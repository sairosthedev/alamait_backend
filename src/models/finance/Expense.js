const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    expenseId: {
        type: String,
        required: true,
        unique: true
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    category: {
        type: String,
        enum: ['Maintenance', 'Utilities', 'Taxes', 'Insurance', 'Salaries', 'Supplies', 'Other'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    expenseDate: {
        type: Date,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Overdue'],
        default: 'Pending'
    },
    period: {
        type: String,
        enum: ['weekly', 'monthly'],
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'],
        required: function() { return this.paymentStatus === 'Paid'; }
    },
    paymentIcon: {
        type: String,
        required: false
    },
    maintenanceRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Maintenance',
        required: false
    },
    monthlyRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MonthlyRequest',
        required: false
    },
    itemIndex: {
        type: Number,
        required: false
    },
    quotationId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    paidDate: Date,
    receiptImage: {
        fileUrl: String,
        fileName: String,
        uploadDate: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Add indexes for common queries
expenseSchema.index({ expenseId: 1 });
expenseSchema.index({ residence: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ paymentStatus: 1 });
expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ period: 1 });

module.exports = mongoose.model('Expense', expenseSchema); 