// models/startupModel.js
const mongoose = require("mongoose");

const startupSchema = new mongoose.Schema(
  {
    startupName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    industry: {
      type: String,
      required: true,
    },
    fundingRequired: {
      type: Number,
      required: true,
    },
    stage: {
      type: String,
      enum: ["idea", "mvp", "early", "growth"],
      default: "idea",
    },
  },
  { timestamps: true }
);

const Startup = mongoose.model("Startup", startupSchema);

module.exports = Startup;
