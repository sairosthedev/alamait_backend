const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        required: true,
        index: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    reason: {
        type: String,
        default: ''
    },
    method: {
        type: String,
        default: 'Bank Transfer'
    },
    status: {
        type: String,
        enum: ['Pending', 'Processed', 'Failed'],
        default: 'Pending',
        index: true
    },
    processedAt: {
        type: Date,
        default: null
    },
    reference: {
        type: String,
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
    }
}, { timestamps: true });

module.exports = mongoose.model('Refund', refundSchema);








