const test = require("node:test");
const assert = require("node:assert/strict");
const { answerQuestionForKnowledge } = require("../src/services/knowledge.service");

const knowledge = {
  companyName: "Vardha AI",
  description: "",
  services: ["AI Voice Agents"],
  pricing: "",
  support: "",
  contact: "",
  faq: [],
};

test("does not invent an office address when the KB has none", async () => {
  const response = await answerQuestionForKnowledge({ knowledge, question: "What is your office address?" });
  assert.match(response, /don't have that information in my knowledge base/i);
  assert.doesNotMatch(response, /\d{1,5}\s+.+(road|street|mumbai|delhi|address)/i);
});

test("returns a service that is present in the KB", async () => {
  const response = await answerQuestionForKnowledge({ knowledge, question: "What services do you provide?" });
  assert.match(response, /AI Voice Agents/i);
});
