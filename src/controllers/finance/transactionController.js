const DoubleEntryAccountingService = require('../../services/doubleEntryAccountingService');
const TransactionEntry = require('../../models/TransactionEntry');
const Payment = require('../../models/Payment');
const Expense = require('../../models/finance/Expense');
const Invoice = require('../../models/Invoice');

/**
 * Transaction Controller
 * 
 * Handles automatic creation of transaction entries for all financial operations
 */

class TransactionController {
    
    /**
     * Get all transactions (main endpoint for frontend)
     */
    static async getAllTransactions(req, res) {
        try {
            const { page = 1, limit = 50, type, startDate, endDate, residence, source, userId } = req.query;
            
            console.log('🔍 Fetching all transactions with filters:', req.query);
            
            const query = {};
            
            // Add filters
            if (type && type !== 'all') {
                if (type === 'petty_cash') {
                    query.source = 'manual';
                    query['metadata.transactionType'] = { 
                        $in: ['petty_cash_allocation', 'petty_cash_expense', 'petty_cash_replenishment'] 
                    };
                } else {
                    query.type = type;
                }
            }
            
            if (source && source !== 'all') {
                query.source = source;
            }
            
            if (userId) {
                query.sourceId = userId;
            }
            
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }
            
            if (residence) {
                query.residence = residence;
            }
            
            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            // Get transaction entries with pagination
            const transactionEntries = await TransactionEntry.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('sourceId', 'paymentId student residence room totalAmount method status')
                .lean();
            
            const total = await TransactionEntry.countDocuments(query);
            
            // Transform data for frontend
            const transactions = transactionEntries.map(entry => ({
                _id: entry._id,
                transactionId: entry.transactionId || `TXN-${entry._id}`,
                date: entry.date,
                description: entry.description,
                type: entry.type || 'transaction',
                amount: entry.totalDebit || entry.totalCredit || 0,
                residence: entry.residence,
                expenseId: entry.expenseId,
                createdBy: {
                    _id: entry.createdBy,
                    firstName: 'System',
                    lastName: 'User',
                    email: 'system@alamait.com'
                },
                entries: entry.entries || []
            }));
            
            res.status(200).json({
                success: true,
                transactions: transactions,
                pagination: {
                    total: total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            });
            
        } catch (error) {
            console.error('Error fetching all transactions:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching transactions',
                error: error.message
            });
        }
    }
    
    /**
     * Get transaction summary
     */
    static async getTransactionSummary(req, res) {
        try {
            const { startDate, endDate, type, account, status, source, userId } = req.query;
            
            console.log('🔍 Fetching transaction summary with filters:', req.query);
            
            const query = {};
            
            // Add filters
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }
            
            if (type && type !== 'all') {
                if (type === 'petty_cash') {
                    query.source = 'manual';
                    query['metadata.transactionType'] = { 
                        $in: ['petty_cash_allocation', 'petty_cash_expense', 'petty_cash_replenishment'] 
                    };
                } else {
                    query.type = type;
                }
            }
            
            if (source && source !== 'all') {
                query.source = source;
            }
            
            if (userId) {
                query.sourceId = userId;
            }
            
            if (account && account !== 'all') {
                query['entries.accountCode'] = account;
            }
            
            // Get transaction entries
            const transactionEntries = await TransactionEntry.find(query).lean();
            
            // Calculate summary
            let totalTransactions = transactionEntries.length;
            let totalAmount = 0;
            let byType = {};
            let byMonth = {};
            
            transactionEntries.forEach(entry => {
                const amount = entry.totalDebit || entry.totalCredit || 0;
                totalAmount += amount;
                
                // Group by type
                const type = entry.type || 'transaction';
                if (!byType[type]) {
                    byType[type] = { count: 0, amount: 0 };
                }
                byType[type].count++;
                byType[type].amount += amount;
                
                // Group by month
                const month = new Date(entry.date).toISOString().substring(0, 7);
                if (!byMonth[month]) {
                    byMonth[month] = { count: 0, amount: 0 };
                }
                byMonth[month].count++;
                byMonth[month].amount += amount;
            });
            
            // Get recent transactions
            const recentTransactions = transactionEntries
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10)
                .map(entry => ({
                    _id: entry._id,
                    date: entry.date,
                    description: entry.description,
                    amount: entry.totalDebit || entry.totalCredit || 0,
                    type: entry.type || 'transaction'
                }));
            
            res.status(200).json({
                success: true,
                data: {
                    totalTransactions,
                    totalAmount,
                    byType,
                    byMonth,
                    recentTransactions
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
    }
    
    /**
     * Get transaction entries with filters
     */
    static async getTransactionEntries(req, res) {
        try {
            const { page = 1, limit = 50, startDate, endDate, type, account, status } = req.query;
            
            console.log('🔍 Fetching transaction entries with filters:', req.query);
            
            const query = {};
            
            // Add filters
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }
            
            if (type && type !== 'all') {
                if (type === 'debit') {
                    query.totalDebit = { $gt: 0 };
                } else if (type === 'credit') {
                    query.totalCredit = { $gt: 0 };
                } else {
                    query.type = type;
                }
            }
            
            if (account && account !== 'all') {
                query['entries.accountCode'] = account;
            }
            
            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            // Get transaction entries
            const transactionEntries = await TransactionEntry.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean();
            
            const total = await TransactionEntry.countDocuments(query);
            
            // Transform data for frontend
            const entries = transactionEntries.map(entry => ({
                _id: entry._id,
                transactionId: entry.transactionId || `TXN-${entry._id}`,
                date: entry.date,
                description: entry.description,
                type: entry.type || 'transaction',
                totalDebit: entry.totalDebit || 0,
                totalCredit: entry.totalCredit || 0,
                entries: entry.entries || []
            }));
            
            res.status(200).json({
                success: true,
                data: entries,
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
    }
    
    /**
     * Get transaction by ID
     */
    static async getTransactionById(req, res) {
        try {
            const { id } = req.params;
            
            console.log('🔍 Fetching transaction by ID:', id);
            
            const transaction = await TransactionEntry.findById(id)
                .populate('sourceId', 'paymentId student residence room totalAmount method status')
                .lean();
            
            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }
            
            const transformedTransaction = {
                _id: transaction._id,
                transactionId: transaction.transactionId || `TXN-${transaction._id}`,
                date: transaction.date,
                description: transaction.description,
                type: transaction.type || 'transaction',
                amount: transaction.totalDebit || transaction.totalCredit || 0,
                residence: transaction.residence,
                expenseId: transaction.expenseId,
                createdBy: {
                    _id: transaction.createdBy,
                    firstName: 'System',
                    lastName: 'User',
                    email: 'system@alamait.com'
                },
                entries: transaction.entries || []
            };
            
            res.status(200).json({
                success: true,
                transaction: transformedTransaction
            });
            
        } catch (error) {
            console.error('Error fetching transaction by ID:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching transaction',
                error: error.message
            });
        }
    }
    
    /**
     * Get transaction entries by transaction ID
     */
    static async getTransactionEntriesById(req, res) {
        try {
            const { id } = req.params;
            
            console.log('🔍 Fetching transaction entries by transaction ID:', id);
            
            const transaction = await TransactionEntry.findById(id).lean();
            
            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }
            
            res.status(200).json({
                success: true,
                entries: transaction.entries || []
            });
            
        } catch (error) {
            console.error('Error fetching transaction entries by ID:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching transaction entries',
                error: error.message
            });
        }
    }
    
    /**
     * Create transaction entries for student payment
     */
    static async createPaymentTransaction(req, res) {
        try {
            const { paymentId, amount, paymentMethod, description, date } = req.body;
            
            // Validate required fields
            if (!paymentId || !amount || !paymentMethod || !description) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: paymentId, amount, paymentMethod, description'
                });
            }
            
            // Get the payment record
            const payment = await Payment.findById(paymentId);
            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment not found'
                });
            }
            
            // Create transaction entries using the service
            const transactionResult = await DoubleEntryAccountingService.createStudentPaymentTransaction({
                paymentId: payment._id,
                amount: amount,
                paymentMethod: paymentMethod,
                description: description,
                date: date || new Date(),
                studentId: payment.student,
                residenceId: payment.residence,
                room: payment.room,
                rentAmount: payment.rentAmount,
                adminFee: payment.adminFee,
                deposit: payment.deposit,
                createdBy: req.user._id
            });
            
            res.status(201).json({
                success: true,
                message: 'Payment transaction entries created successfully',
                data: {
                    transactionId: transactionResult.transactionId,
                    entries: transactionResult.entries,
                    paymentId: payment._id
                }
            });
            
        } catch (error) {
            console.error('Error creating payment transaction:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create payment transaction entries',
                error: error.message
            });
        }
    }
    
    /**
     * Create transaction entries for request approval (accrual)
     */
    static async createApprovalTransaction(req, res) {
        try {
            const { requestId, amount, description, vendorName, date } = req.body;
            
            // Validate required fields
            if (!requestId || !amount || !description) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: requestId, amount, description'
                });
            }
            
            // Create transaction entries using the service
            const transactionResult = await DoubleEntryAccountingService.createRequestApprovalTransaction({
                requestId: requestId,
                amount: amount,
                description: description,
                vendorName: vendorName,
                date: date || new Date(),
                createdBy: req.user._id
            });
            
            res.status(201).json({
                success: true,
                message: 'Approval transaction entries created successfully',
                data: {
                    transactionId: transactionResult.transactionId,
                    entries: transactionResult.entries,
                    requestId: requestId
                }
            });
            
        } catch (error) {
            console.error('Error creating approval transaction:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create approval transaction entries',
                error: error.message
            });
        }
    }
    
    /**
     * Create transaction entries for refund
     */
    static async createRefundTransaction(req, res) {
        try {
            const { refundId, amount, reason, description, date } = req.body;
            
            // Validate required fields
            if (!refundId || !amount || !reason || !description) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: refundId, amount, reason, description'
                });
            }
            
            // Create transaction entries using the service
            const transactionResult = await DoubleEntryAccountingService.createRefundTransaction({
                refundId: refundId,
                amount: amount,
                reason: reason,
                description: description,
                date: date || new Date(),
                createdBy: req.user._id
            });
            
            res.status(201).json({
                success: true,
                message: 'Refund transaction entries created successfully',
                data: {
                    transactionId: transactionResult.transactionId,
                    entries: transactionResult.entries,
                    refundId: refundId
                }
            });
            
        } catch (error) {
            console.error('Error creating refund transaction:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create refund transaction entries',
                error: error.message
            });
        }
    }
    
    /**
     * Create transaction entries for invoice payment
     */
    static async createInvoicePaymentTransaction(req, res) {
        try {
            const { invoiceId, amount, paymentMethod, description, date } = req.body;
            
            // Validate required fields
            if (!invoiceId || !amount || !paymentMethod || !description) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: invoiceId, amount, paymentMethod, description'
                });
            }
            
            // Get the invoice record
            const invoice = await Invoice.findById(invoiceId);
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    message: 'Invoice not found'
                });
            }
            
            // Create transaction entries using the service
            const transactionResult = await DoubleEntryAccountingService.createInvoicePaymentTransaction({
                invoiceId: invoice._id,
                amount: amount,
                paymentMethod: paymentMethod,
                description: description,
                date: date || new Date(),
                studentId: invoice.student,
                invoiceNumber: invoice.invoiceNumber,
                createdBy: req.user._id
            });
            
            res.status(201).json({
                success: true,
                message: 'Invoice payment transaction entries created successfully',
                data: {
                    transactionId: transactionResult.transactionId,
                    entries: transactionResult.entries,
                    invoiceId: invoice._id
                }
            });
            
        } catch (error) {
            console.error('Error creating invoice payment transaction:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create invoice payment transaction entries',
                error: error.message
            });
        }
    }
    
    /**
     * Verify transaction creation for a specific source
     */
    static async verifyTransaction(req, res) {
        try {
            const { sourceType, sourceId } = req.params;
            
            // Find transaction entries for the source
            const transactionEntry = await TransactionEntry.findOne({
                source: sourceType,
                sourceId: sourceId
            });
            
            if (!transactionEntry) {
                return res.status(404).json({
                    success: false,
                    message: `No transaction entries found for ${sourceType} with ID ${sourceId}`,
                    data: {
                        transactionCreated: false,
                        sourceType: sourceType,
                        sourceId: sourceId
                    }
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Transaction entries verified successfully',
                data: {
                    transactionCreated: true,
                    transactionId: transactionEntry.transactionId,
                    sourceType: sourceType,
                    sourceId: sourceId,
                    entries: transactionEntry.entries,
                    totalDebit: transactionEntry.totalDebit,
                    totalCredit: transactionEntry.totalCredit,
                    balanced: transactionEntry.totalDebit === transactionEntry.totalCredit
                }
            });
            
        } catch (error) {
            console.error('Error verifying transaction:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify transaction entries',
                error: error.message
            });
        }
    }
    
    /**
     * Get transaction history for a specific source
     */
    static async getTransactionHistory(req, res) {
        try {
            const { sourceType, sourceId } = req.params;
            const { page = 1, limit = 10 } = req.query;
            
            // Find all transaction entries for the source
            const transactionEntries = await TransactionEntry.find({
                source: sourceType,
                sourceId: sourceId
            })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
            // Get total count
            const total = await TransactionEntry.countDocuments({
                source: sourceType,
                sourceId: sourceId
            });
            
            res.status(200).json({
                success: true,
                message: 'Transaction history retrieved successfully',
                data: {
                    transactions: transactionEntries,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(total / limit),
                        totalItems: total,
                        itemsPerPage: limit
                    }
                }
            });
            
        } catch (error) {
            console.error('Error getting transaction history:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get transaction history',
                error: error.message
            });
        }
    }
}

module.exports = TransactionController; 