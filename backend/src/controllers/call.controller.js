const Call = require("../models/Call");
const { initiateOutboundCall, extractCallInfo } = require("../services/exotel.service");

function normalizePhoneNumber(phoneNumber) {
  const phone = String(phoneNumber || "").trim().replace(/[\s\-()]/g, "");
  if (/^\d{10}$/.test(phone)) return `+91${phone}`;
  if (/^91\d{10}$/.test(phone)) return `+${phone}`;
  if (/^\+91\d{10}$/.test(phone)) return phone;
  return "";
}

function normalizeExotelStatus(status) {
  const value = String(status || "").toLowerCase().trim();
  const statuses = {
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
  return statuses[value] || "unknown";
}

async function createCall(req, res) {
  try {
    const normalizedPhone = normalizePhoneNumber(req.body?.phoneNumber);
    if (!normalizedPhone || !/^\+91[6-9]\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: "Please provide a valid Indian mobile number." });
    }

    const call = await Call.create({ phoneNumber: normalizedPhone, status: "created", direction: "outbound" });

    try {
      // Object form is required by the Exotel service. CustomField links callbacks to this Call record.
      const exotelResponse = await initiateOutboundCall({ phoneNumber: normalizedPhone, customField: call._id.toString() });
      const { callSid, status } = extractCallInfo(exotelResponse);
      call.callSid = callSid;
      call.status = normalizeExotelStatus(status);
      call.exotelResponse = exotelResponse;
      await call.save();
      console.log(`[CALL] Outbound call accepted: ${call._id} (${call.status})`);
      return res.status(201).json({ success: true, message: "Call request created.", data: call });
    } catch (exotelError) {
      call.status = "failed";
      call.exotelResponse = exotelError.response?.data || { message: exotelError.message };
      await call.save();
      console.error("[CALL] Exotel call failed:", exotelError.response?.status || exotelError.message);
      return res.status(502).json({ success: false, message: "Failed to initiate Exotel call.", data: call });
    }
  } catch (error) {
    console.error("[CALL] Create call error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function getCalls(req, res) {
  try {
    const calls = await Call.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, count: calls.length, data: calls });
  } catch (error) {
    console.error("[CALL] Get calls error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch calls." });
  }
}

async function getCallById(req, res) {
  try {
    const call = await Call.findById(req.params.id).lean();
    if (!call) return res.status(404).json({ success: false, message: "Call not found." });
    return res.json({ success: true, data: call });
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ success: false, message: "Call not found." });
    console.error("[CALL] Get call error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch call." });
  }
}

module.exports = { createCall, getCalls, getCallById, normalizeExotelStatus, normalizePhoneNumber };
