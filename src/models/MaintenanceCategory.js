const mongoose = require('mongoose');

const maintenanceCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    estimatedTime: {
        type: Number, // in hours
        default: 2
    },
    amount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Add indexes for common queries
maintenanceCategorySchema.index({ name: 1 });
maintenanceCategorySchema.index({ isActive: 1 });
maintenanceCategorySchema.index({ priority: 1 });

module.exports = mongoose.model('MaintenanceCategory', maintenanceCategorySchema); 