const express = require("express");
const router = express.Router();
const Startup = require("../models/startupModel");

// ✅ POST /api/startups/sendForm — Submit a new startup application
router.post("/sendForm", async (req, res) => {
  try {
    const { startupName, description, industry, fundingRequired, stage, entrepreneurId } = req.body;

    if (!startupName || !description || !industry || !fundingRequired || !stage || !entrepreneurId) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newStartup = new Startup({
      startupName,
      description,
      industry,
      fundingRequired,
      stage,
      status: "pending",
      entrepreneurId,
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

// ✅ GET /api/startups — Fetch all startup ideas with entrepreneur info
router.get("/getIdeas", async (req, res) => {
  try {
    const startups = await Startup.find().populate("entrepreneurId", "name email");
    res.status(200).json(startups);
  } catch (error) {
    console.error("Error fetching startups:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// ✅ PUT /api/startups/:id — Update startup status and feedback
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;

    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const updated = await Startup.findByIdAndUpdate(
      id,
      { status, feedback },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Startup not found." });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating startup:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// ✅ DELETE /api/startups/:id — Delete a startup idea
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Startup.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Startup not found." });
    }

    res.status(200).json({ message: "Startup deleted successfully." });
  } catch (error) {
    console.error("Error deleting startup:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
