const mongoose = require('mongoose');

// Helper function to format description with month name
function formatDescriptionWithMonth(description, month, year) {
    if (!description) return description;
    
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthName = monthNames[month - 1];
    
    // Check if description already contains month/year
    const monthYearPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i;
    
    if (monthYearPattern.test(description)) {
        // Replace existing month/year with new one
        return description.replace(monthYearPattern, `${monthName} ${year}`);
    } else {
        // Add month/year to description
        return `${description} for ${monthName} ${year}`;
    }
}

const monthlyRequestItemSchema = new mongoose.Schema({
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
    category: {
        type: String,
        enum: ['utilities', 'maintenance', 'supplies', 'equipment', 'services', 'other'],
        default: 'other'
    },
    isRecurring: {
        type: Boolean,
        default: true
    },
    quotations: [{
        provider: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0 },
        description: { type: String, trim: true },
        fileUrl: { type: String, required: true },
        fileName: { type: String, required: true },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        uploadedAt: { type: Date, default: Date.now },
        isApproved: { type: Boolean, default: false },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: { type: Date }
    }]
});

const monthlyRequestSchema = new mongoose.Schema({
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
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true // Required for both templates and regular requests
    },
    month: {
        type: Number,
        required: function() {
            return !this.isTemplate; // Only required if not a template
        },
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: function() {
            return !this.isTemplate; // Only required if not a template
        },
        min: 2020
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'approved', 'rejected', 'completed'],
        default: 'draft'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    items: [monthlyRequestItemSchema],
    totalEstimatedCost: {
        type: Number,
        default: 0
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    approvedByEmail: {
        type: String,
        trim: true
    },
    notes: {
        type: String,
        trim: true
    },
    isTemplate: {
        type: Boolean,
        default: false
    },
    templateName: {
        type: String,
        trim: true
    },
    templateDescription: {
        type: String,
        trim: true
    },
    requestHistory: [{
        date: { type: Date, default: Date.now },
        action: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changes: [String]
    }],
    tags: [{
        type: String,
        trim: true
    }]
}, {
    timestamps: true
});

// Index for efficient querying
monthlyRequestSchema.index({ residence: 1, month: 1, year: 1 });
monthlyRequestSchema.index({ status: 1 });
monthlyRequestSchema.index({ isTemplate: 1 });

// Pre-save middleware to calculate total cost and format description
monthlyRequestSchema.pre('save', function(next) {
    // Calculate total cost
    if (this.items && this.items.length > 0) {
        this.totalEstimatedCost = this.items.reduce((total, item) => {
            return total + (item.estimatedCost * item.quantity);
        }, 0);
    }
    
    // Format description with month name if not a template
    if (!this.isTemplate && this.description && this.month && this.year) {
        this.description = formatDescriptionWithMonth(this.description, this.month, this.year);
    }
    
    next();
});

// Static method to get monthly requests for a residence and month/year
monthlyRequestSchema.statics.getMonthlyRequests = function(residenceId, month, year) {
    return this.find({
        residence: residenceId,
        month: month,
        year: year
    }).populate('residence', 'name').populate('submittedBy', 'firstName lastName email');
};

// Static method to get templates for a residence
monthlyRequestSchema.statics.getTemplates = function(residenceId) {
    return this.find({
        residence: residenceId,
        isTemplate: true
    }).populate('residence', 'name');
};

// Static method to create monthly request from template
monthlyRequestSchema.statics.createFromTemplate = function(templateId, month, year, submittedBy) {
    return this.findById(templateId).then(template => {
        if (!template) {
            throw new Error('Template not found');
        }
        
        const monthlyRequest = new this({
            title: template.title,
            description: formatDescriptionWithMonth(template.description, month, year),
            residence: template.residence,
            month: month,
            year: year,
            items: template.items,
            submittedBy: submittedBy,
            status: 'draft',
            tags: template.tags
        });
        
        return monthlyRequest.save();
    });
};

// Instance method to add quotation to item
monthlyRequestSchema.methods.addItemQuotation = function(itemIndex, quotationData) {
    if (!this.items[itemIndex]) {
        throw new Error('Invalid item index');
    }
    
    this.items[itemIndex].quotations.push(quotationData);
    return this.save();
};

// Instance method to approve item quotation
monthlyRequestSchema.methods.approveItemQuotation = function(itemIndex, quotationIndex, approvedBy) {
    if (!this.items[itemIndex] || !this.items[itemIndex].quotations[quotationIndex]) {
        throw new Error('Invalid item or quotation index');
    }
    
    // Unapprove all other quotations for this item
    this.items[itemIndex].quotations.forEach(quotation => {
        quotation.isApproved = false;
        quotation.approvedBy = null;
        quotation.approvedAt = null;
    });
    
    // Approve the selected quotation
    this.items[itemIndex].quotations[quotationIndex].isApproved = true;
    this.items[itemIndex].quotations[quotationIndex].approvedBy = approvedBy;
    this.items[itemIndex].quotations[quotationIndex].approvedAt = new Date();
    
    // Update item's estimated cost to approved quotation amount
    this.items[itemIndex].estimatedCost = this.items[itemIndex].quotations[quotationIndex].amount;
    
    return this.save();
};

module.exports = mongoose.model('MonthlyRequest', monthlyRequestSchema); 