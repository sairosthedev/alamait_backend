const PettyCash = require('../../models/finance/PettyCash');
const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');
const User = require('../../models/User');
const { validationResult } = require('express-validator');

// Initialize petty cash fund
exports.initializePettyCash = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { amount, custodian, description } = req.body;

        // Check if petty cash already exists
        const existingPettyCash = await PettyCash.findOne({ status: 'active' });
        if (existingPettyCash) {
            return res.status(400).json({
                success: false,
                message: 'Petty cash fund already exists'
            });
        }

        // Get required accounts
        const pettyCashAccount = await Account.findOne({ code: '1010' }); // Petty Cash
        const bankAccount = await Account.findOne({ code: '1000' }); // Bank Account

        if (!pettyCashAccount || !bankAccount) {
            return res.status(400).json({
                success: false,
                message: 'Required accounts not found'
            });
        }

        // Create petty cash record
        const pettyCash = new PettyCash({
            fundCode: `PC${Date.now()}`,
            initialAmount: amount,
            currentBalance: amount,
            custodian: custodian,
            status: 'active',
            description: description || 'Petty Cash Fund',
            createdBy: req.user._id
        });

        await pettyCash.save();

        // Create double-entry transaction
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        const transactionEntry = new TransactionEntry({
            transactionId: transactionId,
            date: new Date(),
            description: `Petty Cash Fund Initialization: ${description || 'Initial Setup'}`,
            reference: pettyCash.fundCode,
            entries: [
                {
                    accountCode: pettyCashAccount.code,
                    accountName: pettyCashAccount.name,
                    accountType: pettyCashAccount.type,
                    debit: amount,
                    credit: 0,
                    description: 'Petty cash fund established'
                },
                {
                    accountCode: bankAccount.code,
                    accountName: bankAccount.name,
                    accountType: bankAccount.type,
                    debit: 0,
                    credit: amount,
                    description: 'Cash withdrawn from bank for petty cash'
                }
            ],
            totalDebit: amount,
            totalCredit: amount,
            source: 'petty_cash_initialization',
            sourceId: pettyCash._id,
            sourceModel: 'PettyCash',
            createdBy: req.user._id,
            status: 'posted'
        });

        await transactionEntry.save();

        res.status(201).json({
            success: true,
            message: 'Petty cash fund initialized successfully',
            data: {
                pettyCash: pettyCash,
                transactionId: transactionEntry.transactionId
            }
        });

    } catch (error) {
        console.error('Error initializing petty cash:', error);
        res.status(500).json({
            success: false,
            message: 'Error initializing petty cash',
            error: error.message
        });
    }
};

// Replenish petty cash fund
exports.replenishPettyCash = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { amount, description, receipts } = req.body;

        // Get active petty cash fund
        const pettyCash = await PettyCash.findOne({ status: 'active' });
        if (!pettyCash) {
            return res.status(404).json({
                success: false,
                message: 'No active petty cash fund found'
            });
        }

        // Get required accounts
        const pettyCashAccount = await Account.findOne({ code: '1010' }); // Petty Cash
        const bankAccount = await Account.findOne({ code: '1000' }); // Bank Account

        if (!pettyCashAccount || !bankAccount) {
            return res.status(400).json({
                success: false,
                message: 'Required accounts not found'
            });
        }

        // Update petty cash balance
        pettyCash.currentBalance += amount;
        pettyCash.lastReplenished = new Date();
        pettyCash.replenishmentHistory.push({
            amount: amount,
            date: new Date(),
            description: description,
            receipts: receipts || [],
            replenishedBy: req.user._id
        });

        await pettyCash.save();

        // Create double-entry transaction
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        const transactionEntry = new TransactionEntry({
            transactionId: transactionId,
            date: new Date(),
            description: `Petty Cash Replenishment: ${description || 'Fund Replenishment'}`,
            reference: pettyCash.fundCode,
            entries: [
                {
                    accountCode: pettyCashAccount.code,
                    accountName: pettyCashAccount.name,
                    accountType: pettyCashAccount.type,
                    debit: amount,
                    credit: 0,
                    description: 'Petty cash fund replenished'
                },
                {
                    accountCode: bankAccount.code,
                    accountName: bankAccount.name,
                    accountType: bankAccount.type,
                    debit: 0,
                    credit: amount,
                    description: 'Cash withdrawn from bank for petty cash replenishment'
                }
            ],
            totalDebit: amount,
            totalCredit: amount,
            source: 'petty_cash_replenishment',
            sourceId: pettyCash._id,
            sourceModel: 'PettyCash',
            createdBy: req.user._id,
            status: 'posted'
        });

        await transactionEntry.save();

        res.status(200).json({
            success: true,
            message: 'Petty cash fund replenished successfully',
            data: {
                pettyCash: pettyCash,
                transactionId: transactionEntry.transactionId,
                newBalance: pettyCash.currentBalance
            }
        });

    } catch (error) {
        console.error('Error replenishing petty cash:', error);
        res.status(500).json({
            success: false,
            message: 'Error replenishing petty cash',
            error: error.message
        });
    }
};

// Record petty cash expense
exports.recordExpense = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { amount, category, description, receipt } = req.body;

        // Get active petty cash fund
        const pettyCash = await PettyCash.findOne({ status: 'active' });
        if (!pettyCash) {
            return res.status(404).json({
                success: false,
                message: 'No active petty cash fund found'
            });
        }

        // Check if sufficient balance
        if (pettyCash.currentBalance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient petty cash balance'
            });
        }

        // Get required accounts
        const pettyCashAccount = await Account.findOne({ code: '1010' }); // Petty Cash
        let expenseAccount = await Account.findOne({ code: '5000' }); // Default to General Expenses

        // Map category to specific expense account
        switch (category?.toLowerCase()) {
            case 'office_supplies':
                expenseAccount = await Account.findOne({ code: '5001' }); // Office Supplies
                break;
            case 'transportation':
                expenseAccount = await Account.findOne({ code: '5002' }); // Transportation
                break;
            case 'meals':
                expenseAccount = await Account.findOne({ code: '5003' }); // Meals & Entertainment
                break;
            case 'maintenance':
                expenseAccount = await Account.findOne({ code: '5004' }); // Maintenance
                break;
            default:
                expenseAccount = await Account.findOne({ code: '5000' }); // General Expenses
        }

        if (!pettyCashAccount || !expenseAccount) {
            return res.status(400).json({
                success: false,
                message: 'Required accounts not found'
            });
        }

        // Update petty cash balance
        pettyCash.currentBalance -= amount;
        pettyCash.expenseHistory.push({
            amount: amount,
            date: new Date(),
            category: category,
            description: description,
            receipt: receipt,
            recordedBy: req.user._id
        });

        await pettyCash.save();

        // Create double-entry transaction
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        const transactionEntry = new TransactionEntry({
            transactionId: transactionId,
            date: new Date(),
            description: `Petty Cash Expense: ${description}`,
            reference: pettyCash.fundCode,
            entries: [
                {
                    accountCode: expenseAccount.code,
                    accountName: expenseAccount.name,
                    accountType: expenseAccount.type,
                    debit: amount,
                    credit: 0,
                    description: `${category} expense from petty cash`
                },
                {
                    accountCode: pettyCashAccount.code,
                    accountName: pettyCashAccount.name,
                    accountType: pettyCashAccount.type,
                    debit: 0,
                    credit: amount,
                    description: 'Petty cash used for expense'
                }
            ],
            totalDebit: amount,
            totalCredit: amount,
            source: 'petty_cash_expense',
            sourceId: pettyCash._id,
            sourceModel: 'PettyCash',
            createdBy: req.user._id,
            status: 'posted'
        });

        await transactionEntry.save();

        res.status(200).json({
            success: true,
            message: 'Petty cash expense recorded successfully',
            data: {
                pettyCash: pettyCash,
                transactionId: transactionEntry.transactionId,
                remainingBalance: pettyCash.currentBalance
            }
        });

    } catch (error) {
        console.error('Error recording petty cash expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording petty cash expense',
            error: error.message
        });
    }
};

// Get petty cash status
exports.getPettyCashStatus = async (req, res) => {
    try {
        const pettyCash = await PettyCash.findOne({ status: 'active' });
        
        if (!pettyCash) {
            return res.status(404).json({
                success: false,
                message: 'No active petty cash fund found'
            });
        }

        // Get recent transactions
        const recentTransactions = await TransactionEntry.find({
            sourceId: pettyCash._id,
            sourceModel: 'PettyCash'
        }).sort({ date: -1 }).limit(10);

        res.status(200).json({
            success: true,
            data: {
                pettyCash: pettyCash,
                recentTransactions: recentTransactions
            }
        });

    } catch (error) {
        console.error('Error getting petty cash status:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting petty cash status',
            error: error.message
        });
    }
};

// Get petty cash report
exports.getPettyCashReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const pettyCash = await PettyCash.findOne({ status: 'active' });
        if (!pettyCash) {
            return res.status(404).json({
                success: false,
                message: 'No active petty cash fund found'
            });
        }

        // Build date filter
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }

        // Get transactions for the period
        const transactions = await TransactionEntry.find({
            sourceId: pettyCash._id,
            sourceModel: 'PettyCash',
            ...dateFilter
        }).sort({ date: -1 });

        // Calculate totals
        let totalReplenishments = 0;
        let totalExpenses = 0;

        transactions.forEach(transaction => {
            if (transaction.source === 'petty_cash_replenishment') {
                totalReplenishments += transaction.totalDebit;
            } else if (transaction.source === 'petty_cash_expense') {
                totalExpenses += transaction.totalDebit;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                pettyCash: pettyCash,
                transactions: transactions,
                summary: {
                    totalReplenishments: totalReplenishments,
                    totalExpenses: totalExpenses,
                    currentBalance: pettyCash.currentBalance,
                    expectedBalance: pettyCash.initialAmount + totalReplenishments - totalExpenses
                }
            }
        });

    } catch (error) {
        console.error('Error getting petty cash report:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting petty cash report',
            error: error.message
        });
    }
}; 