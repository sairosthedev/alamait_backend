const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Expense = require('../models/finance/Expense');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Vendor = require('../models/Vendor');
const Debtor = require('../models/Debtor');

/**
 * Comprehensive Double-Entry Accounting Service with Petty Cash Management
 * 
 * This service implements proper double-entry accounting for:
 * - Maintenance Request Approvals (Accrual Basis)
 * - Vendor Payments (Cash Basis)
 * - Supply Purchases
 * - Student Rent Payments (with/without invoices)
 * - Invoice Issuance (Accrual Basis)
 * - Petty Cash Management
 * 
 * Supports both Cash Basis and Accrual Basis accounting
 * Includes duplicate prevention and petty cash tracking
 */
class DoubleEntryAccountingService {
    
    /**
     * PETTY CASH MANAGEMENT
     */
    
    /**
     * Allocate petty cash to a user
     */
    static async allocatePettyCash(userId, amount, description, allocatedBy, residence = null) {
        try {
            console.log('💰 Allocating petty cash:', amount, 'to user:', userId, 'residence:', residence);
            
            // Get the user to determine their role and appropriate petty cash account
            const User = require('../models/User');
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            // Get the appropriate petty cash account based on user role
            const { getPettyCashAccountByRole } = require('../utils/pettyCashUtils');
            const pettyCashAccount = await getPettyCashAccountByRole(user.role);
            
            if (!pettyCashAccount) {
                throw new Error(`No petty cash account found for role: ${user.role}`);
            }
            
            console.log(`💰 Allocating to ${user.role} petty cash account: ${pettyCashAccount.code} - ${pettyCashAccount.name}`);
            
            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: `Petty cash allocation: ${description}`,
                type: 'other', // Changed from 'allocation' to 'other' since 'allocation' is not in enum
                reference: `PETTY-${userId}`,
                residence: residence || await this.getDefaultResidence(), // Use provided residence or fallback to default
                createdBy: allocatedBy._id
            });

            await transaction.save();

            // Create double-entry entries
            const entries = [];

            // Debit: User's Specific Petty Cash Account (Asset)
            entries.push({
                accountCode: pettyCashAccount.code,
                accountName: pettyCashAccount.name,
                accountType: pettyCashAccount.type,
                debit: amount,
                credit: 0,
                description: `Petty cash allocated to ${user.firstName} ${user.lastName} (${user.role})`
            });

            // Credit: Bank/Cash (Source)
            entries.push({
                accountCode: await this.getPaymentSourceAccount('Cash'),
                accountName: 'Cash on Hand',
                accountType: 'Asset',
                debit: 0,
                credit: amount,
                description: `Cash withdrawn for petty cash allocation to ${user.firstName} ${user.lastName}`
            });

            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: `Petty cash allocation: ${description}`,
                reference: `PETTY-${userId}`,
                entries,
                totalDebit: amount,
                totalCredit: amount,
                source: 'manual',
                sourceId: userId,
                sourceModel: 'Request',
                createdBy: allocatedBy.email,
                status: 'posted',
                metadata: {
                    pettyCashUserId: userId,
                    pettyCashUserRole: user.role,
                    pettyCashAccountCode: pettyCashAccount.code,
                    allocationType: 'initial',
                    transactionType: 'petty_cash_allocation'
                }
            });

            await transactionEntry.save();
            
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log(`✅ Petty cash allocated successfully to ${user.firstName} ${user.lastName} (${user.role})`);
            return { transaction, transactionEntry, user, pettyCashAccount };

        } catch (error) {
            console.error('❌ Error allocating petty cash:', error);
            throw error;
        }
    }

    /**
     * Record petty cash expense
     */
    static async recordPettyCashExpense(userId, amount, description, expenseCategory, approvedBy, residence = null) {
        try {
            console.log('💸 Recording petty cash expense:', amount, 'by user:', userId, 'residence:', residence);
            
            // Get the user to determine their role and appropriate petty cash account
            const User = require('../models/User');
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            // Get the appropriate petty cash account based on user role
            const { getPettyCashAccountByRole } = require('../utils/pettyCashUtils');
            const pettyCashAccount = await getPettyCashAccountByRole(user.role);
            
            if (!pettyCashAccount) {
                throw new Error(`No petty cash account found for role: ${user.role}`);
            }
            
            console.log(`💸 Recording expense from ${user.role} petty cash account: ${pettyCashAccount.code} - ${pettyCashAccount.name}`);
            
            // Check if transaction already exists to prevent duplicates
            const existingTransaction = await TransactionEntry.findOne({
                source: 'petty_cash_expense',
                sourceId: userId,
                'metadata.expenseDescription': description,
                'metadata.expenseAmount': amount,
                createdAt: { $gte: new Date(Date.now() - 60000) } // Within last minute
            });

            if (existingTransaction) {
                console.log('⚠️ Duplicate petty cash expense detected, skipping');
                return { transaction: null, transactionEntry: existingTransaction };
            }

            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: `Petty cash expense: ${description}`,
                type: 'other', // Changed from 'expense' to 'other' since 'expense' is not in enum
                reference: `PETTY-EXP-${userId}`,
                residence: residence || await this.getDefaultResidence(), // Use provided residence or fallback to default
                createdBy: approvedBy._id
            });

            await transaction.save();

            // Create double-entry entries
            const entries = [];

            // Debit: Expense Account
            entries.push({
                accountCode: await this.getExpenseAccountByCategory(expenseCategory),
                accountName: `${expenseCategory} Expense`,
                accountType: 'Expense',
                debit: amount,
                credit: 0,
                description: `Petty cash expense: ${description}`
            });

            // Credit: User's Specific Petty Cash Account (Asset)
            entries.push({
                accountCode: pettyCashAccount.code,
                accountName: pettyCashAccount.name,
                accountType: pettyCashAccount.type,
                debit: 0,
                credit: amount,
                description: `${user.firstName} ${user.lastName} petty cash used for ${description}`
            });

            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: `Petty cash expense: ${description}`,
                reference: `PETTY-EXP-${userId}`,
                entries,
                totalDebit: amount,
                totalCredit: amount,
                source: 'manual',
                sourceId: userId,
                sourceModel: 'Request',
                createdBy: approvedBy.email,
                status: 'posted',
                metadata: {
                    pettyCashUserId: userId,
                    pettyCashUserRole: user.role,
                    pettyCashAccountCode: pettyCashAccount.code,
                    expenseCategory,
                    expenseDescription: description,
                    expenseAmount: amount,
                    transactionType: 'petty_cash_expense'
                }
            });

            await transactionEntry.save();
            
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log(`✅ Petty cash expense recorded successfully for ${user.firstName} ${user.lastName} (${user.role})`);
            return { transaction, transactionEntry, user, pettyCashAccount };

        } catch (error) {
            console.error('❌ Error recording petty cash expense:', error);
            throw error;
        }
    }

    /**
     * Replenish petty cash
     */
    static async replenishPettyCash(userId, amount, description, replenishedBy, residence = null) {
        try {
            console.log('🔄 Replenishing petty cash:', amount, 'for user:', userId, 'residence:', residence);
            
            // Get the user to determine their role and appropriate petty cash account
            const User = require('../models/User');
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            // Get the appropriate petty cash account based on user role
            const { getPettyCashAccountByRole } = require('../utils/pettyCashUtils');
            const pettyCashAccount = await getPettyCashAccountByRole(user.role);
            
            if (!pettyCashAccount) {
                throw new Error(`No petty cash account found for role: ${user.role}`);
            }
            
            console.log(`🔄 Replenishing ${user.role} petty cash account: ${pettyCashAccount.code} - ${pettyCashAccount.name}`);
            
            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: `Petty cash replenishment: ${description}`,
                type: 'other', // Changed from 'replenishment' to 'other' since 'replenishment' is not in enum
                reference: `PETTY-REP-${userId}`,
                residence: residence || await this.getDefaultResidence(), // Use provided residence or fallback to default
                createdBy: replenishedBy._id
            });

            await transaction.save();

            // Create double-entry entries
            const entries = [];

            // Debit: User's Specific Petty Cash Account (Asset)
            entries.push({
                accountCode: pettyCashAccount.code,
                accountName: pettyCashAccount.name,
                accountType: pettyCashAccount.type,
                debit: amount,
                credit: 0,
                description: `${user.firstName} ${user.lastName} petty cash replenished`
            });

            // Credit: Bank/Cash (Source)
            entries.push({
                accountCode: await this.getPaymentSourceAccount('Cash'),
                accountName: 'Cash on Hand',
                accountType: 'Asset',
                debit: 0,
                credit: amount,
                description: `Cash used to replenish ${user.firstName} ${user.lastName} petty cash`
            });

            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: `Petty cash replenishment: ${description}`,
                reference: `PETTY-REP-${userId}`,
                entries,
                totalDebit: amount,
                totalCredit: amount,
                source: 'manual',
                sourceId: userId,
                sourceModel: 'Request',
                createdBy: replenishedBy.email,
                status: 'posted',
                metadata: {
                    pettyCashUserId: userId,
                    pettyCashUserRole: user.role,
                    pettyCashAccountCode: pettyCashAccount.code,
                    replenishmentType: 'top_up',
                    transactionType: 'petty_cash_replenishment'
                }
            });

            await transactionEntry.save();
            
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log(`✅ Petty cash replenished successfully for ${user.firstName} ${user.lastName} (${user.role})`);
            return { transaction, transactionEntry, user, pettyCashAccount };

        } catch (error) {
            console.error('❌ Error replenishing petty cash:', error);
            throw error;
        }
    }

    /**
     * Get petty cash balance for a user
     */
    static async getPettyCashBalance(userId) {
        try {
            const allocations = await TransactionEntry.aggregate([
                {
                    $match: {
                        source: 'manual',
                        'metadata.transactionType': 'petty_cash_allocation',
                        sourceId: userId,
                        status: 'posted'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAllocated: { $sum: '$totalDebit' }
                    }
                }
            ]);

            const expenses = await TransactionEntry.aggregate([
                {
                    $match: {
                        source: 'manual',
                        'metadata.transactionType': 'petty_cash_expense',
                        sourceId: userId,
                        status: 'posted'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalExpenses: { $sum: '$totalDebit' }
                    }
                }
            ]);

            const replenishments = await TransactionEntry.aggregate([
                {
                    $match: {
                        source: 'manual',
                        'metadata.transactionType': 'petty_cash_replenishment',
                        sourceId: userId,
                        status: 'posted'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalReplenished: { $sum: '$totalDebit' }
                    }
                }
            ]);

            const totalAllocated = allocations[0]?.totalAllocated || 0;
            const totalExpenses = expenses[0]?.totalExpenses || 0;
            const totalReplenished = replenishments[0]?.totalReplenished || 0;

            return {
                totalAllocated,
                totalExpenses,
                totalReplenished,
                currentBalance: totalAllocated + totalReplenished - totalExpenses
            };

        } catch (error) {
            console.error('❌ Error getting petty cash balance:', error);
            throw error;
        }
    }

    /**
     * 1. MAINTENANCE REQUEST APPROVAL (Accrual Basis) - FIXED FOR DUPLICATES
     */
    static async recordMaintenanceApproval(request, user) {
        try {
            console.log('🏗️ Recording maintenance approval (accrual basis)');
            
            // Check if transaction already exists to prevent duplicates
            const existingTransaction = await TransactionEntry.findOne({
                source: 'expense_payment',
                sourceId: request._id,
                'metadata.requestType': 'maintenance',
                createdAt: { $gte: new Date(Date.now() - 60000) } // Within last minute
            });

            if (existingTransaction) {
                console.log('⚠️ Duplicate maintenance approval detected, skipping');
                return { transaction: null, transactionEntry: existingTransaction };
            }
            
            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: `${request.vendorName || 'Vendor'} maintenance approval`,
                type: 'approval',
                reference: request._id.toString(),
                residence: request.residence,
                residenceName: request.residence?.name || 'Unknown Residence',
                createdBy: user._id
            });

            await transaction.save();

            // Create double-entry entries
            const entries = [];
            
            for (const item of request.items) {
                const selectedQuotation = item.quotations?.find(q => q.isSelected);
                
                if (selectedQuotation) {
                    // ✅ Items WITH selected quotations
                    // Debit: Maintenance Expense
                    entries.push({
                        accountCode: await this.getMaintenanceExpenseAccount(),
                        accountName: 'Maintenance Expense',
                        accountType: 'Expense',
                        debit: selectedQuotation.amount,
                        credit: 0,
                        description: `Maintenance: ${item.description}`
                    });

                    // Credit: Accounts Payable (Vendor)
                    entries.push({
                        accountCode: await this.getOrCreateVendorPayableAccount(selectedQuotation.vendorId),
                        accountName: `Accounts Payable: ${selectedQuotation.provider}`,
                        accountType: 'Liability',
                        debit: 0,
                        credit: selectedQuotation.amount,
                        description: `Payable to ${selectedQuotation.provider}`
                    });
                } else if (request.proposedVendor || item.provider) {
                    // ✅ NEW: Items with providers but no quotations
                    const provider = request.proposedVendor || item.provider;
                    const amount = item.totalCost || item.estimatedCost || 0;
                    
                    console.log(`💰 Processing item with provider but no quotation: ${provider} - $${amount}`);
                    
                    // Debit: Maintenance Expense
                    entries.push({
                        accountCode: await this.getMaintenanceExpenseAccount(),
                        accountName: 'Maintenance Expense',
                        accountType: 'Expense',
                        debit: amount,
                        credit: 0,
                        description: `Maintenance: ${item.description}`
                    });

                    // Credit: Accounts Payable: Provider
                    entries.push({
                        accountCode: await this.getOrCreateVendorPayableAccount(provider),
                        accountName: `Accounts Payable: ${provider}`,
                        accountType: 'Liability',
                        debit: 0,
                        credit: amount,
                        description: `Payable to ${provider}`
                    });
                } else {
                    // ✅ Items WITHOUT providers (general expenses)
                    const amount = item.totalCost || item.estimatedCost || 0;
                    
                    // Debit: Maintenance Expense
                    entries.push({
                        accountCode: await this.getMaintenanceExpenseAccount(),
                        accountName: 'Maintenance Expense',
                        accountType: 'Expense',
                        debit: amount,
                        credit: 0,
                        description: `Maintenance: ${item.description}`
                    });

                    // Credit: Cash/Bank or General Accounts Payable
                    if (request.paymentMethod === 'Cash' || request.paymentMethod === 'Immediate') {
                        entries.push({
                            accountCode: await this.getPaymentSourceAccount('Cash'),
                            accountName: 'Cash',
                            accountType: 'Asset',
                            debit: 0,
                            credit: amount,
                            description: `Cash payment for ${item.description}`
                        });
                    } else {
                        entries.push({
                            accountCode: await this.getOrCreateAccount('2000', 'Accounts Payable: General', 'Liability'),
                            accountName: 'Accounts Payable: General',
                            accountType: 'Liability',
                            debit: 0,
                            credit: amount,
                            description: `General payable for ${item.description}`
                        });
                    }
                }
            }

            // Create transaction entry
            const totalAmount = entries.reduce((sum, entry) => sum + entry.debit, 0);
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: `Maintenance approval: ${request.title}`,
                reference: request._id.toString(),
                entries,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                source: 'expense_payment',
                sourceId: request._id,
                sourceModel: 'Request',
                residence: request.residence, // Add residence reference
                createdBy: user.email,
                status: 'posted',
                metadata: {
                    requestType: 'maintenance',
                    vendorName: request.vendorName,
                    itemCount: request.items.length
                }
            });

            await transactionEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log('✅ Maintenance approval recorded (accrual basis)');
            return { transaction, transactionEntry };

        } catch (error) {
            console.error('❌ Error recording maintenance approval:', error);
            throw error;
        }
    }

    /**
     * 2. VENDOR PAYMENT (Cash Basis) - FIXED FOR DUPLICATES
     */
    static async recordVendorPayment(expense, user, paymentMethod) {
        try {
            console.log('💳 Recording vendor payment (cash basis)');
            
            // Check if transaction already exists to prevent duplicates
            const existingTransaction = await TransactionEntry.findOne({
                source: 'vendor_payment',
                sourceId: expense._id,
                'metadata.paymentMethod': paymentMethod,
                createdAt: { $gte: new Date(Date.now() - 60000) } // Within last minute
            });

            if (existingTransaction) {
                console.log('⚠️ Duplicate vendor payment detected, skipping');
                return { transaction: null, transactionEntry: existingTransaction };
            }
            
            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: expense.paidDate || expense.date || new Date(),
                description: `Payment to ${expense.vendorName || 'Vendor'}`,
                type: 'payment',
                reference: expense._id.toString(),
                residence: expense.residence,
                residenceName: expense.residence?.name || 'Unknown Residence',
                createdBy: user._id
            });

            await transaction.save();

            // Create double-entry entries
            const entries = [];
            
            for (const item of expense.items) {
                if (item.paymentStatus === 'Paid') {
                    // Debit: Accounts Payable (Vendor)
                    entries.push({
                        accountCode: await this.getOrCreateVendorPayableAccount(expense.vendorId),
                        accountName: `Accounts Payable: ${expense.vendorName}`,
                        accountType: 'Liability',
                        debit: item.totalCost,
                        credit: 0,
                        description: `Settle payable to ${expense.vendorName}`
                    });

                    // Credit: Cash/Bank (Payment Method)
                    entries.push({
                        accountCode: await this.getPaymentSourceAccount(paymentMethod),
                        accountName: this.getPaymentAccountName(paymentMethod),
                        accountType: 'Asset',
                        debit: 0,
                        credit: item.totalCost,
                        description: `Payment via ${paymentMethod}`
                    });
                }
            }

            // Create transaction entry
            const totalAmount = entries.reduce((sum, entry) => sum + entry.debit, 0);
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: expense.paidDate || expense.date || new Date(),
                description: `Payment to ${expense.vendorName}`,
                reference: expense._id.toString(),
                entries,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                source: 'vendor_payment',
                sourceId: expense._id,
                sourceModel: 'Expense',
                residence: expense.residence, // Add residence reference
                createdBy: user.email,
                status: 'posted',
                metadata: {
                    paymentMethod,
                    vendorName: expense.vendorName,
                    itemCount: expense.items.length
                }
            });

            await transactionEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log('✅ Vendor payment recorded (cash basis)');
            return { transaction, transactionEntry };

        } catch (error) {
            console.error('❌ Error recording vendor payment:', error);
            throw error;
        }
    }

    /**
     * 3. SUPPLY PURCHASE APPROVAL (Accrual Basis)
     */
    static async recordSupplyPurchaseApproval(request, user) {
        try {
            console.log('📦 Recording supply purchase approval (accrual basis)');
            
            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: `Supply purchase approval: ${request.title}`,
                type: 'approval',
                reference: request._id.toString(),
                residence: request.residence,
                residenceName: request.residence?.name || 'Unknown Residence',
                createdBy: user._id
            });

            await transaction.save();

            // Create double-entry entries
            const entries = [];
            
            for (const item of request.items) {
                const selectedQuotation = item.quotations?.find(q => q.isSelected);
                
                if (selectedQuotation) {
                    // Debit: Supplies Expense
                    entries.push({
                        accountCode: await this.getSuppliesExpenseAccount(),
                        accountName: 'Supplies Expense',
                        accountType: 'Expense',
                        debit: selectedQuotation.amount,
                        credit: 0,
                        description: `Supplies: ${item.description}`
                    });

                    // Credit: Accounts Payable (Vendor)
                    entries.push({
                        accountCode: await this.getOrCreateVendorPayableAccount(selectedQuotation.vendorId),
                        accountName: `Accounts Payable: ${selectedQuotation.provider}`,
                        accountType: 'Liability',
                        debit: 0,
                        credit: selectedQuotation.amount,
                        description: `Payable to ${selectedQuotation.provider}`
                    });
                }
            }

            // Create transaction entry
            const totalAmount = entries.reduce((sum, entry) => sum + entry.debit, 0);
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: `Supply purchase approval: ${request.title}`,
                reference: request._id.toString(),
                entries,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                source: 'expense_payment',
                sourceId: request._id,
                sourceModel: 'Request',
                createdBy: user.email,
                status: 'posted'
            });

            await transactionEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log('✅ Supply purchase approval recorded (accrual basis)');
            return { transaction, transactionEntry };

        } catch (error) {
            console.error('❌ Error recording supply purchase approval:', error);
            throw error;
        }
    }

    /**
     * 4. STUDENT RENT PAYMENT (Cash Basis - No Invoice)
     * Handles both current period payments and debt settlements
     */
    static async recordStudentRentPayment(payment, user) {
        try {
            console.log('💰 Recording student rent payment (cash basis)');
            console.log(`   Payment ID: ${payment.paymentId}`);
            console.log(`   Student ID: ${payment.student}`);
            console.log(`   Amount: $${payment.totalAmount}`);
            console.log(`   Method: ${payment.method}`);
            console.log(`   Date: ${payment.date}`);
            
            // 🚨 DUPLICATE TRANSACTION PREVENTION
            // Check if transaction already exists to prevent duplicates
            const existingTransaction = await TransactionEntry.findOne({
                source: 'payment',
                sourceId: payment._id,
                createdAt: { $gte: new Date(Date.now() - 60000) } // Within last minute
            });

            if (existingTransaction) {
                console.log('⚠️ Duplicate student payment transaction detected, skipping');
                console.log(`   Payment ID: ${payment.paymentId}`);
                console.log(`   Existing Transaction ID: ${existingTransaction.transactionId}`);
                return { 
                    transaction: null, 
                    transactionEntry: existingTransaction,
                    message: 'Transaction already exists for this payment'
                };
            }
            
            // Check if student has outstanding debt
            const Debtor = require('../models/Debtor');
            const debtor = await Debtor.findOne({ user: payment.student });
            const studentHasOutstandingDebt = debtor && debtor.currentBalance > 0;
            
            // Get student details for better descriptions
            let studentName = 'Student';
            try {
                const User = require('../models/User');
                const student = await User.findById(payment.student).select('firstName lastName');
                if (student) {
                    studentName = `${student.firstName} ${student.lastName}`;
                }
            } catch (error) {
                console.log('⚠️ Could not fetch student details, using default name');
            }
            
            const transactionId = await this.generateTransactionId();
            
            // Ensure we have a valid residence ID
            const residenceId = payment.residence || (debtor && debtor.residence);
            if (!residenceId) {
                throw new Error('Residence ID is required for transaction creation');
            }

            // Safely handle the date field
            let transactionDate;
            try {
                if (payment.date instanceof Date) {
                    transactionDate = payment.date;
                } else if (typeof payment.date === 'string') {
                    transactionDate = new Date(payment.date);
                    if (isNaN(transactionDate.getTime())) {
                        throw new Error('Invalid date string');
                    }
                } else {
                    transactionDate = new Date();
                }
            } catch (error) {
                console.log('⚠️ Invalid payment date, using current date');
                transactionDate = new Date();
            }

            const transaction = new Transaction({
                transactionId,
                date: transactionDate,
                description: studentHasOutstandingDebt ? 
                    `Debt settlement from ${studentName}` :
                    `Rent received from ${studentName}`,
                type: 'payment',
                reference: payment._id.toString(),
                residence: residenceId,
                residenceName: payment.residence?.name || 'Unknown Residence',
                createdBy: user._id
            });

            await transaction.save();
            console.log(`✅ Transaction created: ${transaction.transactionId}`);

            // Create double-entry entries based on payment type
            const entries = [];

            if (studentHasOutstandingDebt) {
                // Student has outstanding debt - this payment settles the debt
                console.log('💰 Recording debt settlement payment');
                
                // Debit: Cash/Bank (Payment Method)
                entries.push({
                    accountCode: await this.getPaymentSourceAccount(payment.method),
                    accountName: this.getPaymentAccountName(payment.method),
                    accountType: 'Asset',
                    debit: payment.totalAmount,
                    credit: 0,
                    description: `Debt settlement payment via ${payment.method}`
                });

                // Credit: Accounts Receivable (reduce debt)
                entries.push({
                    accountCode: await this.getAccountsReceivableAccount(),
                    accountName: 'Accounts Receivable',
                    accountType: 'Asset',
                    debit: 0,
                    credit: payment.totalAmount,
                    description: `Settlement of outstanding debt from ${studentName}`
                });
            } else {
                // Student has no outstanding debt - this is current period payment
                console.log('💰 Recording current period payment');
                
                // Debit: Cash/Bank (Payment Method)
                entries.push({
                    accountCode: await this.getPaymentSourceAccount(payment.method),
                    accountName: this.getPaymentAccountName(payment.method),
                    accountType: 'Asset',
                    debit: payment.totalAmount,
                    credit: 0,
                    description: `Rent payment via ${payment.method}`
                });

                // Credit: Rent Income
                entries.push({
                    accountCode: await this.getRentIncomeAccount(),
                    accountName: 'Rent Income',
                    accountType: 'Income',
                    debit: 0,
                    credit: payment.totalAmount,
                    description: `Rent income from ${studentName}`
                });
            }

            // Create transaction entry
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: transactionDate,
                description: studentHasOutstandingDebt ? 
                    `Debt settlement from ${studentName}` :
                    `Rent payment from ${studentName}`,
                reference: payment._id.toString(),
                entries,
                totalDebit: payment.totalAmount,
                totalCredit: payment.totalAmount,
                source: 'payment',
                sourceId: payment._id,
                sourceModel: 'Payment',
                residence: residenceId, // Use the validated residence ID
                createdBy: user.email,
                status: 'posted',
                metadata: {
                    paymentType: studentHasOutstandingDebt ? 'debt_settlement' : 'current_payment',
                    studentHasOutstandingDebt: studentHasOutstandingDebt,
                    studentBalance: debtor ? debtor.currentBalance : 0
                }
            });

            await transactionEntry.save();
            console.log(`✅ Transaction entry created: ${transactionEntry._id}`);
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log(`✅ Student payment recorded (${studentHasOutstandingDebt ? 'debt settlement' : 'current period'})`);
            return { transaction, transactionEntry };

        } catch (error) {
            console.error('❌ Error recording student rent payment:', error);
            console.error('   Error details:', error.message);
            console.error('   Stack trace:', error.stack);
            throw error;
        }
    }

    /**
     * 5. INVOICE ISSUANCE (Accrual Basis)
     */
    static async recordInvoiceIssuance(invoice, user) {
        try {
            console.log('🧾 Recording invoice issuance (accrual basis)');
            
            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: invoice.date || new Date(),
                description: `Invoice issued to ${invoice.student?.firstName || 'Student'}`,
                type: 'approval',
                reference: invoice._id.toString(),
                residence: invoice.residence,
                residenceName: invoice.residence?.name || 'Unknown Residence',
                createdBy: user._id
            });

            await transaction.save();

            // Create double-entry entries
            const entries = [];

            // Debit: Accounts Receivable
            entries.push({
                accountCode: await this.getAccountsReceivableAccount(),
                accountName: 'Accounts Receivable',
                accountType: 'Asset',
                debit: invoice.totalAmount,
                credit: 0,
                description: `Receivable from ${invoice.student?.firstName || 'Student'}`
            });

            // Credit: Rent Income
            entries.push({
                accountCode: await this.getRentIncomeAccount(),
                accountName: 'Rent Income',
                accountType: 'Income',
                debit: 0,
                credit: invoice.totalAmount,
                description: `Rent income from ${invoice.student?.firstName || 'Student'}`
            });

            // Create transaction entry
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: `Invoice issued to ${invoice.student?.firstName || 'Student'}`,
                reference: invoice._id.toString(),
                entries,
                totalDebit: invoice.totalAmount,
                totalCredit: invoice.totalAmount,
                source: 'invoice',
                sourceId: invoice._id,
                sourceModel: 'Invoice',
                residence: invoice.residence, // Add residence reference
                createdBy: user.email,
                status: 'posted'
            });

            await transactionEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log('✅ Invoice issuance recorded (accrual basis)');
            return { transaction, transactionEntry };

        } catch (error) {
            console.error('❌ Error recording invoice issuance:', error);
            throw error;
        }
    }

    /**
     * 6. INVOICE PAYMENT (Cash Basis)
     */
    static async recordInvoicePayment(invoice, paymentRecord, user) {
        try {
            console.log('💳 Recording invoice payment (cash basis)');
            
            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: `Payment from ${invoice.student?.firstName || 'Student'} for Invoice`,
                type: 'payment',
                reference: invoice._id.toString(),
                residence: invoice.residence,
                residenceName: invoice.residence?.name || 'Unknown Residence',
                createdBy: user._id
            });

            await transaction.save();

            // Create double-entry entries
            const entries = [];

            // Debit: Cash/Bank (Payment Method)
            entries.push({
                accountCode: await this.getPaymentSourceAccount(paymentRecord.paymentMethod),
                accountName: this.getPaymentAccountName(paymentRecord.paymentMethod),
                accountType: 'Asset',
                debit: paymentRecord.amount,
                credit: 0,
                description: `Payment via ${paymentRecord.paymentMethod}`
            });

            // Credit: Accounts Receivable
            entries.push({
                accountCode: await this.getAccountsReceivableAccount(),
                accountName: 'Accounts Receivable',
                accountType: 'Asset',
                debit: 0,
                credit: paymentRecord.amount,
                description: `Settle receivable from ${invoice.student?.firstName || 'Student'}`
            });

            // Create transaction entry
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: `Payment from ${invoice.student?.firstName || 'Student'} for Invoice`,
                reference: invoice._id.toString(),
                entries,
                totalDebit: paymentRecord.amount,
                totalCredit: paymentRecord.amount,
                source: 'payment',
                sourceId: invoice._id,
                sourceModel: 'Invoice',
                createdBy: user.email,
                status: 'posted'
            });

            await transactionEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log('✅ Invoice payment recorded (cash basis)');
            return { transaction, transactionEntry };

        } catch (error) {
            console.error('❌ Error recording invoice payment:', error);
            throw error;
        }
    }

    /**
     * 7. COMPREHENSIVE TRANSACTION RECORDING
     * Handles all scenarios based on transaction type
     */
    static async recordTransaction(transactionData, user) {
        const { type, source, sourceId, sourceModel } = transactionData;
        
        try {
            switch (type) {
                case 'maintenance_approval':
                    const request = await this.getRequestById(sourceId);
                    return await this.recordMaintenanceApproval(request, user);
                
                case 'vendor_payment':
                    const expense = await this.getExpenseById(sourceId);
                    return await this.recordVendorPayment(expense, user, transactionData.paymentMethod);
                
                case 'supply_purchase':
                    const supplyRequest = await this.getRequestById(sourceId);
                    return await this.recordSupplyPurchaseApproval(supplyRequest, user);
                
                case 'student_rent_payment':
                    const payment = await this.getPaymentById(sourceId);
                    return await this.recordStudentRentPayment(payment, user);
                
                case 'invoice_issuance':
                    const invoice = await this.getInvoiceById(sourceId);
                    return await this.recordInvoiceIssuance(invoice, user);
                
                case 'invoice_payment':
                    const invoiceForPayment = await this.getInvoiceById(sourceId);
                    return await this.recordInvoicePayment(invoiceForPayment, transactionData.paymentRecord, user);
                
                default:
                    throw new Error(`Unknown transaction type: ${type}`);
            }
        } catch (error) {
            console.error('❌ Error recording transaction:', error);
            throw error;
        }
    }

    /**
     * 8. ACCOUNTING BASIS FILTERING
     * Allows switching between cash and accrual views
     */
    static async getTransactionsByBasis(basis = 'accrual', filters = {}) {
        try {
            let query = {};
            
            if (basis === 'cash') {
                // Cash basis: Only show actual payments
                query.type = 'payment';
            } else if (basis === 'accrual') {
                // Accrual basis: Show approvals and payments
                query.type = { $in: ['approval', 'payment'] };
            }

            // Apply additional filters
            if (filters.dateFrom) {
                query.date = { $gte: new Date(filters.dateFrom) };
            }
            if (filters.dateTo) {
                if (query.date) {
                    query.date.$lte = new Date(filters.dateTo);
                } else {
                    query.date = { $lte: new Date(filters.dateTo) };
                }
            }
            if (filters.residence) {
                query.residence = filters.residence;
            }

            const transactions = await Transaction.find(query)
                .populate('entries')
                .populate('createdBy', 'firstName lastName email')
                .sort({ date: -1 });

            return transactions;
        } catch (error) {
            console.error('❌ Error getting transactions by basis:', error);
            throw error;
        }
    }

    // ===== HELPER METHODS =====

    static async generateTransactionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5).toUpperCase();
        return `TXN${timestamp}${random}`;
    }

    static async getMaintenanceExpenseAccount() {
        let account = await Account.findOne({ 
            name: 'Maintenance Expense',
            type: 'Expense'
        });
        
        if (!account) {
            account = await this.getOrCreateAccount('5001', 'Maintenance Expense', 'Expense');
        }
        
        return account.code;
    }

    static async getSuppliesExpenseAccount() {
        let account = await Account.findOne({ 
            name: 'Supplies Expense',
            type: 'Expense'
        });
        
        if (!account) {
            account = await this.getOrCreateAccount('5002', 'Supplies Expense', 'Expense');
        }
        
        return account.code;
    }

    static async getRentIncomeAccount() {
        let account = await Account.findOne({ 
            name: 'Rent Income',
            type: 'Income'
        });
        
        if (!account) {
            account = await this.getOrCreateAccount('4001', 'Rent Income', 'Income');
        }
        
        return account.code;
    }

    static async getAccountsReceivableAccount() {
        let account = await Account.findOne({ 
            name: 'Accounts Receivable',
            type: 'Asset'
        });
        
        if (!account) {
            account = await this.getOrCreateAccount('1101', 'Accounts Receivable', 'Asset');
        }
        
        return account.code;
    }

    static async getOrCreateVendorPayableAccount(vendorId) {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            throw new Error('Vendor not found');
        }

        let account = await Account.findOne({ 
            name: `Accounts Payable: ${vendor.name}`,
            type: 'Liability'
        });
        
        if (!account) {
            const code = await Account.getNextCode('Liability', 'Current Liabilities');
            account = await this.getOrCreateAccount(code, `Accounts Payable: ${vendor.name}`, 'Liability');
        }
        
        return account.code;
    }

    static async getPaymentSourceAccount(paymentMethod) {
        const methodAccounts = {
            'Bank Transfer': '1001', // Bank Account
            'Cash': '1002', // Cash on Hand
            'Ecocash': '1003', // Ecocash Wallet
            'Innbucks': '1004', // Innbucks Wallet
            'Online Payment': '1005', // Online Payment Account
            'MasterCard': '1006', // Credit Card Account
            'Visa': '1006', // Credit Card Account
            'PayPal': '1007' // PayPal Account
        };

        const accountCode = methodAccounts[paymentMethod] || '1002'; // Default to Cash
        
        let account = await Account.findOne({ code: accountCode });
        if (!account) {
            account = await this.getOrCreateAccount(accountCode, this.getPaymentAccountName(paymentMethod), 'Asset');
        }
        
        return account.code;
    }

    static getPaymentAccountName(paymentMethod) {
        const methodNames = {
            'Bank Transfer': 'Bank Account',
            'Cash': 'Cash on Hand',
            'Ecocash': 'Ecocash Wallet',
            'Innbucks': 'Innbucks Wallet',
            'Online Payment': 'Online Payment Account',
            'MasterCard': 'Credit Card Account',
            'Visa': 'Credit Card Account',
            'PayPal': 'PayPal Account'
        };

        return methodNames[paymentMethod] || 'Cash on Hand';
    }

    static async getOrCreateAccount(code, name, type) {
        let account = await Account.findOne({ code });
        
        if (!account) {
            account = new Account({
                code,
                name,
                type,
                category: this.getCategoryForType(type),
                isActive: true
            });
            await account.save();
        }
        
        return account;
    }

    static getCategoryForType(type) {
        const categoryMap = {
            'Asset': 'Current Assets',
            'Liability': 'Current Liabilities',
            'Equity': 'Owner Equity',
            'Income': 'Operating Revenue',
            'Expense': 'Operating Expenses'
        };
        
        return categoryMap[type] || 'Other Assets';
    }

    /**
     * Get expense account by category
     */
    static async getExpenseAccountByCategory(category) {
        const categoryAccounts = {
            'Maintenance': '5001', // Maintenance Expense
            'Supplies': '5002', // Supplies Expense
            'Utilities': '5003', // Utilities Expense
            'Cleaning': '5004', // Cleaning Expense
            'Transportation': '5005', // Transportation Expense
            'Office': '5006', // Office Expense
            'Miscellaneous': '5007' // Miscellaneous Expense
        };

        const accountCode = categoryAccounts[category] || '5007'; // Default to Miscellaneous
        const accountName = `${category} Expense`;
        
        let account = await Account.findOne({ code: accountCode });
        if (!account) {
            account = await this.getOrCreateAccount(accountCode, accountName, 'Expense');
        }
        
        return account.code;
    }

    /**
     * Get petty cash account
     */
    static async getPettyCashAccount() {
        const accountCode = '1010'; // General Petty Cash Account (updated to match created accounts)
        const accountName = 'General Petty Cash';
        
        let account = await Account.findOne({ code: accountCode });
        if (!account) {
            account = await this.getOrCreateAccount(accountCode, accountName, 'Asset');
        }
        
        return account.code;
    }



    // Data retrieval helpers
    static async getRequestById(id) {
        const Request = require('../models/Request');
        return await Request.findById(id).populate('residence');
    }

    static async getExpenseById(id) {
        return await Expense.findById(id).populate('residence vendorId');
    }

    static async getPaymentById(id) {
        return await Payment.findById(id).populate('student residence');
    }

    static async getInvoiceById(id) {
        return await Invoice.findById(id).populate('student residence');
    }

    /**
     * Get default residence for petty cash transactions
     */
    static async getDefaultResidence() {
        try {
            const Residence = require('../models/Residence');
            const defaultResidence = await Residence.findOne().sort({ createdAt: 1 });
            return defaultResidence?._id || null;
        } catch (error) {
            console.error('Error getting default residence:', error);
            return null;
        }
    }
}

module.exports = DoubleEntryAccountingService; 