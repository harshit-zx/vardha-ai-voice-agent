const axios = require("axios");

const {
  getTtsConfig,
  validateTtsConfiguration,
} = require("../config/providers");

/**
 * Read a WAV file and return its PCM audio data.
 *
 * Supports:
 * - PCM WAV
 * - mono/stereo
 * - 8/16/24/32-bit PCM
 * - arbitrary WAV chunk ordering
 */
function parseWav(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    throw new Error("Invalid WAV audio");
  }

  if (buffer.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Audio response is not RIFF");
  }

  if (buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Audio response is not WAVE");
  }

  let offset = 12;

  let audioFormat = null;
  let channels = null;
  let sampleRate = null;
  let bitsPerSample = null;
  let data = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    const chunkDataStart = offset + 8;

    /*
     * WAV chunks are padded to an even byte boundary.
     */
    const paddedChunkSize = chunkSize + (chunkSize % 2);
    const nextOffset = chunkDataStart + paddedChunkSize;

    /*
     * Some WAV producers can report a chunk size that extends
     * beyond the actual buffer. Stop safely instead of reading
     * outside the returned audio.
     */
    if (chunkDataStart > buffer.length) {
      break;
    }

    if (chunkId === "fmt ") {
      if (chunkDataStart + 16 > buffer.length) {
        throw new Error("Invalid WAV fmt chunk");
      }

      audioFormat = buffer.readUInt16LE(chunkDataStart);
      channels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
    }

    if (chunkId === "data") {
      const availableBytes = buffer.length - chunkDataStart;

      const safeSize = Math.min(
        chunkSize,
        availableBytes
      );

      data = buffer.subarray(
        chunkDataStart,
        chunkDataStart + safeSize
      );

      break;
    }

    /*
     * If the calculated next offset is invalid,
     * stop scanning rather than throwing.
     */
    if (nextOffset <= offset || nextOffset > buffer.length) {
      break;
    }

    offset = nextOffset;
  }

  if (audioFormat !== 1) {
    throw new Error(
      `Unsupported WAV audio format: ${audioFormat}`
    );
  }

  if (!channels) {
    throw new Error("WAV channel information missing");
  }

  if (!sampleRate) {
    throw new Error("WAV sample rate missing");
  }

  if (!bitsPerSample) {
    throw new Error("WAV bit depth missing");
  }

  if (!data || !data.length) {
    throw new Error("WAV data chunk is missing");
  }

  return {
    pcm: Buffer.from(data),
    channels,
    sampleRate,
    bitsPerSample,
  };
}

/**
 * Convert PCM samples to signed 16-bit PCM.
 */
function convertToPcm16le(buffer, bitsPerSample) {
  if (bitsPerSample === 16) {
    return Buffer.from(buffer);
  }

  if (bitsPerSample === 8) {
    const sampleCount = buffer.length;
    const output = Buffer.alloc(sampleCount * 2);

    for (let i = 0; i < sampleCount; i++) {
      const unsignedSample = buffer.readUInt8(i);
      const signedSample = (unsignedSample - 128) * 256;

      output.writeInt16LE(
        Math.max(-32768, Math.min(32767, signedSample)),
        i * 2
      );
    }

    return output;
  }

  if (bitsPerSample === 24) {
    const sampleCount = Math.floor(buffer.length / 3);
    const output = Buffer.alloc(sampleCount * 2);

    for (let i = 0; i < sampleCount; i++) {
      const b0 = buffer[i * 3];
      const b1 = buffer[i * 3 + 1];
      const b2 = buffer[i * 3 + 2];

      let value = b0 | (b1 << 8) | (b2 << 16);

      if (value & 0x800000) {
        value |= 0xff000000;
      }

      const sample = value >> 8;

      output.writeInt16LE(
        Math.max(-32768, Math.min(32767, sample)),
        i * 2
      );
    }

    return output;
  }

  if (bitsPerSample === 32) {
    const sampleCount = Math.floor(buffer.length / 4);
    const output = Buffer.alloc(sampleCount * 2);

    for (let i = 0; i < sampleCount; i++) {
      const sample = buffer.readInt32LE(i * 4) / 65536;

      output.writeInt16LE(
        Math.max(-32768, Math.min(32767, Math.round(sample))),
        i * 2
      );
    }

    return output;
  }

  throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}`);
}

/**
 * Convert stereo PCM16 to mono PCM16.
 */
function stereoToMonoPcm16le(buffer) {
  const sampleCount = Math.floor(buffer.length / 4);
  const output = Buffer.alloc(sampleCount * 2);

  for (let i = 0; i < sampleCount; i++) {
    const left = buffer.readInt16LE(i * 4);
    const right = buffer.readInt16LE(i * 4 + 2);

    const mono = Math.round((left + right) / 2);

    output.writeInt16LE(
      Math.max(-32768, Math.min(32767, mono)),
      i * 2
    );
  }

  return output;
}

/**
 * Resample mono PCM16 audio.
 */
function resamplePcm16le(input, inputRate, outputRate) {
  if (inputRate === outputRate) {
    return Buffer.from(input);
  }

  if (!Buffer.isBuffer(input) || input.length < 2) {
    return Buffer.alloc(0);
  }

  const inputSamples = Math.floor(input.length / 2);

  const outputSamples = Math.floor(
    (inputSamples * outputRate) / inputRate
  );

  const output = Buffer.alloc(outputSamples * 2);

  for (let index = 0; index < outputSamples; index++) {
    const sourcePosition =
      (index * inputRate) / outputRate;

    const leftIndex = Math.floor(sourcePosition);

    const rightIndex = Math.min(
      leftIndex + 1,
      inputSamples - 1
    );

    const fraction = sourcePosition - leftIndex;

    const left = input.readInt16LE(leftIndex * 2);
    const right = input.readInt16LE(rightIndex * 2);

    const sample = Math.round(
      left + (right - left) * fraction
    );

    output.writeInt16LE(
      Math.max(-32768, Math.min(32767, sample)),
      index * 2
    );
  }

  return output;
}

/**
 * Generate speech using Groq Orpheus.
 *
 * Returns raw mono PCM16LE audio suitable for
 * the voicebot WebSocket pipeline.
 */
async function synthesizeSpeech(
  text,
  { outputSampleRate = 8000 } = {}
) {
  const cleanText = String(text || "").trim();

  if (!cleanText) {
    return Buffer.alloc(0);
  }

  const config = getTtsConfig();

  const configurationError =
    validateTtsConfiguration(config);

  if (configurationError) {
    throw new Error(configurationError);
  }

  const targetRate = Number(outputSampleRate);

  if (
    !Number.isInteger(targetRate) ||
    targetRate < 8000 ||
    targetRate > 48000
  ) {
    throw new Error(
      `Unsupported output sample rate: ${outputSampleRate}`
    );
  }

  /*
   * Orpheus has a small input limit.
   * Keep individual TTS requests short because this
   * service is intended for phone conversation.
   */
  const inputText = cleanText.slice(0, 200);

  const endpoint = `${config.baseUrl}/audio/speech`;

  try {
    const response = await axios.post(
      endpoint,
      {
        model: config.model,
        input: inputText,
        voice: config.voice,
        response_format: "wav",
        sample_rate: targetRate,
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        timeout: 45000,
      }
    );

    const wav = Buffer.from(response.data);

    const parsed = parseWav(wav);

    let pcm16 = convertToPcm16le(
      parsed.pcm,
      parsed.bitsPerSample
    );

    if (parsed.channels === 2) {
      pcm16 = stereoToMonoPcm16le(pcm16);
    } else if (parsed.channels !== 1) {
      throw new Error(
        `Unsupported WAV channel count: ${parsed.channels}`
      );
    }

    pcm16 = resamplePcm16le(
      pcm16,
      parsed.sampleRate,
      targetRate
    );

    if (!pcm16.length || pcm16.length % 2 !== 0) {
      throw new Error(
        "Groq returned invalid PCM audio"
      );
    }

    console.log(
      `[TTS] Generated ${pcm16.length} bytes of PCM16 audio`
    );

    return pcm16;
  } catch (error) {
    console.error(
      "[TTS] Groq Orpheus request failed:",
      error.response?.status || error.message
    );

    if (error.response?.data) {
      try {
        const errorText = Buffer.isBuffer(error.response.data)
          ? error.response.data.toString()
          : JSON.stringify(error.response.data);

        console.error("[TTS] Groq error:", errorText);
      } catch {
        // Ignore error parsing failures.
      }
    }

    throw error;
  }
}

module.exports = {
  parseWav,
  convertToPcm16le,
  stereoToMonoPcm16le,
  resamplePcm16le,
  synthesizeSpeech,
};