const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    capacity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    type: {
        type: String,
        enum: ['single', 'double', 'studio', 'apartment'],
        required: true
    },
    floor: {
        type: Number,
        required: true
    },
    area: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['available', 'occupied', 'maintenance', 'reserved'],
        default: 'available'
    },
    features: [{
        type: String
    }],
    occupants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    applications: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Application'
    }],
    pendingPayments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    waitlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    images: [{
        type: String
    }],
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    }
}, {
    timestamps: true
});

// Add indexes for common queries
roomSchema.index({ name: 1 });

module.exports = mongoose.model('Room', roomSchema); 