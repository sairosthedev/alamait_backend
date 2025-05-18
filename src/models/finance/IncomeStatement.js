const mongoose = require('mongoose');

const incomeStatementSchema = new mongoose.Schema({
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    reportId: {
        type: String,
        required: true,
        unique: true
    },
    period: {
        type: String,
        enum: ['Monthly', 'Quarterly', 'Annual', 'Custom'],
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    revenue: [{
        category: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        details: String
    }],
    expenses: [{
        category: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        details: String
    }],
    totalRevenue: {
        type: Number,
        required: true
    },
    totalExpenses: {
        type: Number,
        required: true
    },
    netIncome: {
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
incomeStatementSchema.index({ reportId: 1 });
incomeStatementSchema.index({ residence: 1 });
incomeStatementSchema.index({ period: 1 });
incomeStatementSchema.index({ startDate: -1 });
incomeStatementSchema.index({ endDate: -1 });
incomeStatementSchema.index({ status: 1 });

module.exports = mongoose.model('IncomeStatement', incomeStatementSchema); 