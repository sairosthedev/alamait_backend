const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    createStudentAccount,
    getStudentAccount,
    getAllStudentAccounts,
    updateStudentAccount,
    getStudentAccountSummary
} = require('../../controllers/finance/studentAccountManagementController');

// Apply auth middleware to all routes
router.use(auth);

// Create individual student account (Finance only)
router.post('/', checkRole('finance', 'finance_admin', 'finance_user', 'admin'), createStudentAccount);

// Get all student accounts (Finance only)
router.get('/', checkRole('finance', 'finance_admin', 'finance_user', 'admin'), getAllStudentAccounts);

// Get individual student account (Finance only)
router.get('/:studentId', checkRole('finance', 'finance_admin', 'finance_user', 'admin'), getStudentAccount);

// Get student account summary with payment history (Finance only)
router.get('/:studentId/summary', checkRole('finance', 'finance_admin', 'finance_user', 'admin'), getStudentAccountSummary);

// Update student account (Finance only)
router.put('/:studentId', checkRole('finance', 'finance_admin', 'finance_user', 'admin'), updateStudentAccount);

module.exports = router; 