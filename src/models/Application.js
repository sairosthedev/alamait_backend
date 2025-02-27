const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requestType: {
        type: String,
        enum: ['new', 'upgrade'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'waitlisted'],
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
    preferredRoom: {
        type: String,
        required: function() { return this.requestType === 'new'; }
    },
    alternateRooms: [{
        type: String
    }],
    currentRoom: {
        type: String,
        required: function() { return this.requestType === 'upgrade'; }
    },
    requestedRoom: {
        type: String,
        required: function() { return this.requestType === 'upgrade'; }
    },
    reason: {
        type: String,
        required: function() { return this.requestType === 'upgrade'; }
    },
    allocatedRoom: {
        type: String
    },
    waitlistedRoom: {
        type: String
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
    }
}, {
    timestamps: true
});

// Add indexes for common queries
applicationSchema.index({ status: 1, requestType: 1 });
applicationSchema.index({ student: 1 });
applicationSchema.index({ applicationDate: -1 });

module.exports = mongoose.model('Application', applicationSchema); 