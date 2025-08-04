const express = require('express');
const router = express.Router();
const accountController = require('../../controllers/finance/accountController');
const { checkRole, financeAccess } = require('../../middleware/auth');

// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all accounts with filtering and pagination
router.get('/', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    accountController.getAllAccounts
);

// Get account by ID
router.get('/:id', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    accountController.getAccountById
);

// Create new account (automatic code generation)
router.post('/', 
    checkRole(['finance_admin', 'admin', 'ceo']), 
    accountController.createAccount
);

// Update account
router.put('/:id', 
    checkRole(['finance_admin', 'admin', 'ceo']), 
    accountController.updateAccount
);

// Delete account (soft delete)
router.delete('/:id', 
    checkRole(['finance_admin', 'admin', 'ceo']), 
    accountController.deleteAccount
);

// Get account hierarchy
router.get('/hierarchy/all', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    accountController.getAccountHierarchy
);

// Get accounts by type
router.get('/type/:type', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    accountController.getAccountsByType
);

// Get account code suggestions
router.get('/suggestions/codes', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    accountController.getCodeSuggestions
);

// Validate account code
router.get('/validate/code/:code', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    accountController.validateAccountCode
);

// Get account type information
router.get('/type-info/:type', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    accountController.getAccountTypeInfo
);

// Bulk create accounts
router.post('/bulk', 
    checkRole(['finance_admin', 'admin', 'ceo']), 
    accountController.bulkCreateAccounts
);

// Get account statistics
router.get('/stats/overview', 
    checkRole(['finance', 'finance_admin', 'finance_user', 'admin', 'ceo']), 
    accountController.getAccountStats
);

module.exports = router; 