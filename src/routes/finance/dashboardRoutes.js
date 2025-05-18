const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/finance/dashboardController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Finance overview (finance admin and admin)
router.get('/overview', 
    checkRole('admin', 'finance_admin'), 
    dashboardController.getFinanceOverview
);

// Income by period (finance admin and admin)
router.get('/income/period', 
    checkRole('admin', 'finance_admin'), 
    dashboardController.getIncomeByPeriod
);

// Expenses by period (finance admin and admin)
router.get('/expenses/period', 
    checkRole('admin', 'finance_admin'), 
    dashboardController.getExpensesByPeriod
);

// Expenses by category (finance admin and admin)
router.get('/expenses/category', 
    checkRole('admin', 'finance_admin'), 
    dashboardController.getExpensesByCategory
);

// Income by residence (finance admin and admin)
router.get('/income/residence', 
    checkRole('admin', 'finance_admin'), 
    dashboardController.getIncomeByResidence
);

module.exports = router; 