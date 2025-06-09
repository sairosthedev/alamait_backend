const mongoose = require('mongoose');

const balanceSheetSchema = new mongoose.Schema({
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    asOf: {
        type: Date,
        required: true
    },
    assets: [{
        category: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        value: {
            type: Number,
            required: true
        },
        description: String
    }],
    liabilities: [{
        category: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        value: {
            type: Number,
            required: true
        },
        description: String
    }],
    equity: [{
        category: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        value: {
            type: Number,
            required: true
        },
        description: String
    }],
    totalAssets: {
        type: Number,
        required: true
    },
    totalLiabilities: {
        type: Number,
        required: true
    },
    totalEquity: {
        type: Number,
        required: true
    },
    netWorth: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Draft', 'Published', 'Archived'],
        default: 'Draft'
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedDate: Date,
    notes: String
}, {
    timestamps: true
});

// Add indexes for common queries
balanceSheetSchema.index({ residence: 1 });
balanceSheetSchema.index({ asOf: -1 });
balanceSheetSchema.index({ status: 1 });

module.exports = mongoose.model('BalanceSheet', balanceSheetSchema); 