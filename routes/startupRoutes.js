// routes/startupRoutes.js
const express = require("express");
const router = express.Router();
const Startup = require("../models/startupModel");

// POST /api/startups - Submit startup application
router.post("/sendForm", async (req, res) => {
  try {
    const { startupName, description, industry, fundingRequired, stage } = req.body;

    // Validate all required fields
    if (!startupName || !description || !industry || !fundingRequired || !stage) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newStartup = new Startup({
      startupName,
      description,
      industry,
      fundingRequired,
      stage,
    });

    const savedStartup = await newStartup.save();

    res.status(201).json({
      message: "Startup application submitted successfully.",
      startup: savedStartup,
    });
  } catch (error) {
    console.error("Error saving startup:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
