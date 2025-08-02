const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');

// Get all transactions with filters
exports.getAllTransactions = async (req, res) => {
    try {
        const { 
            type, 
            startDate, 
            endDate, 
            residence, 
            limit = 50, 
            page = 1 
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (type) {
            filter.type = type;
        }
        
        if (startDate && endDate) {
            filter.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (startDate) {
            filter.date = { $gte: new Date(startDate) };
        } else if (endDate) {
            filter.date = { $lte: new Date(endDate) };
        }
        
        if (residence) {
            filter.residence = residence;
        }

        // Calculate skip value for pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get transactions with pagination
        const transactions = await Transaction.find(filter)
            .populate('residence', 'name')
            .populate('expenseId', 'expenseId description')
            .populate('createdBy', 'firstName lastName email')
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        // Get total count for pagination
        const total = await Transaction.countDocuments(filter);

        res.status(200).json({
            transactions,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get transaction by ID
exports.getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await Transaction.findById(id)
            .populate('residence', 'name')
            .populate('expenseId', 'expenseId description')
            .populate('createdBy', 'firstName lastName email')
            .populate('entries');

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        res.status(200).json({ transaction });

    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get transaction entries
exports.getTransactionEntries = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await Transaction.findById(id);
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const entries = await TransactionEntry.find({ transaction: id })
            .populate('account', 'code name type');

        res.status(200).json({ entries });

    } catch (error) {
        console.error('Error fetching transaction entries:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get transaction summary
exports.getTransactionSummary = async (req, res) => {
    try {
        const { 
            startDate, 
            endDate, 
            type, 
            account, 
            status 
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (type) {
            filter.type = type;
        }
        
        if (startDate && endDate) {
            filter.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (startDate) {
            filter.date = { $gte: new Date(startDate) };
        } else if (endDate) {
            filter.date = { $lte: new Date(endDate) };
        }

        // Get transactions
        const transactions = await Transaction.find(filter);
        
        // Calculate summary
        const summary = {
            totalTransactions: transactions.length,
            totalAmount: transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
            byType: {},
            byMonth: {},
            recentTransactions: transactions.slice(0, 10)
        };

        // Group by type
        transactions.forEach(transaction => {
            const type = transaction.type || 'other';
            if (!summary.byType[type]) {
                summary.byType[type] = {
                    count: 0,
                    amount: 0
                };
            }
            summary.byType[type].count++;
            summary.byType[type].amount += transaction.amount || 0;
        });

        // Group by month
        transactions.forEach(transaction => {
            const month = new Date(transaction.date).toISOString().substring(0, 7); // YYYY-MM
            if (!summary.byMonth[month]) {
                summary.byMonth[month] = {
                    count: 0,
                    amount: 0
                };
            }
            summary.byMonth[month].count++;
            summary.byMonth[month].amount += transaction.amount || 0;
        });

        res.status(200).json({ summary });

    } catch (error) {
        console.error('Error fetching transaction summary:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get transaction entries with filters
exports.getTransactionEntriesWithFilters = async (req, res) => {
    try {
        const { 
            startDate, 
            endDate, 
            type, 
            account, 
            status,
            limit = 50,
            page = 1
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (type) {
            filter.type = type;
        }
        
        if (account) {
            filter.account = account;
        }

        // Get transaction IDs first if date filter is applied
        let transactionIds = null;
        if (startDate || endDate) {
            const dateFilter = {};
            if (startDate && endDate) {
                dateFilter.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            } else if (startDate) {
                dateFilter.date = { $gte: new Date(startDate) };
            } else if (endDate) {
                dateFilter.date = { $lte: new Date(endDate) };
            }
            
            const transactions = await Transaction.find(dateFilter).select('_id');
            transactionIds = transactions.map(t => t._id);
            filter.transaction = { $in: transactionIds };
        }

        // Calculate skip value for pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get entries with pagination
        const entries = await TransactionEntry.find(filter)
            .populate('transaction', 'transactionId date description type')
            .populate('account', 'code name type')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        // Get total count for pagination
        const total = await TransactionEntry.countDocuments(filter);

        res.status(200).json({
            entries,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching transaction entries:', error);
        res.status(500).json({ message: error.message });
    }
}; 