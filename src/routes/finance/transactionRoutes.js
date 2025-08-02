const express = require('express');
const router = express.Router();
const transactionController = require('../../controllers/finance/transactionController');
const { checkRole } = require('../../middleware/auth');

// Get all transactions
router.get('/', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    transactionController.getAllTransactions
);

// Get transaction by ID
router.get('/:id', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    transactionController.getTransactionById
);

// Get transaction entries
router.get('/:id/entries', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    transactionController.getTransactionEntries
);

// Get transaction summary
router.get('/summary', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    transactionController.getTransactionSummary
);

// Get transaction entries with filters
router.get('/transaction-entries', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    transactionController.getTransactionEntriesWithFilters
);

module.exports = router; 