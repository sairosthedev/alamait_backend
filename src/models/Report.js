const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    fileName: {
        type: String,
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    category: {
        type: String,
        trim: true,
        default: 'other'
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    uploadedByRole: {
        type: String,
        enum: ['admin', 'finance', 'finance_admin', 'finance_user', 'ceo'],
        required: true
    },
    // CEO-only visibility: if true, only CEO can view this report
    isCEOOnly: {
        type: Boolean,
        default: false
    },
    // Tags for filtering/searching
    tags: [{
        type: String,
        trim: true
    }],
    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // Status
    status: {
        type: String,
        enum: ['active', 'archived', 'deleted'],
        default: 'active'
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
ReportSchema.index({ uploadedBy: 1, createdAt: -1 });
ReportSchema.index({ uploadedByRole: 1, isCEOOnly: 1, status: 1 });
ReportSchema.index({ category: 1, status: 1 });
ReportSchema.index({ status: 1 });

// Static method to get visible reports for a user role
ReportSchema.statics.getVisibleReports = function(userRole) {
    const query = { status: 'active' };
    
    // CEO can see all reports
    if (userRole === 'ceo') {
        return this.find(query);
    }
    
    // Finance can see all except CEO-only reports
    if (['finance', 'finance_admin', 'finance_user'].includes(userRole)) {
        query.isCEOOnly = false;
        return this.find(query);
    }
    
    // Admin can see all reports
    if (userRole === 'admin') {
        return this.find(query);
    }
    
    // Default: no access
    return this.find({ _id: null }); // Empty result
};

module.exports = mongoose.model('Report', ReportSchema);

