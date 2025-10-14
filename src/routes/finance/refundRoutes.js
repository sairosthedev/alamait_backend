const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const refundController = require('../../controllers/finance/refundController');

// Auth + Finance/Admin required
router.use(auth);
router.use(checkAdminOrFinance);

// List payments for a student (to choose refunds source)
router.get('/payments', refundController.listStudentPayments);

// Create a refund entry
router.post('/', refundController.createRefund);

module.exports = router;





