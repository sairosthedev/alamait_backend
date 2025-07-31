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

// Helper function to get current month and year
function getCurrentMonthYear() {
    const now = new Date();
    return {
        month: now.getMonth() + 1, // getMonth() returns 0-11
        year: now.getFullYear()
    };
}

const monthlyRequestItemSchema = new mongoose.Schema({
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
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    isRecurring: {
        type: Boolean,
        default: true
    },
    notes: {
        type: String,
        trim: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    // Template change tracking
    changeHistory: [{
        date: { type: Date, default: Date.now },
        action: { type: String, enum: ['added', 'modified', 'removed'], required: true },
        field: { type: String, required: true },
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        effectiveFrom: { type: Date, required: true }, // When this change takes effect
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: { type: Date },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
    }],
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
        required: true
    },
    month: {
        type: Number,
        required: function() {
            return !this.isTemplate;
        },
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: function() {
            return !this.isTemplate;
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
    // Template versioning and change tracking
    templateVersion: {
        type: Number,
        default: 1
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    effectiveFrom: {
        type: Date,
        default: Date.now
    },
    templateChanges: [{
        date: { type: Date, default: Date.now },
        action: { type: String, enum: ['item_added', 'item_modified', 'item_removed', 'template_modified'], required: true },
        itemIndex: { type: Number }, // For item-specific changes
        field: { type: String }, // Field that was changed
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        effectiveFrom: { type: Date, required: true }, // When this change takes effect
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: { type: Date },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        description: { type: String, required: true } // Human-readable description of change
    }],
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

// Static method to get templates for a residence with enhanced information
monthlyRequestSchema.statics.getTemplates = function(residenceId) {
    return this.find({
        residence: residenceId,
        isTemplate: true
    }).populate('residence', 'name')
      .populate('submittedBy', 'firstName lastName email')
      .populate('templateChanges.changedBy', 'firstName lastName email')
      .populate('templateChanges.approvedBy', 'firstName lastName email')
      .sort({ lastUpdated: -1 });
};

// Static method to get template with pending changes for finance approval
monthlyRequestSchema.statics.getTemplatesWithPendingChanges = function(residenceId) {
    return this.find({
        residence: residenceId,
        isTemplate: true,
        'templateChanges.status': 'pending'
    }).populate('residence', 'name')
      .populate('submittedBy', 'firstName lastName email')
      .populate('templateChanges.changedBy', 'firstName lastName email')
      .sort({ lastUpdated: -1 });
};

// Static method to get template items as table format
monthlyRequestSchema.statics.getTemplateItemsTable = function(templateId) {
    return this.findById(templateId)
        .populate('residence', 'name')
        .populate('submittedBy', 'firstName lastName email')
        .then(template => {
            if (!template) {
                throw new Error('Template not found');
            }
            
            const currentDate = new Date();
            const tableData = {
                template: {
                    id: template._id,
                    title: template.title,
                    description: template.description,
                    residence: template.residence,
                    submittedBy: template.submittedBy,
                    templateVersion: template.templateVersion,
                    lastUpdated: template.lastUpdated,
                    totalEstimatedCost: template.totalEstimatedCost
                },
                items: template.items.map((item, index) => ({
                    index: index + 1,
                    title: item.title,
                    description: item.description,
                    quantity: item.quantity,
                    estimatedCost: item.estimatedCost,
                    totalCost: item.estimatedCost * item.quantity,
                    category: item.category,
                    priority: item.priority,
                    isRecurring: item.isRecurring,
                    notes: item.notes,
                    tags: item.tags,
                    pendingChanges: item.changeHistory.filter(change => 
                        change.status === 'pending' && 
                        new Date(change.effectiveFrom) > currentDate
                    )
                })),
                pendingChanges: template.templateChanges.filter(change => 
                    change.status === 'pending' && 
                    new Date(change.effectiveFrom) > currentDate
                ),
                summary: {
                    totalItems: template.items.length,
                    totalCost: template.totalEstimatedCost,
                    pendingChangesCount: template.templateChanges.filter(change => 
                        change.status === 'pending' && 
                        new Date(change.effectiveFrom) > currentDate
                    ).length
                }
            };
            
            return tableData;
        });
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

// Instance method to add item to template (for future months)
monthlyRequestSchema.methods.addTemplateItem = function(itemData, changedBy) {
    if (!this.isTemplate) {
        throw new Error('This method can only be used on templates');
    }
    
    const currentDate = new Date();
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    
    // Add the new item
    const newItem = {
        ...itemData,
        changeHistory: [{
            date: new Date(),
            action: 'added',
            field: 'new_item',
            oldValue: null,
            newValue: itemData,
            changedBy: changedBy,
            effectiveFrom: nextMonth,
            status: 'pending',
            description: `Added new item: ${itemData.title}`
        }]
    };
    
    this.items.push(newItem);
    this.templateVersion += 1;
    this.lastUpdated = new Date();
    
    // Add to template changes
    this.templateChanges.push({
        date: new Date(),
        action: 'item_added',
        itemIndex: this.items.length - 1,
        field: 'new_item',
        oldValue: null,
        newValue: itemData,
        changedBy: changedBy,
        effectiveFrom: nextMonth,
        status: 'pending',
        description: `Added new item: ${itemData.title} - ${itemData.description}`
    });
    
    return this.save();
};

// Instance method to modify template item (for future months)
monthlyRequestSchema.methods.modifyTemplateItem = function(itemIndex, field, newValue, changedBy) {
    if (!this.isTemplate) {
        throw new Error('This method can only be used on templates');
    }
    
    if (!this.items[itemIndex]) {
        throw new Error('Invalid item index');
    }
    
    const currentDate = new Date();
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const oldValue = this.items[itemIndex][field];
    
    // Update the item
    this.items[itemIndex][field] = newValue;
    
    // Add to item change history
    this.items[itemIndex].changeHistory.push({
        date: new Date(),
        action: 'modified',
        field: field,
        oldValue: oldValue,
        newValue: newValue,
        changedBy: changedBy,
        effectiveFrom: nextMonth,
        status: 'pending',
        description: `Modified ${field} from ${oldValue} to ${newValue}`
    });
    
    this.templateVersion += 1;
    this.lastUpdated = new Date();
    
    // Add to template changes
    this.templateChanges.push({
        date: new Date(),
        action: 'item_modified',
        itemIndex: itemIndex,
        field: field,
        oldValue: oldValue,
        newValue: newValue,
        changedBy: changedBy,
        effectiveFrom: nextMonth,
        status: 'pending',
        description: `Modified item ${this.items[itemIndex].title}: ${field} from ${oldValue} to ${newValue}`
    });
    
    return this.save();
};

// Instance method to remove template item (for future months)
monthlyRequestSchema.methods.removeTemplateItem = function(itemIndex, changedBy) {
    if (!this.isTemplate) {
        throw new Error('This method can only be used on templates');
    }
    
    if (!this.items[itemIndex]) {
        throw new Error('Invalid item index');
    }
    
    const currentDate = new Date();
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const removedItem = this.items[itemIndex];
    
    // Remove the item
    this.items.splice(itemIndex, 1);
    
    this.templateVersion += 1;
    this.lastUpdated = new Date();
    
    // Add to template changes
    this.templateChanges.push({
        date: new Date(),
        action: 'item_removed',
        itemIndex: itemIndex,
        field: 'item_removed',
        oldValue: removedItem,
        newValue: null,
        changedBy: changedBy,
        effectiveFrom: nextMonth,
        status: 'pending',
        description: `Removed item: ${removedItem.title} - ${removedItem.description}`
    });
    
    return this.save();
};

// Instance method to approve template changes (Finance only)
monthlyRequestSchema.methods.approveTemplateChanges = function(changeIndex, approvedBy) {
    if (!this.isTemplate) {
        throw new Error('This method can only be used on templates');
    }
    
    if (!this.templateChanges[changeIndex]) {
        throw new Error('Invalid change index');
    }
    
    const change = this.templateChanges[changeIndex];
    
    if (change.status !== 'pending') {
        throw new Error('Change is not pending approval');
    }
    
    // Approve the change
    change.status = 'approved';
    change.approvedBy = approvedBy;
    change.approvedAt = new Date();
    
    // If it's an item change, also approve the corresponding item change history
    if (change.itemIndex !== undefined && this.items[change.itemIndex]) {
        const itemChange = this.items[change.itemIndex].changeHistory.find(
            ch => ch.field === change.field && ch.status === 'pending'
        );
        if (itemChange) {
            itemChange.status = 'approved';
            itemChange.approvedBy = approvedBy;
            itemChange.approvedAt = new Date();
        }
    }
    
    return this.save();
};

// Instance method to reject template changes (Finance only)
monthlyRequestSchema.methods.rejectTemplateChanges = function(changeIndex, approvedBy, reason) {
    if (!this.isTemplate) {
        throw new Error('This method can only be used on templates');
    }
    
    if (!this.templateChanges[changeIndex]) {
        throw new Error('Invalid change index');
    }
    
    const change = this.templateChanges[changeIndex];
    
    if (change.status !== 'pending') {
        throw new Error('Change is not pending approval');
    }
    
    // Reject the change
    change.status = 'rejected';
    change.approvedBy = approvedBy;
    change.approvedAt = new Date();
    change.description += ` - Rejected: ${reason}`;
    
    // If it's an item change, also reject the corresponding item change history
    if (change.itemIndex !== undefined && this.items[change.itemIndex]) {
        const itemChange = this.items[change.itemIndex].changeHistory.find(
            ch => ch.field === change.field && ch.status === 'pending'
        );
        if (itemChange) {
            itemChange.status = 'rejected';
            itemChange.approvedBy = approvedBy;
            itemChange.approvedAt = new Date();
        }
    }
    
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