const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['unread', 'read', 'archived'],
        default: 'unread'
    },
    parentMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    attachments: [{
        name: String,
        url: String,
        type: String
    }],
    isSystemMessage: {
        type: Boolean,
        default: false
    },
    metadata: {
        relatedTo: {
            type: String,
            enum: ['maintenance', 'booking', 'event', 'payment', 'general'],
            default: 'general'
        },
        referenceId: mongoose.Schema.Types.ObjectId
    }
}, {
    timestamps: true
});

// Indexes for common queries
messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ recipient: 1, status: 1 });
messageSchema.index({ parentMessage: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 