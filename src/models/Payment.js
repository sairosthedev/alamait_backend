const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const paymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true
    },
    // 🆕 NEW FIELD: User ID for direct debtor mapping
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,                    // ← Made optional for new allocation system
        index: true                        // ← Indexed for performance
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false                    // ← Made optional for new allocation system
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: false                    // ← Made optional for new allocation system
    },
    room: {
        type: String,
        default: 'Not Assigned'
    },
    roomType: {
        type: String,
        default: ''
    },
    rentAmount: {
        type: Number,
        default: 0
    },
    adminFee: {
        type: Number,
        default: 0
    },
    deposit: {
        type: Number,
        default: 0
    },
    amount: {
        type: Number,
        default: 0
    },
    payments: [{
        type: {
            type: String,
            enum: ['rent', 'admin', 'deposit'],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    totalAmount: {
        type: Number,
        required: false                    // ← Made optional for new allocation system
    },
    paymentMonth: {
        type: String, // Format: "YYYY-MM"
        required: false                    // ← Made optional for new allocation system
    },
    date: {
        type: Date,
        required: false                    // ← Made optional for new allocation system
    },
    method: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks'],
        required: false                    // ← Made optional for new allocation system
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Failed', 'Verified', 'Rejected', 'Clarification Requested'],
        default: 'Confirmed'
    },
    applicationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'waitlisted', 'expired'],
        default: 'pending'
    },
    description: String,
    proofOfPayment: {
        fileUrl: String,
        fileName: String,
        uploadDate: Date,
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        verificationDate: Date,
        verificationNotes: String
    },
    // 🆕 NEW: Store Smart FIFO allocation results
    allocation: {
        type: mongoose.Schema.Types.Mixed,
        default: null
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
    clarificationRequests: [{
        message: {
            type: String,
            required: true
        },
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        requestDate: {
            type: Date,
            default: Date.now
        },
        response: {
            message: String,
            respondedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            responseDate: Date
        }
    }]
}, {
    timestamps: true
});

// Add virtual fields
paymentSchema.virtual('calculatedAmount').get(function() {
    return (this.rentAmount || 0) + (this.adminFee || 0) + (this.deposit || 0);
});

// Pre-save middleware to automatically set amount
paymentSchema.pre('save', function(next) {
    if (this.isModified('rentAmount') || this.isModified('adminFee') || this.isModified('deposit')) {
        this.amount = (this.rentAmount || 0) + (this.adminFee || 0) + (this.deposit || 0);
    }
    next();
});

// Add indexes for common queries
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ student: 1 });
paymentSchema.index({ user: 1 });         // ← NEW: Index for user field
paymentSchema.index({ residence: 1 });
paymentSchema.index({ date: -1 });

// 🚨 DUPLICATE PREVENTION INDEX
// Compound index to prevent duplicate payments within a time window
paymentSchema.index({
    student: 1, 
    totalAmount: 1, 
    paymentMonth: 1, 
    method: 1,
    createdAt: 1
}, { 
    expireAfterSeconds: 300 // 5 minutes
});

// 🆕 NEW: Compound index for user-based queries
paymentSchema.index({
    user: 1,
    date: -1
});

// 🆕 NEW: Compound index for user + residence queries
paymentSchema.index({
    user: 1,
    residence: 1,
    date: -1
});

// Add pagination plugin
paymentSchema.plugin(mongoosePaginate);

// 🆕 NEW: Pre-save middleware to ensure user field is always set
paymentSchema.pre('save', function(next) {
    // If user field is not set, try to set it from student field
    if (!this.user && this.student) {
        this.user = this.student;
    }
    
    // User field is now optional for the new allocation system
    next();
});

// 🆕 NEW: Virtual for easy debtor lookup
paymentSchema.virtual('debtor', {
    ref: 'Debtor',
    localField: 'user',
    foreignField: 'user',
    justOne: true
});

// 🆕 NEW: Method to get debtor information
paymentSchema.methods.getDebtor = async function() {
    const Debtor = require('./Debtor');
    return await Debtor.findOne({ user: this.user });
};

// 🆕 NEW: Method to validate payment mapping
paymentSchema.methods.validateMapping = async function() {
    const Debtor = require('./Debtor');
    const debtor = await Debtor.findOne({ user: this.user });
    
    if (!debtor) {
        throw new Error(`No debtor found for user ID: ${this.user}`);
    }
    
    return {
        isValid: true,
        debtor: debtor,
        debtorCode: debtor.debtorCode,
        roomNumber: debtor.roomNumber,
        residence: debtor.residence
    };
};

// Ensure double-entry transaction exists after save
paymentSchema.post('save', async function(doc) {
    try {
        const TransactionEntry = require('../models/TransactionEntry');
        const DoubleEntryAccountingService = require('../services/doubleEntryAccountingService');

        // If an entry already exists for this payment, do nothing
        const existing = await TransactionEntry.findOne({ source: 'payment', sourceId: doc._id });
        if (existing) return;

        // Build a minimal user object for createdBy
        const systemUser = { _id: doc.createdBy, email: 'system@alamait.com' };

        // Call service to create the transaction and entry
        await DoubleEntryAccountingService.recordStudentRentPayment(doc, systemUser);
        console.log(`✅ Auto-created double-entry for payment ${doc.paymentId}`);
    } catch (hookErr) {
        console.error('⚠️ post-save Payment hook failed to create accounting entry:', hookErr.message);
    }
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment; 