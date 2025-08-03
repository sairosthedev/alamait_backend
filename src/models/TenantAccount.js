const mongoose = require('mongoose');

const TenantAccountSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    accountCode: {
        type: String,
        required: true,
        unique: true
    },
    accountName: {
        type: String,
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    totalDebits: {
        type: Number,
        default: 0
    },
    totalCredits: {
        type: Number,
        default: 0
    },
    lastTransactionDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    notes: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save middleware to generate account code
TenantAccountSchema.pre('save', async function(next) {
    if (this.isNew) {
        // Generate unique account code: TEN + 6 digits
        const count = await mongoose.model('TenantAccount').countDocuments();
        this.accountCode = `TEN${String(count + 1).padStart(6, '0')}`;
        this.accountName = `Tenant Account - ${this.accountCode}`;
    }
    this.updatedAt = new Date();
    next();
});

// Index for efficient queries
TenantAccountSchema.index({ tenant: 1 });
TenantAccountSchema.index({ accountCode: 1 });
TenantAccountSchema.index({ status: 1 });

module.exports = mongoose.model('TenantAccount', TenantAccountSchema); 