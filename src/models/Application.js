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
        enum: ['new', 'upgrade'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'waitlisted', 'expired'],
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
    
    additionalInfo: {
        dateOfBirth: {
            type: Date
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other']
        },
        specialRequirements: {
            type: String
        }
    }
}, {
    timestamps: true
});

// Add indexes for common queries
applicationSchema.index({ status: 1, requestType: 1 });
applicationSchema.index({ email: 1 });
applicationSchema.index({ applicationDate: -1 });
applicationSchema.index({ applicationCode: 1 });
applicationSchema.index({ debtor: 1 });

// Generate unique application code
applicationSchema.pre('save', async function(next) {
    if (!this.applicationCode && this.status === 'approved') {
        const year = new Date().getFullYear().toString().substr(-2);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.applicationCode = `APP${year}${random}`;
    }
    next();
});

module.exports = mongoose.model('Application', applicationSchema); 