const { WebSocketServer, WebSocket } = require("ws");
const mongoose = require("mongoose");
const Call = require("../models/Call");
const { getKnowledgeBase, generateGroundedResponse } = require("../services/knowledge.service");
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
  if (!Buffer.isBuffer(buffer) || buffer.length < 2) return 0;
  let squared = 0;
  const samples = Math.floor(buffer.length / 2);
  for (let index = 0; index < samples; index += 1) {
    const value = buffer.readInt16LE(index * 2);
    squared += value * value;
  }
  return Math.sqrt(squared / samples);
}

function pcmDurationMs(buffer, sampleRate = DEFAULT_SAMPLE_RATE) {
  return Math.round(buffer.length / ((sampleRate * 2) / 1000));
}

function audioChunksForExotel(pcm, sampleRate = DEFAULT_SAMPLE_RATE) {
  // Exotel requires raw slin chunks that are at least 3.2 KB and divisible by
  // 320 bytes. 200 ms produces valid chunks at its supported sample rates.
  const requestedChunkBytes = Math.round(sampleRate * 2 * (OUTBOUND_CHUNK_MS / 1000));
  const chunkBytes = Math.max(3200, Math.ceil(requestedChunkBytes / 320) * 320);
  const chunks = [];
  for (let offset = 0; offset < pcm.length; offset += chunkBytes) {
    const chunk = Buffer.from(pcm.subarray(offset, Math.min(offset + chunkBytes, pcm.length)));
    chunks.push(chunk.length < chunkBytes ? Buffer.concat([chunk, Buffer.alloc(chunkBytes - chunk.length)]) : chunk);
  }
  return chunks;
}

function getCallSid(message) {
  return message?.start?.call_sid || message?.start?.callSid || message?.call_sid || message?.callSid || "";
}

function getCustomField(message) {
  const params = message?.start?.custom_parameters || message?.start?.customParameters || {};
  return params.CustomField || params.customField || params.callId || "";
}

function getSampleRate(message) {
  const reported = Number(message?.start?.media_format?.sample_rate || message?.start?.mediaFormat?.sampleRate);
  return [8000, 16000, 24000].includes(reported) ? reported : DEFAULT_SAMPLE_RATE;
}

async function findCallForSession({ callSid, customField }) {
  let call = callSid ? await Call.findOne({ callSid }) : null;
  if (!call && customField && mongoose.isValidObjectId(customField)) call = await Call.findById(customField);
  if (!call) return null;
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
  if (changed) await call.save();
  return call;
}

function safeSend(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(payload));
  return true;
}

function sendClear(session) {
  if (session.streamSid) safeSend(session.socket, { event: "clear", stream_sid: session.streamSid });
}

function sendPcmToExotel(session, pcm) {
  if (!session.streamSid || !pcm.length) return;
  session.playbackActive = true;
  for (const chunk of audioChunksForExotel(pcm, session.sampleRate)) {
    session.outboundSequence += 1;
    safeSend(session.socket, {
      event: "media",
      sequence_number: session.outboundSequence,
      stream_sid: session.streamSid,
      media: { chunk: session.outboundSequence, timestamp: String(Date.now()), payload: chunk.toString("base64") },
    });
  }
  safeSend(session.socket, {
    event: "mark",
    sequence_number: ++session.outboundSequence,
    stream_sid: session.streamSid,
    mark: { name: `tts-${Date.now()}` },
  });
}

async function appendProcessingError(callId, message) {
  if (callId) await Call.findByIdAndUpdate(callId, { $set: { processingError: String(message || "").slice(0, 500) } });
}

async function speak(session, text) {
  if (!text || session.closed) return;
  try {
    const pcm = await synthesizeSpeech(text, { outputSampleRate: session.sampleRate });
    if (!session.closed) sendPcmToExotel(session, pcm);
  } catch (error) {
    console.error("[TTS] Unable to return agent audio:", error.message);
    await appendProcessingError(session.callRecordId, "Text-to-speech failed during the call.");
  }
}

async function processUtterance(session, audio) {
  if (!audio.length) return;
  try {
    const text = await transcribeAudio(audio, {
      sampleRate: session.sampleRate
    });

    console.log("[VOICEBOT] Caller said:", text || "(empty)");
    if (!text) return;
    session.messages.push({ role: "user", content: text });
    await appendTranscriptEntry(session.callRecordId, "customer", text);
    console.log(`[STT] Transcribed caller audio for ${session.callSid || session.streamSid}`);
    const response = await generateGroundedResponse({ question: text, history: session.messages });
    console.log("[VOICEBOT] Agent response:", response);
    session.messages.push({ role: "assistant", content: response });
    await appendTranscriptEntry(session.callRecordId, "ai", response);
    console.log(`[LLM] Grounded response prepared for ${session.callSid || session.streamSid}`);
    await speak(session, response);
  } catch (error) {
    console.error("[WEBSOCKET] Utterance pipeline failed:", error.message);
    await appendProcessingError(session.callRecordId, "Speech processing failed during the call. Existing transcript entries were preserved.");
  }
}

function queueUtterance(session, audio) {
  session.processing = session.processing.catch(() => undefined).then(() => processUtterance(session, audio));
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
  if (!payload || typeof payload !== "string") return;
  let audio;
  try {
    audio = Buffer.from(payload, "base64");
  } catch {
    console.warn("[WEBSOCKET] Ignoring malformed Base64 media payload");
    return;
  }
  if (!audio.length || audio.length % 2 !== 0) return;

  const duration = pcmDurationMs(audio, session.sampleRate);
  const voiced = pcmEnergy(audio) >= Number(process.env.VAD_ENERGY_THRESHOLD || 550);
  if (voiced && session.playbackActive) {
    sendClear(session);
    session.playbackActive = false;
  }
  if (!session.heardSpeech && !voiced) return;
  session.audioBuffers.push(audio);
  session.audioMs += duration;
  if (voiced) {
    session.heardSpeech = true;
    session.speechMs += duration;
    session.silenceMs = 0;
  } else {
    session.silenceMs += duration;
  }

  if (session.heardSpeech && ((session.silenceMs >= END_OF_UTTERANCE_SILENCE_MS && session.speechMs >= MIN_UTTERANCE_MS) || session.audioMs >= MAX_UTTERANCE_MS)) {
    const utterance = Buffer.concat(session.audioBuffers);
    resetAudioBuffer(session);
    queueUtterance(session, utterance);
  }
}

async function initializeSession(session, message) {
  if (session.initialized) return;
  session.initialized = true;
  session.streamSid = message.stream_sid || message.start?.stream_sid || session.streamSid;
  session.callSid = getCallSid(message) || session.callSid;
  session.sampleRate = getSampleRate(message);
  console.log("[WEBSOCKET] Stream configuration:", {
    streamSid: session.streamSid,
    callSid: session.callSid,
    sampleRate: session.sampleRate,
    mediaFormat:
      message?.start?.media_format ||
      message?.start?.mediaFormat ||
      null,
  });
  const call = await findCallForSession({ callSid: session.callSid, customField: getCustomField(message) });
  if (!call) {
    console.warn(`[WEBSOCKET] No Call record found for stream ${session.streamSid || "unknown"}`);
  } else {
    session.callRecordId = call._id.toString();
    if (session.streamSid && call.streamSid !== session.streamSid) {
      await Call.findByIdAndUpdate(call._id, { $set: { streamSid: session.streamSid, streamEndedAt: null } });
    }
  }

  try {
    const knowledge = await getKnowledgeBase();
    const greeting = `Hello, you've reached ${knowledge.companyName}. How can I help you today?`;
    session.messages.push({ role: "assistant", content: greeting });
    if (session.callRecordId) await appendTranscriptEntry(session.callRecordId, "ai", greeting);
    await speak(session, greeting);
  } catch (error) {
    console.error("[WEBSOCKET] Session initialization failed:", error.message);
  }
}

async function finishSession(session, reason) {
  if (session.finished) return;
  session.finished = true;
  if (session.heardSpeech && session.audioBuffers.length && session.speechMs >= MIN_UTTERANCE_MS) queueUtterance(session, Buffer.concat(session.audioBuffers));
  await session.processing.catch(() => undefined);
  if (session.callRecordId) {
    const call = await Call.findByIdAndUpdate(
      session.callRecordId,
      { $set: { endedAt: new Date(), streamSid: session.streamSid || "", streamEndedAt: new Date() } },
      { new: true }
    );
    if (call && ["completed", "failed", "busy", "no-answer"].includes(call.status)) {
      startPostCallProcessing(call._id).catch((error) => {
        console.error("[SUMMARY] Stream-end post-call processing failed:", error.message);
      });
    }
  }
  console.log(`[WEBSOCKET] Stream ended (${reason || "closed"}): ${session.callSid || session.streamSid || "unknown"}`);
}

function attachVoicebotWebSocketServer(httpServer) {
  const websocketServer = new WebSocketServer({ noServer: true });
  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname !== "/api/voicebot/media") {
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, (websocket) => websocketServer.emit("connection", websocket, request));
  });

  websocketServer.on("connection", (socket) => {
    const session = {
      socket, streamSid: "", callSid: "", callRecordId: "", messages: [], audioBuffers: [], audioMs: 0, speechMs: 0, silenceMs: 0,
      sampleRate: DEFAULT_SAMPLE_RATE, initialized: false, heardSpeech: false, playbackActive: false, outboundSequence: 0, processing: Promise.resolve(), closed: false, finished: false,
    };
    console.log("[WEBSOCKET] Exotel Voicebot connected");
    socket.on("message", (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { console.warn("[WEBSOCKET] Ignoring non-JSON Exotel message"); return; }
      if (message.event === "connected") return;
      if (message.event === "start") return initializeSession(session, message).catch((error) => console.error("[WEBSOCKET] Start handler failed:", error.message));
      if (message.event === "media") return handleMedia(session, message);
      if (message.event === "mark") { session.playbackActive = false; return; }
      if (message.event === "dtmf") console.log(`[WEBSOCKET] DTMF received for ${session.callSid || session.streamSid}`);
      if (message.event === "clear") { session.playbackActive = false; return; }
      if (message.event === "stop") return finishSession(session, message.stop?.reason).catch((error) => console.error("[WEBSOCKET] Stop handler failed:", error.message));
    });
    socket.on("error", (error) => console.error("[WEBSOCKET] Socket error:", error.message));
    socket.on("close", () => {
      session.closed = true;
      finishSession(session, "socket closed").catch((error) => console.error("[WEBSOCKET] Close handler failed:", error.message));
    });
  });
  console.log("[WEBSOCKET] Voicebot endpoint attached at /api/voicebot/media");
  return websocketServer;
}

module.exports = { attachVoicebotWebSocketServer, audioChunksForExotel, pcmEnergy };
