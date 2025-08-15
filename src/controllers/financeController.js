const DoubleEntryAccountingService = require('../services/doubleEntryAccountingService');
const Request = require('../models/Request');
const Expense = require('../models/finance/Expense');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');

/**
 * Finance Controller with Double-Entry Accounting Integration
 * 
 * This controller demonstrates how to integrate the double-entry accounting
 * service with your existing business logic for proper financial recording.
 */
class FinanceController {

    /**
     * 1. APPROVE MAINTENANCE REQUEST (Accrual Basis)
     * Records expense when approved, creates payable to vendor
     */
    static async approveMaintenanceRequest(req, res) {
        try {
            const { requestId } = req.params;
            const { approvalNotes } = req.body;

            console.log('🏗️ Approving maintenance request:', requestId);

            // Find the request
            const request = await Request.findById(requestId)
                .populate('residence')
                .populate('createdBy');

            if (!request) {
                return res.status(404).json({ error: 'Maintenance request not found' });
            }

            if (request.status === 'approved') {
                return res.status(400).json({ error: 'Request already approved' });
            }

            // Update request status
            request.status = 'approved';
            request.approvedBy = req.user._id;
            request.approvedAt = new Date();
            request.approvalNotes = approvalNotes;
            await request.save();

            // Record double-entry accounting transaction (Accrual Basis)
            const accountingResult = await DoubleEntryAccountingService.recordMaintenanceApproval(request, req.user);

            // Create expense record for tracking
            const expense = new Expense({
                expenseId: await DoubleEntryAccountingService.generateExpenseId(),
                requestId: request._id,
                residence: request.residence._id,
                category: 'Maintenance',
                amount: request.items.reduce((sum, item) => {
                    const selectedQuotation = item.quotations?.find(q => q.isSelected);
                    return sum + (selectedQuotation?.amount || 0);
                }, 0),
                description: `Maintenance: ${request.title}`,
                expenseDate: new Date(),
                paymentStatus: 'Pending',
                period: 'monthly',
                createdBy: req.user._id,
                transactionId: accountingResult.transaction._id
            });

            await expense.save();

            console.log('✅ Maintenance request approved and accounting recorded');

            res.json({
                success: true,
                message: 'Maintenance request approved and accounting recorded',
                request: {
                    _id: request._id,
                    title: request.title,
                    status: request.status,
                    approvedAt: request.approvedAt
                },
                accounting: {
                    transactionId: accountingResult.transaction.transactionId,
                    type: accountingResult.transaction.type,
                    amount: accountingResult.transaction.amount
                },
                expense: {
                    expenseId: expense.expenseId,
                    amount: expense.amount,
                    paymentStatus: expense.paymentStatus
                }
            });

        } catch (error) {
            console.error('❌ Error approving maintenance request:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * 2. PAY VENDOR (Cash Basis)
     * Records payment when actually paid, settles payable
     */
    static async payVendor(req, res) {
        try {
            const { expenseId } = req.params;
            const { paymentMethod, receiptImage, paymentNotes } = req.body;

            console.log('💳 Processing vendor payment:', expenseId);

            // Find the expense
            const expense = await Expense.findById(expenseId)
                .populate('residence')
                .populate('vendorId');

            if (!expense) {
                return res.status(404).json({ error: 'Expense not found' });
            }

            if (expense.paymentStatus === 'Paid') {
                return res.status(400).json({ error: 'Expense already paid' });
            }

            // Update expense payment status
            expense.paymentStatus = 'Paid';
            expense.paymentMethod = paymentMethod;
            expense.paidBy = req.user._id;
            expense.paidDate = new Date();
            expense.receiptImage = receiptImage;
            expense.paymentNotes = paymentNotes;

            // Update individual items
            expense.items.forEach(item => {
                item.paymentStatus = 'Paid';
                item.paymentMethod = paymentMethod;
                item.paidBy = req.user._id;
                item.paidDate = new Date();
            });

            await expense.save();

            // Record double-entry accounting transaction (Cash Basis)
            const accountingResult = await DoubleEntryAccountingService.recordVendorPayment(expense, req.user, paymentMethod);

            console.log('✅ Vendor payment processed and accounting recorded');

            res.json({
                success: true,
                message: 'Vendor payment processed and accounting recorded',
                expense: {
                    expenseId: expense.expenseId,
                    amount: expense.amount,
                    paymentStatus: expense.paymentStatus,
                    paymentMethod: expense.paymentMethod,
                    paidDate: expense.paidDate
                },
                accounting: {
                    transactionId: accountingResult.transaction.transactionId,
                    type: accountingResult.transaction.type,
                    amount: accountingResult.transaction.amount
                }
            });

        } catch (error) {
            console.error('❌ Error processing vendor payment:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * 3. APPROVE SUPPLY PURCHASE (Accrual Basis)
     * Records expense when approved, creates payable to vendor
     */
    static async approveSupplyPurchase(req, res) {
        try {
            const { requestId } = req.params;
            const { approvalNotes } = req.body;

            console.log('📦 Approving supply purchase:', requestId);

            // Find the request
            const request = await Request.findById(requestId)
                .populate('residence')
                .populate('createdBy');

            if (!request) {
                return res.status(404).json({ error: 'Supply purchase request not found' });
            }

            if (request.status === 'approved') {
                return res.status(400).json({ error: 'Request already approved' });
            }

            // Update request status
            request.status = 'approved';
            request.approvedBy = req.user._id;
            request.approvedAt = new Date();
            request.approvalNotes = approvalNotes;
            await request.save();

            // Record double-entry accounting transaction (Accrual Basis)
            const accountingResult = await DoubleEntryAccountingService.recordSupplyPurchaseApproval(request, req.user);

            // Create expense record for tracking
            const expense = new Expense({
                expenseId: await DoubleEntryAccountingService.generateExpenseId(),
                requestId: request._id,
                residence: request.residence._id,
                category: 'Supplies',
                amount: request.items.reduce((sum, item) => {
                    const selectedQuotation = item.quotations?.find(q => q.isSelected);
                    return sum + (selectedQuotation?.amount || 0);
                }, 0),
                description: `Supplies: ${request.title}`,
                expenseDate: new Date(),
                paymentStatus: 'Pending',
                period: 'monthly',
                createdBy: req.user._id,
                transactionId: accountingResult.transaction._id
            });

            await expense.save();

            console.log('✅ Supply purchase approved and accounting recorded');

            res.json({
                success: true,
                message: 'Supply purchase approved and accounting recorded',
                request: {
                    _id: request._id,
                    title: request.title,
                    status: request.status,
                    approvedAt: request.approvedAt
                },
                accounting: {
                    transactionId: accountingResult.transaction.transactionId,
                    type: accountingResult.transaction.type,
                    amount: accountingResult.transaction.amount
                },
                expense: {
                    expenseId: expense.expenseId,
                    amount: expense.amount,
                    paymentStatus: expense.paymentStatus
                }
            });

        } catch (error) {
            console.error('❌ Error approving supply purchase:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * 4. PROCESS STUDENT RENT PAYMENT (Cash Basis - No Invoice)
     * Records income when cash is received
     */
    static async processStudentRentPayment(req, res) {
        try {
            const { paymentId } = req.params;
            const { verificationNotes } = req.body;

            console.log('💰 Processing student rent payment:', paymentId);

            // Find the payment
            const payment = await Payment.findById(paymentId)
                .populate('student')
                .populate('residence');

            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }

            if (payment.status === 'Confirmed') {
                return res.status(400).json({ error: 'Payment already confirmed' });
            }

            // Update payment status
            payment.status = 'Confirmed';
            payment.updatedBy = req.user._id;
            payment.proofOfPayment.verifiedBy = req.user._id;
            payment.proofOfPayment.verificationDate = new Date();
            payment.proofOfPayment.status = 'Accepted';
            payment.proofOfPayment.verificationNotes = verificationNotes;
            await payment.save();

            // Record double-entry accounting transaction (Cash Basis)
            const accountingResult = await DoubleEntryAccountingService.recordStudentRentPayment(payment, req.user);

            console.log('✅ Student rent payment processed and accounting recorded');

            res.json({
                success: true,
                message: 'Student rent payment processed and accounting recorded',
                payment: {
                    paymentId: payment.paymentId,
                    amount: payment.totalAmount,
                    status: payment.status,
                    method: payment.method,
                    date: payment.date
                },
                accounting: {
                    transactionId: accountingResult.transaction.transactionId,
                    type: accountingResult.transaction.type,
                    amount: accountingResult.transaction.amount
                }
            });

        } catch (error) {
            console.error('❌ Error processing student rent payment:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * 5. CREATE INVOICE (Accrual Basis)
     * Records receivable when invoice is issued
     */
    static async createInvoice(req, res) {
        try {
            const { studentId, residenceId, roomId } = req.params;
            const { billingPeriod, charges, dueDate } = req.body;

            console.log('🧾 Creating invoice for student:', studentId);

            // Generate invoice number
            const invoiceNumber = await Invoice.generateInvoiceNumber();

            // Calculate totals
            const subtotal = charges.reduce((sum, charge) => sum + (charge.amount * charge.quantity), 0);
            const totalAmount = subtotal; // Add tax calculation if needed

            // Create invoice
            const invoice = new Invoice({
                invoiceNumber,
                student: studentId,
                residence: residenceId,
                room: roomId,
                billingPeriod,
                billingStartDate: new Date(billingPeriod + '-01'),
                billingEndDate: new Date(billingPeriod + '-31'),
                dueDate: new Date(dueDate),
                subtotal,
                totalAmount,
                balanceDue: totalAmount,
                charges,
                status: 'sent',
                paymentStatus: 'unpaid',
                createdBy: req.user._id
            });

            await invoice.save();

            // Record double-entry accounting transaction (Accrual Basis)
            const accountingResult = await DoubleEntryAccountingService.recordInvoiceIssuance(invoice, req.user);

            console.log('✅ Invoice created and accounting recorded');

            res.json({
                success: true,
                message: 'Invoice created and accounting recorded',
                invoice: {
                    invoiceNumber: invoice.invoiceNumber,
                    totalAmount: invoice.totalAmount,
                    dueDate: invoice.dueDate,
                    status: invoice.status
                },
                accounting: {
                    transactionId: accountingResult.transaction.transactionId,
                    type: accountingResult.transaction.type,
                    amount: accountingResult.transaction.amount
                }
            });

        } catch (error) {
            console.error('❌ Error creating invoice:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * 6. PROCESS INVOICE PAYMENT (Cash Basis)
     * Records payment when cash is received, settles receivable
     */
    static async processInvoicePayment(req, res) {
        try {
            const { invoiceId } = req.params;
            const { amount, paymentMethod, reference, notes } = req.body;

            console.log('💳 Processing invoice payment:', invoiceId);

            // Find the invoice
            const invoice = await Invoice.findById(invoiceId)
                .populate('student')
                .populate('residence');

            if (!invoice) {
                return res.status(404).json({ error: 'Invoice not found' });
            }

            if (invoice.status === 'paid') {
                return res.status(400).json({ error: 'Invoice already paid' });
            }

            // Create payment record
            const paymentRecord = {
                paymentId: `PAY${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                amount,
                paymentDate: new Date(),
                paymentMethod,
                reference,
                status: 'confirmed',
                processedBy: req.user._id,
                notes
            };

            // Add payment to invoice
            invoice.addPayment(paymentRecord);
            await invoice.save();

            // Record double-entry accounting transaction (Cash Basis)
            const accountingResult = await DoubleEntryAccountingService.recordInvoicePayment(invoice, paymentRecord, req.user);

            console.log('✅ Invoice payment processed and accounting recorded');

            res.json({
                success: true,
                message: 'Invoice payment processed and accounting recorded',
                invoice: {
                    invoiceNumber: invoice.invoiceNumber,
                    amountPaid: invoice.amountPaid,
                    balanceDue: invoice.balanceDue,
                    status: invoice.status
                },
                payment: {
                    amount: paymentRecord.amount,
                    paymentMethod: paymentRecord.paymentMethod,
                    paymentDate: paymentRecord.paymentDate
                },
                accounting: {
                    transactionId: accountingResult.transaction.transactionId,
                    type: accountingResult.transaction.type,
                    amount: accountingResult.transaction.amount
                }
            });

        } catch (error) {
            console.error('❌ Error processing invoice payment:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * 7. GET FINANCIAL REPORTS BY ACCOUNTING BASIS
     * Supports both cash and accrual basis reporting
     */
    static async getFinancialReport(req, res) {
        try {
            const { basis = 'accrual', dateFrom, dateTo, residence } = req.query;

            console.log('📊 Generating financial report:', { basis, dateFrom, dateTo, residence });

            // Get transactions by accounting basis
            const transactions = await DoubleEntryAccountingService.getTransactionsByBasis(basis, {
                dateFrom,
                dateTo,
                residence
            });

            // Calculate summary totals
            const summary = transactions.reduce((acc, txn) => {
                if (txn.type === 'payment') {
                    acc.cashOut += txn.amount || 0;
                } else if (txn.type === 'approval') {
                    acc.accruedExpenses += txn.amount || 0;
                }
                return acc;
            }, { cashOut: 0, accruedExpenses: 0 });

            // Group by transaction type
            const byType = transactions.reduce((acc, txn) => {
                const type = txn.type;
                if (!acc[type]) acc[type] = [];
                acc[type].push(txn);
                return acc;
            }, {});

            console.log('✅ Financial report generated');

            res.json({
                success: true,
                report: {
                    basis,
                    period: { dateFrom, dateTo, residence },
                    summary,
                    transactions: {
                        total: transactions.length,
                        byType
                    },
                    data: transactions
                }
            });

        } catch (error) {
            console.error('❌ Error generating financial report:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * 8. GET TRANSACTION DETAILS
     * Shows detailed double-entry entries for a transaction
     */
    static async getTransactionDetails(req, res) {
        try {
            const { transactionId } = req.params;

            console.log('🔍 Getting transaction details:', transactionId);

            // Find transaction with entries
            const transaction = await Transaction.findOne({ transactionId })
                .populate('entries')
                .populate('createdBy', 'firstName lastName email')
                .populate('residence', 'name');

            if (!transaction) {
                return res.status(404).json({ error: 'Transaction not found' });
            }

            // Get detailed entries
            const entries = await TransactionEntry.find({
                transactionId: transaction.transactionId
            }).populate('sourceId');

            console.log('✅ Transaction details retrieved');

            res.json({
                success: true,
                transaction: {
                    transactionId: transaction.transactionId,
                    date: transaction.date,
                    description: transaction.description,
                    type: transaction.type,
                    amount: transaction.amount,
                    createdBy: transaction.createdBy,
                    residence: transaction.residence
                },
                entries: entries.map(entry => ({
                    date: entry.date,
                    description: entry.description,
                    totalDebit: entry.totalDebit,
                    totalCredit: entry.totalCredit,
                    entries: entry.entries,
                    source: entry.source,
                    sourceModel: entry.sourceModel,
                    createdBy: entry.createdBy,
                    status: entry.status
                }))
            });

        } catch (error) {
            console.error('❌ Error getting transaction details:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * 9. GENERATE EXPENSE ID (Helper method)
     */
    static async generateExpenseId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5).toUpperCase();
        return `EXP${timestamp}${random}`;
    }

    /**
     * PETTY CASH MANAGEMENT ENDPOINTS
     */

    /**
     * Allocate petty cash to a user
     * Finance only needs to select user and amount
     */
    static async allocatePettyCash(req, res) {
        try {
            const { userId, amount, description, residence, sourceAccount, targetAccount } = req.body;
            console.log('💰 Allocating petty cash to user:', userId, 'amount:', amount, 'residence:', residence);

            // Validate input
            if (!userId || !amount || amount <= 0) {
                return res.status(400).json({ 
                    error: 'User ID and positive amount are required' 
                });
            }

            // Check if user exists
            const User = require('../models/User');
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Allocate petty cash
            const result = await DoubleEntryAccountingService.allocatePettyCash(
                userId, 
                amount, 
                description || `Petty cash allocation for ${user.firstName} ${user.lastName}`,
                req.user,
                residence // Pass residence to the service
            );

            console.log('✅ Petty cash allocated successfully');
            res.json({
                success: true,
                message: 'Petty cash allocated successfully',
                allocation: {
                    userId,
                    userName: `${user.firstName} ${user.lastName}`,
                    amount,
                    description: result.transactionEntry.description,
                    transactionId: result.transaction.transactionId,
                    date: result.transaction.date,
                    residence: result.transaction.residence // Include residence in response
                }
            });

        } catch (error) {
            console.error('❌ Error allocating petty cash:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Record petty cash expense
     * Finance approves petty cash expenses
     */
    static async recordPettyCashExpense(req, res) {
        try {
            const { userId, amount, description, expenseCategory, residence } = req.body;
            console.log('💸 Recording petty cash expense for user:', userId, 'amount:', amount, 'residence:', residence);

            // Validate input
            if (!userId || !amount || amount <= 0 || !description || !expenseCategory) {
                return res.status(400).json({ 
                    error: 'User ID, positive amount, description, and expense category are required' 
                });
            }

            // Check if user exists
            const User = require('../models/User');
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Check petty cash balance
            const balance = await DoubleEntryAccountingService.getPettyCashBalance(userId);
            if (balance.currentBalance < amount) {
                return res.status(400).json({ 
                    error: `Insufficient petty cash balance. Available: $${balance.currentBalance}, Requested: $${amount}` 
                });
            }

            // Record petty cash expense
            const result = await DoubleEntryAccountingService.recordPettyCashExpense(
                userId,
                amount,
                description,
                expenseCategory,
                req.user,
                residence // Pass residence to the service
            );

            console.log('✅ Petty cash expense recorded successfully');
            res.json({
                success: true,
                message: 'Petty cash expense recorded successfully',
                expense: {
                    userId,
                    userName: `${user.firstName} ${user.lastName}`,
                    amount,
                    description,
                    expenseCategory,
                    transactionId: result.transaction?.transactionId,
                    remainingBalance: balance.currentBalance - amount,
                    residence: result.transaction?.residence // Include residence in response
                }
            });

        } catch (error) {
            console.error('❌ Error recording petty cash expense:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Replenish petty cash for a user
     * Finance can top up petty cash
     */
    static async replenishPettyCash(req, res) {
        try {
            const { userId, amount, description, residence } = req.body;
            console.log('🔄 Replenishing petty cash for user:', userId, 'amount:', amount, 'residence:', residence);

            // Validate input
            if (!userId || !amount || amount <= 0) {
                return res.status(400).json({ 
                    error: 'User ID and positive amount are required' 
                });
            }

            // Check if user exists
            const User = require('../models/User');
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Replenish petty cash
            const result = await DoubleEntryAccountingService.replenishPettyCash(
                userId,
                amount,
                description || `Petty cash replenishment for ${user.firstName} ${user.lastName}`,
                req.user,
                residence // Pass residence to the service
            );

            // Get updated balance
            const balance = await DoubleEntryAccountingService.getPettyCashBalance(userId);

            console.log('✅ Petty cash replenished successfully');
            res.json({
                success: true,
                message: 'Petty cash replenished successfully',
                replenishment: {
                    userId,
                    userName: `${user.firstName} ${user.lastName}`,
                    amount,
                    description: result.transactionEntry.description,
                    transactionId: result.transaction.transactionId,
                    newBalance: balance.currentBalance,
                    residence: result.transaction.residence // Include residence in response
                }
            });

        } catch (error) {
            console.error('❌ Error replenishing petty cash:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get petty cash balance for a user
     */
    /**
     * Get petty cash balance for a specific user
     * Returns detailed balance information including allocations, expenses, and replenishments
     */
    static async getPettyCashBalance(req, res) {
        try {
            // Extract parameters with safe defaults
            const { userId } = req.params || {};
            
            console.log('💰 Getting petty cash balance for user:', userId);

            // Validate required parameters
            if (!userId) {
                return res.status(400).json({ 
                    error: 'User ID is required',
                    message: 'Please provide a valid user ID'
                });
            }

            // Check if user exists
            const User = require('../models/User');
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ 
                    error: 'User not found',
                    message: `No user found with ID: ${userId}`
                });
            }

            // Get petty cash balance with detailed breakdown
            const balance = await DoubleEntryAccountingService.getPettyCashBalance(userId);

            console.log(`✅ Petty cash balance retrieved for ${user.firstName} ${user.lastName}: $${balance.currentBalance}`);

            // Return structured response with readable data
            res.json({
                success: true,
                message: `Successfully retrieved petty cash balance for ${user.firstName} ${user.lastName}`,
                data: {
                    user: {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        role: user.role
                    },
                    pettyCashBalance: {
                        totalAllocated: balance.totalAllocated || 0,
                        totalExpenses: balance.totalExpenses || 0,
                        totalReplenished: balance.totalReplenished || 0,
                        currentBalance: balance.currentBalance || 0,
                        formattedBalance: `$${(balance.currentBalance || 0).toFixed(2)}`
                    },
                    summary: {
                        totalTransactions: (balance.totalAllocated || 0) + (balance.totalExpenses || 0) + (balance.totalReplenished || 0),
                        lastUpdated: new Date().toISOString()
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error getting petty cash balance:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                message: 'Failed to retrieve petty cash balance',
                details: error.message
            });
        }
    }

    /**
     * Get all petty cash balances for all eligible users
     * Returns comprehensive balance information for finance dashboard
     */
    static async getAllPettyCashBalances(req, res) {
        try {
            console.log('💰 Getting all petty cash balances for finance dashboard');

            // Get all users eligible for petty cash
            const User = require('../models/User');
            const eligibleRoles = [
                'admin', 
                'admin_assistant', 
                'ceo_assistant',
                'finance_admin', 
                'finance_user', 
                'finance_assistant',
                'property_manager', 
                'maintenance', 
                'manager', 
                'staff'
            ];
            
            const users = await User.find({ 
                role: { $in: eligibleRoles },
                status: 'active'
            }).sort({ firstName: 1, lastName: 1 });

            console.log(`📊 Found ${users.length} eligible users for petty cash`);

            // Get balances for each user
            const balances = [];
            let totalSystemBalance = 0;
            let totalAllocated = 0;
            let totalExpenses = 0;
            let totalReplenished = 0;

            for (const user of users) {
                try {
                    const balance = await DoubleEntryAccountingService.getPettyCashBalance(user._id);
                    
                    // Only include users with actual petty cash activity
                    if (balance.totalAllocated > 0 || balance.totalExpenses > 0 || balance.totalReplenished > 0) {
                        const userBalance = {
                            user: {
                                _id: user._id,
                                firstName: user.firstName,
                                lastName: user.lastName,
                                email: user.email,
                                role: user.role,
                                fullName: `${user.firstName} ${user.lastName}`
                            },
                            pettyCashBalance: {
                                totalAllocated: balance.totalAllocated || 0,
                                totalExpenses: balance.totalExpenses || 0,
                                totalReplenished: balance.totalReplenished || 0,
                                currentBalance: balance.currentBalance || 0,
                                formattedBalance: `$${(balance.currentBalance || 0).toFixed(2)}`
                            }
                        };
                        
                        balances.push(userBalance);
                        
                        // Update system totals
                        totalAllocated += balance.totalAllocated || 0;
                        totalExpenses += balance.totalExpenses || 0;
                        totalReplenished += balance.totalReplenished || 0;
                        totalSystemBalance += balance.currentBalance || 0;
                    }
                } catch (userError) {
                    console.error(`❌ Error getting balance for user ${user.email}:`, userError);
                    // Continue with other users even if one fails
                }
            }

            console.log(`✅ Retrieved petty cash balances for ${balances.length} users with activity`);

            // Return structured response with readable data
            res.json({
                success: true,
                message: `Successfully retrieved petty cash balances for ${balances.length} users`,
                data: {
                    balances: balances,
                    summary: {
                        totalUsers: balances.length,
                        totalSystemBalance: totalSystemBalance,
                        formattedSystemBalance: `$${totalSystemBalance.toFixed(2)}`,
                        totalAllocated: totalAllocated,
                        totalExpenses: totalExpenses,
                        totalReplenished: totalReplenished,
                        lastUpdated: new Date().toISOString()
                    },
                    filters: {
                        eligibleRoles: eligibleRoles,
                        totalEligibleUsers: users.length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error getting all petty cash balances:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                message: 'Failed to retrieve petty cash balances',
                details: error.message
            });
        }
    }

    /**
     * Get petty cash transactions for a user
     */
    /**
     * Get petty cash transactions for a user
     * Supports optional date filtering
     */
    static async getPettyCashTransactions(req, res) {
        try {
            // Extract parameters with safe defaults
            const { userId } = req.params || {};
            const queryParams = req.query || {};
            const { startDate, endDate } = queryParams;
            
            console.log('📊 Getting petty cash transactions for user:', userId);

            // Validate required parameters
            if (!userId) {
                return res.status(400).json({ 
                    error: 'User ID is required',
                    message: 'Please provide a valid user ID'
                });
            }

            // Check if user exists
            const User = require('../models/User');
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ 
                    error: 'User not found',
                    message: `No user found with ID: ${userId}`
                });
            }

            // Build database query with readable structure
            const baseQuery = {
                sourceId: userId,
                source: 'manual',
                'metadata.transactionType': { 
                    $in: [
                        'petty_cash_allocation', 
                        'petty_cash_expense', 
                        'petty_cash_replenishment'
                    ] 
                }
            };

            // Add date filtering if provided
            let finalQuery = { ...baseQuery };
            if (startDate || endDate) {
                finalQuery.date = {};
                
                if (startDate) {
                    finalQuery.date.$gte = new Date(startDate);
                    console.log('📅 Filtering from start date:', startDate);
                }
                
                if (endDate) {
                    finalQuery.date.$lte = new Date(endDate);
                    console.log('📅 Filtering to end date:', endDate);
                }
            }

            // Get transactions with proper error handling
            const TransactionEntry = require('../models/TransactionEntry');
            const transactions = await TransactionEntry.find(finalQuery)
                .sort({ date: -1 })
                .populate('transactionId')
                .lean(); // Use lean() for better performance

            console.log(`✅ Retrieved ${transactions.length} petty cash transactions for user: ${user.firstName} ${user.lastName}`);

            // Return structured response
            res.json({
                success: true,
                message: `Successfully retrieved ${transactions.length} petty cash transactions`,
                data: {
                    user: {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        role: user.role
                    },
                    transactions: transactions,
                    filters: {
                        startDate: startDate || null,
                        endDate: endDate || null,
                        totalTransactions: transactions.length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error getting petty cash transactions:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                message: 'Failed to retrieve petty cash transactions',
                details: error.message
            });
        }
    }
}

module.exports = FinanceController; 