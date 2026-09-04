const mongoose = require("mongoose");

async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing");
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[DB] MongoDB connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error("[DB] MongoDB connection failed:", error.message);
    throw error;
  }
}

function getDatabaseStatus() {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}

module.exports = { connectDB, getDatabaseStatus };
