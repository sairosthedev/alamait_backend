const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    applicationCode: {
        type: String,
        unique: true,
        sparse: true
    },
    requestType: {
        type: String,
        enum: ['new', 'upgrade', 'renewal'], // Added 'renewal' for re-applications
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'waitlisted', 'expired', 'forfeited'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'paid'],
        default: 'unpaid'
    },
    applicationDate: {
        type: Date,
        default: Date.now
    },
    startDate: {
        type: Date,
    },
    endDate: {
        type: Date,
    },
    preferredRoom: {
        type: String,
        required: false // Made optional to avoid conflicts with roomDetails
    },
    alternateRooms: [{
        type: String
    }],
    currentRoom: {
        type: String,
        required: false // Made optional to avoid conflicts with roomDetails
    },
    requestedRoom: {
        type: String,
        required: false // Made optional to avoid conflicts with roomDetails
    },
    reason: {
        type: String,
        required: function() { return this.requestType === 'upgrade'; }
    },
    allocatedRoom: {
        type: String,
        required: false // Made optional to avoid conflicts with roomDetails
    },
    waitlistedRoom: {
        type: String
    },
    roomOccupancy: {
        current: {
            type: Number,
            default: 0
        },
        capacity: {
            type: Number,
            default: 0
        }
    },
    adminComment: {
        type: String
    },
    actionDate: {
        type: Date
    },
    actionBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    
    // Allocated room details with price linking
    allocatedRoomDetails: {
        roomNumber: String,
        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Residence.rooms'
        },
        price: Number,
        type: String,
        capacity: Number
    },
    
    // Link to Debtor (for financial tracking)
    debtor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Debtor'
    },
    
    // Re-application fields for preserving financial history
    isReapplication: {
        type: Boolean,
        default: false
    },
    previousStudentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    previousDebtorCode: {
        type: String,
        trim: true
    },
    previousFinancialSummary: {
        debtorCode: String,
        previousBalance: Number,
        totalPaid: Number,
        totalOwed: Number,
        lastPaymentDate: Date,
        lastPaymentAmount: Number,
        transactionCount: Number,
        recentTransactions: [{
            date: Date,
            description: String,
            amount: Number,
            type: String
        }]
    },
    
    additionalInfo: {
        dateOfBirth: Date,
        gender: {
            type: String,
            enum: ['male', 'female', 'other']
        },
        nationality: String,
        studentId: String,
        institution: String,
        course: String,
        yearOfStudy: Number,
        emergencyContact: {
            name: String,
            relationship: String,
            phone: String,
            email: String
        },
        specialRequirements: String,
        dietaryRestrictions: String,
        medicalConditions: String,
        allergies: String
    },
    
    // Document uploads
    documents: [{
        type: {
            type: String,
            enum: ['id', 'passport', 'student_card', 'other']
        },
        filename: String,
        originalname: String,
        path: String,
        mimetype: String,
        size: Number,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Signed lease information
    signedLeasePath: String,
    signedLeaseUploadDate: Date,
    signedLeaseFileName: String,
    signedLeaseSize: Number,
    
    // Rejection information
    rejectionReason: String,
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectedAt: Date,
    
    // Waitlist information
    waitlistPosition: Number,
    waitlistDate: Date,
    
    // Financial information
    totalEstimatedCost: {
        type: Number,
        default: 0
    },
    amount: {
        type: Number,
        default: 0
    },
    
    // Approval workflow
    approval: {
        admin: {
            approved: {
                type: Boolean,
                default: false
            },
            approvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            approvedByEmail: String,
            approvedAt: Date,
            notes: String
        },
        finance: {
            approved: {
                type: Boolean,
                default: false
            },
            approvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            approvedByEmail: String,
            approvedAt: Date,
            notes: String,
            rejected: {
                type: Boolean,
                default: false
            },
            waitlisted: {
                type: Boolean,
                default: false
            }
        },
        ceo: {
            approved: {
                type: Boolean,
                default: false
            },
            approvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            approvedByEmail: String,
            approvedAt: Date,
            notes: String
        }
    },
    
    // Financial service integration
    financial: {
        status: {
            type: String,
            enum: ['pending', 'partial', 'complete', 'failed'],
            default: 'pending'
        },
        message: String,
        convertedToExpense: {
            type: Boolean,
            default: false
        }
    },
    
    // Quotations and vendor information
    quotations: [{
        vendor: String,
        amount: Number,
        description: String,
        validUntil: Date,
        accepted: {
            type: Boolean,
            default: false
        }
    }],
    
    // Request items for operational requests
    items: [{
        description: String,
        quantity: Number,
        unitCost: Number,
        totalCost: Number,
        purpose: String,
        quotations: [{
            vendor: String,
            amount: Number,
            description: String,
            validUntil: Date
        }]
    }],
    
    // Vendor and delivery information
    proposedVendor: String,
    deliveryLocation: String,
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Pre-save middleware to update timestamps
applicationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Indexes for efficient queries
applicationSchema.index({ email: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ applicationDate: -1 });
applicationSchema.index({ residence: 1 });
applicationSchema.index({ student: 1 });
applicationSchema.index({ isReapplication: 1 });
applicationSchema.index({ previousDebtorCode: 1 });

// Compound indexes for common query patterns
applicationSchema.index({ status: 1, endDate: 1 }); // For accrual correction service
applicationSchema.index({ status: 1, endDate: 1, updatedAt: -1 }); // For finding updated leases
applicationSchema.index({ student: 1, status: 1 }); // For finding student applications

module.exports = mongoose.model('Application', applicationSchema); 