require("dotenv").config({ quiet: true });

const http = require("http");
const express = require("express");
const cors = require("cors");
const { connectDB, getDatabaseStatus } = require("./config/db");
const { buildWebSocketUrl } = require("./config/public-url");
const { logProviderConfiguration } = require("./config/providers");
const callRoutes = require("./routes/call.routes");
const webhookRoutes = require("./routes/webhook.routes");
const knowledgeRoutes = require("./routes/knowledge.routes");
const {
  attachVoicebotWebSocketServer,
} = require("./websocket/voicebot.server");

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 5000);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  const database = getDatabaseStatus();

  return res.status(database === "connected" ? 200 : 503).json({
    success: database === "connected",
    service: "vardha-ai-voice-agent",
    database,
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Vardha AI Voice Agent API is running.",
  });
});

// Dynamic WebSocket endpoint for Exotel Voicebot
app.get("/api/voicebot/endpoint", (req, res) => {
  const url = buildWebSocketUrl("/api/voicebot/media");

  if (!url) {
    return res.status(503).json({
      success: false,
      message:
        "PUBLIC_BASE_URL must be set before configuring Exotel streaming.",
    });
  }

  return res.json({ url });
});

app.use("/api/calls", callRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/webhooks", webhookRoutes);

app.use((req, res) =>
  res.status(404).json({
    success: false,
    message: "Route not found.",
  })
);

app.use((error, req, res, next) => {
  console.error("[API] Unhandled error:", error.message);

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode
      ? error.message
      : "Internal server error.",
  });
});

attachVoicebotWebSocketServer(server);

async function startServer() {
  logProviderConfiguration();

  await connectDB();

  await new Promise((resolve) => {
    server.listen(port, "0.0.0.0", resolve);
  });

  console.log(`[API] Server listening on port ${port}`);
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("[API] Server startup aborted:", error.message);
    process.exit(1);
  });
}

module.exports = {
  app,
  server,
  startServer,
};