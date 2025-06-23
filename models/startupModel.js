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
    // Add this to the schema fields:
    fundingReceived: {
      type: Number,
      min: 0,
      default: 0
    },
    stage: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    feedback: {
      type: String,
      default: "",
    },
    entrepreneurId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // ✅ Cloudinary image structure (replaces imageUrl)
    startupImage: {
      public_id: {
        type: String,
        default: "default-profile",
      },
      url: {
        type: String,
        default:
          "https://res.cloudinary.com/your-cloud-name/image/upload/v1621234567/default-profile.png",
      },
    },
    // 🆕 New fields
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null, // Optional (can be set later)
    },
    teamSize: {
      type: Number,
      min: 1,
      default: 1, // At least 1 member (the entrepreneur)
    },
    revenue: {
      type: Number,
      min: 0,
      default: 0, // Revenue can be 0 for pre-revenue startups
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Startup", startupSchema);
