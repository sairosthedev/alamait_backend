const express = require('express');
const router = express.Router();
const FinancialReportsController = require('../../controllers/financialReportsController');
const { auth, checkRole, financeAccess } = require('../../middleware/auth');

// All routes require finance role authorization
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

/**
 * INCOME ENDPOINTS
 * 
 * These endpoints provide comprehensive income data and analysis
 */

// Get all income transactions (from TransactionEntry)
// GET /api/finance/income/transactions?period=2024&basis=cash&type=all
router.get('/transactions', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    async (req, res) => {
        try {
            const { period, basis = 'cash', type = 'all', page = 1, limit = 20 } = req.query;
            
            // Get income transactions from TransactionEntry
            const TransactionEntry = require('../../models/TransactionEntry');
            
            const query = {
                'entries.accountType': 'Income'
            };
            
            // Add period filter if provided
            if (period) {
                const startDate = new Date(`${period}-01-01`);
                const endDate = new Date(`${period}-12-31`);
                query.date = { $gte: startDate, $lte: endDate };
            }
            
            // Add type filter
            if (type !== 'all') {
                query['entries.accountCode'] = type === 'rent' ? '4001' : 
                                             type === 'other' ? { $ne: '4001' } : 
                                             type;
            }
            
            const skip = (page - 1) * limit;
            
            const transactions = await TransactionEntry.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('sourceId', 'paymentId student residence room totalAmount method status')
                .lean();
            
            const total = await TransactionEntry.countDocuments(query);
            
            // Process transactions to extract income details
            const incomeTransactions = transactions.map(txn => {
                const incomeEntry = txn.entries.find(entry => entry.accountType === 'Income');
                return {
                    transactionId: txn.transactionId,
                    date: txn.date,
                    description: txn.description,
                    reference: txn.reference,
                    incomeType: incomeEntry?.accountName || 'Unknown Income',
                    incomeCode: incomeEntry?.accountCode || '',
                    amount: incomeEntry?.credit || 0,
                    source: txn.source,
                    sourceData: txn.sourceId,
                    createdBy: txn.createdBy
                };
            });
            
            res.json({
                success: true,
                data: {
                    transactions: incomeTransactions,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(total / limit),
                        total,
                        limit: parseInt(limit)
                    }
                },
                message: `Income transactions retrieved successfully`
            });
            
        } catch (error) {
            console.error('Error fetching income transactions:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching income transactions',
                error: error.message
            });
        }
    }
);

// Get income summary by type
// GET /api/finance/income/summary?period=2024&basis=cash
router.get('/summary', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    async (req, res) => {
        try {
            const { period, basis = 'cash' } = req.query;
            
            // Get income summary from TransactionEntry
            const TransactionEntry = require('../../models/TransactionEntry');
            
            const query = {
                'entries.accountType': 'Income'
            };
            
            // Add period filter if provided
            if (period) {
                const startDate = new Date(`${period}-01-01`);
                const endDate = new Date(`${period}-12-31`);
                query.date = { $gte: startDate, $lte: endDate };
            }
            
            const transactions = await TransactionEntry.find(query).lean();
            
            // Group by income type
            const incomeByType = {};
            let totalIncome = 0;
            
            transactions.forEach(txn => {
                txn.entries.forEach(entry => {
                    if (entry.accountType === 'Income') {
                        const incomeType = entry.accountName || 'Unknown Income';
                        const amount = entry.credit || 0;
                        
                        if (!incomeByType[incomeType]) {
                            incomeByType[incomeType] = {
                                accountCode: entry.accountCode,
                                accountName: incomeType,
                                total: 0,
                                transactionCount: 0
                            };
                        }
                        
                        incomeByType[incomeType].total += amount;
                        incomeByType[incomeType].transactionCount += 1;
                        totalIncome += amount;
                    }
                });
            });
            
            // Convert to array and sort by total
            const incomeSummary = Object.values(incomeByType)
                .sort((a, b) => b.total - a.total);
            
            res.json({
                success: true,
                data: {
                    period: period || 'All Time',
                    basis,
                    totalIncome,
                    incomeByType: incomeSummary,
                    summary: {
                        totalTransactions: transactions.length,
                        averagePerTransaction: transactions.length > 0 ? totalIncome / transactions.length : 0,
                        topIncomeSource: incomeSummary[0]?.accountName || 'None'
                    }
                },
                message: `Income summary generated successfully`
            });
            
        } catch (error) {
            console.error('Error generating income summary:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating income summary',
                error: error.message
            });
        }
    }
);

// Get income by source (payments, invoices, other)
// GET /api/finance/income/by-source?period=2024&basis=cash
router.get('/by-source', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    async (req, res) => {
        try {
            const { period, basis = 'cash' } = req.query;
            
            const TransactionEntry = require('../../models/TransactionEntry');
            
            const query = {
                'entries.accountType': 'Income'
            };
            
            if (period) {
                const startDate = new Date(`${period}-01-01`);
                const endDate = new Date(`${period}-12-31`);
                query.date = { $gte: startDate, $lte: endDate };
            }
            
            const transactions = await TransactionEntry.find(query).lean();
            
            // Group by source
            const incomeBySource = {
                payments: { total: 0, count: 0, description: 'Student Rent Payments' },
                invoices: { total: 0, count: 0, description: 'Invoice Payments' },
                other: { total: 0, count: 0, description: 'Other Income' }
            };
            
            transactions.forEach(txn => {
                const incomeEntry = txn.entries.find(entry => entry.accountType === 'Income');
                const amount = incomeEntry?.credit || 0;
                
                if (txn.source === 'payment') {
                    incomeBySource.payments.total += amount;
                    incomeBySource.payments.count += 1;
                } else if (txn.source === 'invoice_payment') {
                    incomeBySource.invoices.total += amount;
                    incomeBySource.invoices.count += 1;
                } else {
                    incomeBySource.other.total += amount;
                    incomeBySource.other.count += 1;
                }
            });
            
            const totalIncome = Object.values(incomeBySource).reduce((sum, source) => sum + source.total, 0);
            
            res.json({
                success: true,
                data: {
                    period: period || 'All Time',
                    basis,
                    totalIncome,
                    incomeBySource,
                    summary: {
                        topSource: Object.entries(incomeBySource)
                            .sort(([,a], [,b]) => b.total - a.total)[0][0]
                    }
                },
                message: `Income by source generated successfully`
            });
            
        } catch (error) {
            console.error('Error generating income by source:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating income by source',
                error: error.message
            });
        }
    }
);

// Get income trends (monthly breakdown)
// GET /api/finance/income/trends?period=2024&basis=cash
router.get('/trends', 
    checkRole('admin', 'finance_admin', 'finance_user', 'ceo'),
    async (req, res) => {
        try {
            const { period, basis = 'cash' } = req.query;
            
            const TransactionEntry = require('../../models/TransactionEntry');
            
            const query = {
                'entries.accountType': 'Income'
            };
            
            if (period) {
                const startDate = new Date(`${period}-01-01`);
                const endDate = new Date(`${period}-12-31`);
                query.date = { $gte: startDate, $lte: endDate };
            }
            
            const transactions = await TransactionEntry.find(query).lean();
            
            // Group by month
            const monthlyIncome = {};
            
            transactions.forEach(txn => {
                const month = txn.date.toISOString().substring(0, 7); // YYYY-MM
                const incomeEntry = txn.entries.find(entry => entry.accountType === 'Income');
                const amount = incomeEntry?.credit || 0;
                
                if (!monthlyIncome[month]) {
                    monthlyIncome[month] = {
                        month,
                        total: 0,
                        count: 0,
                        rentIncome: 0,
                        otherIncome: 0
                    };
                }
                
                monthlyIncome[month].total += amount;
                monthlyIncome[month].count += 1;
                
                // Categorize by income type
                if (incomeEntry?.accountCode === '4001') {
                    monthlyIncome[month].rentIncome += amount;
                } else {
                    monthlyIncome[month].otherIncome += amount;
                }
            });
            
            // Convert to array and sort by month
            const trends = Object.values(monthlyIncome)
                .sort((a, b) => a.month.localeCompare(b.month));
            
            res.json({
                success: true,
                data: {
                    period: period || 'All Time',
                    basis,
                    trends,
                    summary: {
                        totalMonths: trends.length,
                        averageMonthlyIncome: trends.length > 0 ? 
                            trends.reduce((sum, month) => sum + month.total, 0) / trends.length : 0,
                        bestMonth: trends.length > 0 ? 
                            trends.reduce((best, month) => month.total > best.total ? month : best) : null
                    }
                },
                message: `Income trends generated successfully`
            });
            
        } catch (error) {
            console.error('Error generating income trends:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating income trends',
                error: error.message
            });
        }
    }
);

module.exports = router; 