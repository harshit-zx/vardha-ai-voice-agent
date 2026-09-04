const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 500 },
    answer: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { _id: false }
);

const knowledgeBaseSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    companyName: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 4000 },
    services: [{ type: String, trim: true, maxlength: 500 }],
    pricing: { type: String, default: "", trim: true, maxlength: 4000 },
    support: { type: String, default: "", trim: true, maxlength: 4000 },
    contact: { type: String, default: "", trim: true, maxlength: 2000 },
    faq: { type: [faqSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KnowledgeBase", knowledgeBaseSchema);
