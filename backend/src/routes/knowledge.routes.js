const express = require("express");
const { getKnowledge, putKnowledge } = require("../controllers/knowledge.controller");

const router = express.Router();

router.get("/", getKnowledge);
router.put("/", putKnowledge);

module.exports = router;
