const mongoose = require('mongoose');

const EmailOutboxSchema = new mongoose.Schema({
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    text: { type: String },
    html: { type: String },
    attachments: { type: Array },
    status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued', index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    scheduledAt: { type: Date, default: () => new Date() },
    sentAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('EmailOutbox', EmailOutboxSchema);





