const { getKnowledgeBase, updateKnowledgeBase } = require("../services/knowledge.service");

async function getKnowledge(req, res, next) {
  try {
    const knowledge = await getKnowledgeBase();
    return res.json({ success: true, data: knowledge });
  } catch (error) {
    return next(error);
  }
}

async function putKnowledge(req, res, next) {
  try {
    const knowledge = await updateKnowledgeBase(req.body || {});
    return res.json({ success: true, message: "Knowledge Base updated successfully.", data: knowledge });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getKnowledge,
  putKnowledge,
};
