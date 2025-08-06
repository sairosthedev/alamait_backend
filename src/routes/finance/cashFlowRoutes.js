const express = require('express');
const router = express.Router();
const FinancialReportsController = require('../../controllers/financialReportsController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// All routes require finance role authorization
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

// Generate dynamic cash flow statement report
// GET /api/finance/cash-flow/report?period=2024&basis=cash
router.get('/report/generate', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    FinancialReportsController.generateCashFlowStatement
);

// Get cash flow summary
router.get('/summary', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    async (req, res) => {
        try {
            const { period = new Date().getFullYear().toString(), basis = 'cash' } = req.query;
            const cashFlow = await FinancialReportsController.generateCashFlowStatement(req, res);
            return cashFlow;
        } catch (error) {
            console.error('Error generating cash flow summary:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating cash flow summary',
                error: error.message
            });
        }
    }
);

module.exports = router; 