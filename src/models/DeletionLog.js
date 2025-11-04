const mongoose = require('mongoose');

const DeletionLogSchema = new mongoose.Schema({
    // What was deleted
    deletedModel: {
        type: String,
        required: true,
        index: true
    },
    deletedDocumentId: {
        type: mongoose.Schema.Types.Mixed, // Can be ObjectId or String
        required: true,
        index: true
    },
    
    // Snapshot of the deleted document
    deletedData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    
    // Who deleted it
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    deletedByRole: {
        type: String,
        enum: ['admin', 'finance', 'finance_admin', 'finance_user', 'ceo', 'student', 'property_manager'],
        required: true
    },
    deletedByEmail: {
        type: String,
        required: true
    },
    
    // When it was deleted
    deletedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // Reason for deletion (optional)
    reason: {
        type: String,
        trim: true
    },
    
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Status of the deletion (for potential restoration)
    status: {
        type: String,
        enum: ['deleted', 'restored', 'permanently_deleted'],
        default: 'deleted',
        index: true
    },
    
    // If restored, track restoration info
    restoredAt: {
        type: Date
    },
    restoredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Additional context
    context: {
        type: String, // e.g., 'soft_delete', 'hard_delete', 'cascade_delete'
        default: 'soft_delete'
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
DeletionLogSchema.index({ deletedModel: 1, deletedAt: -1 });
DeletionLogSchema.index({ deletedBy: 1, deletedAt: -1 });
DeletionLogSchema.index({ status: 1, deletedAt: -1 });
DeletionLogSchema.index({ deletedModel: 1, deletedDocumentId: 1 });
DeletionLogSchema.index({ deletedByRole: 1, deletedAt: -1 });

// Static method to get deletions by model
DeletionLogSchema.statics.getDeletionsByModel = function(modelName, options = {}) {
    const query = { deletedModel: modelName, status: 'deleted' };
    
    if (options.startDate || options.endDate) {
        query.deletedAt = {};
        if (options.startDate) query.deletedAt.$gte = new Date(options.startDate);
        if (options.endDate) query.deletedAt.$lte = new Date(options.endDate);
    }
    
    if (options.deletedBy) {
        query.deletedBy = options.deletedBy;
    }
    
    return this.find(query).sort({ deletedAt: -1 });
};

// Static method to check if a document was deleted
DeletionLogSchema.statics.wasDeleted = function(modelName, documentId) {
    return this.findOne({
        deletedModel: modelName,
        deletedDocumentId: documentId,
        status: 'deleted'
    });
};

module.exports = mongoose.model('DeletionLog', DeletionLogSchema, 'deletions');

