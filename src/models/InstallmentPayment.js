const mongoose = require('mongoose');

const installmentPaymentSchema = new mongoose.Schema({
    // Reference to the monthly request
    monthlyRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MonthlyRequest',
        required: true,
        index: true
    },
    
    // Reference to the specific item in the monthly request
    itemIndex: {
        type: Number,
        required: true,
        description: 'Index of the item in the monthly request items array'
    },
    
    // Payment details
    installmentNumber: {
        type: Number,
        required: true,
        min: 1,
        description: 'Which installment this is (1st, 2nd, 3rd, etc.)'
    },
    
    amount: {
        type: Number,
        required: true,
        min: 0,
        description: 'Amount paid in this installment'
    },
    
    paymentDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Bank Transfer', 'Check', 'Other'],
        default: 'Cash'
    },
    
    // Payment status
    status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'cancelled'],
        default: 'pending'
    },
    
    // Reference to created expense (if any)
    expenseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Expense',
        required: false
    },
    
    // Reference to created transaction (if any)
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TransactionEntry',
        required: false
    },
    
    // Tracking fields
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    
    // Metadata for tracking
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Add indexes for common queries
installmentPaymentSchema.index({ monthlyRequestId: 1, itemIndex: 1 });
installmentPaymentSchema.index({ paymentDate: -1 });
installmentPaymentSchema.index({ status: 1 });
installmentPaymentSchema.index({ createdBy: 1 });

// Virtual for checking if this is the final installment
installmentPaymentSchema.virtual('isFinalInstallment').get(function() {
    // This would need to be calculated based on the total amount and remaining balance
    // For now, we'll handle this in the service layer
    return false;
});

// Virtual for getting payment summary
installmentPaymentSchema.virtual('paymentSummary').get(function() {
    return {
        installmentNumber: this.installmentNumber,
        amount: this.amount,
        paymentDate: this.paymentDate,
        status: this.status,
        paymentMethod: this.paymentMethod
    };
});

module.exports = mongoose.model('InstallmentPayment', installmentPaymentSchema);

