const mongoose = require('mongoose');

const otherExpenseSchema = new mongoose.Schema({
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
        enum: ['Office Supplies', 'Marketing', 'Legal', 'Consulting', 'Travel', 'Entertainment', 'Miscellaneous', 'Other'],
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
    paymentMethod: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'],
        required: function() { return this.paymentStatus === 'Paid'; }
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
otherExpenseSchema.index({ expenseId: 1 });
otherExpenseSchema.index({ residence: 1 });
otherExpenseSchema.index({ category: 1 });
otherExpenseSchema.index({ paymentStatus: 1 });
otherExpenseSchema.index({ expenseDate: -1 });

module.exports = mongoose.model('OtherExpense', otherExpenseSchema); 