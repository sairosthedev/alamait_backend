const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { auth, checkRole } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Invoice CRUD operations
router.post('/', 
    checkRole(['admin', 'finance_admin', 'finance_user']), 
    invoiceController.createInvoice
);

router.get('/', 
    checkRole(['admin', 'finance_admin', 'finance_user']), 
    invoiceController.getAllInvoices
);

router.get('/:id', 
    checkRole(['admin', 'finance_admin', 'finance_user']), 
    invoiceController.getInvoiceById
);

router.put('/:id', 
    checkRole(['admin', 'finance_admin', 'finance_user']), 
    invoiceController.updateInvoice
);

router.delete('/:id', 
    checkRole(['admin', 'finance_admin']), 
    invoiceController.deleteInvoice
);

// Payment operations
router.post('/:id/payments', 
    checkRole(['admin', 'finance_admin', 'finance_user']), 
    invoiceController.recordPayment
);

// Reminder operations
router.post('/:id/reminders', 
    checkRole(['admin', 'finance_admin', 'finance_user']), 
    invoiceController.sendReminder
);

// PDF generation
router.get('/:id/pdf', 
    checkRole(['admin', 'finance_admin', 'finance_user']), 
    invoiceController.generatePdf
);

// Special queries
router.get('/overdue/all', 
    checkRole(['admin', 'finance_admin', 'finance_user']), 
    invoiceController.getOverdueInvoices
);

router.get('/student/:studentId', 
    checkRole(['admin', 'finance_admin', 'finance_user']), 
    invoiceController.getStudentInvoices
);

// Bulk operations
router.post('/bulk/reminders', 
    checkRole(['admin', 'finance_admin']), 
    invoiceController.bulkSendReminders
);

module.exports = router; 