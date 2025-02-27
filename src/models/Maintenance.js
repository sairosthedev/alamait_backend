const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
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
    room: {
        roomNumber: {
            type: String,
            required: true
        }
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    category: {
        type: String,
        enum: ['plumbing', 'electrical', 'furniture', 'appliance', 'structural', 'other'],
        required: true
    },
    images: [{
        url: String,
        caption: String
    }],
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
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
    scheduledDate: Date,
    completedDate: Date,
    estimatedCost: Number,
    actualCost: Number
}, {
    timestamps: true
});

// Add indexes for common queries
maintenanceSchema.index({ student: 1, status: 1 });
maintenanceSchema.index({ residence: 1, status: 1 });
maintenanceSchema.index({ assignedTo: 1, status: 1 });

const Maintenance = mongoose.model('Maintenance', maintenanceSchema);

module.exports = Maintenance; 