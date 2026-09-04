const express = require("express");

const {
  handleExotelStatusWebhook,
} = require("../controllers/webhook.controller");

const router = express.Router();

router.post(
  "/exotel/status",
  handleExotelStatusWebhook
);

router.get(
  "/exotel/status",
  handleExotelStatusWebhook
);

module.exports = router;
