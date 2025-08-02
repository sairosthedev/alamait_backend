const mongoose = require('mongoose');

// Itemized expense schema for individual items
const expenseItemSchema = new mongoose.Schema({
    itemIndex: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    unitCost: {
        type: Number,
        required: true,
        min: 0
    },
    totalCost: {
        type: Number,
        required: true,
        min: 0
    },
    purpose: {
        type: String,
        trim: true
    },
    // Selected quotation information
    selectedQuotation: {
        provider: String,
        amount: Number,
        vendorId: mongoose.Schema.Types.ObjectId,
        vendorCode: String,
        vendorName: String,
        vendorType: String,
        expenseCategory: String,
        paymentMethod: String,
        hasBankDetails: Boolean,
        selectedBy: mongoose.Schema.Types.ObjectId,
        selectedByEmail: String,
        selectedAt: Date
    },
    // Payment tracking
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Overdue'],
        default: 'Pending'
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    paidDate: Date,
    paymentMethod: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal']
    },
    receiptImage: {
        fileUrl: String,
        fileName: String,
        uploadDate: Date
    }
});

const expenseSchema = new mongoose.Schema({
    expenseId: {
        type: String,
        required: true,
        unique: true
    },
    // Link to original request
    requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Request',
        required: true
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
    // Itemized expenses
    items: [expenseItemSchema],
    // Legacy field for backward compatibility
    maintenanceRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Maintenance',
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
    },
    // Financial tracking
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    // Approval tracking
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    approvedByEmail: String
}, {
    timestamps: true
});

// Add indexes for common queries
expenseSchema.index({ expenseId: 1 });
expenseSchema.index({ requestId: 1 });
expenseSchema.index({ residence: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ paymentStatus: 1 });
expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ period: 1 });
expenseSchema.index({ transactionId: 1 });

// Virtual for total amount from items
expenseSchema.virtual('totalFromItems').get(function() {
    if (this.items && this.items.length > 0) {
        return this.items.reduce((total, item) => total + item.totalCost, 0);
    }
    return this.amount;
});

// Method to check if all items are paid
expenseSchema.methods.allItemsPaid = function() {
    if (!this.items || this.items.length === 0) {
        return this.paymentStatus === 'Paid';
    }
    return this.items.every(item => item.paymentStatus === 'Paid');
};

// Method to get unpaid items
expenseSchema.methods.getUnpaidItems = function() {
    if (!this.items || this.items.length === 0) {
        return this.paymentStatus !== 'Paid' ? [this] : [];
    }
    return this.items.filter(item => item.paymentStatus !== 'Paid');
};

// Method to get total unpaid amount
expenseSchema.methods.getUnpaidAmount = function() {
    if (!this.items || this.items.length === 0) {
        return this.paymentStatus !== 'Paid' ? this.amount : 0;
    }
    return this.items
        .filter(item => item.paymentStatus !== 'Paid')
        .reduce((total, item) => total + item.totalCost, 0);
};

module.exports = mongoose.model('Expense', expenseSchema); 