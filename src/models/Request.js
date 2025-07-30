const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
    provider: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        trim: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    }
});

// Schema for items/services in non-student requests
const requestItemSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    estimatedCost: {
        type: Number,
        required: true,
        min: 0
    },
    purpose: {
        type: String,
        trim: true
    },
    quotations: [{
        provider: {
            type: String,
            required: true,
            trim: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        description: {
            type: String,
            trim: true
        },
        fileUrl: {
            type: String,
            required: true
        },
        fileName: {
            type: String,
            required: true
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        isApproved: {
            type: Boolean,
            default: false
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedAt: {
            type: Date
        }
    }]
});

const requestSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['maintenance', 'financial', 'operational'],
        required: true
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    
    // Student-specific fields (for maintenance requests)
    room: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        enum: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other'],
        required: function() { return this.type === 'maintenance'; }
    },
    
    // Non-student specific fields
    department: {
        type: String,
        trim: true,
        required: function() { return this.type !== 'maintenance'; }
    },
    requestedBy: {
        type: String,
        trim: true,
        required: function() { return this.type !== 'maintenance'; }
    },
    items: [requestItemSchema], // Multiple items/services
    totalEstimatedCost: {
        type: Number,
        min: 0,
        default: 0
    },
    proposedVendor: {
        type: String,
        trim: true
    },
    deliveryLocation: {
        type: String,
        trim: true,
        required: function() { return this.type !== 'maintenance'; }
    },
    
    // Common fields
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'in-progress', 'completed', 'rejected'],
        default: 'pending'
    },
    approval: {
        admin: {
            approved: {
                type: Boolean,
                default: false
            },
            approvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            approvedByEmail: {
                type: String,
                trim: true
            },
            approvedAt: {
                type: Date
            },
            notes: {
                type: String,
                trim: true
            }
        },
        finance: {
            approved: {
                type: Boolean,
                default: false
            },
            approvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            approvedByEmail: {
                type: String,
                trim: true
            },
            approvedAt: {
                type: Date
            },
            notes: {
                type: String,
                trim: true
            }
        },
        ceo: {
            approved: {
                type: Boolean,
                default: false
            },
            approvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            approvedByEmail: {
                type: String,
                trim: true
            },
            approvedAt: {
                type: Date
            },
            notes: {
                type: String,
                trim: true
            }
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
    quotations: [quotationSchema],
    convertedToExpense: {
        type: Boolean,
        default: false
    },
    expenseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Expense'
    },
    amount: {
        type: Number,
        min: 0,
        default: 0
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
requestSchema.index({ status: 1 });
requestSchema.index({ type: 1 });
requestSchema.index({ submittedBy: 1 });
requestSchema.index({ residence: 1 });
requestSchema.index({ createdAt: -1 });
requestSchema.index({ priority: 1 });

// Add compound index for duplicate detection
requestSchema.index({ 
    title: 1, 
    description: 1, 
    submittedBy: 1, 
    status: 1 
}, { 
    name: 'duplicate_detection_index',
    partialFilterExpression: { 
        status: { $in: ['pending', 'assigned', 'in-progress'] } 
    }
});

// Pre-save middleware to update request history and calculate total cost
requestSchema.pre('save', function(next) {
    // Calculate total estimated cost from items
    if (this.items && this.items.length > 0) {
        this.totalEstimatedCost = this.items.reduce((total, item) => {
            return total + (item.estimatedCost * item.quantity);
        }, 0);
    }
    
    if (this.isModified()) {
        const changes = [];
        
        if (this.isModified('status')) {
            changes.push(`Status changed to ${this.status}`);
        }
        
        if (this.isModified('assignedTo')) {
            changes.push('Assignment updated');
        }
        
        if (this.isModified('approval')) {
            changes.push('Approval status updated');
        }
        
        if (changes.length > 0) {
            this.requestHistory.push({
                date: new Date(),
                action: 'Request updated',
                user: this.submittedBy, // This will be updated in the controller
                changes: changes
            });
        }
    }
    next();
});

// Virtual for checking if request is fully approved
requestSchema.virtual('isFullyApproved').get(function() {
    if (this.type === 'maintenance') {
        return this.status === 'completed';
    } else {
        return this.approval.admin.approved && 
               this.approval.finance.approved && 
               this.approval.ceo.approved;
    }
});

// Virtual for getting the current approval stage
requestSchema.virtual('approvalStage').get(function() {
    if (this.type === 'maintenance') {
        return this.status;
    } else {
        if (!this.approval.admin.approved) return 'admin_pending';
        if (!this.approval.finance.approved) return 'finance_pending';
        if (!this.approval.ceo.approved) return 'ceo_pending';
        return 'approved';
    }
});

module.exports = mongoose.model('Request', requestSchema);