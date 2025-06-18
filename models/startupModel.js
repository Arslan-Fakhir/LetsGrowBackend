const mongoose = require('mongoose');

const startupSchema = new mongoose.Schema({
    name: {
        required: true,
        type: String,
        trim: true
    },
    description: {
        required: true,
        type: String,
        trim: true
    },
    industry: {
        required: true,
        type: String,
        trim: true
    },
    current_stage: {
        type: String,
        enum: ['Idea Stage', 'MVP', 'Early Traction', 'Growth Stage'],
        default: 'Idea Stage',
        required: true
    },
    funding_required: {
        required: true,
        type: Number,
        min: 0
    },
    funding_received: {
        type: Number,
        default: 0,
        min: 0
    },
    entrepreneur_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'entrepreneur', // Updated to match ERD
        required: true
    },
    investor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'investor',
        required: false // Optional as startup might not have an investor yet
    }
}, { 
    timestamps: true 
});

// Add indexes for better query performance
startupSchema.index({ entrepreneur_id: 1 });
startupSchema.index({ investor_id: 1 });
startupSchema.index({ industry: 1 });
startupSchema.index({ current_stage: 1 });

// Virtual for funding gap
startupSchema.virtual('funding_gap').get(function() {
    return this.funding_required - this.funding_received;
});

// Virtual for funding percentage
startupSchema.virtual('funding_percentage').get(function() {
    if (this.funding_required === 0) return 0;
    return Math.round((this.funding_received / this.funding_required) * 100);
});

// Ensure virtual fields are serialized
startupSchema.set('toJSON', { virtuals: true });
startupSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Startup', startupSchema);