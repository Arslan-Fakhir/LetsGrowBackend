const express = require("express");
const router = express.Router();
const Manpower = require("../models/manpowerModel");

// POST /api/manpower/sendForm - Submit manpower request
router.post("/sendForm", async (req, res) => {
  try {
    const { position, requirements, count, timeline, employmentType, location } = req.body;

    // Validate required fields
    if (!position || !requirements || !count || !timeline || !employmentType || !location) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newRequest = new Manpower({
      position,
      requirements,
      count,
      timeline,
      employmentType,
      location,
    });

    const savedRequest = await newRequest.save();

    res.status(201).json({
      message: "Manpower request submitted successfully.",
      request: savedRequest,
    });
  } catch (error) {
    console.error("Error saving manpower request:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
