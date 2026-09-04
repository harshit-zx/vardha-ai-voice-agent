const KnowledgeBase = require("../models/KnowledgeBase");
const { generateLlmText, isLlmConfigured } = require("./llm.service");
const { VOICE_AGENT_SYSTEM_PROMPT } = require("./prompts/voiceAgent.prompt");

const DEFAULT_KNOWLEDGE = {
  companyName: "Vardha AI (Demo Knowledge Base)",
  description: "This is editable demonstration content for an AI voice-agent project. Replace it with verified company information before making production calls.",
  services: ["AI Voice Agents", "Knowledge-base-grounded phone conversations"],
  pricing: "Pricing information has not been added to this demo knowledge base.",
  support: "Support details have not been added to this demo knowledge base.",
  contact: "Contact details have not been added to this demo knowledge base.",
  faq: [
    {
      question: "What services do you provide?",
      answer: "The demo knowledge base lists AI Voice Agents and knowledge-base-grounded phone conversations.",
    },
  ],
};

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "can", "do", "for", "from", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "please", "the", "to", "what", "which", "with", "would", "you", "your",
]);

function toCleanString(value, maxLength = 4000) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toCleanString(item, 500)).filter(Boolean).slice(0, 50);
}

function sanitizeKnowledgePayload(payload = {}) {
  const companyName = toCleanString(payload.companyName, 200);
  if (!companyName) {
    const error = new Error("companyName is required");
    error.statusCode = 400;
    throw error;
  }

  const faq = Array.isArray(payload.faq)
    ? payload.faq
        .map((item) => ({ question: toCleanString(item?.question, 500), answer: toCleanString(item?.answer, 4000) }))
        .filter((item) => item.question && item.answer)
        .slice(0, 100)
    : [];

  return {
    companyName,
    description: toCleanString(payload.description),
    services: cleanStringList(payload.services),
    pricing: toCleanString(payload.pricing),
    support: toCleanString(payload.support),
    contact: toCleanString(payload.contact, 2000),
    faq,
  };
}

async function getKnowledgeBase() {
  let knowledge = await KnowledgeBase.findOne({ key: "default" });
  if (knowledge) return knowledge;

  try {
    knowledge = await KnowledgeBase.create({ key: "default", ...DEFAULT_KNOWLEDGE });
    console.log("[KB] Created editable demo knowledge base");
    return knowledge;
  } catch (error) {
    if (error?.code === 11000) return KnowledgeBase.findOne({ key: "default" });
    throw error;
  }
}

async function updateKnowledgeBase(payload) {
  const values = sanitizeKnowledgePayload(payload);
  const knowledge = await KnowledgeBase.findOneAndUpdate(
    { key: "default" },
    { $set: values, $setOnInsert: { key: "default" } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log("[KB] Knowledge base updated");
  return knowledge;
}

function tokens(text) {
  return [...new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((word) => (word.endsWith("s") && word.length > 3 ? word.slice(0, -1) : word))
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
  )];
}

function buildCandidates(knowledge) {
  return [
    { type: "company", title: "Company name", content: knowledge.companyName },
    { type: "description", title: "Description", content: knowledge.description },
    { type: "services", title: "Services", content: (knowledge.services || []).join("; ") },
    { type: "pricing", title: "Pricing", content: knowledge.pricing },
    { type: "support", title: "Support", content: knowledge.support },
    { type: "contact", title: "Contact", content: knowledge.contact },
    ...(knowledge.faq || []).map((item) => ({
      type: "faq",
      title: item.question,
      content: item.answer,
      question: item.question,
      answer: item.answer,
    })),
  ].filter((item) => item.content);
}

function searchKnowledgeDocument(knowledge, question) {
  const questionTokens = tokens(question);
  if (!questionTokens.length) return [];

  return buildCandidates(knowledge)
    .map((candidate) => {
      const candidateTokens = new Set(tokens(`${candidate.title} ${candidate.content}`));
      const matchingTokens = questionTokens.filter((word) => candidateTokens.has(word));
      return { ...candidate, score: matchingTokens.length / questionTokens.length, matches: matchingTokens.length };
    })
    .filter((candidate) => candidate.matches > 0 && candidate.score >= 0.25)
    .sort((left, right) => right.score - left.score || right.matches - left.matches)
    .slice(0, 4);
}

async function searchKnowledgeBase(question) {
  const knowledge = await getKnowledgeBase();
  return searchKnowledgeDocument(knowledge, question);
}

function isPoliteConversation(question) {
  return /^(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you|bye|goodbye)[!.\s]*$/i.test(String(question || "").trim());
}

function politeResponse(question) {
  if (/thank/i.test(question)) return "You're welcome. Is there anything else I can help with?";
  if (/bye|goodbye/i.test(question)) return "Goodbye, and thank you for calling.";
  return "Hello. How can I help you with information from our knowledge base?";
}

function directGroundedAnswer(knowledge, candidate) {
  if (candidate.type === "faq") return candidate.answer;
  if (candidate.type === "services") return `${knowledge.companyName} provides: ${candidate.content}.`;
  return candidate.content;
}

function isGroundedLlmOutput(text, context) {
  const safeWords = new Set(["i", "m", "sorry", "don", "t", "have", "that", "information", "in", "my", "knowledge", "base", "please", "could", "you", "tell", "me", "about", "the", "and", "is", "are", "we", "our", "it", "a", "an", "of", "for", "to", "with", "can", "help", "company", "provide", "provides", "offer", "offers"]);
  const contextTokens = new Set(tokens(context));
  const outputTokens = tokens(text).filter((word) => !safeWords.has(word));
  if (!outputTokens.length) return true;
  const supported = outputTokens.filter((word) => contextTokens.has(word)).length;
  // Any informational word that is not present in the retrieved context is rejected.
  return supported === outputTokens.length;
}

async function answerQuestionForKnowledge({ knowledge, question, history = [] }) {
  const cleanQuestion = toCleanString(question, 2000);
  if (!cleanQuestion) return "Could you please repeat that?";
  if (isPoliteConversation(cleanQuestion)) return politeResponse(cleanQuestion);

  const matches = searchKnowledgeDocument(knowledge, cleanQuestion);
  if (!matches.length) return "I'm sorry, I don't have that information in my knowledge base.";

  const context = matches.map((item) => `${item.title}: ${item.content}`).join("\n");
  if (!isLlmConfigured()) return directGroundedAnswer(knowledge, matches[0]);

  try {
    const recentHistory = history.slice(-6).map((message) => ({ role: message.role, content: message.content }));
    const answer = await generateLlmText({
      systemPrompt: VOICE_AGENT_SYSTEM_PROMPT,
      messages: [
        ...recentHistory,
        { role: "user", content: `Knowledge Base context:\n${context}\n\nCaller question: ${cleanQuestion}` },
      ],
    });

    if (isGroundedLlmOutput(answer, context)) return answer;
    console.warn("[KB] Rejected LLM response that was not sufficiently grounded");
  } catch (error) {
    console.warn("[KB] Falling back to deterministic grounded response");
  }

  return directGroundedAnswer(knowledge, matches[0]);
}

async function generateGroundedResponse({ question, history = [] }) {
  const knowledge = await getKnowledgeBase();
  return answerQuestionForKnowledge({ knowledge, question, history });
}

module.exports = {
  DEFAULT_KNOWLEDGE,
  answerQuestionForKnowledge,
  generateGroundedResponse,
  getKnowledgeBase,
  sanitizeKnowledgePayload,
  searchKnowledgeBase,
  searchKnowledgeDocument,
  updateKnowledgeBase,
};
