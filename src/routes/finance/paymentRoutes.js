const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const { registerPaymentRoutes, updateStatusValidation } = require('../shared/registerPaymentRoutes');
const {
    getStudentPayments,
    getPaymentsByStudent,
    updatePaymentStatus: updateStudentPaymentStatus,
    requestClarification,
    processPayment
} = require('../../controllers/finance/paymentController');

const requestClarificationValidation = [
    check('message', 'Clarification message is required').notEmpty().trim()
];

const financeRoles = ['finance', 'finance_admin', 'finance_user'];

router.use(auth);
router.use(checkRole(...financeRoles));

// Register specific paths before parameterized /:id routes
router.get('/students', getStudentPayments);
router.get('/students/:studentId', getPaymentsByStudent);
router.put('/students/:paymentId/status', updateStatusValidation, updateStudentPaymentStatus);
router.post('/students/:paymentId/clarification', requestClarificationValidation, requestClarification);
router.post('/process-payment', processPayment);

registerPaymentRoutes(router, {
    readRoles: financeRoles,
    createRoles: financeRoles,
    updateRoles: financeRoles,
    deleteRoles: financeRoles,
    includeGetById: true
});

module.exports = router;
