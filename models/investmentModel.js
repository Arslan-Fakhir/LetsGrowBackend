const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
    investorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Startup',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    stripeSessionId: {
        type: String,
        required: true,
        unique: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better performance
investmentSchema.index({ investorId: 1 });
investmentSchema.index({ startupId: 1 });
investmentSchema.index({ stripeSessionId: 1 }, { unique: true });
investmentSchema.index({ createdAt: -1 });

// Virtuals for easier population
investmentSchema.virtual('investorDetails', {
    ref: 'User',
    localField: 'investorId',
    foreignField: '_id',
    justOne: true
});

investmentSchema.virtual('startupDetails', {
    ref: 'Startup',
    localField: 'startupId',
    foreignField: '_id',
    justOne: true
});

// Pre-save validation
investmentSchema.pre('save', async function(next) {
    try {
        // Validate references exist
        const [investorExists, startupExists] = await Promise.all([
            mongoose.model('User').exists({ _id: this.investorId }),
            mongoose.model('Startup').exists({ _id: this.startupId })
        ]);
        
        if (!investorExists) throw new Error('Invalid investor reference');
        if (!startupExists) throw new Error('Invalid startup reference');
        
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('Investment', investmentSchema);