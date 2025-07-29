const IncomeStatement = require('../../models/finance/IncomeStatement');
const BalanceSheet = require('../../models/finance/BalanceSheet');
const Expense = require('../../models/finance/Expense');
const Payment = require('../../models/Payment');
const Transaction = require('../../models/Transaction');

// Get all income statements
exports.getAllIncomeStatements = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        const [incomeStatements, total] = await Promise.all([
            IncomeStatement.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('residence', 'name')
                .populate('generatedBy', 'firstName lastName email')
                .populate('approvedBy', 'firstName lastName email')
                .lean(),
            IncomeStatement.countDocuments(query)
        ]);

        res.json({
            incomeStatements,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                totalItems: total
            }
        });
    } catch (error) {
        console.error('Error fetching income statements:', error);
        res.status(500).json({ error: 'Error fetching income statements' });
    }
};

// Get income statement by ID
exports.getIncomeStatementById = async (req, res) => {
    try {
        const incomeStatement = await IncomeStatement.findById(req.params.id)
            .populate('residence', 'name')
            .populate('generatedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        if (!incomeStatement) {
            return res.status(404).json({ error: 'Income statement not found' });
        }

        res.json(incomeStatement);
    } catch (error) {
        console.error('Error fetching income statement:', error);
        res.status(500).json({ error: 'Error fetching income statement' });
    }
};

// Get all balance sheets
exports.getAllBalanceSheets = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        const [balanceSheets, total] = await Promise.all([
            BalanceSheet.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('residence', 'name')
                .populate('generatedBy', 'firstName lastName email')
                .populate('approvedBy', 'firstName lastName email')
                .lean(),
            BalanceSheet.countDocuments(query)
        ]);

        res.json({
            balanceSheets,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                totalItems: total
            }
        });
    } catch (error) {
        console.error('Error fetching balance sheets:', error);
        res.status(500).json({ error: 'Error fetching balance sheets' });
    }
};

// Get balance sheet by ID
exports.getBalanceSheetById = async (req, res) => {
    try {
        const balanceSheet = await BalanceSheet.findById(req.params.id)
            .populate('residence', 'name')
            .populate('generatedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        if (!balanceSheet) {
            return res.status(404).json({ error: 'Balance sheet not found' });
        }

        res.json(balanceSheet);
    } catch (error) {
        console.error('Error fetching balance sheet:', error);
        res.status(500).json({ error: 'Error fetching balance sheet' });
    }
};

// Get cashflow data
exports.getCashflow = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        let startDate, endDate;

        const now = new Date();
        if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'quarter') {
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        }

        // Get cash inflows (payments)
        const cashInflows = await Payment.aggregate([
            {
                $match: {
                    status: 'Confirmed',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: '$createdAt' },
                        year: { $year: '$createdAt' }
                    },
                    total: { $sum: '$amount' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // Get cash outflows (expenses)
        const cashOutflows = await Expense.aggregate([
            {
                $match: {
                    expenseDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: '$expenseDate' },
                        year: { $year: '$expenseDate' }
                    },
                    total: { $sum: '$amount' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // Calculate net cashflow
        const cashflow = cashInflows.map(inflow => {
            const outflow = cashOutflows.find(out => 
                out._id.month === inflow._id.month && out._id.year === inflow._id.year
            );
            return {
                period: `${inflow._id.month}/${inflow._id.year}`,
                inflows: inflow.total,
                outflows: outflow ? outflow.total : 0,
                netCashflow: inflow.total - (outflow ? outflow.total : 0)
            };
        });

        res.json(cashflow);
    } catch (error) {
        console.error('Error fetching cashflow:', error);
        res.status(500).json({ error: 'Error fetching cashflow' });
    }
};

// Get all expenses
exports.getAllExpenses = async (req, res) => {
    try {
        const { page = 1, limit = 10, category, status } = req.query;
        const query = {};

        if (category) {
            query.category = category;
        }
        if (status) {
            query.paymentStatus = status;
        }

        const skip = (page - 1) * limit;

        const [expenses, total] = await Promise.all([
            Expense.find(query)
                .sort({ expenseDate: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('residence', 'name')
                .populate('createdBy', 'firstName lastName email')
                .populate('updatedBy', 'firstName lastName email')
                .lean(),
            Expense.countDocuments(query)
        ]);

        res.json({
            expenses,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                totalItems: total
            }
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Error fetching expenses' });
    }
};

// Get expense by ID
exports.getExpenseById = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id)
            .populate('residence', 'name')
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email');

        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        res.json(expense);
    } catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({ error: 'Error fetching expense' });
    }
}; 