const mongoose = require('mongoose');

const financialReportSchema = new mongoose.Schema({
    reportId: {
        type: String,
        required: true,
        unique: true
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    reportType: {
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
    totalIncome: {
        type: Number,
        required: true
    },
    totalExpenses: {
        type: Number,
        required: true
    },
    netProfit: {
        type: Number,
        required: true
    },
    summary: {
        type: String
    },
    incomeBreakdown: [{
        category: String,
        amount: Number,
        percentage: Number
    }],
    expenseBreakdown: [{
        category: String,
        amount: Number,
        percentage: Number
    }],
    occupancyRate: {
        type: Number
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
    approvedDate: Date
}, {
    timestamps: true
});

// Add indexes for common queries
financialReportSchema.index({ reportId: 1 });
financialReportSchema.index({ residence: 1 });
financialReportSchema.index({ reportType: 1 });
financialReportSchema.index({ startDate: -1 });
financialReportSchema.index({ endDate: -1 });
financialReportSchema.index({ status: 1 });

module.exports = mongoose.model('FinancialReport', financialReportSchema); 