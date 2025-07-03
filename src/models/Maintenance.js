const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    issue: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    room: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other'],
        required: true,
        set: function(value) {
            if (value) {
                return value.toLowerCase();
            }
            return value;
        }
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        required: true,
        set: function(value) {
            if (value) {
                return value.toLowerCase();
            }
            return value;
        }
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'in-progress', 'on-hold', 'completed'],
        default: 'pending',
        set: function(value) {
            if (value) {
                return value.toLowerCase().replace(/\s+/g, '-');
            }
            return value;
        }
    },
    assignedTo: {
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        name: String,
        surname: String,
        role: String
    },
    requestDate: {
        type: Date,
        default: Date.now
    },
    scheduledDate: {
        type: Date
    },
    estimatedCompletion: {
        type: Date
    },
    completedDate: {
        type: Date
    },
    amount: {
        type: Number,
        min: 0,
        default: 0
    },
    financeStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        set: function(value) {
            if (value) {
                return value.toLowerCase();
            }
            return value;
        }
    },
    financeNotes: {
        type: String,
        trim: true
    },
    paymentMethod: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal', 'bank transfer', 'cash', 'online payment', 'ecocash', 'innbucks', 'mastercard', 'visa', 'paypal'],
        required: false,
        set: function(value) {
            if (value) {
                // Normalize to title case
                const normalized = value.toLowerCase();
                const mapping = {
                    'bank transfer': 'Bank Transfer',
                    'cash': 'Cash',
                    'online payment': 'Online Payment',
                    'ecocash': 'Ecocash',
                    'innbucks': 'Innbucks',
                    'mastercard': 'MasterCard',
                    'visa': 'Visa',
                    'paypal': 'PayPal'
                };
                return mapping[normalized] || value;
            }
            return value;
        }
    },
    paymentIcon: {
        type: String,
        required: false
    },
    images: [{
        url: {
            type: String,
            required: true
        },
        caption: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    updates: [{
        date: {
            type: Date,
            default: Date.now
        },
        message: {
            type: String,
            required: true
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    requestHistory: [{
        date: {
            type: Date,
            default: Date.now
        },
        action: {
            type: String,
            required: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        changes: [String]
    }]
}, {
    timestamps: true
});

// Add indexes for common queries
maintenanceSchema.index({ status: 1 });
maintenanceSchema.index({ room: 1 });
maintenanceSchema.index({ requestDate: -1 });
maintenanceSchema.index({ priority: 1 });
maintenanceSchema.index({ category: 1 });
maintenanceSchema.index({ student: 1 });
maintenanceSchema.index({ assignedTo: 1 });

// Pre-save middleware to ensure dates are valid and normalize values
maintenanceSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        this.status = this.status.toLowerCase().replace(/\s+/g, '-');
    }

    if (this.isModified('category')) {
        this.category = this.category.toLowerCase();
    }

    if (this.isModified('priority')) {
        this.priority = this.priority.toLowerCase();
    }

    if (this.isModified('financeStatus')) {
        this.financeStatus = this.financeStatus.toLowerCase();
    }

    if (this.isModified('estimatedCompletion') && this.estimatedCompletion) {
        this.estimatedCompletion = new Date(this.estimatedCompletion);
    }
    if (this.isModified('scheduledDate') && this.scheduledDate) {
        this.scheduledDate = new Date(this.scheduledDate);
    }
    if (this.isModified('completedDate') && this.completedDate) {
        this.completedDate = new Date(this.completedDate);
    }
    next();
});

module.exports = mongoose.model('Maintenance', maintenanceSchema, 'maintenance'); 