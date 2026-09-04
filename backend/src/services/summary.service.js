const { generateLlmText, isLlmConfigured } = require("./llm.service");
const { SUMMARY_SYSTEM_PROMPT } = require("./prompts/voiceAgent.prompt");

function cleanText(value, limit = 500) {
  return String(value || "").trim().slice(0, limit);
}

function unique(values, limit = 5) {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))].slice(0, limit);
}

function deterministicSummary(entries) {
  const customerEntries = entries.filter((entry) => entry.speaker === "customer").map((entry) => entry.text);
  const aiEntries = entries.filter((entry) => entry.speaker === "ai").map((entry) => entry.text);
  const callerQuestions = unique(customerEntries.filter((text) => /\?$/.test(text) || /^(what|when|where|why|who|how|can|do|is|are|will)\b/i.test(text)));
  const callerStatements = unique(customerEntries.filter((text) => !callerQuestions.includes(text)));

  return {
    discussed: unique([...customerEntries, ...aiEntries], 4),
    callerQuestions,
    callerRequirement: callerStatements[0] || customerEntries[0] || "No caller requirement was captured.",
    importantPoints: unique(aiEntries, 4),
    followUpNeeded: "Not identified from the transcript.",
  };
}

function parseJsonObject(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normaliseSummary(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  return {
    discussed: unique(Array.isArray(data.discussed) ? data.discussed : fallback.discussed),
    callerQuestions: unique(Array.isArray(data.callerQuestions) ? data.callerQuestions : fallback.callerQuestions),
    callerRequirement: cleanText(data.callerRequirement) || fallback.callerRequirement,
    importantPoints: unique(Array.isArray(data.importantPoints) ? data.importantPoints : fallback.importantPoints),
    followUpNeeded: cleanText(data.followUpNeeded) || fallback.followUpNeeded,
  };
}

function summaryIsGrounded(summary, transcript) {
  const supportedWords = new Set(
    String(transcript || "").toLowerCase().match(/[a-z0-9]{2,}/g) || []
  );
  const safeWords = new Set(["caller", "customer", "ai", "agent", "asked", "said", "discussed", "follow", "up", "needed", "not", "identified", "from", "the", "transcript", "no", "was", "were", "is", "are", "and", "or", "a", "an", "of", "to", "in", "with"]);
  const values = [
    ...(summary.discussed || []),
    ...(summary.callerQuestions || []),
    summary.callerRequirement,
    ...(summary.importantPoints || []),
    summary.followUpNeeded,
  ];
  return values.every((value) => (String(value || "").toLowerCase().match(/[a-z0-9]{2,}/g) || [])
    .filter((word) => !safeWords.has(word))
    .every((word) => supportedWords.has(word)));
}

function formatSummary(summary) {
  return [
    `Discussed: ${summary.discussed.join("; ") || "No discussion captured."}`,
    `Caller questions: ${summary.callerQuestions.join("; ") || "None captured."}`,
    `Caller requirement: ${summary.callerRequirement}`,
    `Important points: ${summary.importantPoints.join("; ") || "None captured."}`,
    `Follow-up needed: ${summary.followUpNeeded}`,
  ].join("\n");
}

async function generateCallSummary(transcriptEntries = []) {
  const entries = transcriptEntries
    .filter((entry) => entry?.text && (entry.speaker === "customer" || entry.speaker === "ai"))
    .map((entry) => ({ speaker: entry.speaker, text: cleanText(entry.text, 2000) }));

  if (!entries.length) {
    const empty = {
      discussed: [],
      callerQuestions: [],
      callerRequirement: "No transcript was captured.",
      importantPoints: [],
      followUpNeeded: "Unable to determine because no transcript was captured.",
    };
    return { data: empty, text: formatSummary(empty) };
  }

  const fallback = deterministicSummary(entries);
  let data = fallback;

  if (isLlmConfigured()) {
    try {
      const transcript = entries.map((entry) => `${entry.speaker === "ai" ? "AI" : "Customer"}: ${entry.text}`).join("\n");
      const llmSummary = normaliseSummary(
        parseJsonObject(await generateLlmText({ systemPrompt: SUMMARY_SYSTEM_PROMPT, messages: [{ role: "user", content: transcript }] })),
        fallback
      );
      if (summaryIsGrounded(llmSummary, transcript)) data = llmSummary;
      else console.warn("[SUMMARY] Rejected an LLM summary containing terms outside the transcript");
    } catch (error) {
      console.warn("[SUMMARY] LLM summary failed; storing transcript-only summary");
    }
  }

  return { data, text: formatSummary(data) };
}

module.exports = {
  generateCallSummary,
};
