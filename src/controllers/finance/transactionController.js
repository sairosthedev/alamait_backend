const mongoose = require('mongoose');
const DoubleEntryAccountingService = require('../../services/doubleEntryAccountingService');
const TransactionEntry = require('../../models/TransactionEntry');
const Payment = require('../../models/Payment');
const Expense = require('../../models/finance/Expense');
const Invoice = require('../../models/Invoice');
const Transaction = require('../../models/Transaction');
const { createAuditLog } = require('../../utils/auditLogger');
const DeletionLogService = require('../../services/deletionLogService');

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
            
            // OPTIMIZED: Use aggregation pipeline for better performance
            // This avoids populate() which causes N+1 queries
            const pipeline = [
                { $match: query },
                { $sort: { date: -1 } },
                { $skip: skip },
                { $limit: parseInt(limit) },
                {
                    $lookup: {
                        from: 'payments',
                        localField: 'sourceId',
                        foreignField: '_id',
                        as: 'paymentData'
                    }
                },
                {
                    $unwind: {
                        path: '$paymentData',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        _id: 1,
                        transactionId: 1,
                        date: 1,
                        description: 1,
                        type: 1,
                        totalDebit: 1,
                        totalCredit: 1,
                        residence: 1,
                        expenseId: 1,
                        status: 1,
                        createdBy: 1,
                        entries: 1,
                        sourceId: {
                            $cond: {
                                if: { $ne: ['$paymentData', null] },
                                then: {
                                    paymentId: '$paymentData.paymentId',
                                    student: '$paymentData.student',
                                    residence: '$paymentData.residence',
                                    room: '$paymentData.room',
                                    totalAmount: '$paymentData.totalAmount',
                                    method: '$paymentData.method',
                                    status: '$paymentData.status'
                                },
                                else: null
                            }
                        }
                    }
                }
            ];
            
            const [transactionEntries, totalResult] = await Promise.all([
                TransactionEntry.aggregate(pipeline),
                TransactionEntry.countDocuments(query)
            ]);
            
            const total = totalResult;
            
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
     * Update transaction entry with cascade update for linked records
     * Logs all updates to AuditLog
     */
    static async updateTransactionEntry(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            const { id } = req.params;
            const updateData = req.body;
            const userId = req.user?._id || req.user?.id;
            
            console.log('🔧 Updating transaction entry:', id, 'with data:', updateData);
            
            // Find the transaction entry
            const transactionEntry = await TransactionEntry.findById(id).session(session);
            if (!transactionEntry) {
                await session.abortTransaction();
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
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: 'Transaction entry cannot have both debit and credit amounts'
                    });
                }
            }
            
            // Add audit information
            filteredUpdateData.updatedBy = userId;
            filteredUpdateData.updatedAt = new Date();
            
            // Update the transaction entry
            const updatedEntry = await TransactionEntry.findByIdAndUpdate(
                id,
                filteredUpdateData,
                { new: true, runValidators: true, session }
            );
            
            // Find and update related transaction entries if needed
            const { cascadeUpdate = false } = req.query;
            let updatedRelatedEntries = 0;
            
            if (cascadeUpdate === 'true' || cascadeUpdate === true) {
                console.log('🔄 Cascade update requested - updating related entries...');
                
                const entryIdObj = new mongoose.Types.ObjectId(id);
                const entryIdString = id.toString();
                
                // Find related entries using explicit ID matching only
                const relatedEntriesQuery = {
                    $or: [
                        { sourceId: entryIdObj, sourceModel: 'TransactionEntry' },
                        { transactionId: transactionEntry.transactionId },
                        { 'metadata.parentEntryId': entryIdString },
                        { 'metadata.originalEntryId': entryIdString }
                    ]
                };
                
                const relatedEntries = await TransactionEntry.find(relatedEntriesQuery).session(session);
                console.log(`   📊 Found ${relatedEntries.length} related transaction entries to update`);
                
                // Update related entries with relevant fields
                for (const entry of relatedEntries) {
                    const relatedUpdate = {};
                    if (filteredUpdateData.date) relatedUpdate.date = filteredUpdateData.date;
                    if (filteredUpdateData.status) relatedUpdate.status = filteredUpdateData.status;
                    if (filteredUpdateData.description) relatedUpdate.description = `[Updated] ${filteredUpdateData.description}`;
                    
                    if (Object.keys(relatedUpdate).length > 0) {
                        relatedUpdate.updatedBy = userId;
                        relatedUpdate.updatedAt = new Date();
                        await TransactionEntry.findByIdAndUpdate(entry._id, relatedUpdate, { session });
                        updatedRelatedEntries++;
                    }
                }
                
                console.log(`   ✅ Updated ${updatedRelatedEntries} related transaction entries`);
            }
            
            // Log to audit trail
            try {
                await createAuditLog({
                    user: userId,
                    action: 'update_transaction_entry',
                    collection: 'TransactionEntry',
                    recordId: id,
                    before: originalData,
                    after: updatedEntry.toObject(),
                    details: JSON.stringify({
                        updatedFields: Object.keys(filteredUpdateData),
                        cascadeUpdated: updatedRelatedEntries > 0 ? { relatedEntries: updatedRelatedEntries } : null
                    })
                });
            } catch (auditError) {
                console.error('⚠️ Failed to create audit log:', auditError);
            }
            
            await session.commitTransaction();
            
            console.log('✅ Transaction entry updated successfully');
            
            res.status(200).json({
                success: true,
                message: 'Transaction entry updated successfully',
                data: {
                    updatedEntry: updatedEntry,
                    cascadeUpdated: updatedRelatedEntries > 0 ? { relatedEntries: updatedRelatedEntries } : null,
                    loggedToAudit: true
                }
            });
            
        } catch (error) {
            await session.abortTransaction();
            console.error('Error updating transaction entry:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update transaction entry',
                error: error.message
            });
        } finally {
            session.endSession();
        }
    }

    /**
     * Delete individual entry from entries array within a TransactionEntry
     * This removes a single entry from the entries array and recalculates totals
     */
    static async deleteEntryFromTransactionEntry(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            const { id, entryId } = req.params;
            const userId = req.user?._id || req.user?.id;
            
            console.log('🗑️ Deleting entry from transaction entry:', { transactionEntryId: id, entryId });
            
            // Find the transaction entry
            const transactionEntry = await TransactionEntry.findById(id).session(session);
            if (!transactionEntry) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    message: `Transaction entry not found with ID: ${id}`
                });
            }
            
            // Store original data for audit
            const originalData = transactionEntry.toObject();
            
            // Find the entry within the entries array
            const entryIndex = transactionEntry.entries.findIndex(
                entry => entry._id.toString() === entryId
            );
            
            if (entryIndex === -1) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    message: `Entry with ID ${entryId} not found in transaction entry ${id}`
                });
            }
            
            // Get the entry to be deleted for logging
            const deletedEntry = transactionEntry.entries[entryIndex].toObject();
            
            // Check if removing this entry would leave less than 2 entries (minimum for double-entry)
            if (transactionEntry.entries.length <= 2) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete entry: Transaction entry must have at least 2 entries for double-entry accounting. Delete the entire transaction entry instead.'
                });
            }
            
            // Remove the entry from the array
            transactionEntry.entries.splice(entryIndex, 1);
            
            // Recalculate totalDebit and totalCredit
            let newTotalDebit = 0;
            let newTotalCredit = 0;
            
            for (const entry of transactionEntry.entries) {
                newTotalDebit += entry.debit || 0;
                newTotalCredit += entry.credit || 0;
            }
            
            // Validate that debits still equal credits
            if (Math.abs(newTotalDebit - newTotalCredit) > 0.01) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete entry: Removing this entry would make the transaction unbalanced (Debits: ${newTotalDebit}, Credits: ${newTotalCredit}). Transaction must remain balanced.`
                });
            }
            
            // Update totals
            transactionEntry.totalDebit = newTotalDebit;
            transactionEntry.totalCredit = newTotalCredit;
            transactionEntry.updatedBy = userId;
            transactionEntry.updatedAt = new Date();
            
            // Save the updated transaction entry
            await transactionEntry.save({ session });
            
            // Log to deletion log
            try {
                    await DeletionLogService.logDeletion({
                        modelName: 'TransactionEntryEntry',
                        documentId: entryId,
                        deletedData: deletedEntry,
                        deletedBy: userId,
                        reason: `Entry deleted from transaction entry ${id}`,
                        context: 'delete_entry',
                        metadata: {
                            transactionEntryId: id,
                            transactionId: transactionEntry.transactionId,
                            deletionType: 'entry_from_transaction',
                            accountCode: deletedEntry.accountCode,
                            accountName: deletedEntry.accountName,
                            debit: deletedEntry.debit,
                            credit: deletedEntry.credit
                        },
                        session: session
                    });
            } catch (logError) {
                console.error(`⚠️ Error logging deletion for entry (${entryId}):`, logError.message);
            }
            
            // Log to audit log
            try {
                await createAuditLog({
                    user: userId,
                    action: 'delete_entry_from_transaction',
                    collection: 'TransactionEntry',
                    recordId: id,
                    before: originalData,
                    after: transactionEntry.toObject(),
                    details: JSON.stringify({
                        deletedEntry: deletedEntry,
                        newTotalDebit: newTotalDebit,
                        newTotalCredit: newTotalCredit,
                        remainingEntries: transactionEntry.entries.length
                    })
                });
            } catch (auditError) {
                console.error('⚠️ Failed to create audit log:', auditError);
            }
            
            await session.commitTransaction();
            
            console.log('✅ Entry deleted from transaction entry successfully');
            
            res.status(200).json({
                success: true,
                message: 'Entry deleted from transaction entry successfully',
                data: {
                    deletedEntry: deletedEntry,
                    updatedTransactionEntry: {
                        _id: transactionEntry._id,
                        transactionId: transactionEntry.transactionId,
                        totalDebit: transactionEntry.totalDebit,
                        totalCredit: transactionEntry.totalCredit,
                        entriesCount: transactionEntry.entries.length
                    },
                    loggedToDeletions: true,
                    loggedToAudit: true
                }
            });
            
        } catch (error) {
            await session.abortTransaction();
            console.error('Error deleting entry from transaction entry:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete entry from transaction entry',
                error: error.message
            });
        } finally {
            session.endSession();
        }
    }

    /**
     * Delete transaction entry with cascade delete for related records
     * ONLY uses explicit linking IDs - no regex/fuzzy matching
     * Logs all deletions to both AuditLog and DeletionLog
     */
    static async deleteTransactionEntry(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            const { id } = req.params;
            const userId = req.user?._id || req.user?.id;
            
            console.log('🗑️ Deleting transaction entry:', id, '(ID-based only)');
            
            // Find the transaction entry
            let transactionEntry = await TransactionEntry.findById(id).session(session);
            
            // If not found, check if this might be an entry ID within the entries array
            if (!transactionEntry) {
                // Try to find a transaction entry that contains this ID in its entries array
                const parentEntry = await TransactionEntry.findOne({
                    'entries._id': id
                }).session(session);
                
                if (parentEntry) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: `The ID provided (${id}) is an entry ID within the entries array, not a TransactionEntry document ID. Use the TransactionEntry document ID: ${parentEntry._id}`,
                        suggestedId: parentEntry._id.toString(),
                        transactionId: parentEntry.transactionId
                    });
                }
                
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    message: `Transaction entry not found with ID: ${id}. Please verify you're using the correct TransactionEntry document ID (not an entry ID from the entries array).`
                });
            }
            
            // Store data for audit and deletion logs
            const deletedData = transactionEntry.toObject();
            const deletedItems = {
                transactionEntry: 1,
                relatedEntries: 0,
                linkedPayments: 0,
                linkedExpenses: 0,
                transactions: 0
            };
            
            console.log('🔍 Checking for related records (ID-based only)...');
            
            const entryIdObj = new mongoose.Types.ObjectId(id);
            const entryIdString = id.toString();
            
            // 1. Find all transaction entries that reference this entry using EXPLICIT ID matching only
            // ONLY matches entries with explicit parent-child relationships - no broad transactionId matching
            const relatedEntriesQuery = {
                $or: [
                    // Direct sourceId reference (exact ObjectId match) - entry explicitly created from this entry
                    { sourceId: entryIdObj, sourceModel: 'TransactionEntry' },
                    // Metadata references (exact string match) - explicit parent-child links
                    { 'metadata.parentEntryId': entryIdString },
                    { 'metadata.originalEntryId': entryIdString },
                    { 'metadata.paymentAllocation.originalTransactionId': entryIdString },
                    { 'metadata.arTransactionId': entryIdString },
                    // Reference field (exact match only - no regex) - explicit reference to this entry ID
                    { reference: entryIdString },
                    { reference: entryIdObj }
                ]
            };
            
            // Note: We intentionally do NOT match by transactionId to avoid deleting unrelated entries
            // that happen to share the same transactionId. Only entries with explicit linking are deleted.
            
            const relatedEntries = await TransactionEntry.find(relatedEntriesQuery).lean().session(session);
            console.log(`   📊 Found ${relatedEntries.length} related transaction entries (ID-based only)`);
            
            // Log and delete related transaction entries
            let loggedRelatedEntries = 0;
            for (const entry of relatedEntries) {
                try {
                    await DeletionLogService.logDeletion({
                        modelName: 'TransactionEntry',
                        documentId: entry._id,
                        deletedData: entry,
                        deletedBy: userId,
                        reason: `Cascade deletion: linked to transaction entry ${id}`,
                        context: 'cascade_delete',
                        metadata: {
                            parentEntryId: id,
                            deletionType: 'related_transaction_entry',
                            transactionId: entry.transactionId,
                            source: entry.source
                        },
                        session: session
                    });
                    loggedRelatedEntries++;
                } catch (logError) {
                    console.error(`⚠️ Error logging deletion for related TransactionEntry (${entry._id}):`, logError.message);
                }
            }
            
            if (relatedEntries.length > 0) {
                const relatedEntryIds = relatedEntries.map(entry => entry._id);
                const deleteResult = await TransactionEntry.deleteMany({
                    _id: { $in: relatedEntryIds }
                }).session(session);
                deletedItems.relatedEntries = deleteResult.deletedCount;
                console.log(`   ✅ Deleted ${deleteResult.deletedCount} related transaction entries - Logged ${loggedRelatedEntries} to deletions collection`);
            }
            
            // 2. Find linked payments using explicit linking IDs only
            let linkedPaymentIds = new Set();
            let paymentsFoundViaRef = new Set(); // Track payments found specifically via reference
            
            // Find payments linked via sourceId
            if (transactionEntry.sourceId && transactionEntry.sourceModel === 'Payment') {
                linkedPaymentIds.add(transactionEntry.sourceId.toString());
            }
            
            // Find payments linked via metadata.paymentId
            if (transactionEntry.metadata?.paymentId) {
                linkedPaymentIds.add(transactionEntry.metadata.paymentId);
            }
            
            // 🆕 NEW: Find payments linked via reference field (if reference matches paymentId or _id)
            // Only these will be auto-deleted (not payments found via other methods)
            if (transactionEntry.reference) {
                // Try to find payment by paymentId (if reference is a string matching paymentId)
                const paymentByPaymentId = await Payment.findOne({ paymentId: transactionEntry.reference }).session(session);
                if (paymentByPaymentId) {
                    const paymentIdStr = paymentByPaymentId._id.toString();
                    linkedPaymentIds.add(paymentIdStr);
                    paymentsFoundViaRef.add(paymentIdStr); // Mark as found via reference
                }
                
                // Try to find payment by _id (if reference is an ObjectId)
                try {
                    const refAsObjectId = new mongoose.Types.ObjectId(transactionEntry.reference);
                    const payment = await Payment.findById(refAsObjectId).session(session);
                    if (payment) {
                        const paymentIdStr = payment._id.toString();
                        linkedPaymentIds.add(paymentIdStr);
                        paymentsFoundViaRef.add(paymentIdStr); // Mark as found via reference
                    }
                } catch (e) {
                    // Reference is not a valid ObjectId, skip
                }
            }
            
            // Find payments linked via related entries (only entries with explicit links)
            for (const entry of relatedEntries) {
                // Only use explicit sourceId links (exact match)
                if (entry.sourceId && entry.sourceModel === 'Payment') {
                    linkedPaymentIds.add(entry.sourceId.toString());
                }
                // Only use explicit metadata.paymentId (exact match)
                if (entry.metadata?.paymentId) {
                    linkedPaymentIds.add(entry.metadata.paymentId);
                }
                // Check reference field - mark as found via reference
                if (entry.reference) {
                    // Try to find payment by paymentId
                    const paymentByPaymentId = await Payment.findOne({ paymentId: entry.reference }).session(session);
                    if (paymentByPaymentId) {
                        const paymentIdStr = paymentByPaymentId._id.toString();
                        linkedPaymentIds.add(paymentIdStr);
                        paymentsFoundViaRef.add(paymentIdStr); // Mark as found via reference
                    }
                    
                    // Try to find payment by _id
                    try {
                        const refAsObjectId = new mongoose.Types.ObjectId(entry.reference);
                        const payment = await Payment.findById(refAsObjectId).session(session);
                        if (payment) {
                            const paymentIdStr = payment._id.toString();
                            linkedPaymentIds.add(paymentIdStr);
                            paymentsFoundViaRef.add(paymentIdStr); // Mark as found via reference
                        }
                    } catch (e) {
                        // Reference is not a valid ObjectId, skip
                    }
                }
            }
            
            console.log(`   📊 Found ${linkedPaymentIds.size} linked payments`);
            
            // Log and delete linked payments
            // 🆕 NEW: Automatically delete payments ONLY if they were found via reference matching
            // This ensures we only delete payments that were created BY this transaction (via reference)
            // Also support query parameter for explicit deletion requests
            const { deleteLinkedPayments = false, deleteLinkedExpenses = false } = req.query;
            
            // Auto-delete ONLY payments that were found specifically via reference matching
            // This is safer - we only delete payments that were created by this transaction
            const paymentsToDelete = deleteLinkedPayments === 'true' || deleteLinkedPayments === true 
                ? Array.from(linkedPaymentIds) // If explicitly requested, delete all linked payments
                : Array.from(paymentsFoundViaRef); // Otherwise, only delete those found via reference
            
            if (paymentsToDelete.length > 0) {
                for (const paymentId of paymentsToDelete) {
                    try {
                        const payment = await Payment.findById(paymentId).session(session);
                        if (payment) {
                            await DeletionLogService.logDeletion({
                                modelName: 'Payment',
                                documentId: paymentId,
                                deletedData: payment.toObject(),
                                deletedBy: userId,
                                reason: `Cascade deletion: linked to transaction entry ${id}`,
                                context: 'cascade_delete',
                                metadata: {
                                    transactionEntryId: id,
                                    deletionType: 'linked_payment'
                                },
                                session: session
                            });
                            await Payment.findByIdAndDelete(paymentId).session(session);
                            deletedItems.linkedPayments++;
                            console.log(`   ✅ Deleted linked payment: ${paymentId} - Logged to deletions collection`);
                        }
                    } catch (logError) {
                        console.error(`⚠️ Error deleting linked payment (${paymentId}):`, logError.message);
                    }
                }
            } else if (linkedPaymentIds.size > paymentsToDelete.length) {
                const remainingCount = linkedPaymentIds.size - paymentsToDelete.length;
                console.log(`   ℹ️ Found ${remainingCount} linked payments (not deleted - use ?deleteLinkedPayments=true to delete all)`);
            }
            
            // 3. Find linked expenses using explicit linking IDs only
            let linkedExpenseIds = new Set();
            let expensesFoundViaRef = new Set(); // Track expenses found specifically via reference
            
            // Find expenses linked via sourceId
            if (transactionEntry.sourceId && transactionEntry.sourceModel === 'Expense') {
                linkedExpenseIds.add(transactionEntry.sourceId.toString());
            }
            
            // Find expenses linked via metadata.expenseId
            if (transactionEntry.metadata?.expenseId) {
                linkedExpenseIds.add(transactionEntry.metadata.expenseId);
            }
            
            // 🆕 NEW: Find expenses linked via reference field (if reference matches expenseId or transactionId)
            // Only these will be auto-deleted (not expenses found via other methods)
            if (transactionEntry.reference) {
                // Try to find expense by expenseId (if reference is a string matching expenseId)
                const expenseByExpenseId = await Expense.findOne({ expenseId: transactionEntry.reference }).session(session);
                if (expenseByExpenseId) {
                    const expenseIdStr = expenseByExpenseId._id.toString();
                    linkedExpenseIds.add(expenseIdStr);
                    expensesFoundViaRef.add(expenseIdStr); // Mark as found via reference
                }
                
                // Try to find expense by transactionId (if reference is an ObjectId)
                try {
                    const refAsObjectId = new mongoose.Types.ObjectId(transactionEntry.reference);
                    const expenseByTransactionId = await Expense.findOne({ transactionId: refAsObjectId }).session(session);
                    if (expenseByTransactionId) {
                        const expenseIdStr = expenseByTransactionId._id.toString();
                        linkedExpenseIds.add(expenseIdStr);
                        expensesFoundViaRef.add(expenseIdStr); // Mark as found via reference
                    }
                } catch (e) {
                    // Reference is not a valid ObjectId, skip
                }
            }
            
            // Find expenses linked via related entries (only entries with explicit links)
            for (const entry of relatedEntries) {
                // Only use explicit sourceId links (exact match)
                if (entry.sourceId && entry.sourceModel === 'Expense') {
                    linkedExpenseIds.add(entry.sourceId.toString());
                }
                // Only use explicit metadata.expenseId (exact match)
                if (entry.metadata?.expenseId) {
                    linkedExpenseIds.add(entry.metadata.expenseId);
                }
                // Check reference field - mark as found via reference
                if (entry.reference) {
                    // Try to find expense by expenseId
                    const expenseByExpenseId = await Expense.findOne({ expenseId: entry.reference }).session(session);
                    if (expenseByExpenseId) {
                        const expenseIdStr = expenseByExpenseId._id.toString();
                        linkedExpenseIds.add(expenseIdStr);
                        expensesFoundViaRef.add(expenseIdStr); // Mark as found via reference
                    }
                    
                    try {
                        const refAsObjectId = new mongoose.Types.ObjectId(entry.reference);
                        const expense = await Expense.findById(refAsObjectId).session(session);
                        if (expense) {
                            const expenseIdStr = expense._id.toString();
                            linkedExpenseIds.add(expenseIdStr);
                            expensesFoundViaRef.add(expenseIdStr); // Mark as found via reference
                        }
                        // Also check transactionId
                        const expenseByTransactionId = await Expense.findOne({ transactionId: refAsObjectId }).session(session);
                        if (expenseByTransactionId) {
                            const expenseIdStr = expenseByTransactionId._id.toString();
                            linkedExpenseIds.add(expenseIdStr);
                            expensesFoundViaRef.add(expenseIdStr); // Mark as found via reference
                        }
                    } catch (e) {
                        // Reference is not a valid ObjectId, skip
                    }
                }
            }
            
            console.log(`   📊 Found ${linkedExpenseIds.size} linked expenses`);
            
            // Log and delete linked expenses
            // 🆕 NEW: Automatically delete expenses ONLY if they were found via reference matching
            // This ensures we only delete expenses that were created BY this transaction (via reference)
            // Also support query parameter for explicit deletion requests
            // Auto-delete ONLY expenses that were found specifically via reference matching
            // This is safer - we only delete expenses that were created by this transaction
            const expensesToDelete = deleteLinkedExpenses === 'true' || deleteLinkedExpenses === true 
                ? Array.from(linkedExpenseIds) // If explicitly requested, delete all linked expenses
                : Array.from(expensesFoundViaRef); // Otherwise, only delete those found via reference
            
            if (expensesToDelete.length > 0) {
                for (const expenseId of expensesToDelete) {
                    try {
                        const expense = await Expense.findById(expenseId).session(session);
                        if (expense) {
                            await DeletionLogService.logDeletion({
                                modelName: 'Expense',
                                documentId: expenseId,
                                deletedData: expense.toObject(),
                                deletedBy: userId,
                                reason: `Cascade deletion: linked to transaction entry ${id}`,
                                context: 'cascade_delete',
                                metadata: {
                                    transactionEntryId: id,
                                    deletionType: 'linked_expense'
                                },
                                session: session
                            });
                            await Expense.findByIdAndDelete(expenseId).session(session);
                            deletedItems.linkedExpenses++;
                            console.log(`   ✅ Deleted linked expense: ${expenseId} - Logged to deletions collection`);
                        }
                    } catch (logError) {
                        console.error(`⚠️ Error deleting linked expense (${expenseId}):`, logError.message);
                    }
                }
            } else if (linkedExpenseIds.size > expensesToDelete.length) {
                const remainingCount = linkedExpenseIds.size - expensesToDelete.length;
                console.log(`   ℹ️ Found ${remainingCount} linked expenses (not deleted - use ?deleteLinkedExpenses=true to delete all)`);
            }
            
            // 4. Check if any transactions are now empty and delete them
            const relatedTransactionIds = [...new Set([
                ...relatedEntries.map(e => e.transactionId),
                transactionEntry.transactionId
            ].filter(Boolean))];
            
            let loggedTransactions = 0;
            for (const transactionId of relatedTransactionIds) {
                const remainingEntries = await TransactionEntry.countDocuments({ 
                    transactionId: transactionId 
                }).session(session);
                
                if (remainingEntries === 0) {
                    const transaction = await Transaction.findOne({ 
                        transactionId: transactionId 
                    }).session(session);
                    
                    if (transaction) {
                        try {
                            await DeletionLogService.logDeletion({
                                modelName: 'Transaction',
                                documentId: transaction._id,
                                deletedData: transaction.toObject(),
                                deletedBy: userId,
                                reason: `Cascade deletion: empty transaction after entry deletion`,
                                context: 'cascade_delete',
                                metadata: {
                                    transactionEntryId: id,
                                    transactionId: transactionId,
                                    deletionType: 'empty_transaction'
                                },
                                session: session
                            });
                            loggedTransactions++;
                        } catch (logError) {
                            console.error(`⚠️ Error logging deletion for Transaction (${transaction._id}):`, logError.message);
                        }
                        
                        await Transaction.findOneAndDelete({ 
                            transactionId: transactionId 
                        }).session(session);
                        deletedItems.transactions++;
                        console.log(`   ✅ Deleted empty transaction: ${transactionId} - Logged to deletions collection`);
                    }
                }
            }
            
            // 5. Log the main transaction entry deletion
            try {
                await DeletionLogService.logDeletion({
                    modelName: 'TransactionEntry',
                    documentId: id,
                    deletedData: deletedData,
                    deletedBy: userId,
                    reason: `Transaction entry deletion with cascade`,
                    context: 'delete',
                    metadata: {
                        deletionType: 'transaction_entry',
                        transactionId: transactionEntry.transactionId,
                        source: transactionEntry.source,
                        cascadeDeleted: {
                            relatedEntries: deletedItems.relatedEntries,
                            transactions: deletedItems.transactions
                        }
                    },
                    session: session
                });
            } catch (logError) {
                console.error(`⚠️ Error logging deletion for TransactionEntry (${id}):`, logError.message);
            }
            
            // 6. Delete the main transaction entry
            await TransactionEntry.findByIdAndDelete(id).session(session);
            console.log('✅ Transaction entry deleted successfully');
            
            // 7. Log to audit trail
            try {
                await createAuditLog({
                    user: userId,
                    action: 'delete_transaction_entry',
                    collection: 'TransactionEntry',
                    recordId: id,
                    details: JSON.stringify({
                        deletedEntry: deletedData,
                        cascadeDeleted: {
                            relatedEntries: deletedItems.relatedEntries,
                            linkedPayments: deletedItems.linkedPayments,
                            linkedExpenses: deletedItems.linkedExpenses,
                            transactions: deletedItems.transactions
                        }
                    })
                });
            } catch (auditError) {
                console.error('⚠️ Failed to create audit log:', auditError);
            }
            
            await session.commitTransaction();
            
            res.status(200).json({
                success: true,
                message: 'Transaction entry deleted successfully with cascade delete (ID-based only)',
                data: {
                    deletedEntry: deletedData,
                    cascadeDeleted: {
                        relatedEntries: deletedItems.relatedEntries,
                        linkedPayments: deletedItems.linkedPayments,
                        linkedExpenses: deletedItems.linkedExpenses,
                        transactions: deletedItems.transactions
                    },
                    loggedToDeletions: true,
                    loggedToAudit: true
                }
            });
            
        } catch (error) {
            await session.abortTransaction();
            console.error('Error deleting transaction entry:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete transaction entry',
                error: error.message
            });
        } finally {
            session.endSession();
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
            
            // Fetch account information for all entries
            const Account = require('../../models/Account');
            const accountIds = entries.map(entry => entry.account);
            const accounts = await Account.find({ _id: { $in: accountIds } });
            
            // Create account lookup map
            const accountMap = {};
            accounts.forEach(account => {
                accountMap[account._id.toString()] = {
                    code: account.code,
                    name: account.name,
                    type: account.type
                };
            });
            
            // Validate all accounts exist
            for (const entry of entries) {
                if (!accountMap[entry.account]) {
                    return res.status(400).json({
                        success: false,
                        message: `Account not found: ${entry.account}`
                    });
                }
            }
            
            // Determine transaction source based on account types and description
            const transactionSource = TransactionController.determineTransactionSource(entries, description);
            
            // Import account name normalizer
            const { normalizeAccountName } = require('../../utils/accountNameNormalizer');
            
            // Create transaction entry with all the double-entry details
            const transactionEntry = new TransactionEntry({
                transactionId,
                date: date ? new Date(date) : new Date(),
                description,
                reference: reference || transactionId,
                entries: entries.map(entry => {
                    const accountInfo = accountMap[entry.account];
                    // Normalize account name (ensures "Cbz Vault" for account code 10003)
                    const normalizedAccountName = normalizeAccountName(accountInfo.code, accountInfo.name);
                    return {
                        accountCode: accountInfo.code,
                        accountName: normalizedAccountName,
                        accountType: accountInfo.type,
                        debit: entry.debit || 0,
                        credit: entry.credit || 0,
                        description: entry.description || description
                    };
                }),
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
            
            // Check if this transaction involves expense accounts and create expense record
            let createdExpense = null;
            const expenseEntry = entries.find(entry => {
                const accountInfo = accountMap[entry.account];
                return accountInfo.type === 'Expense' && entry.debit > 0;
            });
            
            if (expenseEntry) {
                try {
                    console.log('💰 Creating expense record for manual journal entry...');
                    
                    const accountInfo = accountMap[expenseEntry.account];
                    const expenseAmount = expenseEntry.debit;
                    
                    // Generate unique expense ID
                    const { generateUniqueId } = require('../../utils/idGenerator');
                    const expenseId = await generateUniqueId('EXP');
                    
                    // Determine expense category based on account name
                    let category = 'Other';
                    const accountName = accountInfo.name.toLowerCase();
                    if (accountName.includes('maintenance')) category = 'Maintenance';
                    else if (accountName.includes('utility') || accountName.includes('gas') || accountName.includes('water') || accountName.includes('electricity')) category = 'Utilities';
                    else if (accountName.includes('tax')) category = 'Taxes';
                    else if (accountName.includes('insurance')) category = 'Insurance';
                    else if (accountName.includes('salary') || accountName.includes('wage')) category = 'Salaries';
                    else if (accountName.includes('supply')) category = 'Supplies';
                    
                    // Create expense record with proper linking
                    const newExpense = new Expense({
                        expenseId,
                        residence: residence._id || residence,
                        category,
                        amount: expenseAmount,
                        description: description,
                        expenseDate: date ? new Date(date) : new Date(),
                        paymentStatus: 'Paid', // Manual journal entries are considered paid
                        createdBy: req.user._id,
                        period: 'monthly',
                        paymentMethod: 'Cash', // Default for manual entries
                        approvedBy: req.user._id,
                        approvedAt: new Date(),
                        approvedByEmail: req.user.email,
                        transactionId: transactionEntry._id, // Link to transaction entry
                        notes: `Created from manual journal entry: ${transactionId}`,
                        // Add metadata to track the relationship
                        metadata: {
                            source: 'journal_entry',
                            sourceTransactionId: transactionId,
                            sourceTransactionEntryId: transactionEntry._id,
                            createdFrom: 'manual_journal_entry'
                        }
                    });
                    
                    await newExpense.save();
                    createdExpense = newExpense;
                    
                    // Update transaction entry to link to expense
                    await TransactionEntry.findByIdAndUpdate(transactionEntry._id, {
                        $set: { 
                            sourceId: newExpense._id,
                            sourceModel: 'Expense',
                            // Add metadata to track the relationship
                            'metadata.expenseId': newExpense._id,
                            'metadata.expenseRecordId': newExpense._id,
                            'metadata.linkedExpense': true
                        }
                    });
                    
                    console.log('✅ Expense record created:', newExpense._id);
                    
                } catch (expenseError) {
                    console.error('❌ Error creating expense record:', expenseError);
                    // Don't fail the transaction creation if expense creation fails
                }
            }
            
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
                    expense: createdExpense ? {
                        _id: createdExpense._id,
                        expenseId: createdExpense.expenseId,
                        category: createdExpense.category,
                        amount: createdExpense.amount,
                        description: createdExpense.description
                    } : null,
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
                accrualTransactionId,
                paymentType = 'rent' // NEW: Specify what type of payment is being negotiated
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
                accrualTransactionId,
                paymentType
            });

            // Validate required fields
            if (!description || !studentName || !studentId || !originalAmount || !negotiatedAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Description, student name, student ID, original amount, and negotiated amount are required'
                });
            }

            // Validate payment type
            const validPaymentTypes = ['rent', 'admin_fee', 'deposit', 'utilities', 'other'];
            if (!validPaymentTypes.includes(paymentType)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid payment type. Must be one of: ${validPaymentTypes.join(', ')}`
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
                    $and: [
                        {
                            $or: [
                                // Handle both string and ObjectId formats for studentId
                                { 'metadata.studentId': studentId },
                                { 'metadata.studentId': new mongoose.Types.ObjectId(studentId) }
                            ]
                        },
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

            // Get the appropriate income account based on payment type
            let incomeAccount = null;
            
            switch (paymentType) {
                case 'rent':
                    incomeAccount = await Account.findOne({
                        $or: [
                            { code: '4001', type: 'Income' },
                            { code: '4000', type: 'Income' },
                            { name: /rental income/i, type: 'Income' }
                        ]
                    });
                    if (!incomeAccount) {
                        incomeAccount = new Account({
                            code: '4001',
                            name: 'Rental Income - School Accommodation',
                            type: 'Income',
                            category: 'Operating Revenue',
                            description: 'Income from student accommodation rentals',
                            isActive: true
                        });
                        await incomeAccount.save();
                        console.log(`✅ Created rental income account: ${incomeAccount.code}`);
                    }
                    break;
                    
                case 'admin_fee':
                    incomeAccount = await Account.findOne({
                        $or: [
                            { code: '4002', type: 'Income' },
                            { name: /administrative fee/i, type: 'Income' },
                            { name: /admin fee/i, type: 'Income' }
                        ]
                    });
                    if (!incomeAccount) {
                        incomeAccount = new Account({
                            code: '4002',
                            name: 'Administrative Fees',
                            type: 'Income',
                            category: 'Operating Revenue',
                            description: 'Administrative fees from students',
                            isActive: true
                        });
                        await incomeAccount.save();
                        console.log(`✅ Created admin fee account: ${incomeAccount.code}`);
                    }
                    break;
                    
                case 'deposit':
                    // Deposits are liabilities, not income - they should reduce the liability account
                    incomeAccount = await Account.findOne({
                        $or: [
                            { code: '2020', type: 'Liability' },
                            { name: /tenant deposit/i, type: 'Liability' },
                            { name: /security deposit/i, type: 'Liability' }
                        ]
                    });
                    if (!incomeAccount) {
                        incomeAccount = new Account({
                            code: '2020',
                            name: 'Tenant Security Deposits',
                            type: 'Liability',
                            category: 'Current Liabilities',
                            description: 'Security deposits held from tenants',
                            isActive: true
                        });
                        await incomeAccount.save();
                        console.log(`✅ Created tenant deposit account: ${incomeAccount.code}`);
                    }
                    break;
                    
                case 'utilities':
                    incomeAccount = await Account.findOne({
                        $or: [
                            { code: '4005', type: 'Income' },
                            { name: /utilities/i, type: 'Income' },
                            { name: /wifi/i, type: 'Income' }
                        ]
                    });
                    if (!incomeAccount) {
                        incomeAccount = new Account({
                            code: '4005',
                            name: 'Utilities Income',
                            type: 'Income',
                            category: 'Operating Revenue',
                            description: 'Income from utilities and services',
                            isActive: true
                        });
                        await incomeAccount.save();
                        console.log(`✅ Created utilities income account: ${incomeAccount.code}`);
                    }
                    break;
                    
                case 'other':
                    incomeAccount = await Account.findOne({
                        $or: [
                            { code: '4020', type: 'Income' },
                            { name: /other income/i, type: 'Income' }
                        ]
                    });
                    if (!incomeAccount) {
                        incomeAccount = new Account({
                            code: '4020',
                            name: 'Other Income',
                            type: 'Income',
                            category: 'Operating Revenue',
                            description: 'Other miscellaneous income',
                            isActive: true
                        });
                        await incomeAccount.save();
                        console.log(`✅ Created other income account: ${incomeAccount.code}`);
                    }
                    break;
            }
            
            if (!incomeAccount) {
                return res.status(400).json({
                    success: false,
                    message: `Could not find or create appropriate account for payment type: ${paymentType}`
                });
            }

            // Create the negotiated payment adjustment transaction
            // This reduces the A/R balance and records the discount
            // Use the accrual date to maintain proper accounting period matching
            const accrualDate = originalAccrual ? new Date(originalAccrual.date) : new Date();
            const transactionData = {
                description: description || `Negotiated ${paymentType} payment adjustment for ${studentName}`,
                reference: reference || `NEG-${paymentType.toUpperCase()}-${Date.now()}`,
                date: accrualDate,
                source: 'manual', // Use 'manual' since 'negotiated_payment' is not in the enum
                sourceModel: 'TransactionEntry',
                sourceId: req.user?._id,
                status: 'posted',
                createdBy: req.user?._id,
                transactionId: `NEG-${paymentType.toUpperCase()}-${Date.now()}`,
                // Ensure residence is saved at top-level for reliable filtering
                residence: residenceId ? new mongoose.Types.ObjectId(residenceId) : (originalAccrual?.residence || undefined),
                totalDebit: discountAmount, // Only the discount amount
                totalCredit: discountAmount, // Balanced transaction
                entries: [
                    // Debit: Income/Liability Account (reduce by discount amount)
                    {
                        accountCode: incomeAccount.code,
                        accountName: incomeAccount.name,
                        accountType: incomeAccount.type,
                        debit: discountAmount,
                        credit: 0,
                        description: `${incomeAccount.name} reduction for negotiated ${paymentType} discount - ${studentName}`,
                        metadata: {
                            studentName,
                            studentId,
                            residenceId: residenceId || originalAccrual?.metadata?.residenceId || originalAccrual?.residence,
                            transactionType: 'negotiated_payment_adjustment',
                            paymentType: paymentType,
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
                        description: `A/R reduction for negotiated ${paymentType} discount - ${studentName}`,
                        metadata: {
                            studentName,
                            studentId,
                            residenceId: residenceId || originalAccrual?.metadata?.residenceId || originalAccrual?.residence,
                            transactionType: 'negotiated_payment_adjustment',
                            paymentType: paymentType,
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
                    paymentType: paymentType,
                    originalAmount: original,
                    negotiatedAmount: negotiated,
                    discountAmount: discountAmount,
                    negotiationReason: negotiationReason || 'Student negotiation',
                    // Duplicate residence in metadata for compatibility with existing filters
                    residence: residenceId || originalAccrual?.residence,
                    residenceId: residenceId || originalAccrual?.metadata?.residenceId || originalAccrual?.residence,
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
                message: `Negotiated ${paymentType} payment adjustment created successfully`,
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
                    paymentType: paymentType,
                    originalAmount: original,
                    negotiatedAmount: negotiated,
                    discountAmount: discountAmount,
                    discountPercentage: ((discountAmount / original) * 100).toFixed(2) + '%',
                    accountingImpact: {
                        arReduction: discountAmount,
                        accountReduction: {
                            accountCode: incomeAccount.code,
                            accountName: incomeAccount.name,
                            accountType: incomeAccount.type,
                            reductionAmount: discountAmount
                        },
                        netEffect: `A/R reduced, ${incomeAccount.name} reduced by discount amount`
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
     * 🚫 COMPREHENSIVE: Reverse ALL accrual entries from lease start transaction for forfeiture
     * This reverses rental income, admin fees, and security deposits while preserving the original transaction structure
     * 
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    static async reverseLeaseStartAccruals(req, res) {
        try {
            const { 
                transactionId, 
                studentId,
                studentName,
                reason = 'Student forfeiture - no-show',
                date 
            } = req.body;

            console.log('🚫 Reversing ALL accrual entries from lease start transaction:', {
                transactionId,
                studentId,
                studentName,
                reason
            });

            // Validate required fields
            if (!transactionId) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction ID is required'
                });
            }

            if (!studentId || !studentName) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID and name are required'
                });
            }

            // Find the original lease start transaction
            const originalTransaction = await TransactionEntry.findOne({
                transactionId: transactionId,
                status: 'posted'
            });

            if (!originalTransaction) {
                return res.status(404).json({
                    success: false,
                    message: `Lease start transaction not found: ${transactionId}`
                });
            }

            console.log('📋 Original transaction found:', {
                id: originalTransaction._id,
                description: originalTransaction.description,
                entries: originalTransaction.entries.length,
                totalDebit: originalTransaction.totalDebit,
                totalCredit: originalTransaction.totalCredit
            });

            // Create reversal transaction that reverses ALL accrual entries
            const reversalDate = date ? new Date(date) : new Date();
            const reversalTransactionId = `REVERSE-LEASE-START-${Date.now()}`;
            
            // Build reversal entries - reverse ALL entries from the original transaction
            const reversalEntries = originalTransaction.entries.map(entry => {
                // Reverse the debit/credit amounts
                return {
                    accountCode: entry.accountCode,
                    accountName: entry.accountName,
                    accountType: entry.accountType,
                    debit: entry.credit, // Original credit becomes debit
                    credit: entry.debit, // Original debit becomes credit
                    description: `Reversal: ${entry.description}`,
                    metadata: {
                        studentId,
                        studentName,
                        originalEntryId: entry._id,
                        originalTransactionId: transactionId,
                        reason: reason,
                        transactionType: 'lease_start_accrual_reversal',
                        createdBy: 'system',
                        createdByEmail: 'system@alamait.com',
                        isReversal: true,
                        isForfeiture: true
                    }
                };
            });

            // Create the comprehensive reversal transaction
            const reversalTransaction = new TransactionEntry({
                transactionId: reversalTransactionId,
                date: reversalDate,
                description: `Complete lease start accrual reversal for forfeiture: ${studentName}`,
                reference: `FORFEIT-REVERSE-${studentId}`,
                entries: reversalEntries,
                totalDebit: originalTransaction.totalCredit, // Reversed
                totalCredit: originalTransaction.totalDebit, // Reversed
                source: 'rental_accrual_reversal',
                sourceId: originalTransaction._id,
                sourceModel: 'TransactionEntry',
                residence: originalTransaction.residence,
                createdBy: 'system',
                approvedBy: null,
                approvedAt: null,
                status: 'posted',
                metadata: {
                    studentId,
                    studentName,
                    originalTransactionId: transactionId,
                    originalTransaction: originalTransaction._id,
                    reason: reason,
                    transactionType: 'lease_start_complete_reversal',
                    residence: originalTransaction.residence,
                    createdBy: 'system',
                    createdByEmail: 'system@alamait.com',
                    isCompleteReversal: true,
                    isForfeiture: true,
                    originalEntriesCount: originalTransaction.entries.length,
                    reversalEntriesCount: reversalEntries.length,
                    originalTotalDebit: originalTransaction.totalDebit,
                    originalTotalCredit: originalTransaction.totalCredit,
                    reversalTotalDebit: originalTransaction.totalCredit,
                    reversalTotalCredit: originalTransaction.totalDebit
                }
            });

            // Save the reversal transaction
            await reversalTransaction.save();

            console.log('✅ Complete lease start accrual reversal created:', {
                reversalId: reversalTransaction._id,
                reversalTransactionId: reversalTransactionId,
                entriesReversed: reversalEntries.length,
                totalReversed: originalTransaction.totalDebit + originalTransaction.totalCredit
            });

            // Return comprehensive response
            return res.status(200).json({
                success: true,
                message: 'All lease start accrual entries reversed successfully for forfeiture',
                data: {
                    originalTransaction: {
                        id: originalTransaction._id,
                        transactionId: originalTransaction.transactionId,
                        description: originalTransaction.description,
                        totalDebit: originalTransaction.totalDebit,
                        totalCredit: originalTransaction.totalCredit,
                        entriesCount: originalTransaction.entries.length
                    },
                    reversalTransaction: {
                        id: reversalTransaction._id,
                        transactionId: reversalTransaction.transactionId,
                        description: reversalTransaction.description,
                        totalDebit: reversalTransaction.totalDebit,
                        totalCredit: reversalTransaction.totalCredit,
                        entriesCount: reversalTransaction.entries.length
                    },
                    student: {
                        id: studentId,
                        name: studentName
                    },
                    accounting: {
                        entriesReversed: reversalEntries.length,
                        totalAmountReversed: originalTransaction.totalDebit + originalTransaction.totalCredit,
                        netEffect: 0, // Complete reversal means net effect is zero
                        reversalType: 'complete_accrual_reversal'
                    },
                    summary: {
                        reason: reason,
                        date: reversalDate,
                        completeReversal: true,
                        allAccrualsReversed: true
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error reversing lease start accruals:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to reverse lease start accruals',
                error: error.message
            });
        }
    }

    /**
     * 🚫 COMPREHENSIVE: Forfeit a student (complete no-show handling)
     * This handles everything: accrual reversal, payment forfeiture, room availability, student status, and replacement
     * 
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    static async forfeitStudent(req, res) {
        try {
            let { 
                studentId, 
                reason = 'Student no-show',
                replacementStudentId,
                replacementStudentName,
                date 
            } = req.body;

            console.log('🚫 Forfeiting student (comprehensive no-show handling):', {
                studentId,
                reason,
                replacementStudentId,
                replacementStudentName
            });

            // Validate required fields
            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID is required'
                });
            }

            // Get required models
            const User = require('../../models/User');
            const Application = require('../../models/Application');
            const Payment = require('../../models/Payment');
            const ExpiredStudent = require('../../models/ExpiredStudent');
            const Room = require('../../models/Room');
            const Debtor = require('../../models/Debtor');

            // Step 1: Find student (try User collection first, then Application)
            let student = await User.findById(studentId);
            let isApplicationOnly = false;
            
            if (!student) {
                const application = await Application.findById(studentId);
                if (application) {
                    // Create student object from application data
                    // Use the actual student ID from the application, not the application ID
                    const actualStudentId = application.student || studentId;
                    const originalApplicationId = studentId; // Store the original application ID
                    student = {
                        _id: actualStudentId, // Use the actual student ID
                        firstName: application.firstName,
                        lastName: application.lastName,
                        email: application.email,
                        phone: application.phone,
                        currentRoom: application.allocatedRoom,
                        residence: application.residence,
                        status: 'approved',
                        isApplicationOnly: true,
                        applicationId: originalApplicationId // Keep track of the original application ID
                    };
                    isApplicationOnly = true;
                    // Update studentId to use the actual student ID for transaction searches
                    studentId = actualStudentId;
                }
            }

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            // Validate student object has required fields
            if (!student.firstName || !student.lastName) {
                return res.status(400).json({
                    success: false,
                    message: 'Student data is incomplete - missing name information'
                });
            }

            const studentName = `${student.firstName} ${student.lastName}`;
            const forfeitureDate = date ? new Date(date) : new Date();

            console.log('📋 Student found:', {
                id: student._id,
                name: studentName,
                email: student.email,
                isApplicationOnly,
                currentRoom: student.currentRoom,
                residence: student.residence
            });

            // Step 2: Find and analyze applications
            let applications = [];
            if (isApplicationOnly) {
                // For application-only students, find by the original application ID
                const originalApplicationId = student.applicationId || studentId;
                const application = await Application.findById(originalApplicationId);
                if (application) {
                    applications = [application];
                }
            } else {
                applications = await Application.find({ 
                    $or: [
                        { studentId: studentId },
                        { student: studentId },
                        { email: student.email }
                    ]
                });
            }

            console.log('📋 Applications found:', applications.length);
            
            // Get the original application ID for transaction searches
            const originalApplicationId = student.applicationId;
            
            console.log('🔍 Debug - Student ID:', studentId);
            console.log('🔍 Debug - Original Application ID:', originalApplicationId);
            console.log('🔍 Debug - Student Name:', studentName);

            // Step 3: Find and analyze payments
            let payments = [];
            // Search for payments using both student ID and email
            payments = await Payment.find({ 
                $or: [
                    { studentId: studentId },
                    { student: studentId },
                    { user: studentId },
                    { email: student.email }
                ]
            });

            // Also find payment-related transactions
            // Search using both Application ID and Student User ID, plus Payment IDs
            const paymentIds = payments.map(payment => payment._id.toString());
            const paymentTransactions = await TransactionEntry.find({
                $and: [
                    {
                        $or: [
                            { 'metadata.studentId': studentId },
                            { 'metadata.studentId': new mongoose.Types.ObjectId(studentId) },
                            { 'metadata.studentId': originalApplicationId },
                            { 'metadata.studentId': new mongoose.Types.ObjectId(originalApplicationId) },
                            { 'metadata.studentName': { $regex: studentName, $options: 'i' } },
                            { 'description': { $regex: studentName, $options: 'i' } },
                            { 'reference': { $regex: studentId, $options: 'i' } },
                            { 'reference': { $regex: originalApplicationId, $options: 'i' } },
                            // Search by Payment IDs in reference field
                            ...paymentIds.map(paymentId => ({ 'reference': { $regex: paymentId, $options: 'i' } }))
                        ]
                    },
                    {
                        $or: [
                            { source: 'payment' },
                            { source: 'advance_payment' },
                            { 'description': { $regex: 'payment', $options: 'i' } },
                            { 'transactionId': { $regex: 'TXN', $options: 'i' } }
                        ]
                    },
                    { status: 'posted' },
                    // Exclude already forfeited transactions
                    { 
                        $and: [
                            { 'metadata.isForfeiture': { $ne: true } },
                            { 'source': { $ne: 'payment_forfeiture' } }
                        ]
                    }
                ]
            });

            console.log('💰 Payments found:', payments.length);
            if (payments.length > 0) {
                payments.forEach((payment, index) => {
                    console.log(`   Payment ${index + 1}: ID ${payment._id}, Amount: $${payment.totalAmount || payment.amount}, Status: ${payment.status}`);
                });
            }
            console.log('💰 Payment transactions found:', paymentTransactions.length);

            // Step 4: Find ALL accrual transactions to reverse (lease start + monthly)
            // Search by multiple criteria to catch all related transactions
            // BUT exclude already reversed transactions
            const allAccrualTransactions = await TransactionEntry.find({
                $and: [
                    {
                        $or: [
                            { 'metadata.studentId': studentId },
                            { 'metadata.studentId': new mongoose.Types.ObjectId(studentId) },
                            { 'metadata.studentId': originalApplicationId },
                            { 'metadata.studentId': new mongoose.Types.ObjectId(originalApplicationId) },
                            { 'metadata.studentName': { $regex: studentName, $options: 'i' } },
                            { 'description': { $regex: studentName, $options: 'i' } },
                            { 'reference': { $regex: studentId, $options: 'i' } },
                            { 'reference': { $regex: originalApplicationId, $options: 'i' } }
                        ]
                    },
                    {
                        $or: [
                            // Lease start accruals
                            { 'metadata.type': 'lease_start' },
                            { 'description': { $regex: 'lease start', $options: 'i' } },
                            { 'transactionId': { $regex: 'LEASE_START', $options: 'i' } },
                            // Monthly rent accruals
                            { 'metadata.type': 'monthly_rent_accrual' },
                            { 'description': { $regex: 'monthly rent accrual', $options: 'i' } },
                            { 'transactionId': { $regex: 'MONTHLY_ACCRUAL', $options: 'i' } }
                        ]
                    },
                    { status: 'posted' },
                    // Exclude already reversed transactions
                    { 
                        $and: [
                            { 'metadata.isReversal': { $ne: true } },
                            { 'metadata.isForfeiture': { $ne: true } },
                            { 'source': { $ne: 'rental_accrual_reversal' } }
                        ]
                    }
                ]
            });

            console.log('🔄 All accrual transactions found:', allAccrualTransactions.length);

            // Step 5: Reverse all accruals (lease start + monthly)
            const accrualReversals = [];
            for (const transaction of allAccrualTransactions) {
                try {
                    // Create reversal transaction directly instead of calling the endpoint
                    const reversalDate = forfeitureDate;
                    const transactionType = transaction.metadata?.type || 'unknown';
                    const reversalTransactionId = `REVERSE-${transactionType.toUpperCase()}-${Date.now()}`;
                    
                    // Build reversal entries - reverse ALL entries from the original transaction
                    const reversalEntries = transaction.entries.map(entry => {
                        // Reverse the debit/credit amounts
                        return {
                            accountCode: entry.accountCode,
                            accountName: entry.accountName,
                            accountType: entry.accountType,
                            debit: entry.credit, // Original credit becomes debit
                            credit: entry.debit, // Original debit becomes credit
                            description: `Reversal: ${entry.description}`,
                            metadata: {
                                studentId,
                                studentName,
                                originalEntryId: entry._id,
                                originalTransactionId: transaction.transactionId,
                                reason: reason,
                                transactionType: `${transactionType}_accrual_reversal`,
                                createdBy: 'system',
                                createdByEmail: 'system@alamait.com',
                                isReversal: true,
                                isForfeiture: true
                            }
                        };
                    });

                    // Create the comprehensive reversal transaction
                    const reversalTransaction = new TransactionEntry({
                        transactionId: reversalTransactionId,
                        date: reversalDate,
                        description: `Complete ${transactionType} accrual reversal for forfeiture: ${studentName}`,
                        reference: `FORFEIT-REVERSE-${studentId}`,
                        entries: reversalEntries,
                        totalDebit: transaction.totalCredit, // Reversed
                        totalCredit: transaction.totalDebit, // Reversed
                        source: 'rental_accrual_reversal',
                        sourceId: transaction._id,
                        sourceModel: 'TransactionEntry',
                        residence: transaction.residence,
                        createdBy: 'system',
                        approvedBy: null,
                        approvedAt: null,
                        status: 'posted',
                        metadata: {
                            studentId,
                            studentName,
                            originalTransactionId: transaction.transactionId,
                            originalTransaction: transaction._id,
                            reason: reason,
                            transactionType: `${transactionType}_complete_reversal`,
                            originalAccrualType: transactionType,
                            residence: transaction.residence,
                            createdBy: 'system',
                            createdByEmail: 'system@alamait.com',
                            isCompleteReversal: true,
                            isForfeiture: true,
                            originalEntriesCount: transaction.entries.length,
                            reversalEntriesCount: reversalEntries.length,
                            originalTotalDebit: transaction.totalDebit,
                            originalTotalCredit: transaction.totalCredit,
                            reversalTotalDebit: transaction.totalCredit,
                            reversalTotalCredit: transaction.totalDebit
                        }
                    });

                    // Save the reversal transaction
                    await reversalTransaction.save();
                    
                    accrualReversals.push({
                        originalTransactionId: transaction.transactionId,
                        reversalId: reversalTransaction._id
                    });

                    console.log(`✅ ${transactionType} accrual reversal created:`, reversalTransaction._id);
                } catch (reversalError) {
                    console.error('❌ Error reversing accrual transaction:', reversalError);
                }
            }

            // Step 6: Handle payment forfeiture
            let paymentForfeitureResult = null;
            const totalPaymentAmount = payments.reduce((sum, payment) => sum + (payment.totalAmount || payment.amount || 0), 0);
            // Don't double-count: TransactionEntry records are just accounting for the same payments
            const totalForfeitureAmount = totalPaymentAmount;
            
            console.log('💰 Forfeiture amounts:', {
                totalPaymentAmount,
                totalTransactionAmount: paymentTransactions.reduce((sum, transaction) => sum + (transaction.totalDebit || 0), 0),
                totalForfeitureAmount,
                note: 'Using payment amount only (transactions are accounting entries for same payments)'
            });
            
            if (totalForfeitureAmount > 0) {
                try {
                    // Use earliest paid date among payments; fallback to forfeiture date
                    const paidDates = payments
                        .map(p => p.date)
                        .filter(Boolean)
                        .map(d => new Date(d))
                        .filter(d => !isNaN(d.getTime()));
                    const paidDate = paidDates.length ? new Date(Math.min(...paidDates.map(d => d.getTime()))) : forfeitureDate;

                    const forfeitureTransactionId = `FORFEIT-${Date.now()}`;
                    const forfeitureTransaction = new TransactionEntry({
                        transactionId: forfeitureTransactionId,
                        date: paidDate,
                        description: `Payment forfeiture (reclassify advance to income): ${studentName}`,
                        reference: `FORFEIT-${studentId}`,
                        entries: [
                            {
                                accountCode: '2200',
                                accountName: 'Advance Payment Liability',
                                accountType: 'Liability',
                                debit: totalForfeitureAmount,
                                credit: 0,
                                description: `Remove liability for forfeited payment from ${studentName}`,
                                metadata: { studentId, studentName, reason: reason, transactionType: 'payment_forfeiture', createdBy: 'system', createdByEmail: 'system@alamait.com', isForfeiture: true }
                            },
                            {
                                accountCode: '4003',
                                accountName: 'Forfeited Deposits Income',
                                accountType: 'Income',
                                debit: 0,
                                credit: totalForfeitureAmount,
                                description: `Recognize forfeited payment as income from ${studentName}`,
                                metadata: { studentId, studentName, reason: reason, transactionType: 'payment_forfeiture', createdBy: 'system', createdByEmail: 'system@alamait.com', isForfeiture: true }
                            }
                        ],
                        totalDebit: totalForfeitureAmount,
                        totalCredit: totalForfeitureAmount,
                        source: 'payment_forfeiture',
                        sourceId: null,
                        sourceModel: 'TransactionEntry',
                        residence: student.residence,
                        createdBy: 'system',
                        approvedBy: null,
                        approvedAt: null,
                        status: 'posted',
                        metadata: {
                            studentId,
                            studentName,
                            reason: reason,
                            transactionType: 'payment_forfeiture',
                            residence: student.residence,
                            createdBy: 'system',
                            createdByEmail: 'system@alamait.com',
                            isForfeiture: true,
                            totalPayments: totalForfeitureAmount,
                            paymentCount: payments.length
                        }
                    });

                    await forfeitureTransaction.save();
                    paymentForfeitureResult = {
                        forfeitureTransactionId: forfeitureTransactionId,
                        totalAmount: totalForfeitureAmount,
                        paymentCount: payments.length
                    };

                    console.log('✅ Payment forfeiture reclassification created:', forfeitureTransactionId);
                } catch (paymentError) {
                    console.error('❌ Error creating payment forfeiture reclassification:', paymentError);
                }
            }

            // Step 7: Update application statuses
            const applicationUpdates = [];
            for (const application of applications) {
                if (!application) {
                    console.log('⚠️ Skipping null application');
                    continue;
                }
                
                const oldStatus = application.status || 'unknown';
                application.status = 'expired';
                application.expiredAt = forfeitureDate;
                application.expiredReason = reason;
                await application.save();
                
                applicationUpdates.push({
                    applicationId: application._id,
                    applicationCode: application.applicationCode || 'N/A',
                    oldStatus: oldStatus,
                    newStatus: 'expired',
                    reason: reason
                });
            }

            // Step 8: Handle room management using RoomStatusManager
            let roomAvailability = null;
            const RoomStatusManager = require('../../utils/roomStatusManager');
            
            // Update room occupancy for each application that's being expired
            for (const application of applications) {
                if (application.allocatedRoom && application.residence) {
                    try {
                        const roomResult = await RoomStatusManager.updateRoomOnStatusChange(
                            application._id, 
                            'expired', 
                            `Student forfeited: ${reason}`
                        );
                        
                        if (roomResult.success && roomResult.updated) {
                            roomAvailability = {
                                roomFreed: true,
                                freedRoom: {
                                    roomNumber: roomResult.roomNumber,
                                    oldOccupancy: roomResult.oldOccupancy,
                                    newOccupancy: roomResult.newOccupancy,
                                    newStatus: roomResult.newStatus,
                                    reason: roomResult.reason
                                }
                            };
                            console.log('✅ Room freed via RoomStatusManager:', roomResult.roomNumber);
                        }
                    } catch (roomError) {
                        console.error('❌ Error updating room via RoomStatusManager:', roomError);
                    }
                }
            }

            // Step 9: Handle replacement student assignment
            let replacementStudent = null;
            if (replacementStudentId && student && student.currentRoom) {
                try {
                    const replacement = await User.findById(replacementStudentId);
                    if (replacement) {
                        replacement.currentRoom = student.currentRoom;
                        replacement.roomValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
                        await replacement.save();

                        // Update room occupancy
                        const room = await Room.findById(student.currentRoom);
                        if (room) {
                            room.currentOccupancy = (room.currentOccupancy || 0) + 1;
                            room.status = room.currentOccupancy >= (room.capacity || 1) ? 'occupied' : 'reserved';
                            await room.save();
                        }

                        replacementStudent = {
                            assigned: true,
                            replacementStudent: {
                                studentId: replacement._id,
                                studentName: replacementStudentName || `${replacement.firstName || ''} ${replacement.lastName || ''}`.trim(),
                                roomNumber: room?.roomNumber || 'Unknown',
                                validUntil: replacement.roomValidUntil
                            }
                        };

                        console.log('✅ Replacement student assigned:', replacementStudentName || replacement.firstName);
                    } else {
                        console.log('⚠️ Replacement student not found:', replacementStudentId);
                        replacementStudent = { assigned: false, reason: 'Replacement student not found' };
                    }
                } catch (replacementError) {
                    console.error('❌ Error assigning replacement student:', replacementError);
                    replacementStudent = { assigned: false, reason: replacementError.message };
                }
            } else if (replacementStudentId) {
                console.log('ℹ️ No room available for replacement student assignment');
                replacementStudent = { assigned: false, reason: 'No room available for replacement' };
            }

            // Step 10: Archive student data
            let archivedData = null;
            try {
                const expiredStudent = new ExpiredStudent({
                    originalStudentId: student._id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    email: student.email,
                    phone: student.phone,
                    originalRoom: student.currentRoom,
                    originalResidence: student.residence,
                    applications: applications.map(app => ({
                        applicationId: app._id,
                        applicationCode: app.applicationCode,
                        status: app.status,
                        expiredAt: app.expiredAt,
                        expiredReason: app.expiredReason
                    })),
                    payments: payments.map(payment => ({
                        paymentId: payment._id,
                        amount: payment.amount,
                        paymentMethod: payment.paymentMethod,
                        date: payment.date
                    })),
                    forfeitureDetails: {
                        reason: reason,
                        forfeitedAt: forfeitureDate,
                        forfeitedBy: 'system',
                        accrualReversals: accrualReversals,
                        paymentForfeiture: paymentForfeitureResult,
                        replacementStudent: replacementStudent
                    },
                    archivedAt: forfeitureDate
                });

                await expiredStudent.save();
                archivedData = {
                    expiredStudentId: expiredStudent._id,
                    archivedAt: forfeitureDate,
                    reason: reason
                };

                console.log('✅ Student data archived:', expiredStudent._id);
            } catch (archiveError) {
                console.error('❌ Error archiving student data:', archiveError);
            }

            // Step 11: Remove student from active users (if not application-only)
            let studentRemoved = false;
            if (!isApplicationOnly) {
                try {
                    await User.findByIdAndDelete(studentId);
                    studentRemoved = true;
                    console.log('✅ Student removed from active users');
                } catch (deleteError) {
                    console.error('❌ Error removing student:', deleteError);
                }
            }

            // Step 12: Update debtor records
            try {
                await Debtor.updateMany(
                    { studentId: studentId },
                    { 
                        $set: { 
                            status: 'forfeited',
                            forfeitedAt: forfeitureDate,
                            forfeitedReason: reason
                        }
                    }
                );
                console.log('✅ Debtor records updated');
            } catch (debtorError) {
                console.error('❌ Error updating debtor records:', debtorError);
            }

            // Return comprehensive response
            return res.status(200).json({
                success: true,
                message: 'Student forfeited successfully - all systems updated',
                data: {
                    student: {
                        id: student._id,
                        name: studentName,
                        email: student.email,
                        status: 'forfeited',
                        isApplicationOnly: isApplicationOnly,
                        archivedAt: forfeitureDate
                    },
                    applications: {
                        updated: applicationUpdates.length,
                        details: applicationUpdates
                    },
                    payments: {
                        totalAmount: totalPaymentAmount,
                        totalCount: payments.length,
                        paymentTransactions: {
                            totalAmount: paymentTransactions.reduce((sum, transaction) => sum + (transaction.totalDebit || 0), 0),
                            totalCount: paymentTransactions.length,
                            transactions: paymentTransactions.map(t => ({
                                id: t._id,
                                transactionId: t.transactionId,
                                description: t.description,
                                amount: t.totalDebit || 0
                            }))
                        },
                        forfeitureResult: paymentForfeitureResult
                    },
                    accrualReversals: {
                        transactionsReversed: accrualReversals.length,
                        details: accrualReversals
                    },
                    roomAvailability: roomAvailability,
                    replacementStudent: replacementStudent,
                    archivedData: archivedData,
                    summary: {
                        studentRemoved: studentRemoved,
                        applicationsExpired: applicationUpdates.length,
                        paymentsForfeited: totalForfeitureAmount,
                        accrualsReversed: accrualReversals.length,
                        roomFreed: roomAvailability?.roomFreed || false,
                        replacementAssigned: replacementStudent?.assigned || false,
                        archivedToExpiredStudents: archivedData ? true : false
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error forfeiting student:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to forfeit student',
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