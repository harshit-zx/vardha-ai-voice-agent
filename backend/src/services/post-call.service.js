const Call = require("../models/Call");
const { formatTranscript } = require("./transcript.service");
const { generateCallSummary } = require("./summary.service");

async function startPostCallProcessing(callId) {
  const call = await Call.findOneAndUpdate(
    {
      _id: callId,
      postProcessingCompleted: { $ne: true },
      processingStatus: { $ne: "processing" },
    },
    { $set: { processingStatus: "processing", processingError: "" } },
    { new: true }
  );

  if (!call) return { started: false };

  try {
    const entries = call.transcriptEntries || [];
    const summary = await generateCallSummary(entries);
    call.transcript = formatTranscript(entries);
    call.summary = summary.text;
    call.summaryData = summary.data;
    call.processingStatus = "completed";
    call.postProcessingCompleted = true;
    await call.save();
    console.log(`[SUMMARY] Post-call processing completed for ${call._id}`);
    return { started: true, call };
  } catch (error) {
    call.processingStatus = "failed";
    call.processingError = "Unable to generate the call summary. The transcript was preserved.";
    call.transcript = formatTranscript(call.transcriptEntries || []);
    await call.save();
    console.error("[SUMMARY] Post-call processing failed:", error.message);
    return { started: true, error };
  }
}

module.exports = {
  startPostCallProcessing,
};
