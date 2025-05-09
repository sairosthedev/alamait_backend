const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { getPaymentHistory, uploadProofOfPayment, uploadNewProofOfPayment } = require('../../controllers/student/paymentHistoryController');

// Apply authentication and role middleware
router.use(auth);
router.use(checkRole('student'));

// Get payment history route
router.get('/', getPaymentHistory);

// Upload proof of payment route for existing payment
router.post('/:paymentId/upload-pop', uploadProofOfPayment);

// Upload new proof of payment route
router.post('/upload-pop', uploadNewProofOfPayment);

module.exports = router; 