const express = require('express');
const router = express.Router();
const accountController = require('../../controllers/finance/accountController');
const { checkRole } = require('../../middleware/auth');

const financeRoles = ['finance', 'finance_admin', 'finance_user', 'admin', 'ceo'];
const adminRoles = ['finance_admin', 'admin', 'ceo'];

// Get all accounts with filtering and pagination
router.get('/',
    checkRole(financeRoles),
    accountController.getAllAccounts
);

// --- Static paths BEFORE /:id so they are not captured as ids ---

// Allowed types + categories for create-account UI
router.get('/meta/types',
    checkRole(financeRoles),
    accountController.getAccountTypesMeta
);

// Get account hierarchy
router.get('/hierarchy/all',
    checkRole(financeRoles),
    accountController.getAccountHierarchy
);

// Get account code suggestions
router.get('/code-suggestions',
    checkRole(financeRoles),
    accountController.getCodeSuggestions
);

// Get next available account code
router.get('/next-code',
    checkRole(financeRoles),
    accountController.getNextAccountCode
);

// Validate account code
router.get('/validate/code/:code',
    checkRole(financeRoles),
    accountController.validateAccountCode
);

// Get account type information + categories
router.get('/type-info/:type',
    checkRole(financeRoles),
    accountController.getAccountTypeInfo
);

// Get accounts by type
router.get('/type/:type',
    checkRole(financeRoles),
    accountController.getAccountsByType
);

// Get account statistics
router.get('/stats/overview',
    checkRole(financeRoles),
    accountController.getAccountStats
);

// Get debtors by application code
router.get('/debtors/application/:applicationCode',
    checkRole(financeRoles),
    accountController.getDebtorsByApplicationCode
);

// Bulk create accounts
router.post('/bulk',
    checkRole(adminRoles),
    accountController.bulkCreateAccounts
);

// Create new account (automatic code generation)
router.post('/',
    checkRole(adminRoles),
    accountController.createAccount
);

// Get account by ID
router.get('/:id',
    checkRole(financeRoles),
    accountController.getAccountById
);

// Update account
router.put('/:id',
    checkRole(adminRoles),
    accountController.updateAccount
);

// Delete account (soft delete)
router.delete('/:id',
    checkRole(adminRoles),
    accountController.deleteAccount
);

module.exports = router;
