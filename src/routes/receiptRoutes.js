const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');
const { auth, checkRole } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// ===== RECEIPT ENDPOINTS =====

// Create receipt (Admin/Finance only)
router.post('/', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user'),
    receiptController.createReceipt
);

// Get all receipts with filtering (Admin/Finance/CEO only)
router.get('/', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'),
    receiptController.getAllReceipts
);

// Get receipt by ID (Admin/Finance/CEO only)
router.get('/:id', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'),
    receiptController.getReceiptById
);

// Get receipts by student (Admin/Finance/CEO/Student can see their own)
router.get('/student/:studentId', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo', 'student'),
    receiptController.getReceiptsByStudent
);

// Download receipt PDF (Admin/Finance/CEO/Student can download their own)
router.get('/:id/download', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo', 'student'),
    receiptController.downloadReceipt
);

// Resend receipt email (Admin/Finance only)
router.post('/:id/resend-email', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user'),
    receiptController.resendReceiptEmail
);

// Delete receipt (Admin/Finance only)
router.delete('/:id', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user'),
    receiptController.deleteReceipt
);

module.exports = router; 