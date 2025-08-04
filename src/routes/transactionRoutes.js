const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { auth, checkRole } = require('../middleware/auth');

// All routes require authentication and admin/finance/CEO roles
router.use(auth);
router.use(checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'));

// ===== TRANSACTION ENTRIES ENDPOINTS =====

// Get all transaction entries with filtering and pagination
router.get('/entries', transactionController.getTransactionEntries);

// Get transaction summary/statistics
router.get('/summary', transactionController.getTransactionSummary);

// Get single transaction entry by ID
router.get('/entries/:id', transactionController.getTransactionEntry);

// Create manual transaction entry (admin/finance only)
router.post('/entries', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user'), 
    transactionController.createTransactionEntry
);

// Update transaction entry (admin/finance only)
router.put('/entries/:id', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user'), 
    transactionController.updateTransactionEntry
);

// Delete transaction entry (admin/finance only)
router.delete('/entries/:id', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user'), 
    transactionController.deleteTransactionEntry
);

// ===== TRANSACTIONS ENDPOINTS =====

// Get all transactions with filtering and pagination
router.get('/', transactionController.getAllTransactions);

// Get single transaction by ID
router.get('/:id', transactionController.getTransactionById);

// Create new transaction (admin/finance only)
router.post('/', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user'), 
    transactionController.createTransaction
);

// Update transaction (admin/finance only)
router.put('/:id', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user'), 
    transactionController.updateTransaction
);

// Delete transaction (admin/finance only)
router.delete('/:id', 
    checkRole('admin', 'finance', 'finance_admin', 'finance_user'), 
    transactionController.deleteTransaction
);

// ===== ACCOUNTS ENDPOINTS =====

// Get all accounts for dropdown/selection
router.get('/accounts', transactionController.getAccounts);

// Get accounts with detailed information
router.get('/accounts/detailed', transactionController.getDetailedAccounts);

// Get account by ID
router.get('/accounts/:id', transactionController.getAccountById);

module.exports = router; 