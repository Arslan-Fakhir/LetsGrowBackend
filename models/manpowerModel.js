const mongoose = require('mongoose');

const manpowerSchema = new mongoose.Schema({
    position: { 
        required: true, 
        type: String 
    },
    requirements: { 
        required: true, 
        type: String 
    },
    count: { 
        required: true, 
        type: Number,
        min: 1
    },
    timeline: { 
        required: true, 
        type: String 
    },
    employmentType: { 
        type: String, 
        enum: ['full-time', 'part-time', 'contract', 'internship'], 
        default: 'full-time',
        required: true 
    },
    location: { 
        type: String, 
        enum: ['on-site', 'remote', 'hybrid'], 
        default: 'on-site',
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'in-progress', 'fulfilled', 'cancelled'], 
        default: 'pending',
        required: true 
    },
    startup_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Startup', 
        required: true 
    },
    entrepreneur_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('Manpower', manpowerSchema);