const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    callSid: {
      type: String,
      default: "",
      index: true,
    },

    status: {
      type: String,
      default: "created",
      enum: [
        "created",
        "queued",
        "ringing",
        "in-progress",
        "answered",
        "completed",
        "failed",
        "busy",
        "no-answer",
        "unknown",
      ],
    },

    direction: {
      type: String,
      default: "outbound",
      enum: ["outbound", "inbound"],
    },

    recordingUrl: {
      type: String,
      default: "",
    },

    transcript: {
      type: String,
      default: "",
    },

    transcriptEntries: {
      type: [
        {
          speaker: { type: String, enum: ["customer", "ai"], required: true },
          text: { type: String, required: true, trim: true },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    summary: {
      type: String,
      default: "",
    },

    summaryData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    processingError: {
      type: String,
      default: "",
    },

    postProcessingCompleted: {
      type: Boolean,
      default: false,
    },

    recordingAvailable: {
      type: Boolean,
      default: false,
    },

    streamSid: {
      type: String,
      default: "",
      index: true,
    },

    streamEndedAt: {
      type: Date,
      default: null,
    },

    duration: {
      type: Number,
      default: null,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    exotelResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    webhookData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

callSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Call", callSchema);
