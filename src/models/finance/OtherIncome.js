const mongoose = require('mongoose');

const otherIncomeSchema = new mongoose.Schema({
    incomeId: {
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
        enum: ['Investment', 'Interest', 'Commission', 'Rental', 'Service', 'Other'],
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
    incomeDate: {
        type: Date,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Received', 'Overdue'],
        default: 'Pending'
    },
    paymentMethod: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'],
        required: function() { return this.paymentStatus === 'Received'; }
    },
    receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    receivedDate: Date,
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
otherIncomeSchema.index({ incomeId: 1 });
otherIncomeSchema.index({ residence: 1 });
otherIncomeSchema.index({ category: 1 });
otherIncomeSchema.index({ paymentStatus: 1 });
otherIncomeSchema.index({ incomeDate: -1 });

module.exports = mongoose.model('OtherIncome', otherIncomeSchema); 