// models/manpowerModel.js
const mongoose = require("mongoose");

const manpowerSchema = new mongoose.Schema(
  {
    position: { type: String, required: true },
    requirements: { type: String, required: true },
    count: { type: Number, required: true },
    timeline: { type: String, required: true },
    employmentType: { type: String, required: true },
    location: { type: String, required: true },
  },
  { timestamps: true }
);

const Manpower = mongoose.model("Manpower", manpowerSchema);

module.exports = Manpower;
