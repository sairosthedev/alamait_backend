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
    },
    validUntil: {
        type: Date
    },
    terms: {
        type: String,
        trim: true
    },
    attachments: [{
        type: String
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
        enum: ['maintenance', 'financial', 'operational', 'administrative'],
        required: true
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    submittedDate: {
        type: Date,
        default: Date.now
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    room: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        enum: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'renovation', 'other'],
        required: function() { return this.type === 'maintenance'; }
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending_admin_approval', 'pending_finance_approval', 'pending_ceo_approval', 'approved', 'approved_with_changes', 'rejected'],
        default: 'pending_admin_approval'
    },
    amount: {
        type: Number,
        min: 0,
        default: 0
    },
    dueDate: {
        type: Date
    },
    tags: [{
        type: String,
        trim: true
    }],
    attachments: [{
        type: String
    }],
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
            approvedAt: {
                type: Date
            },
            notes: {
                type: String,
                trim: true
            },
            quotationChanges: [{
                originalQuotation: {
                    type: Number,
                    required: true
                },
                newQuotation: {
                    type: Number,
                    required: true
                },
                changeReason: {
                    type: String,
                    required: true,
                    trim: true
                },
                changedDate: {
                    type: Date,
                    default: Date.now
                }
            }]
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
requestSchema.index({ 'approval.admin.approved': 1 });
requestSchema.index({ 'approval.finance.approved': 1 });
requestSchema.index({ 'approval.ceo.approved': 1 });

// Add compound index for duplicate detection
requestSchema.index({ 
    title: 1, 
    description: 1, 
    submittedBy: 1, 
    status: 1 
}, { 
    name: 'duplicate_detection_index',
    partialFilterExpression: { 
        status: { $in: ['pending_admin_approval', 'pending_finance_approval', 'pending_ceo_approval'] } 
    }
});

// Pre-save middleware to update request history
requestSchema.pre('save', function(next) {
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
        return this.status === 'approved' || this.status === 'approved_with_changes';
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
        if (!this.approval.admin.approved) return 'pending_admin_approval';
        if (!this.approval.finance.approved) return 'pending_finance_approval';
        if (!this.approval.ceo.approved) return 'pending_ceo_approval';
        return 'approved';
    }
});

// Virtual for getting pending CEO approval requests
requestSchema.virtual('isPendingCEOApproval').get(function() {
    return this.approval.admin.approved && 
           this.approval.finance.approved && 
           !this.approval.ceo.approved &&
           this.status !== 'rejected';
});

module.exports = mongoose.model('Request', requestSchema);