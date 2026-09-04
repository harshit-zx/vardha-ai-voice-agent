const express = require("express");

const {
  createCall,
  getCalls,
  getCallById,
} = require("../controllers/call.controller");

const router = express.Router();

// Create outbound call
router.post("/", createCall);

// Get all calls
router.get("/", getCalls);

// Get one call
router.get("/:id", getCallById);

module.exports = router;