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
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal', 'Petty Cash']
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
        required: false // Changed from true to false since some expenses come from maintenance requests
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
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal', 'Petty Cash'],
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
    approvedByEmail: String,
    
    // Vendor information for items with quotations
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: false
    },
    vendorCode: {
        type: String,
        required: false
    },
    vendorName: {
        type: String,
        required: false
    },
    vendorType: {
        type: String,
        required: false
    },
    vendorSpecificAccount: {
        type: String,
        required: false
    },
    
    // Item and quotation tracking
    itemIndex: {
        type: Number,
        required: false
    },
    quotationId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    },
    
    // Expense account for items without quotations
    expenseAccountCode: {
        type: String,
        required: false
    },
    
    // Notes and additional information
    notes: {
        type: String,
        trim: true
    },
    
    // Payment reference for tracking
    paymentReference: {
        type: String,
        trim: true
    },
    
    // Monthly Request Deduction Fields
    linkedMonthlyRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MonthlyRequest',
        required: false
    },
    linkedMonthlyRequestItemIndex: {
        type: Number,
        required: false
    },
    linkedMonthlyRequestWeek: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

// Add indexes for common queries
expenseSchema.index({ expenseId: 1 });
expenseSchema.index({ requestId: 1 });
expenseSchema.index({ monthlyRequestId: 1 });
expenseSchema.index({ residence: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ paymentStatus: 1 });
expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ period: 1 });
expenseSchema.index({ transactionId: 1 });
expenseSchema.index({ vendorId: 1 });
expenseSchema.index({ vendorCode: 1 });
expenseSchema.index({ itemIndex: 1 });
expenseSchema.index({ quotationId: 1 });

// Optimize: Compound index for cash flow queries (expenseDate + paymentStatus + residence)
expenseSchema.index({ expenseDate: 1, paymentStatus: 1, residence: 1 });

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