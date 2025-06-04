const mongoose = require('mongoose');

const maintenanceStaffSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    surname: {
        type: String,
        required: true,
        trim: true
    },
    speciality: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    contact: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    assignedTasks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Maintenance'
    }],
    performance: {
        completedTasks: {
            type: Number,
            default: 0
        },
        averageResponseTime: {
            type: Number,
            default: 0
        },
        rating: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true,
    collection: 'maintenancestaff'
});

// Add indexes for common queries
maintenanceStaffSchema.index({ speciality: 1 });
maintenanceStaffSchema.index({ location: 1 });
maintenanceStaffSchema.index({ isActive: 1 });
maintenanceStaffSchema.index({ email: 1 }, { unique: true });

// Log when the model is registered
console.log('Registering MaintenanceStaff model with Mongoose');

const MaintenanceStaff = mongoose.model('MaintenanceStaff', maintenanceStaffSchema);

// Verify the model is registered
console.log('Available models:', Object.keys(mongoose.models));
console.log('MaintenanceStaff model registered:', !!mongoose.models.MaintenanceStaff);
console.log('Collection name:', MaintenanceStaff.collection.name);

module.exports = MaintenanceStaff; 