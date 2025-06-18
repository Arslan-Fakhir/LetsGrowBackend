const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    details: { 
        required: true, 
        type: String 
    },
    date: { 
        type: Date, 
        default: Date.now,
        required: true 
    },
    attribute: { 
        type: String,
        required: true
    },
    startup_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Startup', 
        required: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);