const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
    description: { 
        required: true, 
        type: String 
    },
    status: { 
        type: String, 
        enum: ['pending', 'under_review', 'resolved', 'rejected'], 
        default: 'pending',
        required: true 
    },
    investor_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    entrepreneur_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('Dispute', disputeSchema);