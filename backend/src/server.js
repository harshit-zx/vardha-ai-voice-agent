require("dotenv").config({ quiet: true });

const http = require("http");
const express = require("express");
const cors = require("cors");

const { connectDB, getDatabaseStatus } = require("./config/db");
const { buildWebSocketUrl } = require("./config/public-url");
const { logProviderConfiguration } = require("./config/providers");

const Call = require("./models/Call");

const callRoutes = require("./routes/call.routes");
const webhookRoutes = require("./routes/webhook.routes");
const knowledgeRoutes = require("./routes/knowledge.routes");

const {
  attachVoicebotWebSocketServer,
} = require("./websocket/voicebot.server");

const app = express();
const server = http.createServer(app);

const port = Number(process.env.PORT || 5000);

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || true,
  })
);

app.use(express.urlencoded({ extended: true }));

app.use(
  express.json({
    limit: "1mb",
  })
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", (req, res) => {
  const database = getDatabaseStatus();

  return res.status(database === "connected" ? 200 : 503).json({
    success: database === "connected",
    service: "vardha-ai-voice-agent",
    database,
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "Vardha AI Voice Agent API is running.",
  });
});

/* =========================================================
   EXOTEL VOICEBOT PASSTHRU
========================================================= */

/**
 * Exotel sends call/stream information to this endpoint
 * after the Voicebot WebSocket session ends.
 *
 * Exotel flow:
 *
 * Call Start
 *    ↓
 * Voicebot
 *    ↓
 * Passthru
 *    ↓
 * 200 OK
 *    ↓
 * Hangup
 *
 * Expected information can include:
 *
 * CallSid
 * Stream[StreamSID]
 * Stream[Status]
 * Stream[Duration]
 * Stream[RecordingUrl]
 * Stream[DisconnectedBy]
 * Stream[Error]
 * Stream[DetailedStatus]
 */
app.get("/api/voicebot/passthru", async (req, res) => {
  try {
    console.log("\n=================================================");
    console.log("[PASSTHRU] Exotel callback received");
    console.log("=================================================");

    console.log("[PASSTHRU] Query:", req.query);

    /* -----------------------------------------------------
       BASIC CALL DATA
    ----------------------------------------------------- */

    const callSid =
      req.query.CallSid ||
      req.query.CallSID ||
      req.query.callSid ||
      "";

    /* -----------------------------------------------------
       STREAM DATA
    ----------------------------------------------------- */

    let streamData = {};

    /*
     * Depending on Exotel's request format, Stream can
     * either be an object-like query structure or a JSON
     * string.
     */

    if (typeof req.query.Stream === "string") {
      try {
        streamData = JSON.parse(req.query.Stream);
      } catch (error) {
        console.warn(
          "[PASSTHRU] Stream parameter is not valid JSON."
        );

        streamData = {};
      }
    } else if (
      req.query.Stream &&
      typeof req.query.Stream === "object"
    ) {
      streamData = req.query.Stream;
    }

    /* -----------------------------------------------------
       EXTRACT STREAM FIELDS
    ----------------------------------------------------- */

    const streamSid =
      req.query["Stream[StreamSID]"] ||
      req.query["Stream[StreamSid]"] ||
      streamData.StreamSID ||
      streamData.StreamSid ||
      "";

    const status =
      req.query["Stream[Status]"] ||
      streamData.Status ||
      "";

    const duration =
      req.query["Stream[Duration]"] ||
      streamData.Duration ||
      "";

    const recordingUrl =
      req.query["Stream[RecordingUrl]"] ||
      streamData.RecordingUrl ||
      "";

    const disconnectedBy =
      req.query["Stream[DisconnectedBy]"] ||
      streamData.DisconnectedBy ||
      "";

    const error =
      req.query["Stream[Error]"] ||
      streamData.Error ||
      "";

    const detailedStatus =
      req.query["Stream[DetailedStatus]"] ||
      streamData.DetailedStatus ||
      "";

    /* -----------------------------------------------------
       LOG PARSED DATA
    ----------------------------------------------------- */

    console.log("[PASSTHRU] Parsed data:");

    console.log({
      callSid,
      streamSid,
      status,
      duration,
      recordingUrl,
      disconnectedBy,
      error,
      detailedStatus,
    });

    /* -----------------------------------------------------
       FIND CALL RECORD
    ----------------------------------------------------- */

    let call = null;

    /*
     * First try CallSid.
     */

    if (callSid) {
      call = await Call.findOne({
        callSid,
      });
    }

    /*
     * If CallSid didn't find anything, try StreamSID.
     */

    if (!call && streamSid) {
      call = await Call.findOne({
        streamSid,
      });
    }

    /* -----------------------------------------------------
       HANDLE MISSING CALL
    ----------------------------------------------------- */

    if (!call) {
      console.warn(
        `[PASSTHRU] No Call record found for CallSid=${callSid}, StreamSID=${streamSid}`
      );

      /*
       * We still return 200 because Exotel needs a valid
       * response to continue the flow.
       */

      return res.status(200).send("OK");
    }

    /* -----------------------------------------------------
       BUILD DATABASE UPDATE
    ----------------------------------------------------- */

    const update = {
      streamEndedAt: new Date(),
    };

    /* -----------------------------------------------------
       STREAM SID
    ----------------------------------------------------- */

    if (streamSid) {
      update.streamSid = streamSid;
    }

    /* -----------------------------------------------------
       RECORDING
    ----------------------------------------------------- */

    if (recordingUrl) {
      update.recordingUrl = recordingUrl;
      update.recordingAvailable = true;
    }

    /* -----------------------------------------------------
       DURATION
    ----------------------------------------------------- */

    if (duration !== "") {
      const numericDuration = Number(duration);

      if (Number.isFinite(numericDuration)) {
        update.duration = numericDuration;
      }
    }

    /* -----------------------------------------------------
       STATUS
    ----------------------------------------------------- */

    if (status) {
      const normalizedStatus = String(status)
        .trim()
        .toLowerCase();

      /*
       * Only use statuses supported by Call.js enum.
       */

      const allowedStatuses = [
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
      ];

      if (allowedStatuses.includes(normalizedStatus)) {
        update.status = normalizedStatus;
      } else {
        /*
         * If Exotel gives us an unknown status, don't
         * break the MongoDB update.
         */
        console.warn(
          `[PASSTHRU] Unknown Exotel status: ${normalizedStatus}`
        );
      }
    }

    /* -----------------------------------------------------
       PROCESSING ERROR
    ----------------------------------------------------- */

    if (error || detailedStatus) {
      update.processingError = String(
        error || detailedStatus
      ).slice(0, 500);
    }

    /* -----------------------------------------------------
       STORE RAW EXOTEL PASSTHRU DATA
    ----------------------------------------------------- */

    update.webhookData = {
      source: "exotel-passthru",

      receivedAt: new Date(),

      callSid,

      stream: {
        streamSid,
        status,
        duration,
        recordingUrl,
        disconnectedBy,
        error,
        detailedStatus,
      },

      rawQuery: req.query,
    };

    /* -----------------------------------------------------
       UPDATE DATABASE
    ----------------------------------------------------- */

    const updatedCall = await Call.findByIdAndUpdate(
      call._id,
      {
        $set: update,
      },
      {
        new: true,
      }
    );

    console.log(
      `[PASSTHRU] Call updated successfully: ${call._id}`
    );

    console.log("[PASSTHRU] Updated call:", {
      id: updatedCall?._id?.toString(),
      callSid: updatedCall?.callSid,
      streamSid: updatedCall?.streamSid,
      status: updatedCall?.status,
      duration: updatedCall?.duration,
      recordingAvailable: updatedCall?.recordingAvailable,
    });

    console.log("=================================================");
    console.log("[PASSTHRU] Returning 200 OK");
    console.log("=================================================\n");

    /*
     * IMPORTANT:
     *
     * Returning 200 tells Exotel that Passthru succeeded.
     * Your Exotel flow will then follow the 200 OK branch.
     */

    return res.status(200).send("OK");
  } catch (error) {
    console.error(
      "[PASSTHRU] Handler failed:",
      error.message
    );

    console.error(error.stack);

    /*
     * During initial testing, return 200 so a database/
     * metadata problem doesn't unnecessarily break the
     * Exotel call flow.
     */

    return res.status(200).send("OK");
  }
});

/* =========================================================
   DYNAMIC WEBSOCKET ENDPOINT
========================================================= */

/**
 * Returns the WebSocket URL that should be configured
 * in the Exotel Voicebot applet.
 */
app.get("/api/voicebot/endpoint", (req, res) => {
  const url = buildWebSocketUrl("/api/voicebot/media");

  if (!url) {
    return res.status(503).json({
      success: false,
      message:
        "PUBLIC_BASE_URL must be set before configuring Exotel streaming.",
    });
  }

  return res.json({
    success: true,
    url,
  });
});

/* =========================================================
   API ROUTES
========================================================= */

app.use("/api/calls", callRoutes);

app.use("/api/knowledge", knowledgeRoutes);

app.use("/api/webhooks", webhookRoutes);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error(
    "[API] Unhandled error:",
    error.message
  );

  console.error(error.stack);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode
      ? error.message
      : "Internal server error.",
  });
});

/* =========================================================
   VOICEBOT WEBSOCKET SERVER
========================================================= */

attachVoicebotWebSocketServer(server);

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
  try {
    logProviderConfiguration();

    await connectDB();

    await new Promise((resolve) => {
      server.listen(
        port,
        "0.0.0.0",
        resolve
      );
    });

    console.log(
      `[API] Server listening on port ${port}`
    );
  } catch (error) {
    console.error(
      "[API] Server startup failed:",
      error.message
    );

    throw error;
  }
}

/* =========================================================
   DIRECT START
========================================================= */

if (require.main === module) {
  startServer().catch((error) => {
    console.error(
      "[API] Server startup aborted:",
      error.message
    );

    process.exit(1);
  });
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  app,
  server,
  startServer,
};