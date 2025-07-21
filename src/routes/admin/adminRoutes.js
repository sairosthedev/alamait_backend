const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { check } = require('express-validator');
const AuditLog = require('../../models/AuditLog');

// Import controllers
const {
    getDashboardStats,
    getFinancialStats,
    getMaintenanceStats,
    getOccupancyStats,
    getTransactions,
    exportTransactions,
    generateDashboardReport,
    getRoomsWithOccupancy,
    getStudentsWithLocation
} = require('../../controllers/admin/dashboardController');

const {
    getAllMaintenanceRequests,
    getMaintenanceRequest,
    updateMaintenanceRequest,
    assignMaintenanceRequest,
    getMaintenanceStaff,
    addMaintenanceStaff,
    removeMaintenanceStaff,
    createMaintenanceRequest,
    getResidencesForMaintenance
} = require('../../controllers/admin/maintenanceController');

const {
    getApplications,
    updateApplicationStatus,
    deleteApplication
} = require('../../controllers/admin/applicationController');

const {
    getPayments,
    updatePaymentStatus,
    createPayment
} = require('../../controllers/admin/paymentController');

const adminController = require('../../controllers/admin/adminController');
const leaseController = require('../../controllers/student/leaseController');

// Validation middleware
const maintenanceUpdateValidation = [
    check('status')
        .optional()
        .isIn(['pending', 'assigned', 'in-progress', 'on-hold', 'completed'])
        .withMessage('Invalid status'),
    check('assignedTo')
        .optional()
        .isMongoId()
        .withMessage('Invalid assigned user ID'),
    check('estimatedCompletion')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format'),
    check('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'Low', 'Medium', 'High'])
        .withMessage('Invalid priority level'),
    check('category')
        .optional()
        .isIn(['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other'])
        .withMessage('Invalid category'),
    check('description')
        .optional()
        .trim()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters'),
    check('comment')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Comment cannot be empty'),
    check('estimatedCost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Estimated cost must be a positive number'),
    check('actualCost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Actual cost must be a positive number'),
    check('scheduledDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid scheduled date format')
];

const maintenanceCreateValidation = [
    check('issue', 'Issue is required').notEmpty().trim(),
    check('description', 'Description is required').notEmpty().trim(),
    check('room', 'Room is required').notEmpty().trim(),
    check('residence', 'Residence ID is required').notEmpty().isMongoId().withMessage('Invalid residence ID format'),
    check('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority level'),
    check('status').optional().isIn(['pending', 'assigned', 'in-progress', 'on-hold', 'completed']).withMessage('Invalid status'),
    check('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    check('assignedTo').optional().isMongoId().withMessage('Invalid assigned user ID')
];

const applicationStatusValidation = [
    check('status').isIn(['pending', 'approved', 'rejected']),
    check('comment').optional().trim().notEmpty()
];

const paymentValidation = [
    check('amount').isNumeric(),
    check('method').isIn(['cash', 'card', 'bank_transfer']),
    check('status').isIn(['pending', 'completed', 'failed']),
    check('description').optional().trim().notEmpty()
];

// All routes below require admin/finance roles
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user'));

// Dashboard routes
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/financial', getFinancialStats);
router.get('/dashboard/maintenance', getMaintenanceStats);
router.get('/dashboard/occupancy', getOccupancyStats);
router.get('/dashboard/transactions', getTransactions);
router.post('/dashboard/export-transactions', exportTransactions);
router.post('/dashboard/generate-report', generateDashboardReport);

// New routes for rooms and students
router.get('/rooms', getRoomsWithOccupancy);
router.get('/students', getStudentsWithLocation);

// Maintenance routes
router.get('/maintenance', getAllMaintenanceRequests);
router.get('/maintenance/:requestId', getMaintenanceRequest);
router.post('/maintenance', maintenanceCreateValidation, createMaintenanceRequest);
router.put('/maintenance/:requestId', maintenanceUpdateValidation, updateMaintenanceRequest);
router.post('/maintenance/:requestId/assign', assignMaintenanceRequest);
router.get('/maintenance/residences', getResidencesForMaintenance);
router.get('/maintenance/maintenance_staff', getMaintenanceStaff);
router.post('/maintenance/maintenance_staff', addMaintenanceStaff);
router.delete('/maintenance/maintenance_staff/:staffId', removeMaintenanceStaff);

// Payment routes
router.get('/payments', getPayments);
router.put('/payments/:paymentId', updatePaymentStatus);
router.post('/payments', paymentValidation, createPayment);

// Add route for fetching all leases from all students (unified logic)
router.get('/leases2', leaseController.listAllLeases);

// Application routes - protected fetch/edit/delete
router.get('/applications', getApplications);
router.put('/applications/:applicationId', applicationStatusValidation, updateApplicationStatus);
router.delete('/applications/:applicationId', deleteApplication);

// Admin Audit Report Routes
// GET /admin/audit-reports - List all audit logs (with optional filters)
router.get('/audit-reports', async (req, res) => {
  try {
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.resourceType) filter.resourceType = req.query.resourceType;
    if (req.query.userId) filter.userId = req.query.userId;
    const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(500);
    // Audit log: log that audit logs were listed
    try {
      await AuditLog.create({
        user: req.user ? req.user._id : null,
        action: 'view',
        collection: 'AuditLog',
        recordId: null,
        before: null,
        after: null,
        timestamp: new Date()
      });
    } catch (auditErr) { /* ignore audit log errors */ }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /admin/audit-reports/:id - Get a single audit log by ID
router.get('/audit-reports/:id', async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: 'Audit log not found' });
    // Audit log: log that a specific audit log was viewed
    try {
      await AuditLog.create({
        user: req.user ? req.user._id : null,
        action: 'view',
        collection: 'AuditLog',
        recordId: log._id,
        before: null,
        after: log.toObject(),
        timestamp: new Date()
      });
    } catch (auditErr) { /* ignore audit log errors */ }
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// POST /admin/audit-reports - Create a new audit log entry
router.post('/audit-reports', async (req, res) => {
  try {
    const { action, resourceType, resourceId, userId, details } = req.body;
    if (!action || !resourceType || !userId) {
      return res.status(400).json({ error: 'action, resourceType, and userId are required' });
    }
    const log = await AuditLog.create({ action, resourceType, resourceId, userId, details });
    // Audit log: log that an audit log was created
    try {
      await AuditLog.create({
        user: req.user ? req.user._id : null,
        action: 'create',
        collection: 'AuditLog',
        recordId: log._id,
        before: null,
        after: log.toObject(),
        timestamp: new Date()
      });
    } catch (auditErr) { /* ignore audit log errors */ }
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create audit log' });
  }
});

module.exports = router; 