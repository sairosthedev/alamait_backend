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
     * Residence is REQUIRED for proper financial tracking
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
            
            // ENFORCE RESIDENCE REQUIREMENT
            if (!residence) {
                console.log('⚠️ No residence provided, getting default residence');
                residence = await this.getDefaultResidence();
                if (!residence) {
                    throw new Error('Residence is required for petty cash allocation. No default residence available.');
                }
            }
            
            // Validate residence exists
            const Residence = require('../models/Residence');
            const residenceDoc = await Residence.findById(residence);
            if (!residenceDoc) {
                throw new Error(`Invalid residence ID: ${residence}`);
            }
            
            console.log(`🏠 Using residence: ${residenceDoc.name} (${residence})`);
            
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
                residence: residence, // Always use validated residence
                residenceName: residenceDoc.name, // Include residence name for better tracking
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
                description: `Petty cash allocated to ${user.firstName} ${user.lastName} (${user.role}) - ${residenceDoc.name}`,
                residence: residence // Include residence in entry for better tracking
            });

            // Credit: Bank/Cash (Source)
            entries.push({
                accountCode: await this.getPaymentSourceAccount('Cash'),
                accountName: 'Cash on Hand',
                accountType: 'Asset',
                debit: 0,
                credit: amount,
                description: `Cash withdrawn for petty cash allocation to ${user.firstName} ${user.lastName} - ${residenceDoc.name}`,
                residence: residence // Include residence in entry for better tracking
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
                residence: residence, // Include residence in transaction entry
                metadata: {
                    pettyCashUserId: userId,
                    pettyCashUserRole: user.role,
                    pettyCashAccountCode: pettyCashAccount.code,
                    allocationType: 'initial',
                    transactionType: 'petty_cash_allocation',
                    residenceId: residence,
                    residenceName: residenceDoc.name
                }
            });

            await transactionEntry.save();
            
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log(`✅ Petty cash allocated successfully to ${user.firstName} ${user.lastName} (${user.role}) for residence: ${residenceDoc.name}`);
            return { transaction, transactionEntry, user, pettyCashAccount, residence: residenceDoc };

        } catch (error) {
            console.error('❌ Error allocating petty cash:', error);
            throw error;
        }
    }

    /**
     * Record petty cash expense
     * Residence is REQUIRED for proper financial tracking
     * Links to original expense if expenseId provided
     */
    static async recordPettyCashExpense(userId, amount, description, expenseCategory, approvedBy, residence = null, expenseId = null) {
        try {
            console.log('💸 Recording petty cash expense:', amount, 'by user:', userId, 'residence:', residence, 'expenseId:', expenseId);
            
            // Get the user to determine their role and appropriate petty cash account
            const User = require('../models/User');
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            // ENFORCE RESIDENCE REQUIREMENT
            if (!residence) {
                console.log('⚠️ No residence provided, getting default residence');
                residence = await this.getDefaultResidence();
                if (!residence) {
                    throw new Error('Residence is required for petty cash expense. No default residence available.');
                }
            }
            
            // Validate residence exists
            const Residence = require('../models/Residence');
            const residenceDoc = await Residence.findById(residence);
            if (!residenceDoc) {
                throw new Error(`Invalid residence ID: ${residence}`);
            }
            
            console.log(`🏠 Using residence: ${residenceDoc.name} (${residence})`);
            
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

            // ✅ NEW: Check if this expense was previously accrued
            let wasAccrued = false;
            let originalExpense = null;
            
            if (expenseId) {
                const Expense = require('../models/finance/Expense');
                originalExpense = await Expense.findById(expenseId);
                if (originalExpense && originalExpense.transactionId) {
                    wasAccrued = true;
                    console.log(`🔍 Found accrued expense: ${expenseId} with transaction: ${originalExpense.transactionId}`);
                }
            }

            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: wasAccrued ? 
                    `Petty cash payment: ${description}` : 
                    `Petty cash expense: ${description}`,
                type: 'other', // Changed from 'expense' to 'other' since 'expense' is not in enum
                reference: `PETTY-EXP-${userId}`,
                residence: residence, // Always use validated residence
                residenceName: residenceDoc.name, // Include residence name for better tracking
                createdBy: approvedBy._id
            });

            await transaction.save();

            // Create double-entry entries
            const entries = [];

            if (wasAccrued) {
                // ✅ SETTLE ACCRUED LIABILITY: Dr. Accounts Payable, Cr. Petty Cash
                console.log(`💰 Settling accrued liability for expense: ${expenseId}`);
                
                // Get Accounts Payable account
                const apAccount = await Account.findOne({ code: '2000', type: 'Liability' });
                if (!apAccount) {
                    throw new Error('Accounts Payable account not found for settling accrued liability');
                }
                
                // Debit: Accounts Payable (reduce liability)
                entries.push({
                    accountCode: apAccount.code,
                    accountName: apAccount.name,
                    accountType: apAccount.type,
                    debit: amount,
                    credit: 0,
                    description: `Petty cash payment: ${description} - settling accrued liability - ${residenceDoc.name}`,
                    residence: residence
                });

                // Credit: User's Specific Petty Cash Account (Asset)
                entries.push({
                    accountCode: pettyCashAccount.code,
                    accountName: pettyCashAccount.name,
                    accountType: pettyCashAccount.type,
                    debit: 0,
                    credit: amount,
                    description: `${user.firstName} ${user.lastName} petty cash used to settle ${description} - ${residenceDoc.name}`,
                    residence: residence
                });
                
                console.log(`✅ Created liability settlement entries: Dr. AP ${amount}, Cr. Petty Cash ${amount}`);
            } else {
                // ✅ NEW EXPENSE: Dr. Expense Account, Cr. Petty Cash
                console.log(`💰 Creating new expense entry for petty cash payment`);
                
                // Debit: Expense Account
                const expenseAccountCode = await this.getExpenseAccountByCategory(expenseCategory);
                console.log(`🔍 Creating expense entry with category: ${expenseCategory}, account code: ${expenseAccountCode}`);
                
                entries.push({
                    accountCode: expenseAccountCode,
                    accountName: `${expenseCategory} Expense`,
                    accountType: 'Expense',
                    debit: amount,
                    credit: 0,
                    description: `Petty cash expense: ${description} - ${residenceDoc.name}`,
                    residence: residence // Include residence in entry for better tracking
                });

                // Credit: User's Specific Petty Cash Account (Asset)
                console.log(`🔍 Creating credit entry with petty cash account: ${pettyCashAccount.code} - ${pettyCashAccount.name}`);
                
                entries.push({
                    accountCode: pettyCashAccount.code,
                    accountName: pettyCashAccount.name,
                    accountType: pettyCashAccount.type,
                    debit: 0,
                    credit: amount,
                    description: `${user.firstName} ${user.lastName} petty cash used for ${description} - ${residenceDoc.name}`,
                    residence: residence // Include residence in entry for better tracking
                });
            }

            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: wasAccrued ? 
                    `Petty cash payment: ${description}` : 
                    `Petty cash expense: ${description}`,
                reference: `PETTY-EXP-${userId}`,
                entries,
                totalDebit: amount,
                totalCredit: amount,
                source: wasAccrued ? 'petty_cash_payment' : 'manual',
                sourceId: userId,
                sourceModel: 'Request',
                createdBy: approvedBy.email,
                status: 'posted',
                residence: residence, // Include residence in transaction entry
                metadata: {
                    pettyCashUserId: userId,
                    pettyCashUserRole: user.role,
                    pettyCashAccountCode: pettyCashAccount.code,
                    expenseCategory,
                    expenseDescription: description,
                    expenseAmount: amount,
                    transactionType: wasAccrued ? 'petty_cash_payment' : 'petty_cash_expense',
                    residenceId: residence,
                    residenceName: residenceDoc.name,
                    expenseId: expenseId, // Link to original expense
                    paymentMethod: 'Petty Cash',
                    paymentReference: `PC-${Date.now()}`,
                    wasAccrued: wasAccrued, // Track if this was settling an accrued liability
                    originalTransactionId: wasAccrued ? originalExpense.transactionId : null
                }
            });

            await transactionEntry.save();
            
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log(`✅ Petty cash ${wasAccrued ? 'payment' : 'expense'} recorded successfully for ${user.firstName} ${user.lastName} (${user.role}) at residence: ${residenceDoc.name}`);
            if (expenseId) {
                console.log(`🔗 Linked to expense: ${expenseId}${wasAccrued ? ' (settling accrued liability)' : ''}`);
            }
            return { transaction, transactionEntry, user, pettyCashAccount, residence: residenceDoc, expenseId, wasAccrued };

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
            
            // ENFORCE RESIDENCE REQUIREMENT
            if (!residence) {
                console.log('⚠️ No residence provided, getting default residence');
                residence = await this.getDefaultResidence();
                if (!residence) {
                    throw new Error('Residence is required for petty cash replenishment. No default residence available.');
                }
            }
            
            // Validate residence exists
            const Residence = require('../models/Residence');
            const residenceDoc = await Residence.findById(residence);
            if (!residenceDoc) {
                throw new Error(`Invalid residence ID: ${residence}`);
            }
            
            console.log(`🔄 Replenishing ${user.role} petty cash account: ${pettyCashAccount.code} - ${pettyCashAccount.name}`);
            
            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: `Petty cash replenishment: ${description}`,
                type: 'other', // Changed from 'replenishment' to 'other' since 'replenishment' is not in enum
                reference: `PETTY-REP-${userId}`,
                residence: residence, // Always use validated residence
                residenceName: residenceDoc.name, // Include residence name for better tracking
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
                description: `${user.firstName} ${user.lastName} petty cash replenished - ${residenceDoc.name}`,
                residence: residence // Include residence in entry for better tracking
            });

            // Credit: Bank/Cash (Source)
            entries.push({
                accountCode: await this.getPaymentSourceAccount('Cash'),
                accountName: 'Cash on Hand',
                accountType: 'Asset',
                debit: 0,
                credit: amount,
                description: `Cash used to replenish ${user.firstName} ${user.lastName} petty cash - ${residenceDoc.name}`,
                residence: residence // Include residence in entry for better tracking
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
                residence: residence, // Include residence in transaction entry
                metadata: {
                    pettyCashUserId: userId,
                    pettyCashUserRole: user.role,
                    pettyCashAccountCode: pettyCashAccount.code,
                    replenishmentType: 'top_up',
                    transactionType: 'petty_cash_replenishment',
                    residenceId: residence,
                    residenceName: residenceDoc.name
                }
            });

            await transactionEntry.save();
            
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log(`✅ Petty cash replenished successfully for ${user.firstName} ${user.lastName} (${user.role}) for residence: ${residenceDoc.name}`);
            return { transaction, transactionEntry, user, pettyCashAccount, residence: residenceDoc };

        } catch (error) {
            console.error('❌ Error replenishing petty cash:', error);
            throw error;
        }
    }

    /**
     * Get petty cash balance for a user based on transaction entries
     * This method calculates balance from actual double-entry transactions
     */
    static async getPettyCashBalance(userId) {
        try {
            console.log('💰 Getting petty cash balance for user:', userId);
            
            // Get user to determine their role and petty cash account
            const User = require('../models/User');
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Get the appropriate petty cash account based on user role
            const pettyCashAccountCode = await this.getPettyCashAccountCodeByRole(user.role);
            console.log(`💰 Using petty cash account code: ${pettyCashAccountCode} for user role: ${user.role}`);

            // Calculate balance from transaction entries for the petty cash account
            const pettyCashEntries = await TransactionEntry.aggregate([
                {
                    $match: {
                        status: 'posted',
                        'entries.accountCode': pettyCashAccountCode
                    }
                },
                {
                    $unwind: '$entries'
                },
                {
                    $match: {
                        'entries.accountCode': pettyCashAccountCode
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDebits: { $sum: '$entries.debit' },
                        totalCredits: { $sum: '$entries.credit' }
                    }
                }
            ]);

            // Calculate balance: Debits increase petty cash, Credits decrease petty cash
            const totalDebits = pettyCashEntries[0]?.totalDebits || 0;
            const totalCredits = pettyCashEntries[0]?.totalCredits || 0;
            const currentBalance = totalDebits - totalCredits;

            console.log(`💰 Petty cash balance calculation: Debits: $${totalDebits}, Credits: $${totalCredits}, Balance: $${currentBalance}`);

            return {
                totalAllocated: totalDebits,
                totalExpenses: totalCredits,
                totalReplenished: 0, // Will be calculated separately if needed
                currentBalance: currentBalance
            };

        } catch (error) {
            console.error('❌ Error getting petty cash balance:', error);
            throw error;
        }
    }

    /**
     * Get petty cash account code based on user role
     */
    static async getPettyCashAccountCodeByRole(userRole) {
        const roleToAccountCode = {
            'admin': '1011',
            'finance_admin': '1012',
            'finance_user': '1012',
            'property_manager': '1013',
            'maintenance': '1014'
        };
        
        return roleToAccountCode[userRole] || '1010'; // Default to general petty cash
    }

    /**
     * 1. MAINTENANCE REQUEST APPROVAL (Accrual Basis) - FIXED FOR DUPLICATES
     */
    static async recordMaintenanceApproval(request, user) {
        try {
            console.log('🏗️ Recording maintenance approval (accrual basis)');

            // Check if transaction already exists to prevent duplicates (per item via metadata)
            const duplicateQuery = {
                source: 'expense_accrual',
                sourceId: request._id,
                'metadata.requestType': 'maintenance',
                createdAt: { $gte: new Date(Date.now() - 60000) } // Within last minute
            };
            if (request && request.itemIndex !== undefined) {
                duplicateQuery['metadata.itemIndex'] = request.itemIndex;
            }
            const existingTransaction = await TransactionEntry.findOne(duplicateQuery);

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
                
                // Enhanced account resolution using multiple strategies
                const expenseAccountCode = await this.resolveExpenseAccount(item, request);
                const expenseAccountName = await this.getAccountNameByCode(expenseAccountCode);
                
                if (selectedQuotation) {
                    // ✅ Items WITH selected quotations
                    // Debit: Resolved Expense Account (not just Maintenance)
                    entries.push({
                        accountCode: expenseAccountCode,
                        accountName: expenseAccountName,
                        accountType: 'Expense',
                        debit: selectedQuotation.amount,
                        credit: 0,
                        description: `${expenseAccountName}: ${item.description}`
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
                    
                    // Debit: Resolved Expense Account
                    entries.push({
                        accountCode: expenseAccountCode,
                        accountName: expenseAccountName,
                        accountType: 'Expense',
                        debit: amount,
                        credit: 0,
                        description: `${expenseAccountName}: ${item.description}`
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
                    
                    // Debit: Resolved Expense Account
                    entries.push({
                        accountCode: expenseAccountCode,
                        accountName: expenseAccountName,
                        accountType: 'Expense',
                        debit: amount,
                        credit: 0,
                        description: `${expenseAccountName}: ${item.description}`
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
                            accountCode: '2000',
                            accountName: 'Accounts Payable',
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
                source: 'expense_accrual',
                sourceId: request._id,
                sourceModel: 'Request',
                residence: request.residence, // Add residence reference
                createdBy: user.email,
                status: 'posted',
                metadata: {
                    requestType: 'maintenance',
                    vendorName: request.vendorName,
                    itemCount: request.items.length,
                    ...(request && request.itemIndex !== undefined ? { itemIndex: request.itemIndex } : {})
                }
            });

            await transactionEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            // Create expense record for tracking unless explicitly skipped by caller
            let expense = null;
            if (!request || !request.skipExpenseCreation) {
                const { generateUniqueId } = require('../utils/idGenerator');
                expense = new Expense({
                    expenseId: await generateUniqueId('EXP'),
                    requestId: request._id,
                    residence: request.residence._id || request.residence,
                    category: 'Maintenance',
                    amount: totalAmount,
                    description: `Maintenance: ${request.title}`,
                    expenseDate: new Date(),
                    paymentStatus: 'Pending',
                    period: 'monthly',
                    createdBy: user._id,
                    transactionId: transaction._id
                });

                await expense.save();
                console.log(`   - Expense created: ${expense.expenseId}`);
            } else {
                console.log('ℹ️ Skipping internal expense creation (handled by caller)');
            }

            console.log('✅ Maintenance approval recorded (accrual basis)');
            console.log(`   - Transaction: ${transaction.transactionId}`);
            console.log(`   - Total amount: $${totalAmount}`);
            
            return { 
                transaction, 
                expense, 
                entries: [transactionEntry._id] // Return entries array for compatibility
            };

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
     * Record student rent payment with proper accrual accounting
     * Handles advance payments, deposits, admin fees, and current period payments
     */
    static async recordStudentRentPayment(payment, user) {
        try {
            console.log('💰 Recording student rent payment with accrual accounting');
            console.log(`   Payment ID: ${payment.paymentId}`);
            console.log(`   Student ID: ${payment.student}`);
            console.log(`   Amount: $${payment.totalAmount}`);
            console.log(`   Method: ${payment.method}`);
            console.log(`   Date: ${payment.date}`);
            console.log(`   Payment Month: ${payment.paymentMonth}`);
            
            // 🚨 DUPLICATE TRANSACTION PREVENTION
            const existingTransaction = await TransactionEntry.findOne({
                source: 'payment',
                sourceId: payment._id
            });

            if (existingTransaction) {
                console.log('⚠️ Duplicate student payment transaction detected, skipping');
                return { 
                    transaction: null, 
                    transactionEntry: existingTransaction,
                    message: 'Transaction already exists for this payment'
                };
            }
            
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

            // 🆕 NEW: Parse payment breakdown and month for proper accrual accounting
            let rentAmount = 0, adminAmount = 0, depositAmount = 0;
            let parsedPayments = payment.payments;
            
            if (parsedPayments) {
                if (typeof parsedPayments === 'string') {
                    parsedPayments = JSON.parse(parsedPayments);
                }
                rentAmount = parsedPayments.find(p => p.type === 'rent')?.amount || 0;
                adminAmount = parsedPayments.find(p => p.type === 'admin')?.amount || 0;
                depositAmount = parsedPayments.find(p => p.type === 'deposit')?.amount || 0;
            }

            // 🆕 NEW: Analyze payment month vs current month to determine payment type
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth(); // 0-11
            const currentYear = currentDate.getFullYear();
            
            let paymentMonthDate = null;
            let isAdvancePayment = false;
            let isCurrentPeriodPayment = false;
            let isPastDuePayment = false;
            
            if (payment.paymentMonth) {
                try {
                    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                                       'july', 'august', 'september', 'october', 'november', 'december'];
                    const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                                      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                    
                    let month = -1;
                    let year = currentYear;
                    
                    const lowerPaymentMonth = payment.paymentMonth.toLowerCase();
                    month = monthNames.findIndex(m => lowerPaymentMonth.includes(m));
                    if (month === -1) {
                        month = monthAbbr.findIndex(m => lowerPaymentMonth.includes(m));
                    }
                    
                    const yearMatch = payment.paymentMonth.match(/\b(20\d{2})\b/);
                    if (yearMatch) {
                        year = parseInt(yearMatch[1]);
                    }
                    
                    if (month !== -1) {
                        paymentMonthDate = new Date(year, month, 1);
                        const currentMonthDate = new Date(currentYear, currentMonth, 1);
                        
                        if (paymentMonthDate > currentMonthDate) {
                            isAdvancePayment = true;
                        } else if (paymentMonthDate.getTime() === currentMonthDate.getTime()) {
                            isCurrentPeriodPayment = true;
                        } else {
                            isPastDuePayment = true;
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Could not parse payment month: ${payment.paymentMonth}`);
                }
            }

            // Check if student has outstanding debt
            const Debtor = require('../models/Debtor');
            const debtor = await Debtor.findOne({ user: payment.student });
            const studentHasOutstandingDebt = debtor && debtor.currentBalance > 0;
            const hasAccruedRentals = debtor && debtor.currentBalance > 0;

            console.log(`   Payment Analysis:`);
            console.log(`     Current Month: ${currentMonth + 1}/${currentYear}`);
            console.log(`     Payment Month: ${payment.paymentMonth}`);
            console.log(`     Is Advance Payment: ${isAdvancePayment}`);
            console.log(`     Is Current Period: ${isCurrentPeriodPayment}`);
            console.log(`     Is Past Due: ${isPastDuePayment}`);
            console.log(`     Has Outstanding Debt: ${studentHasOutstandingDebt}`);
            console.log(`     Payment Breakdown: Rent $${rentAmount}, Admin $${adminAmount}, Deposit $${depositAmount}`);

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

            // Use existing debtor or load if needed for allocation context
            if (!debtor) {
                try {
                    debtor = await Debtor.findOne({ user: payment.user || payment.student });
                } catch (e) {
                    console.log('⚠️ Could not load debtor for payment allocation context');
                }
            }

            // 🆕 NEW: Determine transaction description based on payment analysis
            let transactionDescription;
            let paymentType;
            
            if (isAdvancePayment) {
                transactionDescription = `Advance payment from ${studentName} for ${payment.paymentMonth}`;
                paymentType = 'advance_payment';
            } else if (isPastDuePayment || studentHasOutstandingDebt || hasAccruedRentals) {
                transactionDescription = `Debt settlement from ${studentName}`;
                paymentType = 'debt_settlement';
            } else {
                transactionDescription = `Current period payment from ${studentName} for ${payment.paymentMonth || 'current month'}`;
                paymentType = 'current_payment';
            }

            const transaction = new Transaction({
                transactionId,
                date: transactionDate,
                description: transactionDescription,
                type: 'payment',
                reference: payment._id.toString(),
                residence: residenceId,
                residenceName: payment.residence?.name || 'Unknown Residence',
                createdBy: user._id
            });

            await transaction.save();
            console.log(`✅ Transaction created: ${transaction.transactionId}`);

            // 🆕 NEW: Create proper double-entry entries based on payment analysis
            const entries = [];

            // Get required accounts
            const receivingAccount = await this.getPaymentSourceAccount(payment.method);
            const rentAccount = await this.getRentIncomeAccount();
            const deferredIncomeAccount = await this.getDeferredIncomeAccount();
            const adminFeeAccount = await this.getAdminIncomeAccount();
            const depositAccount = await this.getDepositLiabilityAccount();
            const studentAccount = await this.getAccountsReceivableAccount();

            // 🆕 NEW: Process payment breakdown with proper accounting
            if (parsedPayments && parsedPayments.length > 0) {
                console.log('💰 Processing payment breakdown with accrual accounting');
                
                // 1. DEBIT: Cash/Bank (Payment Method) - Money coming IN
                entries.push({
                    accountCode: receivingAccount,
                    accountName: this.getPaymentAccountName(payment.method),
                    accountType: 'Asset',
                    debit: payment.totalAmount, // ✅ FIXED: DEBIT when receiving money
                    credit: 0,
                    description: `Payment received from ${studentName} (${payment.method}, ${payment.paymentId}, ${payment.paymentMonth || ''})`
                });

                // Helper: compute outstanding accrued rent for the payment month
                const computeOutstandingRentForPaymentMonth = async () => {
                    try {
                        if (!payment.paymentMonth) return { accrued: 0, paid: 0, outstanding: 0 };
                        const [py, pm] = payment.paymentMonth.includes('-')
                            ? payment.paymentMonth.split('-').map(n => parseInt(n))
                            : [null, null];
                        if (!py || !pm) return { accrued: 0, paid: 0, outstanding: 0 };

                        const monthStart = new Date(py, pm - 1, 1);
                        const monthEnd = new Date(py, pm, 0);

                        // 1) Try actual accrual entries first
                        const monthAccruals = await TransactionEntry.find({
                            source: 'rental_accrual',
                            'metadata.studentId': payment.student,
                            status: 'posted',
                            $or: [
                                { 'metadata.type': 'monthly_rent_accrual', 'metadata.accrualMonth': pm, 'metadata.accrualYear': py },
                                { 'metadata.type': 'lease_start', date: { $gte: monthStart, $lte: monthEnd } }
                            ]
                        }).lean();

                        let accrued = 0;
                        for (const acc of monthAccruals) {
                            if (acc.metadata?.rentAmount) accrued += Number(acc.metadata.rentAmount) || 0;
                            if (acc.metadata?.proratedRent) accrued += Number(acc.metadata.proratedRent) || 0;
                        }

                        // 2) If no accruals found, compute expected from debtor data (fallback)
                        if (accrued === 0 && debtor) {
                            // Determine expected monthly rent
                            const monthlyRent = Number(
                                (debtor.financialBreakdown?.monthlyRent) ||
                                (debtor.billingPeriod?.amount?.monthly) ||
                                debtor.roomPrice ||
                                0
                            ) || 0;

                            // Determine if this is the lease start month
                            const leaseStart = debtor.startDate || debtor.billingPeriod?.startDate;
                            const isStartMonth = leaseStart
                                ? (new Date(leaseStart).getFullYear() === py && (new Date(leaseStart).getMonth() + 1) === pm)
                                : false;

                            if (monthlyRent > 0) {
                                if (isStartMonth && leaseStart) {
                                    // Prorate from lease start date to month end (inclusive)
                                    const startDateObj = new Date(leaseStart);
                                    const daysInMonth = new Date(py, pm, 0).getDate();
                                    const startDay = startDateObj.getDate();
                                    const proratedDays = Math.max(0, daysInMonth - startDay + 1);
                                    const dailyRate = monthlyRent / daysInMonth;
                                    accrued = Math.round((proratedDays * dailyRate) * 100) / 100;
                                } else {
                                    // Full month expected
                                    accrued = monthlyRent;
                                }
                            }
                        }

                        // 3) Determine paid rent tracked in debtor monthlyPayments (if available)
                        let paid = 0;
                        const monthKey = `${py}-${String(pm).padStart(2, '0')}`;
                        if (debtor) {
                            const mp = debtor.monthlyPayments?.find(m => m.month === monthKey);
                            if (mp && mp.paidComponents?.rent) paid = Number(mp.paidComponents.rent) || 0;
                        }

                        const outstanding = Math.max(0, (Number(accrued) || 0) - (Number(paid) || 0));
                        return { accrued, paid, outstanding };
                    } catch (err) {
                        console.log('⚠️ Error computing outstanding rent for payment month:', err.message);
                        return { accrued: 0, paid: 0, outstanding: 0 };
                    }
                };

                const paymentMonthRent = await computeOutstandingRentForPaymentMonth();

                // 2. Process each payment component
                for (const paymentItem of parsedPayments) {
                    const amount = paymentItem.amount || 0;
                    if (amount <= 0) continue;

                    switch (paymentItem.type) {
                        case 'admin':
                            // Accrual basis: settle AR for admin fee (revenue was recognized at lease start)
                            entries.push({
                                accountCode: studentAccount,
                                accountName: 'Accounts Receivable - Tenants',
                                accountType: 'Asset',
                                debit: 0,
                                credit: amount,
                                description: `Admin fee payment settles accrual for ${studentName} (${payment.paymentId})`
                            });
                            break;
                            
                        case 'deposit':
                            // Accrual basis: settle AR for deposit (liability was recognized at lease start)
                            entries.push({
                                accountCode: studentAccount,
                                accountName: 'Accounts Receivable - Tenants',
                                accountType: 'Asset',
                                debit: 0,
                                credit: amount,
                                description: `Security deposit payment settles accrual for ${studentName} (${payment.paymentId})`
                            });
                            break;
                            
                        case 'rent': {
                            if (isAdvancePayment && deferredIncomeAccount) {
                                // Entire rent is for future period
                                entries.push({
                                    accountCode: deferredIncomeAccount,
                                    accountName: 'Deferred Income - Tenant Advances',
                                    accountType: 'Liability',
                                    debit: 0,
                                    credit: amount,
                                    description: `Deferred rent income from ${studentName} for ${payment.paymentMonth} (${payment.paymentId})`
                                });
                                break;
                            }

                            // Allocate to Accounts Receivable up to the month's accrued rent, remainder goes to Deferred Income as advance
                            const outstandingForMonth = paymentMonthRent.outstanding || 0;
                            const allocateToAR = Math.min(amount, outstandingForMonth);
                            const excess = Math.max(0, amount - allocateToAR);

                            if (allocateToAR > 0) {
                                entries.push({
                                    accountCode: studentAccount,
                                    accountName: 'Accounts Receivable - Tenants',
                                    accountType: 'Asset',
                                    debit: 0,
                                    credit: allocateToAR,
                                    description: `Rent payment settles ${payment.paymentMonth || 'period'} accrual from ${studentName} (${payment.paymentId})`
                                });
                            }

                            if (excess > 0 && deferredIncomeAccount) {
                                entries.push({
                                    accountCode: deferredIncomeAccount,
                                    accountName: 'Deferred Income - Tenant Advances',
                                    accountType: 'Liability',
                                    debit: 0,
                                    credit: excess,
                                    description: `Advance rent from ${studentName} for future periods (${payment.paymentId})`
                                });
                            }
                            break;
                        }
                            
                        default:
                            // Fallback for unknown payment types
                            entries.push({
                                accountCode: rentAccount,
                                accountName: 'Rental Income - Residential',
                                accountType: 'Income',
                                debit: 0,
                                credit: amount,
                                description: `${paymentItem.type} payment from ${studentName} (${payment.paymentId})`
                            });
                    }
                }
                
                // Set transaction type based on processed items
                if (isAdvancePayment) {
                    transaction.type = 'advance_payment';
                } else if (isPastDuePayment || studentHasOutstandingDebt) {
                    transaction.type = 'debt_settlement';
                } else {
                    transaction.type = 'current_payment';
                }
                await transaction.save();
                
            } else {
                // 🚨 FALLBACK: Old logic for payments without breakdown
                console.log('⚠️ No payment breakdown found, using fallback logic');
                
                if (isAdvancePayment && deferredIncomeAccount) {
                    // Advance payment goes to Deferred Income
                    entries.push({
                        accountCode: receivingAccount,
                        accountName: this.getPaymentAccountName(payment.method),
                        accountType: 'Asset',
                        debit: payment.totalAmount,
                        credit: 0,
                        description: `Advance payment received from ${studentName} (${payment.paymentId})`
                    });
                    
                    entries.push({
                        accountCode: deferredIncomeAccount,
                        accountName: 'Deferred Income - Tenant Advances',
                        accountType: 'Liability',
                        debit: 0,
                        credit: payment.totalAmount,
                        description: `Deferred rent income from ${studentName} for ${payment.paymentMonth} (${payment.paymentId})`
                    });
                } else if (studentHasOutstandingDebt || hasAccruedRentals) {
                    // Payment settles existing debt
                    entries.push({
                        accountCode: receivingAccount,
                        accountName: this.getPaymentAccountName(payment.method),
                        accountType: 'Asset',
                        debit: payment.totalAmount,
                        credit: 0,
                        description: `Debt settlement payment via ${payment.method}`
                    });
                    
                    entries.push({
                        accountCode: studentAccount,
                        accountName: 'Accounts Receivable - Tenants',
                        accountType: 'Asset',
                        debit: 0,
                        credit: payment.totalAmount,
                        description: `Settlement of outstanding debt from ${studentName}`
                    });
                } else {
                    // Current period payment
                    entries.push({
                        accountCode: receivingAccount,
                        accountName: this.getPaymentAccountName(payment.method),
                        accountType: 'Asset',
                        debit: payment.totalAmount,
                        credit: 0,
                        description: `Rent payment via ${payment.method}`
                    });
                    
                    entries.push({
                        accountCode: rentAccount,
                        accountName: 'Rent Income',
                        accountType: 'Income',
                        debit: 0,
                        credit: payment.totalAmount,
                        description: `Rent income from ${studentName} for ${payment.paymentMonth || 'current period'} (${payment.paymentId})`
                    });
                }
            }

            // Create transaction entry
            console.log('🔧 Creating TransactionEntry with data:', {
                transactionId: transaction.transactionId,
                date: transactionDate,
                description: transactionDescription,
                reference: payment._id.toString(),
                entriesCount: entries.length,
                totalDebit: payment.totalAmount,
                totalCredit: payment.totalAmount,
                source: 'payment',
                sourceId: payment._id,
                sourceModel: 'Payment',
                residence: residenceId,
                createdBy: user.email || 'system',
                status: 'posted'
            });
            
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: transactionDate,
                description: transactionDescription,
                reference: payment._id.toString(),
                entries,
                totalDebit: payment.totalAmount,
                totalCredit: payment.totalAmount,
                source: 'payment',
                sourceId: payment._id,
                sourceModel: 'Payment',
                residence: residenceId,
                createdBy: user.email || 'system',
                status: 'posted',
                metadata: {
                    paymentType: paymentType,
                    paymentMonth: payment.paymentMonth,
                    isAdvancePayment: isAdvancePayment,
                    isCurrentPeriodPayment: isCurrentPeriodPayment,
                    isPastDuePayment: isPastDuePayment,
                    studentHasOutstandingDebt: studentHasOutstandingDebt,
                    studentBalance: debtor ? debtor.currentBalance : 0,
                    paymentBreakdown: {
                        rent: rentAmount,
                        admin: adminAmount,
                        deposit: depositAmount
                    },
                    paymentComponents: {
                        rent: rentAmount,
                        admin: adminAmount,
                        deposit: depositAmount
                    },
                    accountsReceivableCollection: isPastDuePayment || studentHasOutstandingDebt
                }
            });

            console.log('💾 Saving TransactionEntry to database...');
            try {
                await transactionEntry.save();
                console.log(`✅ Transaction entry created and saved: ${transactionEntry._id}`);
                console.log(`   Total Debit: $${transactionEntry.totalDebit}`);
                console.log(`   Total Credit: $${transactionEntry.totalCredit}`);
                console.log(`   Entries Count: ${transactionEntry.entries?.length || 0}`);
            } catch (saveError) {
                console.error('❌ Error saving TransactionEntry:', saveError);
                console.error('   Validation errors:', saveError.errors);
                console.error('   TransactionEntry data:', transactionEntry.toObject());
                throw saveError;
            }
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log(`✅ Student payment recorded with accrual accounting (${paymentType})`);
            if (isAdvancePayment) {
                console.log(`   📊 This payment creates deferred income for ${payment.paymentMonth}`);
                console.log(`   💰 Proper double-entry: Cash ↑, Deferred Income ↑ (Liability)`);
            } else if (isPastDuePayment || studentHasOutstandingDebt) {
                console.log(`   📊 This payment settles accounts receivable`);
                console.log(`   💰 Proper double-entry: Cash ↑, Accounts Receivable ↓`);
            } else {
                console.log(`   📊 This payment recognizes current period revenue`);
                console.log(`   💰 Proper double-entry: Cash ↑, Rental Income ↑`);
            }
            
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
        // Use the actual Property Maintenance account that exists in the database
        return '5007'; // Property Maintenance
    }

    static async getSuppliesExpenseAccount() {
        // Use the actual Maintenance Supplies account that exists in the database
        return '5011'; // Maintenance Supplies
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
        // Prefer tenant AR account 1100; fallback to generic AR (1101) if needed
        let account = await Account.findOne({ code: '1100' });
        if (!account) {
            account = await Account.findOne({ name: 'Accounts Receivable - Tenants', type: 'Asset' });
        }
        if (!account) {
            account = await this.getOrCreateAccount('1100', 'Accounts Receivable - Tenants', 'Asset');
        }
        return account.code;
    }

    static async getDeferredIncomeAccount() {
        let account = await Account.findOne({ 
            name: 'Deferred Income - Tenant Advances',
            type: 'Liability'
        });
        
        if (!account) {
            account = await this.getOrCreateAccount('1102', 'Deferred Income - Tenant Advances', 'Liability');
        }
        
        return account.code;
    }

    static async getAdminIncomeAccount() {
        let account = await Account.findOne({ 
            name: 'Administrative Income',
            type: 'Income'
        });
        
        if (!account) {
            account = await this.getOrCreateAccount('4002', 'Administrative Income', 'Income');
        }
        
        return account.code;
    }

    static async getDepositLiabilityAccount() {
        let account = await Account.findOne({ 
            name: 'Tenant Deposits Held',
            type: 'Liability'
        });
        
        if (!account) {
            account = await this.getOrCreateAccount('2001', 'Tenant Deposits Held', 'Liability');
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
     * Resolve expense account based on item description/name when no category is specified
     * Uses intelligent name matching to map to appropriate expense accounts
     */
    static async resolveExpenseAccountByDescription(description, fallbackCategory = 'maintenance') {
        try {
            if (!description) {
                return await this.getMaintenanceExpenseAccount();
            }

            const desc = description.toLowerCase();
            
            // Plumbing related - use Property Maintenance (5007) since no specific plumbing account
            if (desc.includes('plumbing') || desc.includes('pipe') || desc.includes('drain') || 
                desc.includes('tap') || desc.includes('toilet') || desc.includes('sink') ||
                desc.includes('shower') || desc.includes('bath') || desc.includes('water')) {
                return '5007'; // Property Maintenance
            }
            
            // Electrical related - use Property Maintenance (5007) since no specific electrical account
            if (desc.includes('electrical') || desc.includes('wiring') || desc.includes('power') ||
                desc.includes('light') || desc.includes('switch') || desc.includes('outlet') ||
                desc.includes('circuit') || desc.includes('fuse') || desc.includes('breaker')) {
                return '5007'; // Property Maintenance
            }
            
            // HVAC related - use Property Maintenance (5007) since no specific HVAC account
            if (desc.includes('hvac') || desc.includes('air') || desc.includes('conditioning') ||
                desc.includes('heating') || desc.includes('ventilation') || desc.includes('fan')) {
                return '5007'; // Property Maintenance
            }
            
            // Cleaning related
            if (desc.includes('cleaning') || desc.includes('clean') || desc.includes('sanitize') ||
                desc.includes('disinfect') || desc.includes('wash') || desc.includes('mop')) {
                return '5009'; // Cleaning Services
            }
            
            // Security related
            if (desc.includes('security') || desc.includes('guard') || desc.includes('camera') ||
                desc.includes('alarm') || desc.includes('lock') || desc.includes('access')) {
                return '5014'; // Security Services
            }
            
            // Landscaping related
            if (desc.includes('landscaping') || desc.includes('garden') || desc.includes('lawn') ||
                desc.includes('tree') || desc.includes('plant') || desc.includes('irrigation')) {
                return '5012'; // Garden & Landscaping
            }
            
            // Painting related - use Property Maintenance (5007) since no specific painting account
            if (desc.includes('paint') || desc.includes('wall') || desc.includes('ceiling') ||
                desc.includes('color') || desc.includes('brush') || desc.includes('roller')) {
                return '5007'; // Property Maintenance
            }
            
            // Carpentry related - use Property Maintenance (5007) since no specific carpentry account
            if (desc.includes('carpentry') || desc.includes('wood') || desc.includes('door') ||
                desc.includes('window') || desc.includes('cabinet') || desc.includes('shelf')) {
                return '5007'; // Property Maintenance
            }
            
            // Supplies and materials
            if (desc.includes('supply') || desc.includes('material') || desc.includes('part') ||
                desc.includes('tool') || desc.includes('equipment') || desc.includes('hardware')) {
                return '5011'; // Maintenance Supplies
            }
            
            // Administrative/other services
            if (desc.includes('service') || desc.includes('admin') || desc.includes('consult') ||
                desc.includes('inspection') || desc.includes('assessment') || desc.includes('report')) {
                return '5062'; // Professional Fees
            }
            
            // Default to maintenance expense
            return '5007'; // Property Maintenance
            
        } catch (error) {
            console.error('Error resolving expense account by description:', error);
            // Fallback to maintenance expense
            return '5007'; // Property Maintenance
        }
    }

    /**
     * Enhanced account resolution that tries multiple strategies
     */
    static async resolveExpenseAccount(item, request) {
        try {
            // Strategy 1: Use item category if available
            if (item.category) {
                const categoryMap = {
                    'maintenance': '5007',      // Property Maintenance
                    'plumbing': '5007',         // Property Maintenance (no specific plumbing account)
                    'electrical': '5007',       // Property Maintenance (no specific electrical account)
                    'hvac': '5007',             // Property Maintenance (no specific HVAC account)
                    'cleaning': '5009',         // Cleaning Services
                    'security': '5014',         // Security Services
                    'landscaping': '5012',      // Garden & Landscaping
                    'painting': '5007',         // Property Maintenance (no specific painting account)
                    'carpentry': '5007',       // Property Maintenance (no specific carpentry account)
                    'supplies': '5011',         // Maintenance Supplies
                    'utilities': '5003',        // Utilities - Electricity (default)
                    'services': '5062'          // Professional Fees
                };
                
                if (categoryMap[item.category.toLowerCase()]) {
                    return categoryMap[item.category.toLowerCase()];
                }
            }
            
            // Strategy 2: Use request type
            if (request.type) {
                const typeMap = {
                    'maintenance': '5007',         // Property Maintenance
                    'student_maintenance': '5007', // Property Maintenance
                    'financial': '5062',           // Professional Fees
                    'operational': '5007',         // Property Maintenance
                    'administrative': '5062'       // Professional Fees
                };
                
                if (typeMap[request.type.toLowerCase()]) {
                    return typeMap[request.type.toLowerCase()];
                }
            }
            
            // Strategy 3: Use intelligent name matching on description
            if (item.description) {
                return await this.resolveExpenseAccountByDescription(item.description);
            }
            
            // Strategy 4: Use request title for context
            if (request.title) {
                return await this.resolveExpenseAccountByDescription(request.title);
            }
            
            // Strategy 5: Fallback to maintenance expense
            return '5007'; // Property Maintenance
            
        } catch (error) {
            console.error('Error in enhanced account resolution:', error);
            return '5007'; // Property Maintenance
        }
    }

    /**
     * Get account name by code
     */
    static async getAccountNameByCode(accountCode) {
        try {
            const account = await Account.findOne({ code: accountCode });
            return account ? account.name : 'Unknown Account';
        } catch (error) {
            console.error('Error getting account name by code:', error);
            return 'Unknown Account';
        }
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