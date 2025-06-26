const express = require("express");
const router = express.Router();
const { cloudinary, startupStorage } = require('../config/cloudinaryConfig');
const multer = require('multer');
const upload = multer({ 
  storage: startupStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
const Startup = require("../models/startupModel");
const User = require("../models/userModel");
const checkAuth = require('../middlewares/checkAuthToken');

router.post("/sendForm", checkAuth, upload.single('startupImage'), async (req, res) => {
  try {
    // First check if user profile is complete
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check for required profile fields
    const missingFields = [];
    if (!user.cnic) missingFields.push("CNIC");
    if (!user.contactNumber) missingFields.push("contact number");
    if (!user.location?.city && !user.location?.country) missingFields.push("location (city or country)");

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: "Profile incomplete",
        errors: missingFields.map(field => `${field} is required in your profile`),
        redirectToProfile: true
      });
    }

    // Proceed with form submission if profile is complete
    const { startupName, description, industry, fundingRequired, stage } = req.body;

    if (!startupName || !description || !industry || !fundingRequired || !stage) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const startupData = {
      startupName,
      description,
      industry,
      fundingRequired: Number(fundingRequired),
      stage,
      status: "pending",
      entrepreneurId: req.userId,
    };

    // If an image was uploaded, add it to the startup data
    if (req.file) {
      startupData.startupImage = {
        public_id: req.file.filename,
        url: req.file.path
      };
    }

    const newStartup = new Startup(startupData);
    const savedStartup = await newStartup.save();

    res.status(201).json({
      message: "Startup application submitted successfully.",
      startup: savedStartup,
    });
  } catch (error) {
    console.error("Error saving startup:", error.message);
    
    // If there was an error and an image was uploaded, delete it from Cloudinary
    if (req.file && req.file.filename) {
      await cloudinary.uploader.destroy(req.file.filename);
    }

    res.status(500).json({ message: "Internal server error." });
  }
});

// GET /api/startups — Fetch all startup ideas with entrepreneur info for Admin
router.get("/getIdeas", async (req, res) => {
  try {
    const startups = await Startup.find().populate("entrepreneurId", "name email");
    res.status(200).json(startups);
  } catch (error) {
    console.error("Error fetching startups:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// GET /api/startups — Fetch all startup ideas with entrepreneur info 
router.get("/entrepreneur/:myId", async (req, res) => {
  try {
    const { myId } = req.params;
    const startups = await Startup.find({entrepreneurId:myId}).populate("entrepreneurId", "name email");
    res.status(200).json(startups);
  } catch (error) {
    console.error("Error fetching startups:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// GET /api/startups — Fetch all approved startup ideas with entrepreneur info for Investor
router.get("/startups", async (req, res) => {
  try {
    const startups = await Startup.find({ status: "approved" })
      .populate("entrepreneurId", "name email")
      .select("-__v");
    res.status(200).json(startups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// update startup ideas for entrepreneurs
router.put('/:id', upload.single('startupImage'), async (req, res) => {
  try {
    const startup = await Startup.findById(req.params.id);
    console.log("startup id: ",startup)
    if (!startup) {
      return res.status(404).json({ success: false, message: 'Startup not found' });
    }

    // Update basic fields
    const updatableFields = ['startupName', 'description', 'industry', 'fundingRequired', 'stage'];
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        startup[field] = req.body[field];
      }
    });

    // Handle image upload if present
    if (req.file) {
      // Delete old image if it exists and isn't the default
      if (startup.startupImage.public_id && startup.startupImage.public_id !== 'default-profile') {
        await cloudinary.uploader.destroy(startup.startupImage.public_id);
      }

      // Update with new image
      startup.startupImage = {
        public_id: req.file.filename,
        url: req.file.path
      };
    }

    const updatedStartup = await startup.save();
    
    res.status(200).json({
      success: true,
      message: 'Startup updated successfully',
      startup: updatedStartup
    });

  } catch (error) {
    console.error('Error updating startup:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update startup'
    });
  }
});
// update the status or startup for admin   
router.patch('/status/:id', async (req, res) => {
  try {
    const { status, feedback } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const startup = await Startup.findById(req.params.id);
    if (!startup) {
      return res.status(404).json({ success: false, message: 'Startup not found' });
    }

    startup.status = status;
    startup.feedback = feedback || startup.feedback;
    
    const updatedStartup = await startup.save();
    
    res.status(200).json({
      success: true,
      message: 'Startup status updated successfully',
      startup: updatedStartup
    });

  } catch (error) {
    console.error('Error updating startup:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update startup'
    });
  }
});
/*// PUT /api/startups/:id — Update startup status and feedback
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
});*/

// Update the DELETE route in startupRoutes.js
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // First verify the user owns this startup
    const startup = await Startup.findById(id);
    
    if (!startup) {
      return res.status(404).json({ message: "Startup not found." });
    }

    // If there's an image, delete it from Cloudinary
    if (startup.startupImage?.public_id && startup.startupImage.public_id !== "default-profile") {
      await cloudinary.uploader.destroy(startup.startupImage.public_id);
    }

    await Startup.findByIdAndDelete(id);
    res.status(200).json({ message: "Startup deleted successfully." });
  } catch (error) {
    console.error("Error deleting startup:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// GET /api/startups/:id — Get specific startup details
router.get("/:id", async (req, res) => {
  try {
    const startup = await Startup.findById(req.params.id)
      .populate({
        path: 'entrepreneurId',
        select: 'name email contactNumber location.city location.country'
      })
      .lean();

    if (!startup) {
      return res.status(404).json({ message: "Startup not found" });
    }

    // Format location string
    const locationParts = [];
    if (startup.entrepreneurId?.location?.city) {
      locationParts.push(startup.entrepreneurId.location.city);
    }
    if (startup.entrepreneurId?.location?.country) {
      locationParts.push(startup.entrepreneurId.location.country);
    }
    const locationString = locationParts.join(', ') || 'N/A';

    const response = {
      ...startup,
      entrepreneurId: {
        _id: startup.entrepreneurId._id,
        name: startup.entrepreneurId.name,
        email: startup.entrepreneurId.email,
        contactNumber: startup.entrepreneurId.contactNumber || "N/A",
        location: locationString
      },
      image: {
        url: startup.image?.url || null,
        public_id: startup.image?.public_id || null
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching startup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;






























// POST /api/startups/sendForm — Submit a new startup application
/*router.post("/sendForm", checkAuth, async (req, res) => {
  try {
    const { startupName, description, industry, fundingRequired, stage } = req.body;

    if (!startupName || !description || !industry || !fundingRequired || !stage) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newStartup = new Startup({
      startupName,
      description,
      industry,
      fundingRequired: Number(fundingRequired),
      stage,
      status: "pending",
      entrepreneurId: req.userId,
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
});*/