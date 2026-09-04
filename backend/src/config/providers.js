const SUPPORTED_PROVIDERS = {
  llm: "gemini",
  stt: "groq",
  tts: "groq",
};

function value(name, fallback = "") {
  const configured = String(process.env[name] || "").trim();
  return configured || fallback;
}

function withoutTrailingSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function getLlmConfig() {
  return {
    provider: value("LLM_PROVIDER", SUPPORTED_PROVIDERS.llm).toLowerCase(),
    apiKey: value("LLM_API_KEY"),
    baseUrl: withoutTrailingSlash(
      value(
        "LLM_BASE_URL",
        "https://generativelanguage.googleapis.com/v1beta"
      )
    ),
    model: value("LLM_MODEL", "gemini-3.6-flash"),
  };
}

function getSttConfig() {
  return {
    provider: value("STT_PROVIDER", SUPPORTED_PROVIDERS.stt).toLowerCase(),
    apiKey: value("STT_API_KEY"),
    baseUrl: withoutTrailingSlash(
      value("STT_BASE_URL", "https://api.groq.com/openai/v1")
    ),
    model: value("STT_MODEL", "whisper-large-v3-turbo"),
  };
}

function getTtsConfig() {
  return {
    provider: value("TTS_PROVIDER", SUPPORTED_PROVIDERS.tts).toLowerCase(),
    apiKey: value("TTS_API_KEY") || value("STT_API_KEY"),
    baseUrl: withoutTrailingSlash(
      value("TTS_BASE_URL", "https://api.groq.com/openai/v1")
    ),
    model: value("TTS_MODEL", "canopylabs/orpheus-v1-english"),
    voice: value("TTS_VOICE", "austin"),
    outputFormat: value("TTS_OUTPUT_FORMAT", "wav").toLowerCase(),
  };
}

function validateLlmConfiguration(config = getLlmConfig()) {
  if (config.provider !== SUPPORTED_PROVIDERS.llm) {
    return `LLM_PROVIDER must be ${SUPPORTED_PROVIDERS.llm}`;
  }

  if (!config.apiKey) {
    return "LLM_PROVIDER=gemini requires LLM_API_KEY";
  }

  if (!config.baseUrl) {
    return "LLM_BASE_URL is required";
  }

  if (!config.model) {
    return "LLM_MODEL is required";
  }

  return "";
}

function validateSttConfiguration(config = getSttConfig()) {
  if (config.provider !== SUPPORTED_PROVIDERS.stt) {
    return `STT_PROVIDER must be ${SUPPORTED_PROVIDERS.stt}`;
  }

  if (!config.apiKey) {
    return "STT_PROVIDER=groq requires STT_API_KEY";
  }

  if (!config.baseUrl) {
    return "STT_BASE_URL is required";
  }

  if (!config.model) {
    return "STT_MODEL is required";
  }

  return "";
}

function validateTtsConfiguration(config = getTtsConfig()) {
  if (config.provider !== SUPPORTED_PROVIDERS.tts) {
    return `TTS_PROVIDER must be ${SUPPORTED_PROVIDERS.tts}`;
  }

  if (!config.apiKey) {
    return "TTS_PROVIDER=groq requires TTS_API_KEY or STT_API_KEY";
  }

  if (!config.baseUrl) {
    return "TTS_BASE_URL is required";
  }

  if (!config.model) {
    return "TTS_MODEL is required";
  }

  const allowedVoices = [
    "autumn",
    "diana",
    "hannah",
    "austin",
    "daniel",
    "troy",
  ];

  if (!allowedVoices.includes(config.voice)) {
    return `TTS_VOICE must be one of: ${allowedVoices.join(", ")}`;
  }

  if (config.outputFormat !== "wav") {
    return "TTS_OUTPUT_FORMAT must be wav for Groq Orpheus";
  }

  return "";
}

function getProviderValidation() {
  const llm = getLlmConfig();
  const stt = getSttConfig();
  const tts = getTtsConfig();

  return [
    {
      label: "LLM",
      configured: llm,
      error: validateLlmConfiguration(llm),
    },
    {
      label: "STT",
      configured: stt,
      error: validateSttConfiguration(stt),
    },
    {
      label: "TTS",
      configured: tts,
      error: validateTtsConfiguration(tts),
    },
  ];
}

function logProviderConfiguration() {
  for (const entry of getProviderValidation()) {
    if (entry.error) {
      console.error(`[${entry.label}] ${entry.error}`);
      continue;
    }

    const providerName =
      entry.configured.provider === "groq"
        ? "Groq"
        : entry.configured.provider[0].toUpperCase() +
          entry.configured.provider.slice(1);

    console.log(
      `[${entry.label}] ${providerName} configured (model: ${entry.configured.model})`
    );
  }
}

module.exports = {
  getLlmConfig,
  getProviderValidation,
  getSttConfig,
  getTtsConfig,
  logProviderConfiguration,
  validateLlmConfiguration,
  validateSttConfiguration,
  validateTtsConfiguration,
};