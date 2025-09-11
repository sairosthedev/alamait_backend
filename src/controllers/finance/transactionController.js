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
                status: entry.status || 'posted', // ✅ Added status field
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
            const { startDate, endDate, type, account, status, source, userId, residence } = req.query;
            
            console.log('🔍 Fetching transaction summary with filters:', req.query);
            
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
            
            if (source && source !== 'all') {
                query.source = source;
            }
            
            if (userId) {
                query.sourceId = userId;
            }
            
            // 🎯 ADD RESIDENCE FILTERING
            if (residence) {
                query.residence = residence;
            }
            
            // Get transaction entries with residence population
            const transactionEntries = await TransactionEntry.find(query)
                .populate('residence', 'name address')
                .lean();
            
            const totalTransactions = transactionEntries.length;
            const totalAmount = transactionEntries.reduce((sum, entry) => {
                return sum + (entry.totalDebit || 0) + (entry.totalCredit || 0);
            }, 0);
            
            // Group by type
            const byType = {};
            transactionEntries.forEach(entry => {
                const type = entry.type || 'transaction';
                if (!byType[type]) byType[type] = { count: 0, amount: 0 };
                byType[type].count++;
                byType[type].amount += (entry.totalDebit || 0) + (entry.totalCredit || 0);
            });
            
            // Group by month
            const byMonth = {};
            transactionEntries.forEach(entry => {
                const month = new Date(entry.date).toLocaleString('default', { month: 'long' });
                if (!byMonth[month]) byMonth[month] = { count: 0, amount: 0 };
                byMonth[month].count++;
                byMonth[month].amount += (entry.totalDebit || 0) + (entry.totalCredit || 0);
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
                    type: entry.type || 'transaction',
                    residence: entry.residence // Include residence info
                }));
            
            res.status(200).json({
                success: true,
                data: {
                    totalTransactions,
                    totalAmount,
                    byType,
                    byMonth,
                    recentTransactions,
                    filters: {
                        residence: residence || 'all',
                        startDate,
                        endDate,
                        type: type || 'all',
                        account: account || 'all'
                    }
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
            const { page = 1, limit = 50, startDate, endDate, type, account, status, residence } = req.query;
            
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
            
            // 🎯 ADD RESIDENCE FILTERING
            if (residence) {
                query.residence = residence;
            }
            
            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            // Get transaction entries with residence population
            const transactionEntries = await TransactionEntry.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('residence', 'name address') // Populate residence info
                .lean();
            
            const total = await TransactionEntry.countDocuments(query);
            
            // Transform data for frontend with student information
            const { getStudentName, isStudentExpired } = require('../../utils/studentUtils');
            const entries = await Promise.all(transactionEntries.map(async (entry) => {
                const entryObj = {
                    _id: entry._id,
                    transactionId: entry.transactionId || `TXN-${entry._id}`,
                    date: entry.date,
                    description: entry.description,
                    type: entry.type || 'transaction',
                    totalDebit: entry.totalDebit || 0,
                    totalCredit: entry.totalCredit || 0,
                    residence: entry.residence, // Include residence info
                    entries: entry.entries || []
                };

                // Add student information if available
                if (entry.metadata && entry.metadata.studentId) {
                    const studentName = await getStudentName(entry.metadata.studentId);
                    const isExpired = await isStudentExpired(entry.metadata.studentId);
                    
                    entryObj.studentInfo = {
                        studentId: entry.metadata.studentId,
                        studentName: studentName,
                        isExpired: isExpired
                    };
                }

                return entryObj;
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

    /**
     * Update multiple transaction entries (for double-entry transactions)
     */
    static async updateTransactionEntries(req, res) {
        try {
            const { transactionId } = req.params;
            const { entries } = req.body;
            
            console.log('🔧 Updating multiple transaction entries for transaction:', transactionId);
            
            if (!entries || !Array.isArray(entries)) {
                return res.status(400).json({
                    success: false,
                    message: 'Entries array is required'
                });
            }
            
            // Validate that debits equal credits
            let totalDebit = 0;
            let totalCredit = 0;
            
            for (const entry of entries) {
                totalDebit += entry.debit || 0;
                totalCredit += entry.credit || 0;
            }
            
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                return res.status(400).json({
                    success: false,
                    message: 'Total debits must equal total credits for double-entry transactions'
                });
            }
            
            // Find all entries for this transaction
            const existingEntries = await TransactionEntry.find({ transactionId });
            if (existingEntries.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No transaction entries found for this transaction'
                });
            }
            
            // Update each entry
            const updatedEntries = [];
            for (const entryData of entries) {
                if (!entryData._id) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each entry must have an _id field'
                    });
                }
                
                const updatedEntry = await TransactionEntry.findByIdAndUpdate(
                    entryData._id,
                    {
                        ...entryData,
                        updatedBy: req.user._id,
                        updatedAt: new Date()
                    },
                    { new: true, runValidators: true }
                );
                
                if (!updatedEntry) {
                    return res.status(404).json({
                        success: false,
                        message: `Transaction entry with ID ${entryData._id} not found`
                    });
                }
                
                updatedEntries.push(updatedEntry);
            }
            
            console.log('✅ Multiple transaction entries updated successfully');
            
            res.status(200).json({
                success: true,
                message: 'Transaction entries updated successfully',
                data: {
                    entries: updatedEntries,
                    totalDebit,
                    totalCredit,
                    balanced: Math.abs(totalDebit - totalCredit) < 0.01
                }
            });
            
        } catch (error) {
            console.error('Error updating multiple transaction entries:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update transaction entries',
                error: error.message
            });
        }
    }

    /**
     * Update transaction entry
     */
    static async updateTransactionEntry(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            
            console.log('🔧 Updating transaction entry:', id, 'with data:', updateData);
            
            // Find the transaction entry
            const transactionEntry = await TransactionEntry.findById(id);
            if (!transactionEntry) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction entry not found'
                });
            }
            
            // Store original data for audit
            const originalData = transactionEntry.toObject();
            
            // Validate update data
            const allowedFields = [
                'description', 
                'debit', 
                'credit', 
                'date', 
                'account', 
                'accountName', 
                'accountType',
                'metadata',
                'status'  // Added status to allow voiding transactions
            ];
            
            const filteredUpdateData = {};
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    filteredUpdateData[field] = updateData[field];
                }
            }
            
            // Validate debits and credits if both are provided
            if (filteredUpdateData.debit !== undefined && filteredUpdateData.credit !== undefined) {
                if (filteredUpdateData.debit > 0 && filteredUpdateData.credit > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Transaction entry cannot have both debit and credit amounts'
                    });
                }
            }
            
            // Add audit information
            filteredUpdateData.updatedBy = req.user._id;
            filteredUpdateData.updatedAt = new Date();
            
            // Update the transaction entry
            const updatedEntry = await TransactionEntry.findByIdAndUpdate(
                id,
                filteredUpdateData,
                { new: true, runValidators: true }
            );
            
            console.log('✅ Transaction entry updated successfully');
            
            res.status(200).json({
                success: true,
                message: 'Transaction entry updated successfully',
                data: updatedEntry
            });
            
        } catch (error) {
            console.error('Error updating transaction entry:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update transaction entry',
                error: error.message
            });
        }
    }

    /**
     * Delete transaction entry
     */
    static async deleteTransactionEntry(req, res) {
        try {
            const { id } = req.params;
            
            console.log('🗑️ Deleting transaction entry:', id);
            
            // Find the transaction entry
            const transactionEntry = await TransactionEntry.findById(id);
            if (!transactionEntry) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction entry not found'
                });
            }
            
            // Store data for audit
            const deletedData = transactionEntry.toObject();
            
            // Check if this is part of a balanced transaction
            // If it's part of a double-entry transaction, we might need to handle it differently
            if (transactionEntry.source && transactionEntry.sourceId) {
                console.log('⚠️ Transaction entry is part of a source transaction:', {
                    source: transactionEntry.source,
                    sourceId: transactionEntry.sourceId
                });
                
                // For now, we'll allow deletion but log a warning
                // In a production system, you might want to prevent deletion of system-generated entries
            }
            
            // Delete the transaction entry
            await TransactionEntry.findByIdAndDelete(id);
            
            console.log('✅ Transaction entry deleted successfully');
            
            res.status(200).json({
                success: true,
                message: 'Transaction entry deleted successfully',
                data: {
                    deletedEntry: deletedData
                }
            });
            
        } catch (error) {
            console.error('Error deleting transaction entry:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete transaction entry',
                error: error.message
            });
        }
    }

    /**
     * Create double-entry transaction
     */
    static async createDoubleEntryTransaction(req, res) {
        try {
            const {
                description,
                reference,
                residence,
                date,
                entries
            } = req.body;
            
            console.log('💰 Creating double-entry transaction:', { description, reference, residence });
            
            // Validate required fields
            if (!description || !residence || !entries) {
                return res.status(400).json({
                    success: false,
                    message: 'Description, residence, and entries are required'
                });
            }
            
            // Validate entries array
            if (!Array.isArray(entries) || entries.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'At least two entries are required for double-entry accounting'
                });
            }
            
            // Validate each entry
            for (const entry of entries) {
                if (!entry.account || (!entry.debit && !entry.credit)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each entry must have an account and either debit or credit amount'
                    });
                }
                
                if (entry.debit && entry.credit && entry.debit > 0 && entry.credit > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'An entry cannot have both debit and credit amounts'
                    });
                }
            }
            
            // Calculate totals and validate balance
            let totalDebit = 0;
            let totalCredit = 0;
            
            for (const entry of entries) {
                totalDebit += entry.debit || 0;
                totalCredit += entry.credit || 0;
            }
            
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                return res.status(400).json({
                    success: false,
                    message: `Total debits (${totalDebit}) must equal total credits (${totalCredit})`
                });
            }
            
            // Generate transaction ID
            const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
            
            // Determine transaction source based on account types and description
            const transactionSource = this.determineTransactionSource(entries, description);
            
            // Create transaction entry with all the double-entry details
            const transactionEntry = new TransactionEntry({
                transactionId,
                date: date ? new Date(date) : new Date(),
                description,
                reference: reference || transactionId,
                entries: entries.map(entry => ({
                    accountCode: entry.account,
                    accountName: entry.accountName || entry.account,
                    accountType: entry.accountType || 'asset',
                    debit: entry.debit || 0,
                    credit: entry.credit || 0,
                    description: entry.description || description
                })),
                totalDebit,
                totalCredit,
                source: transactionSource,
                sourceId: null, // No source for manual transactions
                sourceModel: 'TransactionEntry',
                residence: residence._id || residence,
                createdBy: req.user.email,
                metadata: {
                    residenceId: residence._id || residence,
                    residenceName: residence?.name || 'Unknown',
                    createdBy: req.user.email,
                    transactionType: 'manual_double_entry',
                    balanced: true,
                    manualTransaction: true,
                    originalSource: 'manual'
                }
            });
            
            await transactionEntry.save();
            console.log('✅ Transaction entry created:', transactionEntry._id);
            
            console.log('✅ Double-entry transaction created successfully');
            
            res.status(201).json({
                success: true,
                message: 'Double-entry transaction created successfully',
                data: {
                    transactionEntry: {
                        _id: transactionEntry._id,
                        transactionId: transactionEntry.transactionId,
                        date: transactionEntry.date,
                        description: transactionEntry.description,
                        totalDebit: transactionEntry.totalDebit,
                        totalCredit: transactionEntry.totalCredit,
                        entries: transactionEntry.entries,
                        balanced: transactionEntry.totalDebit === transactionEntry.totalCredit
                    },
                    summary: {
                        totalDebit,
                        totalCredit,
                        balanced: Math.abs(totalDebit - totalCredit) < 0.01,
                        entryCount: entries.length
                    }
                }
            });
            
        } catch (error) {
            console.error('Error creating double-entry transaction:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create double-entry transaction',
                error: error.message
            });
        }
    }

    /**
     * Create a negotiated payment transaction
     * Handles scenarios where students negotiate to pay less than the full amount
     * This works with the accrual system by:
     * 1. Finding the original accrual entry for the month
     * 2. Creating an adjustment to reduce the A/R balance
     * 3. Recording the negotiated discount as other income
     * 
     * Example: Student supposed to pay $150 (from accrual) but negotiates to pay $140
     * This creates:
     * 1. Credit: Accounts Receivable (reduce A/R by discount amount)
     * 2. Debit: Other Income - Negotiated Discounts (record the discount)
     */
    static async createNegotiatedPayment(req, res) {
        try {
            const { 
                description, 
                reference, 
                residence, 
                date, 
                studentName,
                studentId,
                originalAmount,
                negotiatedAmount,
                negotiationReason,
                residenceId,
                accrualMonth,
                accrualYear,
                accrualTransactionId
            } = req.body;

            console.log('🔧 Creating negotiated payment transaction:', {
                description,
                studentName,
                studentId,
                originalAmount,
                negotiatedAmount,
                negotiationReason,
                residenceId,
                accrualMonth,
                accrualYear,
                accrualTransactionId
            });

            // Validate required fields
            if (!description || !studentName || !studentId || !originalAmount || !negotiatedAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Description, student name, student ID, original amount, and negotiated amount are required'
                });
            }

            // Validate amounts
            const original = parseFloat(originalAmount);
            const negotiated = parseFloat(negotiatedAmount);

            if (isNaN(original) || isNaN(negotiated) || original <= 0 || negotiated <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Original amount and negotiated amount must be positive numbers'
                });
            }

            if (negotiated >= original) {
                return res.status(400).json({
                    success: false,
                    message: 'Negotiated amount must be less than original amount'
                });
            }

            const discountAmount = original - negotiated;

            // Find the original accrual transaction if provided
            let originalAccrual = null;
            if (accrualTransactionId) {
                originalAccrual = await TransactionEntry.findById(accrualTransactionId);
                if (!originalAccrual) {
                    return res.status(400).json({
                        success: false,
                        message: 'Original accrual transaction not found'
                    });
                }
            } else if (accrualMonth && accrualYear) {
                // Try to find the accrual by month/year and student
                // Look for both monthly accruals AND lease start transactions
                // Support both formats: separate accrualMonth/accrualYear fields and combined month field
                const monthString = `${accrualYear}-${accrualMonth.toString().padStart(2, '0')}`;
                
                originalAccrual = await TransactionEntry.findOne({
                    'metadata.studentId': studentId,
                    $and: [
                        {
                            $or: [
                                // Format 1: Separate accrualMonth and accrualYear fields
                                {
                                    'metadata.accrualMonth': parseInt(accrualMonth),
                                    'metadata.accrualYear': parseInt(accrualYear)
                                },
                                // Format 2: Combined month field (e.g., "2025-08")
                                {
                                    'metadata.month': monthString
                                }
                            ]
                        },
                        {
                            $or: [
                                { 'metadata.type': 'monthly_rent_accrual' },
                                { 'metadata.type': 'lease_start' }
                            ]
                        }
                    ],
                    status: 'posted'
                });
                
                if (!originalAccrual) {
                    return res.status(400).json({
                        success: false,
                        message: `No accrual found for student ${studentName} for ${accrualMonth}/${accrualYear}. Please ensure the monthly accrual or lease start transaction has been created first.`
                    });
                }
            }

            // Get or create student-specific A/R account
            const Account = require('../../models/Account');
            let studentARAccount = await Account.findOne({
                code: `1100-${studentId}`,
                type: 'Asset'
            });

            if (!studentARAccount) {
                studentARAccount = new Account({
                    code: `1100-${studentId}`,
                    name: `Accounts Receivable - ${studentName}`,
                    type: 'Asset',
                    category: 'Current Assets',
                    description: `Accounts receivable for ${studentName}`,
                    isActive: true
                });
                await studentARAccount.save();
                console.log(`✅ Created student-specific A/R account: ${studentARAccount.code}`);
            }

            // Get rental income account
            let rentalIncomeAccount = await Account.findOne({
                $or: [
                    { code: '4001', type: 'Income' },
                    { code: '4000', type: 'Income' },
                    { name: /rental income/i, type: 'Income' }
                ]
            });

            if (!rentalIncomeAccount) {
                rentalIncomeAccount = new Account({
                    code: '4001',
                    name: 'Rental Income - School Accommodation',
                    type: 'Income',
                    category: 'Operating Revenue',
                    description: 'Income from student accommodation rentals',
                    isActive: true
                });
                await rentalIncomeAccount.save();
                console.log(`✅ Created rental income account: ${rentalIncomeAccount.code}`);
            }

            // We'll reduce Rental Income instead of creating Other Income
            // This maintains proper balance sheet accounting

            // Create the negotiated payment adjustment transaction
            // This reduces the A/R balance and records the discount
            // Use the accrual date to maintain proper accounting period matching
            const accrualDate = originalAccrual ? new Date(originalAccrual.date) : new Date();
            const transactionData = {
                description: description || `Negotiated payment adjustment for ${studentName}`,
                reference: reference || `NEG-${Date.now()}`,
                date: accrualDate,
                source: 'manual', // Use 'manual' since 'negotiated_payment' is not in the enum
                sourceModel: 'TransactionEntry',
                sourceId: req.user?._id,
                status: 'posted',
                createdBy: req.user?._id,
                transactionId: `NEG-${Date.now()}`,
                totalDebit: discountAmount, // Only the discount amount
                totalCredit: discountAmount, // Balanced transaction
                entries: [
                    // Debit: Rental Income (reduce rental income by discount amount)
                    {
                        accountCode: rentalIncomeAccount.code,
                        accountName: rentalIncomeAccount.name,
                        accountType: 'Income',
                        debit: discountAmount,
                        credit: 0,
                        description: `Rental income reduction for negotiated discount - ${studentName}`,
                        metadata: {
                            studentName,
                            studentId,
                            transactionType: 'negotiated_payment_adjustment',
                            originalAmount: original,
                            negotiatedAmount: negotiated,
                            discountAmount: discountAmount,
                            negotiationReason: negotiationReason || 'Student negotiation',
                            originalAccrualId: originalAccrual?._id,
                            accrualMonth: accrualMonth,
                            accrualYear: accrualYear,
                            createdBy: req.user?._id,
                            createdByEmail: req.user?.email
                        }
                    },
                    // Credit: Student's A/R account (reduce A/R by discount amount)
                    {
                        accountCode: studentARAccount.code,
                        accountName: studentARAccount.name,
                        accountType: 'Asset',
                        debit: 0,
                        credit: discountAmount,
                        description: `A/R reduction for negotiated discount - ${studentName}`,
                        metadata: {
                            studentName,
                            studentId,
                            transactionType: 'negotiated_payment_adjustment',
                            originalAmount: original,
                            negotiatedAmount: negotiated,
                            discountAmount: discountAmount,
                            negotiationReason: negotiationReason || 'Student negotiation',
                            originalAccrualId: originalAccrual?._id,
                            accrualMonth: accrualMonth,
                            accrualYear: accrualYear,
                            createdBy: req.user?._id,
                            createdByEmail: req.user?.email
                        }
                    }
                ],
                metadata: {
                    studentName,
                    studentId,
                    transactionType: 'negotiated_payment_adjustment',
                    originalAmount: original,
                    negotiatedAmount: negotiated,
                    discountAmount: discountAmount,
                    negotiationReason: negotiationReason || 'Student negotiation',
                    residence: residenceId,
                    originalAccrualId: originalAccrual?._id,
                    accrualMonth: accrualMonth,
                    accrualYear: accrualYear,
                    accrualDate: accrualDate, // Include the accrual date for reference
                    createdBy: req.user?._id,
                    createdByEmail: req.user?.email,
                    isNegotiated: true,
                    isAdjustment: true
                }
            };

            const transaction = new TransactionEntry(transactionData);
            await transaction.save();

            console.log('✅ Negotiated payment transaction created successfully:', transaction._id);

            // Update debtor's totalOwed to reflect the negotiated amount as the new "original outstanding"
            try {
                const Debtor = require('../../models/Debtor');
                let debtor = null;
                
                // Try multiple methods to find the debtor (for both active and expired students)
                // Method 1: Find by user field (for active students)
                debtor = await Debtor.findOne({ user: studentId });
                
                // Method 2: Find by accountCode (for expired students)
                if (!debtor) {
                    debtor = await Debtor.findOne({ accountCode: `1100-${studentId}` });
                }
                
                // Method 3: Find by ObjectId user field
                if (!debtor) {
                    debtor = await Debtor.findOne({ user: new mongoose.Types.ObjectId(studentId) });
                }
                
                if (debtor) {
                    // Reduce totalOwed by the discount amount so negotiated amount becomes the new "original outstanding"
                    const newTotalOwed = Math.max(0, debtor.totalOwed - discountAmount);
                    const oldTotalOwed = debtor.totalOwed;
                    
                    debtor.totalOwed = newTotalOwed;
                    debtor.currentBalance = Math.max(0, newTotalOwed - debtor.totalPaid);
                    debtor.overdueAmount = debtor.currentBalance > 0 ? debtor.currentBalance : 0;
                    
                    // Add note about the negotiation
                    const negotiationNote = `[${new Date().toISOString().split('T')[0]}] Negotiated payment: Original $${original} → Negotiated $${negotiated} (Discount: $${discountAmount})`;
                    debtor.notes = (debtor.notes || '') + '\n' + negotiationNote;
                    
                    await debtor.save();
                    
                    console.log('✅ Updated debtor totalOwed for negotiated payment:');
                    console.log(`   Student: ${studentName}`);
                    console.log(`   Debtor Code: ${debtor.debtorCode}`);
                    console.log(`   Old Total Owed: $${oldTotalOwed}`);
                    console.log(`   New Total Owed: $${newTotalOwed}`);
                    console.log(`   Discount Applied: $${discountAmount}`);
                    console.log(`   New Current Balance: $${debtor.currentBalance}`);
                } else {
                    console.log(`⚠️ No debtor found for student: ${studentName} (${studentId})`);
                    console.log(`   Tried methods: user field, accountCode, ObjectId`);
                }
            } catch (debtorUpdateError) {
                console.error('❌ Error updating debtor for negotiated payment:', debtorUpdateError);
                // Don't fail the transaction creation if debtor update fails
            }

            res.status(201).json({
                success: true,
                message: 'Negotiated payment adjustment created successfully',
                transaction: {
                    _id: transaction._id,
                    description: transaction.description,
                    reference: transaction.reference,
                    date: transaction.date,
                    entries: transaction.entries,
                    metadata: transaction.metadata
                },
                originalAccrual: originalAccrual ? {
                    _id: originalAccrual._id,
                    description: originalAccrual.description,
                    date: originalAccrual.date,
                    accrualMonth: originalAccrual.metadata?.accrualMonth,
                    accrualYear: originalAccrual.metadata?.accrualYear
                } : null,
                summary: {
                    originalAmount: original,
                    negotiatedAmount: negotiated,
                    discountAmount: discountAmount,
                    discountPercentage: ((discountAmount / original) * 100).toFixed(2) + '%',
                    accountingImpact: {
                        arReduction: discountAmount,
                        otherIncomeIncrease: discountAmount,
                        netEffect: 'A/R reduced, Other Income increased by discount amount'
                    },
                    debtorUpdate: {
                        totalOwedReduced: discountAmount,
                        newOriginalOutstanding: negotiated,
                        note: 'Negotiated amount is now the new "original outstanding" amount'
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error creating negotiated payment transaction:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create negotiated payment transaction',
                error: error.message
            });
        }
    }

    /**
     * Upload CSV and create multiple transaction entries
     */
    static async uploadCsvTransactions(req, res) {
        try {
            const { csvData, residence, defaultDate } = req.body;
            
            console.log('📁 Processing CSV upload for residence:', residence);
            
            if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'CSV data is required and must be an array'
                });
            }
            
            if (!residence) {
                return res.status(400).json({
                    success: false,
                    message: 'Residence is required for all transactions'
                });
            }
            
            const results = {
                successful: [],
                failed: [],
                summary: {
                    totalProcessed: csvData.length,
                    totalSuccessful: 0,
                    totalFailed: 0,
                    totalDebits: 0,
                    totalCredits: 0
                }
            };
            
            // Process each CSV row
            for (let i = 0; i < csvData.length; i++) {
                const row = csvData[i];
                const rowNumber = i + 1;
                
                try {
                    // Validate required fields
                    if (!row.description || !row.entries || !Array.isArray(row.entries) || row.entries.length < 2) {
                        results.failed.push({
                            row: rowNumber,
                            error: 'Missing description or insufficient entries (minimum 2 required)',
                            data: row
                        });
                        results.summary.totalFailed++;
                        continue;
                    }
                    
                    // Validate entries
                    let totalDebit = 0;
                    let totalCredit = 0;
                    const validEntries = [];
                    
                    for (const entry of row.entries) {
                        if (!entry.account || (!entry.debit && !entry.credit)) {
                            throw new Error(`Entry missing account or amounts`);
                        }
                        
                        if (entry.debit && entry.credit && parseFloat(entry.debit) > 0 && parseFloat(entry.credit) > 0) {
                            throw new Error(`Entry cannot have both debit and credit amounts`);
                        }
                        
                        const debit = parseFloat(entry.debit) || 0;
                        const credit = parseFloat(entry.credit) || 0;
                        
                        totalDebit += debit;
                        totalCredit += credit;
                        
                        validEntries.push({
                            account: entry.account,
                            accountName: entry.accountName || entry.account,
                            accountType: entry.accountType || 'asset',
                            debit: debit,
                            credit: credit,
                            description: entry.description || row.description
                        });
                    }
                    
                    // Validate balance
                    if (Math.abs(totalDebit - totalCredit) > 0.01) {
                        throw new Error(`Debits (${totalDebit}) must equal credits (${totalCredit})`);
                    }
                    
                    // Generate transaction ID
                    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                    
                    // Create transaction entry
                    const transactionEntry = new TransactionEntry({
                        transactionId,
                        date: row.date ? new Date(row.date) : (defaultDate ? new Date(defaultDate) : new Date()),
                        description: row.description,
                        reference: row.reference || transactionId,
                        entries: validEntries,
                        totalDebit,
                        totalCredit,
                        source: 'manual',
                        sourceId: null,
                        sourceModel: 'TransactionEntry',
                        residence: residence._id || residence,
                        createdBy: req.user.email,
                        metadata: {
                            residenceId: residence._id || residence,
                            residenceName: residence?.name || 'Unknown',
                            createdBy: req.user.email,
                            transactionType: 'manual_double_entry_csv',
                            balanced: true,
                            csvRow: rowNumber
                        }
                    });
                    
                    await transactionEntry.save();
                    
                    results.successful.push({
                        row: rowNumber,
                        transactionId: transactionEntry.transactionId,
                        description: transactionEntry.description,
                        totalDebit: transactionEntry.totalDebit,
                        totalCredit: transactionEntry.totalCredit,
                        entryCount: validEntries.length
                    });
                    
                    results.summary.totalSuccessful++;
                    results.summary.totalDebits += totalDebit;
                    results.summary.totalCredits += totalCredit;
                    
                } catch (error) {
                    results.failed.push({
                        row: rowNumber,
                        error: error.message,
                        data: row
                    });
                    results.summary.totalFailed++;
                }
            }
            
            console.log(`✅ CSV upload completed: ${results.summary.totalSuccessful} successful, ${results.summary.totalFailed} failed`);
            
            res.status(200).json({
                success: true,
                message: 'CSV upload processed successfully',
                data: results
            });
            
        } catch (error) {
            console.error('Error processing CSV upload:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to process CSV upload',
                error: error.message
            });
        }
    }

    /**
     * Get CSV template for transaction entries
     */
    static async getCsvTemplate(req, res) {
        try {
            const template = {
                headers: [
                    'description',
                    'reference',
                    'date',
                    'entries'
                ],
                sampleData: [
                    {
                        description: 'Sample Transaction 1',
                        reference: 'REF-001',
                        date: '2025-01-15',
                        entries: [
                            {
                                account: '1001',
                                accountName: 'Cash',
                                accountType: 'asset',
                                debit: 1000,
                                credit: 0,
                                description: 'Cash received'
                            },
                            {
                                account: '4001',
                                accountName: 'Rental Income',
                                accountType: 'revenue',
                                debit: 0,
                                credit: 1000,
                                description: 'Rental income earned'
                            }
                        ]
                    },
                    {
                        description: 'Sample Transaction 2',
                        reference: 'REF-002',
                        date: '2025-01-16',
                        entries: [
                            {
                                account: '5001',
                                accountName: 'Maintenance Expense',
                                accountType: 'expense',
                                debit: 500,
                                credit: 0,
                                description: 'Maintenance cost'
                            },
                            {
                                account: '1001',
                                accountName: 'Cash',
                                accountType: 'asset',
                                debit: 0,
                                credit: 500,
                                description: 'Cash paid'
                            }
                        ]
                    }
                ],
                instructions: [
                    'Each row represents one double-entry transaction',
                    'Each transaction must have at least 2 entries',
                    'Total debits must equal total credits for each transaction',
                    'Date format: YYYY-MM-DD',
                    'Account types: asset, liability, equity, revenue, expense',
                    'Only one of debit or credit should have a value per entry'
                ]
            };
            
            res.status(200).json({
                success: true,
                message: 'CSV template retrieved successfully',
                data: template
            });
            
        } catch (error) {
            console.error('Error getting CSV template:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get CSV template',
                error: error.message
            });
        }
    }

    /**
     * Determine transaction source based on account types and description
     * This helps financial statements categorize transactions correctly
     */
    static determineTransactionSource(entries, description) {
        const desc = description.toLowerCase();
        
        // Check for specific transaction patterns
        if (desc.includes('rental') || desc.includes('rent')) {
            // Check if it's income (credit to revenue) or payment (debit to bank)
            const hasRevenueCredit = entries.some(entry => 
                entry.accountType === 'revenue' && entry.credit > 0
            );
            const hasBankDebit = entries.some(entry => 
                (entry.accountCode === '1000' || entry.accountCode === '1001') && entry.debit > 0
            );
            
            if (hasRevenueCredit) {
                return 'rental_accrual'; // Income when earned
            } else if (hasBankDebit) {
                return 'payment'; // Payment received
            }
        }
        
        if (desc.includes('expense') || desc.includes('maintenance') || desc.includes('utility')) {
            // Check if it's expense accrual or payment
            const hasExpenseDebit = entries.some(entry => 
                entry.accountType === 'expense' && entry.debit > 0
            );
            const hasPayableCredit = entries.some(entry => 
                entry.accountType === 'liability' && entry.credit > 0
            );
            
            if (hasExpenseDebit && hasPayableCredit) {
                return 'expense_accrual'; // Expense when incurred
            } else if (hasExpenseDebit) {
                return 'vendor_payment'; // Direct expense payment
            }
        }
        
        if (desc.includes('other income') || desc.includes('miscellaneous')) {
            return 'other_income';
        }
        
        if (desc.includes('refund')) {
            return 'refund';
        }
        
        // Default to manual for unrecognized patterns
        return 'manual';
    }
}

module.exports = TransactionController; 