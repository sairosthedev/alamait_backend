const mongoose = require('mongoose');

/**
 * User Activity Model
 * Tracks comprehensive user activity including:
 * - Page navigation
 * - Actions on each page
 * - Session tracking
 * - Time spent on pages
 */
const UserActivitySchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  activityType: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'page_view',
      'page_navigation',
      'action',
      'form_submit',
      'button_click',
      'data_view',
      'data_export',
      'data_import',
      'search',
      'filter',
      'sort',
      'download',
      'upload',
      'delete',
      'create',
      'update',
      'approve',
      'reject',
      'export',
      'print',
      'copy',
      'paste',
      'unknown'
    ]
  },
  page: {
    type: String,
    required: true,
    index: true
  },
  pageTitle: {
    type: String,
    default: ''
  },
  previousPage: {
    type: String,
    default: null
  },
  action: {
    type: String,
    default: ''
  },
  actionDetails: {
    type: Object,
    default: {}
  },
  elementId: {
    type: String,
    default: null
  },
  elementType: {
    type: String,
    default: null // button, link, form, input, etc.
  },
  elementLabel: {
    type: String,
    default: null
  },
  data: {
    type: Object,
    default: {}
  },
  recordId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  collection: {
    type: String,
    default: null
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  duration: {
    type: Number, // Time spent on page in milliseconds
    default: null
  },
  ipAddress: {
    type: String,
    default: null,
    index: true
  },
  userAgent: {
    type: String,
    default: null
  },
  deviceInfo: {
    type: Object,
    default: {}
  },
  requestId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['success', 'error', 'pending', 'cancelled'],
    default: 'success'
  },
  errorMessage: {
    type: String,
    default: null
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
UserActivitySchema.index({ user: 1, timestamp: -1 });
UserActivitySchema.index({ sessionId: 1, timestamp: -1 });
UserActivitySchema.index({ activityType: 1, timestamp: -1 });
UserActivitySchema.index({ page: 1, timestamp: -1 });
UserActivitySchema.index({ user: 1, sessionId: 1, timestamp: -1 });

// Compound index for common queries
UserActivitySchema.index({ user: 1, activityType: 1, timestamp: -1 });

module.exports = mongoose.model('UserActivity', UserActivitySchema);

