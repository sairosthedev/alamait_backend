const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');

// Import CEO controllers for request management
const requestController = require('../../controllers/ceo/requestController');
const auditController = require('../../controllers/ceo/auditController');

// Import finance controllers for financial data (same as finance routes)
const balanceSheetController = require('../../controllers/finance/balanceSheetController');
const incomeStatementController = require('../../controllers/finance/incomeStatementController');
const expenseController = require('../../controllers/finance/expenseController');
const TransactionController = require('../../controllers/finance/transactionController');

// Import analytics service for dashboard data (same as admin uses)
const analyticsService = require('../../services/analyticsService');

// Validation middleware
const approvalValidation = [
    check('notes').optional().trim().notEmpty().withMessage('Notes cannot be empty if provided')
];

const rejectionValidation = [
    check('notes').notEmpty().trim().withMessage('Rejection notes are required')
];

const quotationChangeValidation = [
    check('quotationId').notEmpty().withMessage('Quotation ID is required'),
    check('reason').notEmpty().trim().withMessage('Reason for quotation change is required')
];

// All CEO routes require CEO role
router.use(auth);
router.use(checkRole('ceo'));

// Dashboard data (same as admin dashboard)
router.get('/dashboard/overview', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        const [financial, students, maintenance] = await Promise.all([
            analyticsService.getFinancialOverview(start, end),
            analyticsService.getStudentStatistics(),
            analyticsService.getMaintenanceOverview()
        ]);

        res.json({
            financial,
            students,
            maintenance
        });
    } catch (error) {
        console.error('Dashboard overview error:', error);
        res.status(500).json({ message: 'Error fetching dashboard overview' });
    }
});

// Financial data (same endpoints as finance uses)
router.get('/financial/income-statements', incomeStatementController.getAllIncomeStatements);
router.get('/financial/income-statements/:id', incomeStatementController.getIncomeStatementById);
router.get('/financial/balance-sheets', balanceSheetController.getAllBalanceSheets);
router.get('/financial/balance-sheets/:id', balanceSheetController.getBalanceSheetById);
router.get('/financial/expenses', expenseController.getAllExpenses);
router.get('/financial/expenses/:id', expenseController.getExpenseById);

// Transaction data (same endpoints as finance uses)
router.get('/financial/transactions', TransactionController.getAllTransactions);
router.get('/financial/transactions/summary', TransactionController.getTransactionSummary);
router.get('/financial/transactions/entries', TransactionController.getTransactionEntries);
router.get('/financial/transactions/:id', TransactionController.getTransactionById);
router.get('/financial/transactions/:id/entries', TransactionController.getTransactionEntriesById);
router.get('/financial/transactions/transaction-history/:sourceType/:sourceId', TransactionController.getTransactionHistory);

// Request management (CEO specific)
router.get('/requests', requestController.getAllRequests);
router.get('/requests/:id', requestController.getRequestById);
router.get('/requests/pending-ceo-approval', requestController.getPendingCEOApproval);
router.patch('/requests/:id/approve', approvalValidation, requestController.approveRequest);
router.patch('/requests/:id/reject', rejectionValidation, requestController.rejectRequest);
router.patch('/requests/:id/change-quotation', quotationChangeValidation, requestController.changeQuotation);

// Audit data (same endpoints as finance uses)
router.get('/audit/reports', auditController.getAuditReports);
router.get('/audit/trail', auditController.getAuditTrail);
router.get('/audit/trail/:id', auditController.getAuditTrailById);

// Simple audit log endpoint (similar to admin audit-log)
router.get('/audit-log', auditController.getAuditLogs);

// CEO Financial Overview - Income and Expenses combined
router.get('/financial/overview', async (req, res) => {
    try {
        const { 
            period = new Date().getFullYear().toString(),
            basis = 'cash',
            startDate,
            endDate,
            residence,
            page = 1,
            limit = 20
        } = req.query;

        // Import required models
        const TransactionEntry = require('../../models/TransactionEntry');
        const Expense = require('../../models/Expense');

        // Build date filter
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        } else if (period) {
            const startOfYear = new Date(`${period}-01-01`);
            const endOfYear = new Date(`${period}-12-31`);
            dateFilter = {
                date: {
                    $gte: startOfYear,
                    $lte: endOfYear
                }
            };
        }

        // Build residence filter
        let residenceFilter = {};
        if (residence) {
            residenceFilter = { residence: residence };
        }

        // Fetch income data from TransactionEntry
        const incomeQuery = {
            ...dateFilter,
            'entries.accountType': 'Income'
        };

        const incomeTransactions = await TransactionEntry.find(incomeQuery)
            .sort({ date: -1 })
            .populate('sourceId', 'paymentId student residence room totalAmount method status')
            .lean();

        // Calculate income summary
        const incomeSummary = {
            totalIncome: 0,
            incomeByType: {},
            totalTransactions: incomeTransactions.length,
            recentTransactions: incomeTransactions.slice(0, 10)
        };

        incomeTransactions.forEach(transaction => {
            transaction.entries.forEach(entry => {
                if (entry.accountType === 'Income' && entry.credit > 0) {
                    const incomeType = `${entry.accountCode} - ${entry.accountName}`;
                    incomeSummary.totalIncome += entry.credit;
                    incomeSummary.incomeByType[incomeType] = (incomeSummary.incomeByType[incomeType] || 0) + entry.credit;
                }
            });
        });

        // Fetch expense data
        const expenseQuery = {
            ...residenceFilter
        };

        // Add date filter for expenses
        if (startDate && endDate) {
            expenseQuery.expenseDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (period) {
            const startOfYear = new Date(`${period}-01-01`);
            const endOfYear = new Date(`${period}-12-31`);
            expenseQuery.expenseDate = {
                $gte: startOfYear,
                $lte: endOfYear
            };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [expenses, totalExpenses] = await Promise.all([
            Expense.find(expenseQuery)
                .sort({ expenseDate: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('vendor', 'businessName contactPerson phone email')
                .populate('residence', 'name address')
                .populate('createdBy', 'firstName lastName email')
                .populate('approvedBy', 'firstName lastName email')
                .lean(),
            Expense.countDocuments(expenseQuery)
        ]);

        // Calculate expense summary
        const expenseSummary = {
            totalExpenses: 0,
            paidExpenses: 0,
            pendingExpenses: 0,
            expensesByCategory: {},
            expensesByStatus: {},
            totalCount: totalExpenses
        };

        // Get all expenses for summary calculation (not paginated)
        const allExpenses = await Expense.find(expenseQuery)
            .populate('vendor', 'businessName')
            .populate('residence', 'name')
            .lean();

        allExpenses.forEach(expense => {
            expenseSummary.totalExpenses += expense.amount;
            
            // Count by status
            expenseSummary.expensesByStatus[expense.status] = (expenseSummary.expensesByStatus[expense.status] || 0) + expense.amount;
            
            // Count by category
            expenseSummary.expensesByCategory[expense.category] = (expenseSummary.expensesByCategory[expense.category] || 0) + expense.amount;
            
            // Count paid vs pending
            if (expense.paymentStatus === 'paid') {
                expenseSummary.paidExpenses += expense.amount;
            } else {
                expenseSummary.pendingExpenses += expense.amount;
            }
        });

        // Calculate net income
        const netIncome = incomeSummary.totalIncome - expenseSummary.totalExpenses;

        // Prepare response
        const response = {
            success: true,
            message: `Financial overview for ${period}`,
            data: {
                period,
                basis,
                dateRange: startDate && endDate ? { startDate, endDate } : null,
                residence: residence || 'all',
                
                // Income data
                income: {
                    summary: incomeSummary,
                    transactions: expenses.length > 0 ? incomeSummary.recentTransactions : []
                },
                
                // Expense data
                expenses: {
                    summary: expenseSummary,
                    items: expenses,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalExpenses / parseInt(limit)),
                        total: totalExpenses,
                        limit: parseInt(limit)
                    }
                },
                
                // Financial summary
                financialSummary: {
                    totalIncome: incomeSummary.totalIncome,
                    totalExpenses: expenseSummary.totalExpenses,
                    netIncome: netIncome,
                    profitMargin: incomeSummary.totalIncome > 0 ? ((netIncome / incomeSummary.totalIncome) * 100).toFixed(2) : 0,
                    expenseRatio: incomeSummary.totalIncome > 0 ? ((expenseSummary.totalExpenses / incomeSummary.totalIncome) * 100).toFixed(2) : 0
                },
                
                // Quick stats
                quickStats: {
                    totalTransactions: incomeSummary.totalTransactions + expenseSummary.totalCount,
                    averageIncome: incomeSummary.totalTransactions > 0 ? (incomeSummary.totalIncome / incomeSummary.totalTransactions).toFixed(2) : 0,
                    averageExpense: expenseSummary.totalCount > 0 ? (expenseSummary.totalExpenses / expenseSummary.totalCount).toFixed(2) : 0,
                    topIncomeSource: Object.keys(incomeSummary.incomeByType).length > 0 ? 
                        Object.entries(incomeSummary.incomeByType).sort(([,a], [,b]) => b - a)[0][0] : 'None',
                    topExpenseCategory: Object.keys(expenseSummary.expensesByCategory).length > 0 ? 
                        Object.entries(expenseSummary.expensesByCategory).sort(([,a], [,b]) => b - a)[0][0] : 'None'
                }
            }
        };

        res.json(response);

    } catch (error) {
        console.error('CEO Financial Overview Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching financial overview',
            error: error.message
        });
    }
});

module.exports = router; 