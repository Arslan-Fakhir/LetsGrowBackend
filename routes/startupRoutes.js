const express = require("express");
const router = express.Router();
const Startup = require("../models/startupModel");
const checkAuth = require('../middlewares/checkAuthToken');

// ✅ POST /api/startups/sendForm — Submit a new startup application
router.post("/sendForm", checkAuth, async (req, res) => {
  try {
    const { startupName, description, industry, fundingRequired, stage } = req.body;

    if (!startupName || !description || !industry || !fundingRequired || !stage) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newStartup = new Startup({
      startupName,
      description,
      industry,
      fundingRequired: Number(fundingRequired), // Ensure it's stored as number
      stage,
      status: "pending",
      entrepreneurId: req.userId, // This will be the ObjectId from your image
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

// ✅ GET /api/startups — Fetch all startup ideas with entrepreneur info for Admin
router.get("/getIdeas", async (req, res) => {
  try {
    const startups = await Startup.find().populate("entrepreneurId", "name email");
    res.status(200).json(startups);
  } catch (error) {
    console.error("Error fetching startups:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});
// ✅ GET /api/startups — Fetch all approved startup ideas with entrepreneur info for Investor
router.get("/startups", async (req, res) => {
  try {
    const startups = await Startup.find({ status: "approved" }) // This filters for approved
      .populate("entrepreneurId", "name email")
      .select("-__v");
    res.status(200).json(startups);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

// Update the GET /:id endpoint to properly populate entrepreneur data
router.get("/:id", async (req, res) => {
  try {
    const startup = await Startup.findById(req.params.id)
      .populate({
        path: 'entrepreneurId',
        select: 'name email role' // Include all fields you need
      })
      .lean(); // Convert to plain JavaScript object

    if (!startup) {
      return res.status(404).json({ message: "Startup not found" });
    }

    // Transform the data to match frontend expectations
    const response = {
      ...startup,
      entrepreneurId: {
        _id: startup.entrepreneurId._id,
        name: startup.entrepreneurId.name,
        email: startup.entrepreneurId.email,
        role: startup.entrepreneurId.role
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching startup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
module.exports = router;
