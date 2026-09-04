const Call = require("../models/Call");

function formatTranscript(entries = []) {
  return entries
    .filter((entry) => entry?.text)
    .map((entry) => `${entry.speaker === "ai" ? "AI" : "Customer"}: ${entry.text}`)
    .join("\n");
}

async function appendTranscriptEntry(callId, speaker, text) {
  const cleanText = String(text || "").trim();
  if (!callId || !cleanText) return null;

  // $push keeps transcript entries safe when the final media event and a webhook
  // arrive close together. The rendered transcript is rebuilt once more by
  // post-call processing, so it can never discard stored entries.
  const call = await Call.findByIdAndUpdate(
    callId,
    { $push: { transcriptEntries: { speaker, text: cleanText, at: new Date() } } },
    { new: true }
  );
  if (!call) return null;

  call.transcript = formatTranscript(call.transcriptEntries);
  await call.save();
  return call;
}

module.exports = {
  appendTranscriptEntry,
  formatTranscript,
};
