const axios = require("axios");

const {
  getLlmConfig,
  validateLlmConfiguration,
} = require("../config/providers");

const {
  VOICE_AGENT_SYSTEM_PROMPT,
} = require("./prompts/voiceAgent.prompt");

function messageContentToText(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        return part?.text || "";
      })
      .join("\n")
      .trim();
  }

  return String(content?.text || "").trim();
}

function toGeminiContents(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => {
      const text = messageContentToText(message?.content);

      if (!text) return null;

      return {
        role:
          message?.role === "assistant" ||
          message?.role === "model"
            ? "model"
            : "user",

        parts: [
          {
            text,
          },
        ],
      };
    })
    .filter(Boolean);
}

function isLlmConfigured() {
  return !validateLlmConfiguration(getLlmConfig());
}

async function generateLlmText({
  systemPrompt = VOICE_AGENT_SYSTEM_PROMPT,
  messages = [],
}) {
  const config = getLlmConfig();

  const configurationError =
    validateLlmConfiguration(config);

  if (configurationError) {
    throw new Error(configurationError);
  }

  const contents = toGeminiContents(messages);

  if (!contents.length) {
    throw new Error(
      "Gemini requires at least one non-empty message"
    );
  }

  const endpoint =
    `${config.baseUrl}/models/` +
    `${encodeURIComponent(config.model)}` +
    `:generateContent`;

  try {
    const response = await axios.post(
      endpoint,
      {
        systemInstruction: {
          parts: [
            {
              text: String(
                systemPrompt ||
                VOICE_AGENT_SYSTEM_PROMPT
              ).trim(),
            },
          ],
        },

        contents,

        generationConfig: {
          temperature: 0,
          topP: 0.1,
          maxOutputTokens: 500,
        },
      },
      {
        headers: {
          "x-goog-api-key": config.apiKey,
          "Content-Type": "application/json",
        },

        timeout: 30000,
      }
    );

    const text =
      response.data
        ?.candidates?.[0]
        ?.content?.parts
        ?.map((part) => part?.text || "")
        .join("")
        .trim();

    if (!text) {
      throw new Error(
        "Gemini returned no text response"
      );
    }

    return text;
  } catch (error) {
    console.error(
      "[LLM] Gemini request failed:",
      error.response?.status ||
        error.message
    );

    if (error.response?.data) {
      console.error(
        "[LLM] Gemini error:",
        JSON.stringify(
          error.response.data
        )
      );
    }

    throw error;
  }
}

module.exports = {
  generateLlmText,
  isLlmConfigured,
  toGeminiContents,
};