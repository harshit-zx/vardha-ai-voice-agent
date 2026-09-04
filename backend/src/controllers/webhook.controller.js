const mongoose = require("mongoose");
const Call = require("../models/Call");
const { startPostCallProcessing } = require("../services/post-call.service");

function getValue(body, ...keys) {
  for (const key of keys) {
    if (body && body[key] !== undefined && body[key] !== null && body[key] !== "") return body[key];
  }
  return undefined;
}

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  const map = {
    queued: "queued",
    ringing: "ringing",
    "in progress": "in-progress",
    "in-progress": "in-progress",
    answered: "answered",
    completed: "completed",
    failed: "failed",
    busy: "busy",
    "no answer": "no-answer",
    "no-answer": "no-answer",
  };
  return map[value] || "unknown";
}

function parseNestedValue(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null;
}

async function handleExotelStatusWebhook(req, res) {
  try {
    const body = { ...(req.query || {}), ...(req.body || {}) };
    const stream = parseNestedValue(body.Stream || body.stream) || {};
    const callSid = getValue(body, "CallSid", "callsid", "callSid", "Sid", "sid") || getValue(stream, "CallSid", "callSid");
    const customField = getValue(body, "CustomField", "customfield", "customField");
    const status = getValue(body, "Status", "status") || getValue(stream, "Status", "status");
    const recordingUrl = getValue(body, "RecordingUrl", "recordingurl", "recordingUrl") || getValue(stream, "RecordingUrl", "recordingUrl");
    const dateUpdated = getValue(body, "DateUpdated", "dateupdated", "dateUpdated");
    const duration = parseDuration(
      getValue(body, "Duration", "duration", "CallDuration", "callduration") || getValue(stream, "Duration", "duration")
    );

    if (!callSid && !customField) {
      console.warn("[WEBHOOK] Exotel callback did not contain CallSid or CustomField");
      return res.status(200).json({ success: true, message: "Webhook received without a call identifier." });
    }

    const normalizedStatus = normalizeStatus(status);
    const update = {
      webhookData: { ...body, receivedAt: new Date().toISOString() },
    };
    if (callSid) update.callSid = callSid;
    if (status) update.status = normalizedStatus;
    if (recordingUrl) {
      update.recordingUrl = recordingUrl;
      update.recordingAvailable = true;
    }
    if (duration !== null) update.duration = duration;

    const updatedAt = parseDate(dateUpdated);
    if (["in-progress", "answered"].includes(normalizedStatus) && updatedAt) update.startedAt = updatedAt;
    if (["completed", "failed", "busy", "no-answer"].includes(normalizedStatus)) {
      update.endedAt = updatedAt || new Date();
    }

    const candidates = [];
    if (callSid) candidates.push({ callSid });
    if (mongoose.isValidObjectId(customField)) candidates.push({ _id: customField });
    const lookup = candidates.length === 1 ? candidates[0] : candidates.length > 1 ? { $or: candidates } : null;
    if (!lookup) {
      console.warn("[WEBHOOK] Callback identifier is not associated with a stored call");
      return res.status(200).json({ success: true, message: "Webhook received but no matching call was found." });
    }

    const call = await Call.findOneAndUpdate(lookup, { $set: update }, { new: true });
    if (!call) {
      console.warn(`[WEBHOOK] No MongoDB call found for CallSid: ${callSid || "not provided"}`);
      return res.status(200).json({ success: true, message: "Webhook received but call record was not found." });
    }

    let changed = false;
    if (["in-progress", "answered"].includes(call.status) && !call.startedAt) {
      call.startedAt = updatedAt || new Date();
      changed = true;
    }
    if (call.endedAt && call.startedAt && duration === null && (call.duration === null || call.duration === undefined)) {
      call.duration = Math.max(0, Math.round((call.endedAt.getTime() - call.startedAt.getTime()) / 1000));
      changed = true;
    }
    if (changed) await call.save();

    console.log(`[WEBHOOK] Call updated: ${call._id.toString()} (${call.status})`);
    if (["completed", "failed", "busy", "no-answer"].includes(call.status)) {
      // The stream's stop handler invokes processing immediately after it flushes
      // its queue. This timer also covers calls where Exotel never opens a stream.
      setTimeout(() => {
        Call.findById(call._id).then((latestCall) => {
          if (latestCall?.streamSid && !latestCall.streamEndedAt) return;
          return startPostCallProcessing(call._id);
        }).catch((error) => {
          console.error("[SUMMARY] Background post-call processing failed:", error.message);
        });
      }, Number(process.env.POST_CALL_PROCESSING_DELAY_MS || 1000));
    }

    return res.status(200).json({ success: true, message: "Webhook processed." });
  } catch (error) {
    console.error("[WEBHOOK] Exotel webhook error:", error.message);
    // Exotel webhooks must be acknowledged even for malformed/unexpected input.
    return res.status(200).json({ success: false, message: "Webhook received." });
  }
}

module.exports = { handleExotelStatusWebhook, normalizeStatus };
