const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get transaction entries with filters
router.get('/entries', authenticateToken, transactionController.getTransactionEntries);

// Get transaction summary
router.get('/summary', authenticateToken, transactionController.getTransactionSummary);

// Get single transaction entry
router.get('/entries/:id', authenticateToken, transactionController.getTransactionEntry);

// Create manual transaction entry
router.post('/entries', authenticateToken, authorizeRoles(['admin', 'finance']), transactionController.createTransactionEntry);

// Get accounts for dropdown
router.get('/accounts', authenticateToken, transactionController.getAccounts);

module.exports = router; 