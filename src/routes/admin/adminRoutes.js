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
    removeMaintenanceStaff
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

// Validation middleware
const maintenanceUpdateValidation = [
    check('status').isIn(['pending', 'assigned', 'in-progress', 'on-hold', 'completed']),
    check('assignedTo').optional().isMongoId(),
    check('comment').optional().trim().notEmpty(),
    check('estimatedCompletion').optional().isISO8601()
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
router.use(auth);
router.use(checkRole('admin'));

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
router.put('/maintenance/:requestId', maintenanceUpdateValidation, updateMaintenanceRequest);
router.post('/maintenance/:requestId/assign', assignMaintenanceRequest);
router.get('/maintenance/staff', getMaintenanceStaff);
router.post('/maintenance/staff', addMaintenanceStaff);
router.delete('/maintenance/staff/:staffId', removeMaintenanceStaff);

// Application routes
router.get('/applications', getApplications);
router.put('/applications/:applicationId', applicationStatusValidation, updateApplicationStatus);
router.delete('/applications/:applicationId', deleteApplication);

// Payment routes
router.get('/payments', getPayments);
router.put('/payments/:paymentId', updatePaymentStatus);
router.post('/payments', paymentValidation, createPayment);

module.exports = router; 