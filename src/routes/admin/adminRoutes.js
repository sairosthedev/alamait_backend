const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { check } = require('express-validator');
const AuditLog = require('../../models/AuditLog');
const auditLogRoutes = require('./auditLogRoutes'); // Import new audit log routes

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
    createPayment,
    sendReceiptEmail,
    uploadReceipt
} = require('../../controllers/admin/paymentController');

const adminController = require('../../controllers/admin/adminController');
const leaseController = require('../../controllers/student/leaseController');
const FinanceController = require('../../controllers/financeController');

// Validation middleware
const maintenanceUpdateValidation = [
    check('status')
        .optional()
        .isIn(['pending', 'assigned', 'in-progress', 'on-hold', 'completed', 'approved', 'rejected'])
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
    check('status').optional().isIn(['pending', 'assigned', 'in-progress', 'on-hold', 'completed', 'approved', 'rejected']).withMessage('Invalid status'),
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

// All routes below require admin/finance/ceo roles
router.use(auth);
router.use(checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'));

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
router.post('/send-receipt-email', sendReceiptEmail);
router.post('/upload-receipt', uploadReceipt);

// Add route for fetching all leases from all students (unified logic)
router.get('/leases2', leaseController.listAllLeases);

// Application routes - protected fetch/edit/delete
router.get('/applications', getApplications);
router.put('/applications/:applicationId', applicationStatusValidation, updateApplicationStatus);
router.delete('/applications/:applicationId', deleteApplication);

// Audit Log Route
router.use('/audit-log', auth, checkRole('admin'), auditLogRoutes);

// ========================================
// ADMIN PETTY CASH MANAGEMENT ROUTES
// ========================================

// Admin can allocate petty cash to users
router.post('/petty-cash/allocate', FinanceController.allocatePettyCash);

// Admin can replenish petty cash for users
router.post('/petty-cash/replenish', FinanceController.replenishPettyCash);

// Admin can record petty cash expenses
router.post('/petty-cash/expense', FinanceController.recordPettyCashExpense);

// Admin can view all petty cash balances
router.get('/petty-cash/balances', FinanceController.getAllPettyCashBalances);

// Admin can view specific user's petty cash balance
router.get('/petty-cash/balance/:userId', FinanceController.getPettyCashBalance);

// Admin can view user's petty cash transactions
router.get('/petty-cash/transactions/:userId', FinanceController.getPettyCashTransactions);

// Admin can get eligible users for petty cash allocation
router.get('/petty-cash/eligible-users', async (req, res) => {
    try {
        console.log('🔍 Admin: Getting eligible users for petty cash allocation');
        
        const User = require('../../models/User');
        
        // Get users who are eligible for petty cash (not students/tenants)
        const eligibleUsers = await User.find({
            role: { 
                $in: ['admin', 'finance_admin', 'finance_user', 'property_manager', 'maintenance', 'manager', 'staff'] 
            },
            status: 'active'
        })
        .select('firstName lastName email role status')
        .sort({ firstName: 1, lastName: 1 })
        .lean();

        console.log(`✅ Admin: Found ${eligibleUsers.length} eligible users for petty cash`);
        
        res.json({
            success: true,
            eligibleUsers,
            total: eligibleUsers.length
        });

    } catch (error) {
        console.error('❌ Admin: Error getting eligible users for petty cash:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin can get petty cash accounts
router.get('/petty-cash/accounts', async (req, res) => {
    try {
        console.log('💰 Admin: Getting petty cash accounts');
        
        const Account = require('../../models/Account');
        
        // Get all petty cash accounts
        const pettyCashAccounts = await Account.find({
            code: { $in: ['1010', '1011', '1012', '1013', '1014'] }
        })
        .select('code name type balance')
        .sort({ code: 1 })
        .lean();

        // Map accounts to roles
        const accountRoleMapping = {
            '1010': { role: 'general', name: 'General Petty Cash' },
            '1011': { role: 'admin', name: 'Admin Petty Cash' },
            '1012': { role: 'finance', name: 'Finance Petty Cash' },
            '1013': { role: 'property_manager', name: 'Property Manager Petty Cash' },
            '1014': { role: 'maintenance', name: 'Maintenance Petty Cash' }
        };

        const accountsWithRoles = pettyCashAccounts.map(account => ({
            ...account,
            role: accountRoleMapping[account.code]?.role || 'general',
            displayName: accountRoleMapping[account.code]?.name || account.name
        }));

        console.log(`✅ Admin: Found ${accountsWithRoles.length} petty cash accounts`);
        
        res.json({
            success: true,
            pettyCashAccounts: accountsWithRoles,
            total: accountsWithRoles.length
        });

    } catch (error) {
        console.error('❌ Admin: Error getting petty cash accounts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin can get petty cash summary dashboard
router.get('/petty-cash/summary', async (req, res) => {
    try {
        console.log('📊 Admin: Getting petty cash summary dashboard');
        
        const Account = require('../../models/Account');
        
        // Get petty cash accounts with balances
        const pettyCashAccounts = await Account.find({
            code: { $in: ['1010', '1011', '1012', '1013', '1014'] }
        })
        .select('code name balance')
        .lean();

        // Calculate totals
        const totalPettyCash = pettyCashAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);
        
        // Get recent petty cash transactions
        const TransactionEntry = require('../../models/TransactionEntry');
        const recentTransactions = await TransactionEntry.find({
            source: { $in: ['petty_cash_allocation', 'petty_cash_expense', 'petty_cash_replenishment'] }
        })
        .sort({ date: -1 })
        .limit(10)
        .populate('transactionId')
        .lean();

        console.log(`✅ Admin: Petty cash summary - Total $${totalPettyCash}, ${recentTransactions.length} recent transactions`);
        
        res.json({
            success: true,
            summary: {
                totalPettyCash,
                totalAccounts: pettyCashAccounts.length,
                recentTransactions: recentTransactions.length
            },
            pettyCashAccounts,
            recentTransactions
        });

    } catch (error) {
        console.error('❌ Admin: Error getting petty cash summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin can get their own petty cash balance
router.get('/petty-cash/my-balance', async (req, res) => {
    try {
        console.log('👤 Admin: Getting own petty cash balance');
        
        const userId = req.user._id;
        return FinanceController.getPettyCashBalance({ params: { userId }, user: req.user }, res);

    } catch (error) {
        console.error('❌ Admin: Error getting own petty cash balance:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin can get their own petty cash transactions
router.get('/petty-cash/my-transactions', async (req, res) => {
    try {
        console.log('👤 Admin: Getting own petty cash transactions');
        
        const userId = req.user._id;
        return FinanceController.getPettyCashTransactions({ params: { userId }, user: req.user }, res);

    } catch (error) {
        console.error('❌ Admin: Error getting own petty cash transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 