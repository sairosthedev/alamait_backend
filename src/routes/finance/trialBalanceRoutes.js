const express = require('express');
const router = express.Router();
const FinancialReportsController = require('../../controllers/financialReportsController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// All routes require finance role authorization
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

// Generate dynamic trial balance report
// GET /api/finance/trial-balance/report?asOf=2024-12-31&basis=cash
router.get('/report/generate', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    FinancialReportsController.generateTrialBalance
);

// Get trial balance summary
router.get('/summary', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    async (req, res) => {
        try {
            const { asOf = new Date().toISOString().split('T')[0], basis = 'cash' } = req.query;
            const trialBalance = await FinancialReportsController.generateTrialBalance(req, res);
            return trialBalance;
        } catch (error) {
            console.error('Error generating trial balance summary:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating trial balance summary',
                error: error.message
            });
        }
    }
);

module.exports = router; 