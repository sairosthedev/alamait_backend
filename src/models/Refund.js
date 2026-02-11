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
    debtor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Debtor',
        default: null,
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
    transactionId: {
        type: String,
        default: null,
        index: true
    },
    reference: {
        type: String,
        default: null
    },
    refundDate: {
        type: Date,
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

// Virtual for student name (requires population)
refundSchema.virtual('studentName').get(function() {
    if (this.student && typeof this.student === 'object') {
        return `${this.student.firstName || ''} ${this.student.lastName || ''}`.trim() || 'Unknown Student';
    }
    return 'Unknown Student';
});

// Ensure virtuals are included in JSON output
refundSchema.set('toJSON', { virtuals: true });
refundSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Refund', refundSchema);





































