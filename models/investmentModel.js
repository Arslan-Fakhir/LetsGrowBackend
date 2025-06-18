const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
    amount: { 
        required: true, 
        type: Number,
        min: 0
    },
    date: { 
        type: Date, 
        default: Date.now,
        required: true 
    },
    investment_id: { 
        type: String,
        required: true,
        unique: true
    },
    startup_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Startup', 
        required: true 
    },
    investor_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('Investment', investmentSchema);