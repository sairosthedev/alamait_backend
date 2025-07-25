const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    editedAt: {
        type: Date,
        default: null
    },
    isEdited: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const messageSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['announcement', 'discussion'],
        required: true
    },
    recipients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    pinned: {
        type: Boolean,
        default: false
    },
    replies: [replySchema],
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Delivery status for each recipient
    deliveryStatus: [{
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read'],
            default: 'sent'
        },
        deliveredAt: Date,
        readAt: Date
    }],
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'delivered'
    },
    // Edit tracking
    editedAt: {
        type: Date,
        default: null
    },
    isEdited: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Add indexes for common queries
messageSchema.index({ type: 1 });
messageSchema.index({ author: 1 });
messageSchema.index({ 'recipients': 1 });
messageSchema.index({ pinned: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ 'deliveryStatus.recipient': 1 });

module.exports = mongoose.model('Message', messageSchema); 