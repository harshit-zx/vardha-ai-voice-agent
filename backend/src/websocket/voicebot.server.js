const { WebSocketServer, WebSocket } = require("ws");
const mongoose = require("mongoose");

const Call = require("../models/Call");

const {
  getKnowledgeBase,
  generateGroundedResponse,
} = require("../services/knowledge.service");

const { transcribeAudio } = require("../services/stt.service");
const { synthesizeSpeech } = require("../services/tts.service");
const { appendTranscriptEntry } = require("../services/transcript.service");
const { startPostCallProcessing } = require("../services/post-call.service");

const DEFAULT_SAMPLE_RATE = 8000;

const MIN_UTTERANCE_MS = 500;
const END_OF_UTTERANCE_SILENCE_MS = 700;
const MAX_UTTERANCE_MS = 15000;

const OUTBOUND_CHUNK_MS = 200;

function pcmEnergy(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2) {
    return 0;
  }

  let squared = 0;

  const samples = Math.floor(buffer.length / 2);

  for (let index = 0; index < samples; index += 1) {
    const value = buffer.readInt16LE(index * 2);
    squared += value * value;
  }

  return Math.sqrt(squared / samples);
}

function pcmDurationMs(buffer, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    return 0;
  }

  return Math.round(buffer.length / ((sampleRate * 2) / 1000));
}

function audioChunksForExotel(pcm, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!Buffer.isBuffer(pcm) || !pcm.length) {
    return [];
  }

  /*
   * Exotel Voicebot expects:
   *
   * raw signed 16-bit PCM
   * mono
   * little-endian
   *
   * Minimum chunk size = 3.2 KB
   *
   * 8kHz / 16-bit / mono:
   * 8000 * 2 * 0.2 = 3200 bytes
   */

  const requestedChunkBytes = Math.round(
    sampleRate * 2 * (OUTBOUND_CHUNK_MS / 1000),
  );

  const chunkBytes = Math.max(3200, Math.ceil(requestedChunkBytes / 320) * 320);

  const chunks = [];

  for (let offset = 0; offset < pcm.length; offset += chunkBytes) {
    let chunk = Buffer.from(
      pcm.subarray(offset, Math.min(offset + chunkBytes, pcm.length)),
    );

    /*
     * Exotel expects the minimum chunk size.
     *
     * Pad the final chunk with silence.
     */
    if (chunk.length < chunkBytes) {
      chunk = Buffer.concat([chunk, Buffer.alloc(chunkBytes - chunk.length)]);
    }

    chunks.push(chunk);
  }

  return chunks;
}

function getCallSid(message) {
  return (
    message?.start?.call_sid ||
    message?.start?.callSid ||
    message?.call_sid ||
    message?.callSid ||
    ""
  );
}

function getCustomField(message) {
  const params =
    message?.start?.custom_parameters || message?.start?.customParameters || {};

  return params.CustomField || params.customField || params.callId || "";
}

function getSampleRate(message) {
  const reported = Number(
    message?.start?.media_format?.sample_rate ||
      message?.start?.mediaFormat?.sampleRate,
  );

  return [8000, 16000, 24000].includes(reported)
    ? reported
    : DEFAULT_SAMPLE_RATE;
}

async function findCallForSession({ callSid, customField }) {
  let call = callSid ? await Call.findOne({ callSid }) : null;

  if (!call && customField && mongoose.isValidObjectId(customField)) {
    call = await Call.findById(customField);
  }

  if (!call) {
    return null;
  }

  let changed = false;

  if (callSid && !call.callSid) {
    call.callSid = callSid;
    changed = true;
  }

  if (!["completed", "failed", "busy", "no-answer"].includes(call.status)) {
    call.status = "in-progress";
    call.startedAt = call.startedAt || new Date();

    changed = true;
  }

  if (changed) {
    await call.save();
  }

  return call;
}

function safeSend(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("[WEBSOCKET] Cannot send - socket is not OPEN");

    return false;
  }

  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error("[WEBSOCKET] Socket send failed:", error.message);

    return false;
  }
}

function sendClear(session) {
  if (!session.streamSid) {
    return;
  }

  console.log("[VOICEBOT] Sending clear to Exotel");

  safeSend(session.socket, {
    event: "clear",
    stream_sid: session.streamSid,
  });
}

/*
 * Send PCM audio to Exotel.
 *
 * IMPORTANT:
 * Timestamp is stream-relative.
 * It must NOT use Date.now().
 */
function sendPcmToExotel(session, pcm) {
  if (!session.socket || session.socket.readyState !== WebSocket.OPEN) {
    console.warn("[VOICEBOT] Cannot send PCM: WebSocket is not open");

    return false;
  }

  if (!Buffer.isBuffer(pcm) || pcm.length === 0) {
    console.warn("[VOICEBOT] Cannot send PCM: empty/invalid buffer");

    return false;
  }

  /*
   * PCM16 must always contain complete 16-bit samples.
   */
  if (pcm.length % 2 !== 0) {
    console.warn(
      `[VOICEBOT] PCM length is odd: ${pcm.length}. Trimming last byte.`,
    );

    pcm = pcm.subarray(0, pcm.length - 1);
  }

  const chunks = audioChunksForExotel(pcm, session.sampleRate);

  if (!chunks.length) {
    return false;
  }

  session.playbackActive = true;

  /*
   * Reset timestamp for every new TTS response.
   *
   * The timestamp describes the media timeline,
   * not the absolute server clock.
   */
  session.playbackTimestamp = 0;

  if (!Number.isInteger(session.outboundSequence)) {
    session.outboundSequence = 1;
  }

  if (!Number.isInteger(session.outboundChunk)) {
    session.outboundChunk = 1;
  }

  console.log(`[VOICEBOT] Sending ${pcm.length} PCM bytes to Exotel`);

  console.log(
    `[VOICEBOT] Audio duration: ${(pcm.length / 2 / session.sampleRate).toFixed(
      2,
    )} sec`,
  );

  console.log(`[VOICEBOT] Exotel chunks: ${chunks.length}`);

  for (let index = 0; index < chunks.length; index += 1) {
    if (session.socket.readyState !== WebSocket.OPEN) {
      console.warn("[VOICEBOT] WebSocket closed during TTS playback");

      session.playbackActive = false;

      return false;
    }

    const chunk = chunks[index];

    const durationMs = Math.round(
      (chunk.length / 2 / session.sampleRate) * 1000,
    );

    const sequenceNumber = session.outboundSequence++;

    const chunkNumber = session.outboundChunk++;

    const timestamp = session.playbackTimestamp;

    const payload = {
      event: "media",

      sequence_number: sequenceNumber,

      stream_sid: session.streamSid,

      media: {
        chunk: String(chunkNumber),

        timestamp: String(timestamp),

        payload: chunk.toString("base64"),
      },
    };

    const sent = safeSend(session.socket, payload);

    if (!sent) {
      session.playbackActive = false;
      return false;
    }

    console.log(`[VOICEBOT] OUT media #${chunkNumber}:`, {
      sequence: sequenceNumber,
      timestamp,
      bytes: chunk.length,
      durationMs,
    });

    session.playbackTimestamp += durationMs;
  }

  /*
   * Tell Exotel that this TTS segment is complete.
   */
  const markName = `tts-${Date.now()}-${session.outboundChunk}`;

  session.lastMark = markName;

  console.log(`[VOICEBOT] Sending playback mark: ${markName}`);

  safeSend(session.socket, {
    event: "mark",

    sequence_number: session.outboundSequence++,

    stream_sid: session.streamSid,

    mark: {
      name: markName,
    },
  });

  return true;
}

async function appendProcessingError(callId, message) {
  if (!callId) {
    return;
  }

  await Call.findByIdAndUpdate(callId, {
    $set: {
      processingError: String(message || "").slice(0, 500),
    },
  });
}

async function speak(session, text) {
  if (!text || session.closed || session.finished) {
    return;
  }

  try {
    console.log("[TTS] Generating speech:", text);

    const pcm = await synthesizeSpeech(text, {
      outputSampleRate: session.sampleRate,
    });

    if (!Buffer.isBuffer(pcm) || !pcm.length) {
      throw new Error("TTS returned empty PCM audio");
    }

    console.log("[TTS] PCM ready:", {
      bytes: pcm.length,
      sampleRate: session.sampleRate,
      channels: 1,
      bitsPerSample: 16,
      durationSeconds: (pcm.length / 2 / session.sampleRate).toFixed(2),
    });

    if (!session.closed) {
      sendPcmToExotel(session, pcm);
    }
  } catch (error) {
    console.error("[TTS] Unable to return agent audio:", error.message);

    await appendProcessingError(
      session.callRecordId,
      "Text-to-speech failed during the call.",
    );
  }
}

async function processUtterance(session, audio) {
  if (!Buffer.isBuffer(audio) || !audio.length) {
    return;
  }

  try {
    const text = await transcribeAudio(audio, {
      sampleRate: session.sampleRate,
    });

    console.log("[VOICEBOT] Caller said:", text || "(empty)");

    if (!text) {
      return;
    }

    session.messages.push({
      role: "user",
      content: text,
    });

    await appendTranscriptEntry(session.callRecordId, "customer", text);

    console.log(
      `[STT] Transcribed caller audio for ${
        session.callSid || session.streamSid
      }`,
    );

    const response = await generateGroundedResponse({
      question: text,
      history: session.messages,
    });

    console.log("[VOICEBOT] Agent response:", response);

    session.messages.push({
      role: "assistant",
      content: response,
    });

    await appendTranscriptEntry(session.callRecordId, "ai", response);

    console.log(
      `[LLM] Grounded response prepared for ${
        session.callSid || session.streamSid
      }`,
    );

    await speak(session, response);
  } catch (error) {
    console.error("[WEBSOCKET] Utterance pipeline failed:", error.message);

    await appendProcessingError(
      session.callRecordId,
      "Speech processing failed during the call. Existing transcript entries were preserved.",
    );
  }
}

function queueUtterance(session, audio) {
  session.processing = session.processing
    .catch(() => undefined)
    .then(() => processUtterance(session, audio));
}

function resetAudioBuffer(session) {
  session.audioBuffers = [];
  session.audioMs = 0;
  session.speechMs = 0;
  session.silenceMs = 0;
  session.heardSpeech = false;
}

function handleMedia(session, message) {
  const payload = message?.media?.payload;

  if (!payload || typeof payload !== "string") {
    return;
  }

  let audio;

  try {
    audio = Buffer.from(payload, "base64");
  } catch {
    console.warn("[WEBSOCKET] Ignoring malformed Base64 media payload");

    return;
  }

  if (!audio.length || audio.length % 2 !== 0) {
    return;
  }

  const duration = pcmDurationMs(audio, session.sampleRate);

  const threshold = Number(process.env.VAD_ENERGY_THRESHOLD || 550);

  const voiced = pcmEnergy(audio) >= threshold;

  /*
   * Caller started speaking while AI audio
   * was playing.
   *
   * Stop current Exotel playback.
   */
  if (voiced && session.playbackActive) {
    console.log("[VOICEBOT] Caller interrupted AI playback");

    sendClear(session);

    session.playbackActive = false;
  }

  /*
   * Ignore pure silence before caller speech.
   */
  if (!session.heardSpeech && !voiced) {
    return;
  }

  session.audioBuffers.push(audio);

  session.audioMs += duration;

  if (voiced) {
    session.heardSpeech = true;

    session.speechMs += duration;

    session.silenceMs = 0;
  } else {
    session.silenceMs += duration;
  }

  const utteranceComplete =
    session.heardSpeech &&
    session.speechMs >= MIN_UTTERANCE_MS &&
    (session.silenceMs >= END_OF_UTTERANCE_SILENCE_MS ||
      session.audioMs >= MAX_UTTERANCE_MS);

  if (utteranceComplete) {
    const utterance = Buffer.concat(session.audioBuffers);

    resetAudioBuffer(session);

    queueUtterance(session, utterance);
  }
}

async function initializeSession(session, message) {
  if (session.initialized) {
    return;
  }

  session.initialized = true;

  session.streamSid =
    message.stream_sid || message.start?.stream_sid || session.streamSid || "";

  session.callSid = getCallSid(message) || session.callSid || "";

  session.sampleRate = getSampleRate(message);

  /*
   * Reset outbound state.
   */
  session.outboundSequence = 1;
  session.outboundChunk = 1;
  session.playbackTimestamp = 0;
  session.playbackActive = false;
  session.lastMark = null;

  console.log("[WEBSOCKET] Stream configuration:", {
    streamSid: session.streamSid,

    callSid: session.callSid,

    sampleRate: session.sampleRate,

    mediaFormat:
      message?.start?.media_format || message?.start?.mediaFormat || null,
  });

  console.log("[WEBSOCKET] Outbound audio state:", {
    outboundSequence: session.outboundSequence,

    outboundChunk: session.outboundChunk,

    playbackTimestamp: session.playbackTimestamp,
  });

  const call = await findCallForSession({
    callSid: session.callSid,

    customField: getCustomField(message),
  });

  if (!call) {
    console.warn(
      `[WEBSOCKET] No Call record found for stream ${
        session.streamSid || "unknown"
      }`,
    );
  } else {
    session.callRecordId = call._id.toString();

    if (session.streamSid && call.streamSid !== session.streamSid) {
      await Call.findByIdAndUpdate(call._id, {
        $set: {
          streamSid: session.streamSid,

          streamEndedAt: null,
        },
      });
    }

    console.log("[WEBSOCKET] Call record linked:", {
      callId: session.callRecordId,

      callSid: session.callSid,

      streamSid: session.streamSid,
    });
  }

  try {
    const knowledge = await getKnowledgeBase();

    const companyName = knowledge?.companyName || "Vardha AI";

    const greeting = `Hello, you've reached ${companyName}. How can I help you today?`;

    console.log("[VOICEBOT] Greeting:", greeting);

    session.messages.push({
      role: "assistant",
      content: greeting,
    });

    if (session.callRecordId) {
      await appendTranscriptEntry(session.callRecordId, "ai", greeting);
    }

    await speak(session, greeting);

    console.log("[WEBSOCKET] Greeting TTS sent successfully");
  } catch (error) {
    console.error("[WEBSOCKET] Session initialization failed:", error.message);

    await appendProcessingError(
      session.callRecordId,
      `Session initialization failed: ${error.message}`,
    );
  }
}

async function finishSession(session, reason) {
  if (session.finished) {
    return;
  }

  session.finished = true;

  /*
   * Process any remaining caller audio.
   *
   * IMPORTANT:
   * use audioBuffers, not audioBuffer.
   */
  if (
    session.heardSpeech &&
    session.audioBuffers.length &&
    session.speechMs >= MIN_UTTERANCE_MS
  ) {
    queueUtterance(session, Buffer.concat(session.audioBuffers));
  }

  /*
   * Wait for STT -> LLM -> TTS processing.
   */
  await session.processing.catch(() => undefined);

  if (session.callRecordId) {
    try {
      const call = await Call.findByIdAndUpdate(
        session.callRecordId,
        {
          $set: {
            status: "completed",

            endedAt: new Date(),

            streamSid: session.streamSid || "",

            streamEndedAt: new Date(),
          },
        },
        {
          new: true,
        },
      );

      if (call) {
        console.log("[WEBSOCKET] Call completed:", {
          id: call._id.toString(),

          callSid: call.callSid,

          streamSid: call.streamSid,

          status: call.status,
        });

        /*
         * Start post-call processing only
         * after the stream has ended.
         */
        if (
          ["completed", "failed", "busy", "no-answer"].includes(call.status)
        ) {
          startPostCallProcessing(call._id).catch((error) =>
            console.error("[POST-CALL] Processing failed:", error.message),
          );
        }
      }
    } catch (error) {
      console.error(
        "[WEBSOCKET] Failed to update completed call:",
        error.message,
      );
    }
  }

  console.log(
    `[WEBSOCKET] Stream ended (${reason || "closed"}): ${
      session.callSid || session.streamSid || "unknown"
    }`,
  );
}

function attachVoicebotWebSocketServer(httpServer) {
  const websocketServer = new WebSocketServer({
    noServer: true,
  });

  httpServer.on("upgrade", (request, socket, head) => {
    let pathname;

    try {
      pathname = new URL(request.url, "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (pathname !== "/api/voicebot/media") {
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit("connection", websocket, request);
    });
  });

  websocketServer.on("connection", (socket) => {
    /*
     * IMPORTANT:
     * audioBuffers is the same property used by
     * handleMedia(), resetAudioBuffer(), and
     * finishSession().
     */
    const session = {
      socket,

      streamSid: "",
      callSid: "",
      callRecordId: "",

      sampleRate: DEFAULT_SAMPLE_RATE,

      initialized: false,
      finished: false,
      closed: false,

      playbackActive: false,

      playbackTimestamp: 0,

      outboundSequence: 1,

      outboundChunk: 1,

      lastMark: null,

      audioBuffers: [],

      audioMs: 0,

      speechMs: 0,

      silenceMs: 0,

      heardSpeech: false,

      processing: Promise.resolve(),

      messages: [],
    };

    console.log("[WEBSOCKET] Exotel Voicebot connected");

    socket.on("message", (raw) => {
      let message;

      try {
        message = JSON.parse(raw.toString());
      } catch {
        console.warn("[WEBSOCKET] Ignoring non-JSON Exotel message");

        return;
      }

      switch (message.event) {
        case "connected": {
          console.log("[WEBSOCKET] Exotel connected event received");

          break;
        }

        case "start": {
          initializeSession(session, message).catch((error) =>
            console.error("[WEBSOCKET] Start handler failed:", error.message),
          );

          break;
        }

        case "media": {
          handleMedia(session, message);

          break;
        }

        case "mark": {
          const markName = message.mark?.name || "";

          session.lastMark = markName;

          session.playbackActive = false;

          console.log("[WEBSOCKET] Exotel playback mark received:", markName);

          break;
        }

        case "dtmf": {
          console.log(
            `[WEBSOCKET] DTMF received for ${
              session.callSid || session.streamSid
            }`,
          );

          break;
        }

        case "clear": {
          console.log("[WEBSOCKET] Exotel clear event received");

          session.playbackActive = false;

          break;
        }

        case "stop": {
          console.log("[WEBSOCKET] Exotel stop event received:", message.stop);

          finishSession(session, message.stop?.reason).catch((error) =>
            console.error("[WEBSOCKET] Stop handler failed:", error.message),
          );

          break;
        }

        default: {
          console.log("[WEBSOCKET] Unhandled Exotel event:", message.event);
        }
      }
    });

    socket.on("error", (error) => {
      console.error("[WEBSOCKET] Socket error:", error.message);
    });

    socket.on("close", () => {
      session.closed = true;

      console.log("[WEBSOCKET] WebSocket connection closed");

      finishSession(session, "socket closed").catch((error) =>
        console.error("[WEBSOCKET] Close handler failed:", error.message),
      );
    });
  });

  console.log("[WEBSOCKET] Voicebot endpoint attached at /api/voicebot/media");

  return websocketServer;
}

module.exports = {
  attachVoicebotWebSocketServer,
  audioChunksForExotel,
  pcmEnergy,
};
