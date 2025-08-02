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
        required: false // Changed from required: true to allow creation without files
    },
    fileName: {
        type: String,
        required: false // Changed from required: true to allow creation without files
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
    },
    // Quotation selection tracking
    isSelected: {
        type: Boolean,
        default: false
    },
    selectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    selectedAt: {
        type: Date
    },
    selectedByEmail: {
        type: String,
        trim: true
    },
    deselectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    deselectedAt: {
        type: Date
    },
    deselectedByEmail: {
        type: String,
        trim: true
    },
    selectionHistory: [{
        action: {
            type: String,
            enum: ['selected', 'deselected'],
            required: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        userEmail: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        reason: {
            type: String,
            trim: true
        }
    }]
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
    unitCost: {
        type: Number,
        required: false,
        default: 0,
        description: 'Cost per unit/item'
    },
    totalCost: {
        type: Number,
        required: false,
        default: 0,
        description: 'Total cost for this item (unitCost × quantity)'
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
            required: false // Changed from required: true to allow creation without files
        },
        fileName: {
            type: String,
            required: false // Changed from required: true to allow creation without files
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
        },
        // Quotation selection tracking
        isSelected: {
            type: Boolean,
            default: false
        },
        selectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        selectedAt: {
            type: Date
        },
        selectedByEmail: {
            type: String,
            trim: true
        },
        deselectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        deselectedAt: {
            type: Date
        },
        deselectedByEmail: {
            type: String,
            trim: true
        },
        selectionHistory: [{
            action: {
                type: String,
                enum: ['selected', 'deselected'],
                required: true
            },
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            userEmail: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            reason: {
                type: String,
                trim: true
            }
        }]
    }]
});

const requestSchema = new mongoose.Schema({
    title: {
        type: String,
        required: function() { return !this.student; }, // Required for non-student requests
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
        required: function() { return !this.student; } // Required for non-student requests
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() { return !this.student; } // Required for non-student requests
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    
    // Student-specific fields (for maintenance requests)
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() { return !this.type; } // Required if no type (student requests)
    },
    issue: {
        type: String,
        required: function() { return !!this.student; }, // Required for student requests
        trim: true
    },
    room: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        enum: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other'],
        required: function() { return !!this.student; } // Required for student requests
    },
    
    // Non-student specific fields
    department: {
        type: String,
        trim: true,
        required: function() { return !this.student; } // Required for non-student requests
    },
    requestedBy: {
        type: String,
        trim: true,
        required: function() { return !this.student; } // Required for non-student requests
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
        required: function() { return !this.student; } // Required for non-student requests
    },
    
    // Common fields
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'in-progress', 'completed', 'rejected', 'waitlisted', 'pending_ceo_approval', 'pending_finance_approval', 'pending_admin_approval', 'pending-ceo-approval', 'pending-finance-approval', 'pending-admin-approval'],
        default: 'pending'
    },
    financeStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'waitlisted'],
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
            },
            rejected: {
                type: Boolean,
                default: false
            },
            rejectedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            rejectedByEmail: {
                type: String,
                trim: true
            },
            rejectedAt: {
                type: Date
            },
            waitlisted: {
                type: Boolean,
                default: false
            },
            waitlistedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            waitlistedByEmail: {
                type: String,
                trim: true
            },
            waitlistedAt: {
                type: Date
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
    // Calculate total cost for each item and overall total
    if (this.items && this.items.length > 0) {
        this.items.forEach(item => {
            // Calculate total cost for this item (unitCost × quantity)
            if (item.unitCost && item.quantity) {
                item.totalCost = item.unitCost * item.quantity;
            }
        });
        
        // Calculate total estimated cost from all items
        this.totalEstimatedCost = this.items.reduce((total, item) => {
            return total + (item.totalCost || 0);
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

// Virtual for cost breakdown
requestSchema.virtual('costBreakdown').get(function() {
    if (!this.items || this.items.length === 0) {
        return {
            totalItems: 0,
            totalCost: 0,
            items: []
        };
    }
    
    const breakdown = {
        totalItems: this.items.length,
        totalCost: this.totalEstimatedCost || 0,
        items: this.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            purpose: item.purpose
        }))
    };
    
    return breakdown;
});

module.exports = mongoose.model('Request', requestSchema, 'maintenance');