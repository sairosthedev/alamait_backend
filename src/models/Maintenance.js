const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other'],
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low'
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'in-progress', 'on-hold', 'completed'],
        default: 'pending'
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    roomNumber: {
        type: String,
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    requestDate: {
        type: Date,
        default: Date.now
    },
    scheduledDate: Date,
    estimatedCompletion: Date,
    completedDate: Date,
    estimatedCost: Number,
    updates: [{
        date: {
            type: Date,
            default: Date.now
        },
        message: String,
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        text: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    images: [{
        url: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Add indexes for common queries
maintenanceSchema.index({ status: 1 });
maintenanceSchema.index({ priority: 1 });
maintenanceSchema.index({ student: 1 });
maintenanceSchema.index({ assignedTo: 1 });
maintenanceSchema.index({ residence: 1 });
maintenanceSchema.index({ requestDate: -1 });

module.exports = mongoose.model('Maintenance', maintenanceSchema); 