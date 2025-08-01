const mongoose = require('mongoose');

const enhancedQuotationSchema = new mongoose.Schema({
    // Vendor Information (auto-filled from vendor selection)
    vendor: {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true
        },
        vendorCode: {
            type: String,
            required: true,
            trim: true
        },
        businessName: {
            type: String,
            required: true,
            trim: true
        },
        contactPerson: {
            firstName: { type: String, required: true, trim: true },
            lastName: { type: String, required: true, trim: true },
            email: { type: String, required: true, trim: true },
            phone: { type: String, required: true, trim: true }
        },
        category: {
            type: String,
            required: true,
            trim: true
        }
    },
    
    // Quotation Details
    quotationNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    
    // Financial Information
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'ZAR',
        trim: true
    },
    vatAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Chart of Accounts Integration
    expenseAccountCode: {
        type: String,
        required: true,
        trim: true,
        ref: 'Account'
    },
    vendorAccountCode: {
        type: String,
        required: true,
        trim: true,
        ref: 'Account'
    },
    
    // Payment Information
    paymentTerms: {
        type: Number,
        default: 30, // days
        min: 0
    },
    paymentMethod: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'],
        default: 'Bank Transfer'
    },
    paymentAccountCode: {
        type: String,
        trim: true,
        ref: 'Account'
    },
    
    // Quotation Status
    status: {
        type: String,
        enum: ['draft', 'submitted', 'approved', 'rejected', 'expired'],
        default: 'draft'
    },
    
    // Approval Information
    isApproved: {
        type: Boolean,
        default: false
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    approvedByEmail: {
        type: String,
        trim: true
    },
    
    // Admin Selection (which quotation admin prefers)
    isAdminSelected: {
        type: Boolean,
        default: false
    },
    adminSelectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    adminSelectedAt: {
        type: Date
    },
    
    // Finance Selection (which quotation finance approves)
    isFinanceSelected: {
        type: Boolean,
        default: false
    },
    financeSelectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    financeSelectedAt: {
        type: Date
    },
    
    // Document Management
    documents: [{
        type: { type: String, required: true }, // 'quotation', 'invoice', 'receipt', 'other'
        name: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    
    // Validity
    validFrom: {
        type: Date,
        required: true
    },
    validUntil: {
        type: Date,
        required: true
    },
    
    // Notes and Comments
    notes: {
        type: String,
        trim: true
    },
    adminNotes: {
        type: String,
        trim: true
    },
    financeNotes: {
        type: String,
        trim: true
    },
    
    // Audit Trail
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // History
    history: [{
        action: { type: String, required: true },
        description: { type: String },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
        changes: [{
            field: { type: String },
            oldValue: { type: mongoose.Schema.Types.Mixed },
            newValue: { type: mongoose.Schema.Types.Mixed }
        }]
    }]
}, {
    timestamps: true,
    collection: 'enhanced_quotations'
});

// Indexes for performance
enhancedQuotationSchema.index({ quotationNumber: 1 });
enhancedQuotationSchema.index({ 'vendor.vendorId': 1 });
enhancedQuotationSchema.index({ status: 1 });
enhancedQuotationSchema.index({ isApproved: 1 });
enhancedQuotationSchema.index({ isAdminSelected: 1 });
enhancedQuotationSchema.index({ isFinanceSelected: 1 });
enhancedQuotationSchema.index({ validUntil: 1 });

// Pre-save middleware to generate quotation number if not provided
enhancedQuotationSchema.pre('save', async function(next) {
    if (!this.quotationNumber) {
        this.quotationNumber = await generateQuotationNumber();
    }
    
    // Calculate total amount if not provided
    if (!this.totalAmount) {
        this.totalAmount = this.amount + (this.vatAmount || 0);
    }
    
    next();
});

// Generate unique quotation number
async function generateQuotationNumber() {
    const count = await mongoose.model('EnhancedQuotation').countDocuments();
    const year = new Date().getFullYear().toString().substr(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const sequence = (count + 1).toString().padStart(4, '0');
    return `QT${year}${month}${sequence}`;
}

// Virtual for vendor full name
enhancedQuotationSchema.virtual('vendor.fullName').get(function() {
    return `${this.vendor.contactPerson.firstName} ${this.vendor.contactPerson.lastName}`;
});

// Virtual for business name
enhancedQuotationSchema.virtual('vendor.displayName').get(function() {
    return this.vendor.tradingName || this.vendor.businessName;
});

// Method to check if quotation is expired
enhancedQuotationSchema.methods.isExpired = function() {
    return new Date() > this.validUntil;
};

// Method to check if quotation is valid
enhancedQuotationSchema.methods.isValid = function() {
    const now = new Date();
    return now >= this.validFrom && now <= this.validUntil && this.status !== 'expired';
};

// Method to approve quotation
enhancedQuotationSchema.methods.approve = function(user) {
    this.isApproved = true;
    this.approvedBy = user._id;
    this.approvedAt = new Date();
    this.approvedByEmail = user.email;
    this.status = 'approved';
    
    this.history.push({
        action: 'Quotation approved',
        description: 'Quotation approved by finance',
        user: user._id,
        changes: []
    });
};

// Method to select quotation (admin)
enhancedQuotationSchema.methods.selectByAdmin = function(user) {
    this.isAdminSelected = true;
    this.adminSelectedBy = user._id;
    this.adminSelectedAt = new Date();
    
    this.history.push({
        action: 'Quotation selected by admin',
        description: 'Admin selected this quotation as preferred',
        user: user._id,
        changes: []
    });
};

// Method to select quotation (finance)
enhancedQuotationSchema.methods.selectByFinance = function(user) {
    this.isFinanceSelected = true;
    this.financeSelectedBy = user._id;
    this.financeSelectedAt = new Date();
    
    this.history.push({
        action: 'Quotation selected by finance',
        description: 'Finance selected this quotation for approval',
        user: user._id,
        changes: []
    });
};

// Method to add history entry
enhancedQuotationSchema.methods.addHistory = function(action, description, user, changes = []) {
    this.history.push({
        action,
        description,
        user,
        changes
    });
};

// Static method to find valid quotations
enhancedQuotationSchema.statics.findValid = function() {
    const now = new Date();
    return this.find({
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        status: { $nin: ['expired', 'rejected'] }
    });
};

// Static method to find approved quotations
enhancedQuotationSchema.statics.findApproved = function() {
    return this.find({ isApproved: true });
};

// Static method to find admin selected quotations
enhancedQuotationSchema.statics.findAdminSelected = function() {
    return this.find({ isAdminSelected: true });
};

// Static method to find finance selected quotations
enhancedQuotationSchema.statics.findFinanceSelected = function() {
    return this.find({ isFinanceSelected: true });
};

module.exports = mongoose.model('EnhancedQuotation', enhancedQuotationSchema); 