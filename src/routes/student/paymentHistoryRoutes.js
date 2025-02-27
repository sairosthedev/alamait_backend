const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { getPaymentHistory } = require('../../controllers/student/paymentHistoryController');

// Apply authentication and role middleware
router.use(auth);
router.use(checkRole('student'));

// Get payment history route
router.get('/', getPaymentHistory);

module.exports = router; 