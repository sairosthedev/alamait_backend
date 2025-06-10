const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const paymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: false,
        default: null
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
    totalAmount: {
        type: Number,
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

// Add indexes for common queries
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ student: 1 });
paymentSchema.index({ residence: 1 });
paymentSchema.index({ room: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ date: -1 });

// Add pagination plugin
paymentSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Payment', paymentSchema); 