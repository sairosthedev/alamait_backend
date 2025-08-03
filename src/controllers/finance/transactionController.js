const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');

// Get transaction entries with filters
exports.getTransactionEntriesWithFilters = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            startDate,
            endDate,
            type,
            account,
            status
        } = req.query;

        const query = {};

        // Date range filter
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Account filter
        if (account && account !== 'all') {
            query['entries.accountCode'] = account;
        }

        // Status filter
        if (status) {
            query.status = status;
        }

        // Type filter (debit/credit)
        if (type && type !== 'all') {
            if (type === 'debit') {
                query['entries.debit'] = { $gt: 0 };
            } else if (type === 'credit') {
                query['entries.credit'] = { $gt: 0 };
            }
        }

        const options = {
            sort: { date: -1 },
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit)
        };

        const transactionEntries = await TransactionEntry.find(query, null, options);
        const total = await TransactionEntry.countDocuments(query);

        // Transform data for frontend
        const transformedTransactions = transactionEntries.map(entry => {
            // Flatten entries for table display
            const transactions = [];
            
            entry.entries.forEach(entryItem => {
                if (entryItem.debit > 0) {
                    transactions.push({
                        _id: `${entry._id}_debit_${entryItem.accountCode}`,
                        transactionId: entry.transactionId,
                        timestamp: entry.date,
                        type: 'debit',
                        accountName: entryItem.accountName,
                        accountType: entryItem.accountType,
                        accountCode: entryItem.accountCode,
                        amount: entryItem.debit,
                        description: entryItem.description || entry.description,
                        reference: entry.reference,
                        referenceType: entry.source,
                        referenceId: entry.sourceId,
                        createdByEmail: entry.createdBy,
                        createdAt: entry.createdAt,
                        metadata: entry.metadata
                    });
                }
                
                if (entryItem.credit > 0) {
                    transactions.push({
                        _id: `${entry._id}_credit_${entryItem.accountCode}`,
                        transactionId: entry.transactionId,
                        timestamp: entry.date,
                        type: 'credit',
                        accountName: entryItem.accountName,
                        accountType: entryItem.accountType,
                        accountCode: entryItem.accountCode,
                        amount: entryItem.credit,
                        description: entryItem.description || entry.description,
                        reference: entry.reference,
                        referenceType: entry.source,
                        referenceId: entry.sourceId,
                        createdByEmail: entry.createdBy,
                        createdAt: entry.createdAt,
                        metadata: entry.metadata
                    });
                }
            });
            
            return transactions;
        }).flat();

        res.status(200).json({
            success: true,
            data: transformedTransactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalEntries: total,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching transaction entries:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching transaction entries',
            error: error.message
        });
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

        const query = {};

        // Date range filter
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Account filter
        if (account && account !== 'all') {
            query['entries.accountCode'] = account;
        }

        // Status filter
        if (status) {
            query.status = status;
        }

        const transactionEntries = await TransactionEntry.find(query);

        let totalDebits = 0;
        let totalCredits = 0;
        let transactionCount = 0;

        transactionEntries.forEach(entry => {
            entry.entries.forEach(entryItem => {
                totalDebits += entryItem.debit || 0;
                totalCredits += entryItem.credit || 0;
            });
            transactionCount++;
        });

        const netAmount = totalCredits - totalDebits;

        res.status(200).json({
            success: true,
            data: {
                totalDebits,
                totalCredits,
                netAmount,
                transactionCount
            }
        });

    } catch (error) {
        console.error('Error fetching transaction summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching transaction summary',
            error: error.message
        });
    }
};

// Get all transactions (legacy support)
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

        // Calculate skip value for pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get transactions with pagination
        const transactions = await TransactionEntry.find(filter)
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        // Get total count for pagination
        const total = await TransactionEntry.countDocuments(filter);

        res.status(200).json({
            success: true,
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
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

// Get transaction by ID
exports.getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await TransactionEntry.findById(id);

        if (!transaction) {
            return res.status(404).json({ 
                success: false,
                message: 'Transaction not found' 
            });
        }

        res.status(200).json({ 
            success: true,
            transaction 
        });

    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

// Get transaction entries
exports.getTransactionEntries = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await TransactionEntry.findById(id);
        if (!transaction) {
            return res.status(404).json({ 
                success: false,
                message: 'Transaction not found' 
            });
        }

        res.status(200).json({
            success: true,
            entries: transaction.entries
        });

    } catch (error) {
        console.error('Error fetching transaction entries:', error);
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
}; 