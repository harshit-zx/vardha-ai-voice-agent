const axios = require("axios");

const {
  getSttConfig,
  validateSttConfiguration,
} = require("../config/providers");

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function pcm16ToWav(
  pcm,
  sampleRate = 8000
) {
  const header = Buffer.alloc(44);

  const byteRate = sampleRate * 2;

  header.write("RIFF", 0);
  header.writeUInt32LE(
    36 + pcm.length,
    4
  );

  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);

  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);

  header.writeUInt32LE(
    sampleRate,
    24
  );

  header.writeUInt32LE(
    byteRate,
    28
  );

  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);

  header.write("data", 36);

  header.writeUInt32LE(
    pcm.length,
    40
  );

  return Buffer.concat([
    header,
    pcm,
  ]);
}

function isSupportedPcmSampleRate(
  sampleRate
) {
  return (
    Number.isInteger(sampleRate) &&
    sampleRate >= 8000 &&
    sampleRate <= 48000
  );
}

async function transcribeAudio(
  pcmAudio,
  {
    sampleRate = 8000,
    format = "pcm_s16le",
  } = {}
) {
  if (
    !Buffer.isBuffer(pcmAudio) ||
    pcmAudio.length === 0
  ) {
    return "";
  }

  if (pcmAudio.length % 2 !== 0) {
    console.warn(
      "[STT] Invalid PCM byte length"
    );

    return "";
  }

  if (
    pcmAudio.length >
    MAX_AUDIO_BYTES
  ) {
    throw new Error(
      "STT audio exceeds 25 MB"
    );
  }

  if (format !== "pcm_s16le") {
    throw new Error(
      `Unsupported audio format: ${format}`
    );
  }

  sampleRate = Number(sampleRate);

  if (
    !isSupportedPcmSampleRate(
      sampleRate
    )
  ) {
    throw new Error(
      `Unsupported sample rate: ${sampleRate}`
    );
  }

  const config = getSttConfig();

  const configurationError =
    validateSttConfiguration(config);

  if (configurationError) {
    throw new Error(configurationError);
  }

  const wavAudio =
    pcm16ToWav(
      pcmAudio,
      sampleRate
    );

  const form = new FormData();

  form.append(
    "model",
    config.model
  );

  form.append(
    "response_format",
    "json"
  );

  form.append(
    "temperature",
    "0"
  );

  form.append(
    "file",
    new Blob(
      [wavAudio],
      {
        type: "audio/wav",
      }
    ),
    "caller-utterance.wav"
  );

  try {
    const response =
      await axios.post(
        `${config.baseUrl}/audio/transcriptions`,
        form,
        {
          headers: {
            Authorization:
              `Bearer ${config.apiKey}`,
          },

          timeout: 45000,
        }
      );

    const text =
      String(
        response.data?.text || ""
      ).trim();

    console.log(
      `[STT] Transcription: ${text || "(empty)"}`
    );

    return text;
  } catch (error) {
    console.error(
      "[STT] Groq transcription failed:",
      error.response?.status ||
        error.message
    );

    if (error.response?.data) {
      console.error(
        "[STT] Groq error:",
        JSON.stringify(
          error.response.data
        )
      );
    }

    throw error;
  }
}

module.exports = {
  isSupportedPcmSampleRate,
  pcm16ToWav,
  transcribeAudio,
};