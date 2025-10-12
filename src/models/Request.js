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
    // Vendor information (for linking to vendor records)
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: false
    },
    vendorCode: {
        type: String,
        trim: true,
        required: false
    },
    vendorName: {
        type: String,
        trim: true,
        required: false
    },
    vendorType: {
        type: String,
        trim: true,
        required: false
    },
    vendorContact: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String
    },
    expenseCategory: {
        type: String,
        trim: true,
        required: false
    },
    paymentMethod: {
        type: String,
        trim: true,
        required: false
    },
    hasBankDetails: {
        type: Boolean,
        default: false
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
        // Vendor information (for linking to vendor records)
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: false
        },
        vendorCode: {
            type: String,
            trim: true,
            required: false
        },
        vendorName: {
            type: String,
            trim: true,
            required: false
        },
        vendorType: {
            type: String,
            trim: true,
            required: false
        },
        vendorContact: {
            firstName: String,
            lastName: String,
            email: String,
            phone: String
        },
        expenseCategory: {
            type: String,
            trim: true,
            required: false
        },
        paymentMethod: {
            type: String,
            trim: true,
            required: false
        },
        hasBankDetails: {
            type: Boolean,
            default: false
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
            },
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            notes: String
        }],
        // Vendor integration fields
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor'
        },
        vendorCode: {
            type: String,
            trim: true
        },
        vendorName: {
            type: String,
            trim: true
        },
        vendorType: {
            type: String,
            trim: true
        },
        vendorContact: {
            firstName: String,
            lastName: String,
            email: String,
            phone: String
        },
        expenseCategory: {
            type: String,
            trim: true
        },
        paymentMethod: {
            type: String,
            trim: true
        },
        hasBankDetails: {
            type: Boolean,
            default: false
        }
    }]
});

const requestSchema = new mongoose.Schema({
    title: {
        type: String,
        required: false, // Will be validated in custom validation
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['maintenance', 'student_maintenance', 'financial', 'operational'],
        required: false // Will be validated in custom validation
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Will be validated in custom validation
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: false // Will be validated conditionally based on request type
    },
    
    // Student-specific fields (for maintenance requests)
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Will be validated in custom validation
    },
    issue: {
        type: String,
        required: false, // Will be validated in custom validation
        trim: true
    },
    room: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        enum: [
            'plumbing', 'electrical', 'hvac', 'appliance', 'structural', 
            'cleaning', 'pest_control', 'security', 'furniture', 'fire_safety',
            'emergency', 'landscaping', 'internet_it', 'accessibility', 'parking',
            'exterior', 'communication', 'general_maintenance', 'other',
            // Financial-specific categories
            'salary', 'salaries'
        ],
        required: false // Will be validated in custom validation
    },
    
    // Non-student specific fields
    department: {
        type: String,
        trim: true,
        required: false // Will be validated in custom validation
    },
    requestedBy: {
        type: String,
        trim: true,
        required: false // Will be validated in custom validation
    },
    items: [requestItemSchema], // Multiple items/services
    totalEstimatedCost: {
        type: Number,
        min: 0,
        default: 0
    },
    // Salary request specific fields
    allocatedEmployees: [{
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        employeeName: {
            type: String,
            required: true
        },
        jobTitle: {
            type: String,
            required: false
        },
        baseSalary: {
            type: Number,
            required: true,
            min: 0
        },
        allocationPercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        allocatedSalary: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    proposedVendor: {
        type: String,
        trim: true
    },
    // Vendor information (optional - populated when vendor is selected)
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: false
    },
    vendorCode: {
        type: String,
        trim: true,
        required: false
    },
    vendorName: {
        type: String,
        trim: true,
        required: false
    },
    vendorType: {
        type: String,
        trim: true,
        required: false
    },
    vendorContact: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String
    },
    expenseCategory: {
        type: String,
        trim: true,
        required: false
    },
    paymentMethod: {
        type: String,
        trim: true,
        required: false
    },
    hasBankDetails: {
        type: Boolean,
        default: false
    },
    deliveryLocation: {
        type: String,
        trim: true,
        required: false // Will be validated in custom validation
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
    // Metadata for additional request information
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
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
    }],
    dateRequested: {
        type: Date,
        default: Date.now
    },
    datePaid: {
        type: Date
    }
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

// Custom validation for conditional field requirements
requestSchema.pre('validate', function(next) {
    const errors = [];
    
    // Determine if this is a student request or admin request
    const isStudentRequest = !!this.student;
    const isAdminRequest = !!this.type;
    
    if (isStudentRequest) {
        // Student request validation
        if (!this.issue) {
            errors.push('issue: Issue is required for student requests');
        }
        if (!this.category) {
            errors.push('category: Category is required for student requests');
        }
        if (this.title) {
            errors.push('title: Title should not be provided for student requests');
        }
        if (this.type) {
            errors.push('type: Type should not be provided for student requests');
        }
        if (this.submittedBy) {
            errors.push('submittedBy: SubmittedBy should not be provided for student requests');
        }
        if (this.department) {
            errors.push('department: Department should not be provided for student requests');
        }
        if (this.requestedBy) {
            errors.push('requestedBy: RequestedBy should not be provided for student requests');
        }
        if (this.deliveryLocation) {
            errors.push('deliveryLocation: DeliveryLocation should not be provided for student requests');
        }
        if (!this.residence) {
            errors.push('residence: Residence is required for student requests');
        }
    } else if (isAdminRequest) {
        // Admin request validation
        if (!this.title) {
            errors.push('title: Title is required for admin requests');
        }
        if (!this.type) {
            errors.push('type: Type is required for admin requests');
        }
        if (!this.submittedBy) {
            errors.push('submittedBy: SubmittedBy is required for admin requests');
        }
        
        // For student_maintenance type, make department and deliveryLocation optional
        if (this.type !== 'student_maintenance') {
            // Finance requests (including salary requests) have different validation rules
            if (this.type === 'financial') {
                console.log('🔍 Finance request detected - applying finance-specific validation');
                // Finance requests don't require deliveryLocation (it's for physical deliveries)
                // But they still need department and requestedBy for tracking
                if (!this.department) {
                    errors.push('department: Department is required for finance requests');
                }
                if (!this.requestedBy) {
                    errors.push('requestedBy: RequestedBy is required for finance requests');
                }
                // deliveryLocation is optional for finance requests
            } else {
                // All other admin requests require these fields
                if (!this.department) {
                    errors.push('department: Department is required for admin requests');
                }
                if (!this.requestedBy) {
                    errors.push('requestedBy: RequestedBy is required for admin requests');
                }
                if (!this.deliveryLocation) {
                    errors.push('deliveryLocation: DeliveryLocation is required for admin requests');
                }
            }
        }
        
        if (this.student) {
            errors.push('student: Student should not be provided for admin requests');
        }
        if (this.issue) {
            errors.push('issue: Issue should not be provided for admin requests');
        }
        // Allow category for student_maintenance and financial types
        if (this.category && !['student_maintenance', 'financial'].includes(this.type)) {
            errors.push('category: Category should not be provided for this admin request type');
        }
        
        // Residence validation based on request type
        if (this.type === 'student_maintenance') {
            // Student maintenance requests don't require a residence
            if (this.residence) {
                errors.push('residence: Residence should not be provided for student maintenance requests');
            }
        } else if (this.type === 'financial' && (this.category === 'salary' || this.category === 'salaries')) {
            // Salary requests can have residence (for residence-specific requests) or no residence (for multi-residence requests)
            console.log('🔍 Salary request detected - type:', this.type, 'category:', this.category, 'residence:', this.residence);
            // Allow both cases: with residence (residence-specific) or without residence (multi-residence)
        } else {
            // All other admin requests require a residence
            if (!this.residence) {
                errors.push('residence: Residence is required for this admin request type');
            }
        }
    } else {
        // Neither student nor admin request - invalid
        errors.push('Request must be either a student request (with student field) or admin request (with type field)');
    }
    
    if (errors.length > 0) {
        const error = new Error('Request validation failed: ' + errors.join(', '));
        error.name = 'ValidationError';
        return next(error);
    }
    
    // Auto-categorize salaries for financial type based on title/description keywords
    try {
        if (this.type === 'financial') {
            const text = `${this.title || ''} ${this.description || ''}`.toLowerCase();
            const hasSalaryKeyword = /(salary|salaries|payroll|wages|stipend)/i.test(text);
            if (hasSalaryKeyword && !this.category) {
                this.category = 'salaries';
            }
        }
    } catch (e) {
        // swallow auto-categorization errors; validation continues
    }

    next();
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