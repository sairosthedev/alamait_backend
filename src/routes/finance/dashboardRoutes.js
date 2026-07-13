const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/finance/dashboardController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');
const { executiveDashboardHandler } = require('../../middleware/dashboardExecutiveGateway');

// Apply authentication middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Executive dashboard (finance portal)
router.get('/executive', executiveDashboardHandler);

// Finance overview (finance admin, admin, and CEO)
router.get('/overview', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    dashboardController.getFinanceOverview
);

// Income by period (finance admin, admin, and CEO)
router.get('/income/period', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    dashboardController.getIncomeByPeriod
);

// Expenses by period (finance admin, admin, and CEO)
router.get('/expenses/period', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    dashboardController.getExpensesByPeriod
);

// Expenses by category (finance admin, admin, and CEO)
router.get('/expenses/category', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    dashboardController.getExpensesByCategory
);

// Income by residence (finance admin, admin, and CEO)
router.get('/income/residence', 
    checkRole('admin', 'finance_admin', 'ceo'), 
    dashboardController.getIncomeByResidence
);

// Unified dashboard badge counts (replaces multiple pending-count calls)
router.get('/badges',
    checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'),
    dashboardController.getDashboardBadges
);

module.exports = router; 