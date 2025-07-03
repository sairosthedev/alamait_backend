const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { check } = require('express-validator');

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

// All routes require admin role
// The 'auth' middleware sets req.user and must be used for all admin routes
router.use(auth);
router.use(checkRole(['admin', 'finance', 'finance_admin', 'finance_user']));

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

// Application routes
router.get('/applications', getApplications);
router.put('/applications/:applicationId', applicationStatusValidation, updateApplicationStatus);
router.delete('/applications/:applicationId', deleteApplication);

// Payment routes
router.get('/payments', getPayments);
router.put('/payments/:paymentId', updatePaymentStatus);
router.post('/payments', paymentValidation, createPayment);

// Add route for fetching all leases from all students (unified logic)
router.get('/leases2', leaseController.listAllLeases);

module.exports = router; 