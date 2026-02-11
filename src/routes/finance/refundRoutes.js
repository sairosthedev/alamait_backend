const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const refundController = require('../../controllers/finance/refundController');

// Auth + Finance/Admin required
router.use(auth);
router.use(checkAdminOrFinance);

// List all refunds with filtering
router.get('/', refundController.listRefunds);

// Get refund by ID
router.get('/:refundId', refundController.getRefundById);

// List payments for a student (to choose refunds source)
router.get('/payments', refundController.listStudentPayments);

// Create a refund entry (automatically creates transaction by default)
router.post('/', refundController.createRefund);

// Process existing refund (create transaction if not already created)
router.post('/:refundId/process', refundController.processRefund);

module.exports = router;






