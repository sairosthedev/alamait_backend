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
        required: true,                    // ← REQUIRED for proper mapping
        index: true                        // ← Indexed for performance
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
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
        required: true
    },
    paymentMonth: {
        type: String, // Format: "YYYY-MM"
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    method: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks'],
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Failed', 'Verified', 'Rejected', 'Clarification Requested'],
        default: 'Pending'
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
        verificationNotes: String,
        status: {
            type: String,
            enum: ['Under Review', 'Accepted', 'Rejected'],
            default: 'Under Review'
        },
        studentComment: {
            type: String
        }
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
    
    // Ensure user field is always present
    if (!this.user) {
        return next(new Error('User field is required for proper debtor mapping'));
    }
    
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

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment; 