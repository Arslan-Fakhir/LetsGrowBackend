const mongoose = require("mongoose");

const startupSchema = new mongoose.Schema({
  startupName: { type: String, required: true },
  description: { type: String, required: true },
  industry: { type: String, required: true },
  fundingRequired: { type: Number, required: true },
  stage: { type: String, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  feedback: { type: String, default: "" },
  entrepreneurId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // ✅ fixed here
}, { timestamps: true });

module.exports = mongoose.model("Startup", startupSchema);
