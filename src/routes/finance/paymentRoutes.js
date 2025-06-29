const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');
const {
    getStudentPayments,
    updatePaymentStatus,
    requestClarification
} = require('../../controllers/finance/paymentController');

// Validation middleware
const updateStatusValidation = [
    check('status').isIn(['Pending', 'Confirmed', 'Failed', 'Verified', 'Rejected', 'Clarification Requested'])
];

const requestClarificationValidation = [
    check('message', 'Clarification message is required').notEmpty().trim()
];

// All routes require finance role authorization
router.use(auth);
router.use(financeAccess);

// Get all payments (alias for student payments)
router.get('/', getStudentPayments);

// Get all student payments with pagination and filtering
router.get('/students', getStudentPayments);

// Update payment status
router.put('/students/:paymentId/status', updateStatusValidation, updatePaymentStatus);

// Request clarification for a payment
router.post('/students/:paymentId/clarification', requestClarificationValidation, requestClarification);

module.exports = router; 