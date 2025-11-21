const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Expense = require('../models/finance/Expense');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Vendor = require('../models/Vendor');
const Debtor = require('../models/Debtor');
const { logTransactionOperation, logSystemOperation } = require('../utils/auditLogger');

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
    static async allocatePettyCash(userId, amount, description, allocatedBy, residence = null, date = null) {
        try {
            console.log('💰 Allocating petty cash:', amount, 'to user:', userId, 'residence:', residence, 'date:', date);
            
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
            const { Residence } = require('../models/Residence');
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
            const allocationDate = date ? new Date(date) : new Date();
            console.log('🔍 Petty Cash Date Debug:', {
                providedDate: date,
                allocationDate: allocationDate,
                usingProvidedDate: !!date
            });
            const transaction = new Transaction({
                transactionId,
                date: allocationDate,
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

            // Credit: Bank Account (Source)
            entries.push({
                accountCode: await this.getPaymentSourceAccount('Cash'),
                accountName: 'Bank Account',
                accountType: 'Asset',
                debit: 0,
                credit: amount,
                description: `Bank withdrawal for petty cash allocation to ${user.firstName} ${user.lastName} - ${residenceDoc.name}`,
                residence: residence // Include residence in entry for better tracking
            });

            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: allocationDate,
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
    static async recordPettyCashExpense(userId, amount, description, expenseCategory, approvedBy, residence = null, expenseId = null, date = null, linkedRequestId = null) {
        try {
            console.log('💸 Recording petty cash expense:', amount, 'by user:', userId, 'residence:', residence, 'expenseId:', expenseId, 'date:', date);
            
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
            const { Residence } = require('../models/Residence');
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

            // ✅ NEW: Check if this expense was previously accrued (link via expenseId or requestId)
            let wasAccrued = false;
            let resolvedExpense = null;
            let resolvedExpenseId = expenseId;
            let effectiveRequestId = linkedRequestId;
            let foundAccrualTransactionEntry = null; // Store the accrual transaction entry if found via fallback

            if (resolvedExpenseId) {
                console.log(`🔍 Looking up expense with ID: ${resolvedExpenseId}`);
                
                // Try finding by _id first (MongoDB ObjectId)
                resolvedExpense = await Expense.findById(resolvedExpenseId).lean();
                
                // If not found by _id, try finding by expenseId field (string like "EXP123")
                if (!resolvedExpense) {
                    console.log(`   - Not found by _id, trying expenseId field...`);
                    resolvedExpense = await Expense.findOne({ expenseId: resolvedExpenseId }).lean();
                }
                
                if (!resolvedExpense) {
                    console.log(`❌ Expense ${resolvedExpenseId} not found by _id or expenseId when recording petty cash expense`);
                    console.log(`   - This means the expense doesn't exist or the ID is incorrect`);
                    resolvedExpenseId = null;
                } else {
                    // Update resolvedExpenseId to the actual _id for consistency
                    resolvedExpenseId = resolvedExpense._id.toString();
                    console.log(`✅ Found expense: ${resolvedExpenseId}`);
                    console.log(`   - Expense ID: ${resolvedExpense.expenseId || resolvedExpense._id}`);
                    console.log(`   - Description: ${resolvedExpense.description}`);
                    console.log(`   - Amount: $${resolvedExpense.amount}`);
                    console.log(`   - Payment Status: ${resolvedExpense.paymentStatus || 'undefined'}`);
                    console.log(`   - TransactionId field exists: ${resolvedExpense.transactionId !== undefined && resolvedExpense.transactionId !== null}`);
                    console.log(`   - TransactionId value: ${resolvedExpense.transactionId || 'null/undefined'}`);
                    console.log(`   - TransactionId type: ${typeof resolvedExpense.transactionId}`);
                    
                    if (resolvedExpense.transactionId) {
                        console.log(`   ✅ TransactionId found: ${resolvedExpense.transactionId}`);
                        console.log(`   ✅ This expense WAS accrued and should settle liability`);
                    } else {
                        console.log(`   ⚠️ TransactionId is missing - expense was NOT accrued`);
                        console.log(`   ⚠️ This will be recorded as a new expense (Dr. Expense, Cr. Petty Cash)`);
                    }
                }
            }

            if (!resolvedExpense && linkedRequestId) {
                const requestCriteria = [{ requestId: linkedRequestId }];
                if (mongoose.Types.ObjectId.isValid(linkedRequestId)) {
                    requestCriteria.push({ requestId: new mongoose.Types.ObjectId(linkedRequestId) });
                }

                resolvedExpense = await Expense.findOne({ $or: requestCriteria }).sort({ createdAt: -1 });
                if (resolvedExpense) {
                    resolvedExpenseId = resolvedExpense._id.toString();
                    effectiveRequestId = resolvedExpense.requestId?.toString() || linkedRequestId;
                    console.log(`🔗 Matched request ${effectiveRequestId} to expense ${resolvedExpense.expenseId || resolvedExpenseId}`);
                }
            }

            // ✅ AUTO-DETECT: If description suggests paying an existing expense (e.g., "Paid: ...")
            // Try to match by description keywords, amount, residence, and date proximity
            if (!resolvedExpense && description && (description.toLowerCase().startsWith('paid:') || description.toLowerCase().includes('paid:'))) {
                console.log(`🔍 Auto-detecting accrued expense from description: "${description}"`);
                
                // Extract keywords from description (remove "Petty cash expense: Paid:", common words, get meaningful terms)
                const cleanDesc = description
                    .replace(/^petty\s+cash\s+(expense|payment):\s*/i, '')
                    .replace(/^paid:\s*/i, '')
                    .replace(/\s*-\s*(other|maintenance|supplies|services)\s*$/gi, '')
                    .trim();
                
                // Try to extract residence/vendor name (usually first part after "Paid:")
                const parts = cleanDesc.split(/\s*-\s*/);
                const locationOrVendor = parts[0]?.trim();
                const itemDescription = parts.slice(1).join(' - ').trim();
                
                console.log(`   - Clean description: "${cleanDesc}"`);
                console.log(`   - Location/Vendor: "${locationOrVendor}"`);
                console.log(`   - Item: "${itemDescription}"`);
                console.log(`   - Amount: $${amount}`);
                console.log(`   - Residence: ${residence}`);
                
                // Strategy 1: Try exact amount match first (most reliable)
                // Handle residence as both ObjectId and string
                const residenceMatch = mongoose.Types.ObjectId.isValid(residence) 
                    ? { $in: [residence, new mongoose.Types.ObjectId(residence), residence.toString()] }
                    : residence;
                
                // Match expenses that were accrued (have transactionId) - ONLY match 'Pending' expenses
                // Do NOT match expenses that are already 'Paid'
                let baseCriteria = {
                    residence: residenceMatch,
                    transactionId: { $exists: true, $ne: null }, // Must have been accrued
                    amount: amount,
                    expenseDate: { 
                        $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                    },
                    $or: [
                        { paymentStatus: 'Pending' },
                        { paymentStatus: { $exists: false } } // Handle old expenses without paymentStatus
                    ]
                    // Note: This $or already excludes 'Paid' expenses since we only match 'Pending' or missing
                };
                
                // Add description matching if we have keywords
                const orConditions = [];
                if (itemDescription) {
                    const keywords = itemDescription.split(/\s+/).filter(w => w.length > 2);
                    if (keywords.length > 0) {
                        const keywordRegex = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                        orConditions.push({ description: { $regex: keywordRegex, $options: 'i' } });
                        orConditions.push({ 'items.description': { $regex: keywordRegex, $options: 'i' } });
                    }
                }
                
                if (locationOrVendor) {
                    const locationWords = locationOrVendor.split(/\s+/).filter(w => w.length > 2);
                    if (locationWords.length > 0) {
                        const locationRegex = locationWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                        orConditions.push({ vendorName: { $regex: locationRegex, $options: 'i' } });
                        orConditions.push({ description: { $regex: locationRegex, $options: 'i' } });
                    }
                }
                
                // If we have OR conditions, combine them with paymentStatus $or using $and
                let searchCriteria = { ...baseCriteria };
                if (orConditions.length > 0) {
                    // Use $and to combine paymentStatus $or with description $or
                    searchCriteria.$and = [
                        { $or: baseCriteria.$or }, // PaymentStatus: 'Pending' or missing
                        { $or: orConditions } // Description/vendor matching
                    ];
                    delete searchCriteria.$or; // Remove the old $or since we're using $and now
                }
                
                console.log(`   - Strategy 1: Searching with exact amount + description match...`);
                console.log(`   - Criteria:`, JSON.stringify(searchCriteria, null, 2));
                
                // Sort to prefer Pending expenses, then by date
                let matchedExpenses = await Expense.find(searchCriteria)
                    .lean()
                    .limit(20);
                
                // Filter out any 'Paid' expenses (safety check)
                matchedExpenses = matchedExpenses.filter(e => e.paymentStatus !== 'Paid');
                
                // Manual sort: Pending first, then by date
                matchedExpenses.sort((a, b) => {
                    const aPending = a.paymentStatus === 'Pending' ? 0 : 1;
                    const bPending = b.paymentStatus === 'Pending' ? 0 : 1;
                    if (aPending !== bPending) return aPending - bPending;
                    return new Date(b.expenseDate) - new Date(a.expenseDate);
                });
                
                matchedExpenses = matchedExpenses.slice(0, 10);
                
                console.log(`   - Found ${matchedExpenses.length} potential matches`);
                
                // Strategy 2: If no matches, try with amount range (±$2) and same criteria
                if (matchedExpenses.length === 0) {
                    console.log(`   - Strategy 2: Trying with amount range (±$2)...`);
                    const rangeCriteria = {
                        ...baseCriteria,
                        amount: { $gte: amount - 2, $lte: amount + 2 }
                    };
                    // Merge description $or with paymentStatus $or using $and
                    if (orConditions.length > 0) {
                        rangeCriteria.$and = [
                            { $or: baseCriteria.$or }, // Keep paymentStatus conditions
                            { $or: orConditions } // Add description conditions
                        ];
                        delete rangeCriteria.$or; // Remove the old $or since we're using $and now
                    }
                    
                    // Sort to prefer Pending expenses
                    matchedExpenses = await Expense.find(rangeCriteria)
                        .lean()
                        .limit(20);
                    
                    // Filter out any 'Paid' expenses (safety check)
                    matchedExpenses = matchedExpenses.filter(e => e.paymentStatus !== 'Paid');
                    
                    matchedExpenses.sort((a, b) => {
                        const aPending = a.paymentStatus === 'Pending' ? 0 : 1;
                        const bPending = b.paymentStatus === 'Pending' ? 0 : 1;
                        if (aPending !== bPending) return aPending - bPending;
                        return new Date(b.expenseDate) - new Date(a.expenseDate);
                    });
                    
                    matchedExpenses = matchedExpenses.slice(0, 10);
                    
                    console.log(`   - Found ${matchedExpenses.length} potential matches with amount range`);
                }
                
                // Strategy 3: If still no matches, try by amount and residence only (no description match)
                if (matchedExpenses.length === 0) {
                    console.log(`   - Strategy 3: Trying by amount and residence only...`);
                    // Sort to prefer Pending expenses
                    matchedExpenses = await Expense.find({
                        residence: residence,
                        transactionId: { $exists: true, $ne: null },
                        amount: { $gte: amount - 2, $lte: amount + 2 },
                        expenseDate: { 
                            $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                        },
                        $or: [
                            { paymentStatus: 'Pending' },
                            { paymentStatus: { $exists: false } }
                        ]
                    })
                    .lean()
                    .limit(10);
                    
                    // Filter out any 'Paid' expenses (safety check)
                    matchedExpenses = matchedExpenses.filter(e => e.paymentStatus !== 'Paid');
                    
                    matchedExpenses.sort((a, b) => {
                        const aPending = a.paymentStatus === 'Pending' ? 0 : 1;
                        const bPending = b.paymentStatus === 'Pending' ? 0 : 1;
                        if (aPending !== bPending) return aPending - bPending;
                        return new Date(b.expenseDate) - new Date(a.expenseDate);
                    });
                    
                    matchedExpenses = matchedExpenses.slice(0, 5);
                    
                    console.log(`   - Found ${matchedExpenses.length} potential matches by amount/residence only`);
                }
                
                if (matchedExpenses.length > 0) {
                    // Prefer: 1) Exact amount match, 2) Pending status, 3) Closest by date
                    const exactAmountMatch = matchedExpenses.find(e => e.amount === amount);
                    const pendingMatch = (exactAmountMatch || matchedExpenses).find(e => e.paymentStatus === 'Pending');
                    resolvedExpense = pendingMatch || exactAmountMatch || matchedExpenses[0];
                    resolvedExpenseId = resolvedExpense._id.toString();
                    effectiveRequestId = resolvedExpense.requestId?.toString();
                    
                    console.log(`✅ Auto-matched expense: ${resolvedExpense.expenseId || resolvedExpenseId}`);
                    console.log(`   - Description: ${resolvedExpense.description}`);
                    console.log(`   - Amount: $${resolvedExpense.amount} (requested: $${amount})`);
                    console.log(`   - Date: ${resolvedExpense.expenseDate}`);
                    console.log(`   - Payment Status: ${resolvedExpense.paymentStatus || 'undefined'}`);
                    console.log(`   - Has TransactionId: ${!!resolvedExpense.transactionId}`);
                } else {
                    console.log(`⚠️ No matching accrued expense found for "${description}"`);
                    console.log(`   - Searched for: amount=$${amount}, residence=${residence}, has transactionId`);
                }
            }

            // Check if the resolved expense was accrued and can be paid
            if (resolvedExpense) {
                // ✅ CRITICAL: Reject if expense is already paid
                if (resolvedExpense.paymentStatus === 'Paid') {
                    throw new Error(`Cannot pay expense ${resolvedExpense.expenseId || resolvedExpense._id}: Expense is already marked as Paid. Payment status: ${resolvedExpense.paymentStatus}`);
                }
                
                // Check if expense was accrued (has transactionId)
                if (resolvedExpense.transactionId) {
                    wasAccrued = true;
                    console.log(`✅ Expense was accrued - will settle liability: ${resolvedExpense._id} with transaction: ${resolvedExpense.transactionId}`);
                } else {
                    // Fallback: Try to find if there's an accrual transaction for this expense
                    console.log(`⚠️ Expense ${resolvedExpense._id} does not have transactionId in expense record`);
                    console.log(`   - Trying to find accrual transaction by expense _id or requestId...`);
                    
                    // Build search criteria - try both expense._id and requestId
                    // Since multiple transactions can have the same sourceId (requestId), we need to match by amount too
                    const baseSearchCriteria = {
                        source: 'expense_accrual',
                        status: 'posted',
                        $or: [
                            { sourceId: resolvedExpense._id }
                        ]
                    };
                    
                    // Also try by requestId if available
                    if (resolvedExpense.requestId) {
                        baseSearchCriteria.$or.push({ sourceId: resolvedExpense.requestId });
                        if (mongoose.Types.ObjectId.isValid(resolvedExpense.requestId)) {
                            baseSearchCriteria.$or.push({ sourceId: new mongoose.Types.ObjectId(resolvedExpense.requestId) });
                        }
                    }
                    
                    console.log(`   - Base search criteria:`, {
                        source: baseSearchCriteria.source,
                        status: baseSearchCriteria.status,
                        $or: baseSearchCriteria.$or.map(condition => ({
                            sourceId: condition.sourceId?.toString ? condition.sourceId.toString() : condition.sourceId
                        }))
                    });
                    
                    // Strategy 1: Try to find transaction with exact amount match
                    console.log(`   - Strategy 1: Searching for transaction with exact amount match: $${resolvedExpense.amount}`);
                    let accrualTransactions = await TransactionEntry.find({
                        ...baseSearchCriteria,
                        totalCredit: resolvedExpense.amount
                    })
                    .sort({ createdAt: -1 })
                    .lean();
                    
                    let accrualTransaction = accrualTransactions.length > 0 ? accrualTransactions[0] : null;
                    
                    // Strategy 2: If multiple transactions with same amount, try to match by description
                    if (accrualTransactions.length > 1) {
                        console.log(`   - Found ${accrualTransactions.length} transactions with matching amount, trying to match by description...`);
                        if (resolvedExpense.description) {
                            const descKeywords = resolvedExpense.description
                                .split(/\s+/)
                                .filter(w => w.length > 3)
                                .slice(0, 3);
                            
                            if (descKeywords.length > 0) {
                                // Try to find transaction with matching description
                                const matched = accrualTransactions.find(tx => {
                                    const txDesc = (tx.description || '').toLowerCase();
                                    const entryDescs = (tx.entries || []).map(e => (e.description || '').toLowerCase()).join(' ');
                                    const searchText = txDesc + ' ' + entryDescs;
                                    return descKeywords.some(keyword => searchText.includes(keyword.toLowerCase()));
                                });
                                
                                if (matched) {
                                    accrualTransaction = matched;
                                    console.log(`   ✅ Matched transaction by description: ${matched.transactionId}`);
                                }
                            }
                        }
                    }
                    
                    // Strategy 3: If no exact amount match, try with amount range (±$1)
                    if (!accrualTransaction) {
                        console.log(`   - Strategy 2: No exact amount match, trying with amount range (±$1)...`);
                        accrualTransactions = await TransactionEntry.find({
                            ...baseSearchCriteria,
                            totalCredit: { $gte: resolvedExpense.amount - 1, $lte: resolvedExpense.amount + 1 }
                        })
                        .sort({ createdAt: -1 })
                        .limit(10)
                        .lean();
                        
                        if (accrualTransactions.length > 0) {
                            // Prefer exact match if available
                            const exactMatch = accrualTransactions.find(tx => tx.totalCredit === resolvedExpense.amount);
                            accrualTransaction = exactMatch || accrualTransactions[0];
                        }
                    }
                    
                    // Strategy 4: If still no match, just get any transaction with matching sourceId (fallback)
                    if (!accrualTransaction) {
                        console.log(`   - Strategy 3: No amount match, using any transaction with matching sourceId...`);
                        accrualTransaction = await TransactionEntry.findOne(baseSearchCriteria)
                            .sort({ createdAt: -1 })
                            .lean();
                    }
                    
                    if (accrualTransaction) {
                        console.log(`✅ Found accrual transaction: ${accrualTransaction.transactionId}`);
                        console.log(`   - Transaction amount: $${accrualTransaction.totalCredit || accrualTransaction.totalDebit || 0}`);
                        console.log(`   - Expense amount: $${resolvedExpense.amount}`);
                        if (Math.abs((accrualTransaction.totalCredit || 0) - resolvedExpense.amount) > 0.01) {
                            console.log(`   ⚠️ Amount mismatch - transaction: $${accrualTransaction.totalCredit}, expense: $${resolvedExpense.amount}`);
                            console.log(`   ⚠️ This might be a different item from the same request`);
                        }
                        console.log(`   - This expense WAS accrued, will settle liability`);
                        wasAccrued = true;
                        foundAccrualTransactionEntry = accrualTransaction; // Store for AP account lookup
                        
                        // Also update the expense record with Transaction document _id (not transactionId string)
                        // expense.transactionId stores the Transaction document _id, not the transactionId string
                        try {
                            const transactionDoc = await Transaction.findOne({ 
                                transactionId: accrualTransaction.transactionId 
                            }).select('_id').lean();
                            
                            if (transactionDoc) {
                                await Expense.findByIdAndUpdate(resolvedExpense._id, {
                                    transactionId: transactionDoc._id
                                });
                                console.log(`   ✅ Updated expense record with Transaction _id: ${transactionDoc._id} for future reference`);
                            } else {
                                console.log(`   ⚠️ Could not find Transaction document for transactionId: ${accrualTransaction.transactionId}`);
                            }
                        } catch (updateError) {
                            console.log(`   ⚠️ Could not update expense record with transactionId: ${updateError.message}`);
                        }
                    } else {
                        console.log(`ℹ️ No accrual transaction found - expense was NOT accrued`);
                        console.log(`   - Will record as new expense (Dr. Expense, Cr. Petty Cash)`);
                    }
                }
            }

            const transactionId = await this.generateTransactionId();
            const expenseDate = date ? new Date(date) : new Date();
            console.log('🔍 Petty Cash Expense Date Debug:', {
                providedDate: date,
                expenseDate: expenseDate,
                usingProvidedDate: !!date
            });
            const transaction = new Transaction({
                transactionId,
                date: expenseDate,
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
                console.log(`💰 Settling accrued liability for expense: ${resolvedExpenseId}`);
                
                // ✅ CRITICAL: Look up the original transaction entry to find the exact AP account that was credited
                let apAccount = null;
                let apAccountCode = null;
                let apAccountName = null;
                
                // Use the stored accrual transaction entry if we found it via fallback, otherwise look it up
                let originalTransactionEntry = foundAccrualTransactionEntry;
                
                if (!originalTransactionEntry && resolvedExpense && resolvedExpense.transactionId) {
                    // expense.transactionId is the Transaction document _id, not the transactionId string
                    // We need to get the Transaction to find its transactionId string, then find the TransactionEntry
                    const originalTransaction = await Transaction.findById(resolvedExpense.transactionId).lean();
                    
                    if (!originalTransaction || !originalTransaction.transactionId) {
                        console.log(`⚠️ Original transaction not found for expense.transactionId: ${resolvedExpense.transactionId}, will try fallback`);
                    } else {
                        // Find the original transaction entry that was created during accrual
                        originalTransactionEntry = await TransactionEntry.findOne({
                            transactionId: originalTransaction.transactionId,
                            source: 'expense_accrual'
                        }).lean();
                    }
                }
                
                // Now use the originalTransactionEntry (whether found via fallback or lookup) to find AP account
                if (originalTransactionEntry && originalTransactionEntry.entries) {
                    // Find the credit entry (AP account) - it should be a Liability account with credit > 0
                    // Look for any Liability account that was credited (this covers vendor-specific AP accounts too)
                    const apEntry = originalTransactionEntry.entries.find(entry => 
                        entry.accountType === 'Liability' && 
                        entry.credit > 0
                    );
                    
                    if (apEntry) {
                        apAccountCode = apEntry.accountCode;
                        apAccountName = apEntry.accountName;
                        console.log(`✅ Found original AP account from transaction entry: ${apAccountCode} - ${apAccountName}`);
                        
                        // Verify the account exists
                        apAccount = await Account.findOne({ code: apAccountCode, type: 'Liability' });
                        if (apAccount) {
                            console.log(`[Petty Cash] Using exact AP account from accrual transaction: ${apAccountCode} - ${apAccountName}`);
                        } else {
                            console.log(`⚠️ AP account ${apAccountCode} from transaction not found in chart of accounts, will try fallback`);
                            apAccountCode = null;
                            apAccountName = null;
                        }
                    } else {
                        console.log(`⚠️ No AP credit entry found in original transaction entry, will try fallback`);
                    }
                } else {
                    console.log(`⚠️ Original transaction entry not found or has no entries, will try fallback`);
                }
                
                // Fallback 1: Try vendor-specific account from expense record
                if (!apAccount && resolvedExpense && resolvedExpense.vendorSpecificAccount) {
                    apAccountCode = resolvedExpense.vendorSpecificAccount;
                    apAccount = await Account.findOne({ code: apAccountCode, type: 'Liability' });
                    if (apAccount) {
                        apAccountName = apAccount.name;
                        console.log(`[Petty Cash] Using vendor-specific account from expense: ${apAccountCode} - ${apAccountName}`);
                    }
                }
                
                // Fallback 2: Try vendor lookup
                if (!apAccount && resolvedExpense && resolvedExpense.vendorId) {
                    const vendor = await Vendor.findById(resolvedExpense.vendorId);
                    if (vendor && vendor.chartOfAccountsCode) {
                        apAccountCode = vendor.chartOfAccountsCode;
                        apAccount = await Account.findOne({ code: apAccountCode, type: 'Liability' });
                        if (apAccount) {
                            apAccountName = apAccount.name;
                            console.log(`[Petty Cash] Using vendor account from lookup: ${apAccountCode} - ${apAccountName}`);
                        }
                    }
                }
                
                // Fallback 3: Use general AP account (2000)
                if (!apAccount) {
                    apAccountCode = '2000';
                    apAccount = await Account.findOne({ code: apAccountCode, type: 'Liability' });
                    if (apAccount) {
                        apAccountName = apAccount.name;
                        console.log(`[Petty Cash] Using general AP account (2000) as final fallback`);
                    }
                }
                
                if (!apAccount) {
                    throw new Error('Accounts Payable account not found for settling accrued liability');
                }
                
                // Debit: Accounts Payable (reduce liability) - use the exact account from accrual
                entries.push({
                    accountCode: apAccountCode || apAccount.code,
                    accountName: apAccountName || apAccount.name,
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
                date: expenseDate,
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
                    expenseId: resolvedExpenseId,
                    requestId: effectiveRequestId,
                    paymentMethod: 'Petty Cash',
                    paymentReference: `PC-${Date.now()}`,
                    wasAccrued: wasAccrued, // Track if this was settling an accrued liability
                    originalTransactionId: wasAccrued ? resolvedExpense.transactionId : null
                }
            });

            await transactionEntry.save();
            
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log(`✅ Petty cash ${wasAccrued ? 'payment' : 'expense'} recorded successfully for ${user.firstName} ${user.lastName} (${user.role}) at residence: ${residenceDoc.name}`);
            if (resolvedExpenseId) {
                console.log(`🔗 Linked to expense: ${resolvedExpenseId}${wasAccrued ? ' (settling accrued liability)' : ''}`);
            }
            return { transaction, transactionEntry, user, pettyCashAccount, residence: residenceDoc, expenseId: resolvedExpenseId, wasAccrued };

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
            const { Residence } = require('../models/Residence');
            const residenceDoc = await Residence.findById(residence);
            if (!residenceDoc) {
                throw new Error(`Invalid residence ID: ${residence}`);
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

            // Credit: Bank Account (Source)
            entries.push({
                accountCode: await this.getPaymentSourceAccount('Cash'),
                accountName: 'Bank Account',
                accountType: 'Asset',
                debit: 0,
                credit: amount,
                description: `Bank withdrawal to replenish ${user.firstName} ${user.lastName} petty cash - ${residenceDoc.name}`,
                residence: residence // Include residence in entry for better tracking
            });

            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(), // Replenishment date should be current date
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
    static async recordMaintenanceApproval(request, user, approvalDate = null) {
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
            
            // Always use the incurred/expense date for accruals
            // Priority: explicit expenseDate -> dateRequested -> approvalDate -> year/month (1st of month) -> createdAt
            const accrualDate = request.expenseDate ? new Date(request.expenseDate)
                               : (request.dateRequested ? new Date(request.dateRequested)
                               : (approvalDate ? new Date(approvalDate)
                               : (request.year && request.month ? new Date(request.year, request.month - 1, 1)
                               : (request.createdAt ? new Date(request.createdAt) : new Date()))));
            
            // CRITICAL: Normalize residence to ObjectId BEFORE creating transaction
            // request.residence could be ObjectId, populated object, string, or null
            let normalizedResidence = null;
            if (request.residence) {
                if (request.residence._id) {
                    // Populated object - extract _id
                    normalizedResidence = request.residence._id;
                } else if (mongoose.Types.ObjectId.isValid(request.residence)) {
                    // Already an ObjectId or valid string
                    normalizedResidence = new mongoose.Types.ObjectId(request.residence);
                } else {
                    console.warn(`⚠️ Invalid residence format for request ${request._id}:`, request.residence);
                }
            }
            
            if (!normalizedResidence) {
                console.error(`❌ ERROR: Request ${request._id} has no valid residence! Cannot create transaction.`);
                throw new Error(`Request ${request._id} must have a valid residence to create expense accrual transaction`);
            }
            
            console.log(`📍 Setting residence for transaction: ${normalizedResidence} (from request ${request._id})`);
            
            const transaction = new Transaction({
                transactionId,
                date: accrualDate,
                description: `${request.vendorName || 'Vendor'} maintenance approval`,
                type: 'approval',
                reference: request._id.toString(),
                residence: normalizedResidence, // CRITICAL: Always use normalized ObjectId
                residenceName: request.residence?.name || (typeof request.residence === 'object' && request.residence.name) || 'Unknown Residence',
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
                        accountCode: await this.getOrCreateVendorPayableAccount(selectedQuotation.vendorId, selectedQuotation.provider),
                        accountName: `Accounts Payable: ${selectedQuotation.provider}`,
                        accountType: 'Liability',
                        debit: 0,
                        credit: selectedQuotation.amount,
                        description: `Payable to ${selectedQuotation.provider}`
                    });
                } else if (request.proposedVendor || request.vendorName || item.provider) {
                    // ✅ NEW: Items with providers but no quotations
                    // Check request-level vendor first, then item-level
                    const provider = request.proposedVendor || request.vendorName || item.provider;
                    const vendorId = request.vendorId || null; // Use request-level vendorId if available
                    const amount = item.totalCost || item.estimatedCost || 0;
                    
                    console.log(`💰 Processing item with provider but no quotation: provider="${provider}", vendorId="${vendorId}", amount=$${amount}`);
                    
                    // Debit: Resolved Expense Account
                    entries.push({
                        accountCode: expenseAccountCode,
                        accountName: expenseAccountName,
                        accountType: 'Expense',
                        debit: amount,
                        credit: 0,
                        description: `${expenseAccountName}: ${item.description}`
                    });

                    // Credit: Accounts Payable: Provider (use vendorId if available for better account linking)
                    const vendorAPAccountCode = await this.getOrCreateVendorPayableAccount(vendorId, provider);
                    entries.push({
                        accountCode: vendorAPAccountCode,
                        accountName: `Accounts Payable: ${provider}`,
                        accountType: 'Liability',
                        debit: 0,
                        credit: amount,
                        description: `Payable to ${provider}`
                    });
                    console.log(`✅ Created AP entry for vendor: ${provider} using account ${vendorAPAccountCode}`);
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
                            accountName: 'Bank Account',
                            accountType: 'Asset',
                            debit: 0,
                            credit: amount,
                            description: `Bank payment for ${item.description}`
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

            // Create transaction entry (residence already normalized above)
            const totalAmount = entries.reduce((sum, entry) => sum + entry.debit, 0);
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: accrualDate, // Use same accrual date for consistency
                description: `Maintenance approval: ${request.title}`,
                reference: request._id.toString(),
                entries,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                source: 'expense_accrual',
                sourceId: request._id,
                sourceModel: 'Request',
                residence: normalizedResidence, // CRITICAL: Always use normalized ObjectId
                createdBy: user.email,
                status: 'posted',
                metadata: {
                    requestType: 'maintenance',
                    vendorName: request.vendorName,
                    itemCount: request.items.length,
                    expenseDate: accrualDate,
                    residenceId: normalizedResidence.toString(), // Also store as string in metadata for queries
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
                
                // Find vendor information from selected quotations
                let vendorId = null;
                let vendorSpecificAccount = null;
                
                // Check for selected quotations in items
                for (const item of request.items) {
                    const selectedQuotation = item.quotations?.find(q => q.isSelected || q.isApproved);
                    if (selectedQuotation) {
                        // Use vendor information from the quotation if available
                        if (selectedQuotation.vendorId && selectedQuotation.vendorCode) {
                            vendorId = selectedQuotation.vendorId;
                            vendorSpecificAccount = selectedQuotation.vendorCode;
                            console.log(`   - Found vendor from quotation: ${selectedQuotation.vendorName} (${selectedQuotation.vendorCode})`);
                            break;
                        } else if (selectedQuotation.provider) {
                            // Fallback: Try to find vendor by business name
                            const vendor = await Vendor.findOne({ businessName: selectedQuotation.provider });
                            if (vendor) {
                                vendorId = vendor._id;
                                vendorSpecificAccount = vendor.chartOfAccountsCode;
                                console.log(`   - Found vendor: ${vendor.businessName} (${vendor.chartOfAccountsCode})`);
                                break;
                            }
                        }
                    }
                }
                
                expense = new Expense({
                    expenseId: await generateUniqueId('EXP'),
                    requestId: request._id,
                    residence: normalizedResidence, // Use normalized residence from above
                    category: 'Maintenance',
                    amount: totalAmount,
                    description: `Maintenance: ${request.title}`,
                    expenseDate: accrualDate, // Use approval date instead of new Date()
                    paymentStatus: 'Pending',
                    period: 'monthly',
                    createdBy: user._id,
                    transactionId: transaction._id,
                    vendorId: vendorId, // Link the vendor
                    vendorSpecificAccount: vendorSpecificAccount // Store the vendor account code
                });

                await expense.save();
                console.log(`   - Expense created: ${expense.expenseId}`);
                if (vendorId) {
                    console.log(`   - Linked to vendor: ${vendorId} (${vendorSpecificAccount})`);
                }
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
            
            // Get datePaid from monthly request if available
            let paymentDate = expense.paidDate || expense.date || new Date();
            if (expense.monthlyRequestId) {
                const MonthlyRequest = require('../models/MonthlyRequest');
                const monthlyRequest = await MonthlyRequest.findById(expense.monthlyRequestId);
                if (monthlyRequest && monthlyRequest.datePaid) {
                    paymentDate = monthlyRequest.datePaid;
                    console.log(`📅 Using datePaid from monthly request: ${paymentDate}`);
                }
            }
            
            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: paymentDate,
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
                        accountCode: await this.getOrCreateVendorPayableAccount(expense.vendorId, expense.vendorName),
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
                date: paymentDate, // Use same payment date for consistency
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
            
            // CRITICAL: Normalize residence to ObjectId
            let normalizedResidence = null;
            if (request.residence) {
                if (request.residence._id) {
                    normalizedResidence = request.residence._id;
                } else if (mongoose.Types.ObjectId.isValid(request.residence)) {
                    normalizedResidence = new mongoose.Types.ObjectId(request.residence);
                }
            }
            
            if (!normalizedResidence) {
                throw new Error(`Request ${request._id} must have a valid residence to create supply purchase transaction`);
            }
            
            const transactionId = await this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: `Supply purchase approval: ${request.title}`,
                type: 'approval',
                reference: request._id.toString(),
                residence: normalizedResidence, // CRITICAL: Always use normalized ObjectId
                residenceName: request.residence?.name || (typeof request.residence === 'object' && request.residence.name) || 'Unknown Residence',
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
                        accountCode: await this.getOrCreateVendorPayableAccount(selectedQuotation.vendorId, selectedQuotation.provider),
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
                date: request.approvedAt || request.createdAt || new Date(),
                description: `Supply purchase approval: ${request.title}`,
                reference: request._id.toString(),
                entries,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                source: 'expense_payment',
                sourceId: request._id,
                sourceModel: 'Request',
                residence: normalizedResidence, // CRITICAL: Always use normalized ObjectId
                createdBy: user.email,
                status: 'posted',
                metadata: {
                    residenceId: normalizedResidence.toString() // Also store as string in metadata for queries
                }
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

            // 🆕 IMPROVED: Analyze payment month vs current month to determine payment type
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
                    
                    // 🆕 NEW: Handle "2025-09" format first (YYYY-MM)
                    const yyyyMmMatch = payment.paymentMonth.match(/^(\d{4})-(\d{1,2})$/);
                    if (yyyyMmMatch) {
                        year = parseInt(yyyyMmMatch[1]);
                        month = parseInt(yyyyMmMatch[2]) - 1; // Convert to 0-based index
                        console.log(`📅 Parsed YYYY-MM format: Year ${year}, Month ${month + 1}`);
                    } else {
                        // 🆕 FALLBACK: Try month names and abbreviations
                        month = monthNames.findIndex(m => lowerPaymentMonth.includes(m));
                        if (month === -1) {
                            month = monthAbbr.findIndex(m => lowerPaymentMonth.includes(m));
                        }
                        
                        const yearMatch = payment.paymentMonth.match(/\b(20\d{2})\b/);
                        if (yearMatch) {
                            year = parseInt(yearMatch[1]);
                        }
                    }
                    
                    if (month !== -1 && month >= 0 && month <= 11) {
                        paymentMonthDate = new Date(year, month, 1);
                        const currentMonthDate = new Date(currentYear, currentMonth, 1);
                        
                        console.log(`📅 Payment Month Analysis:`);
                        console.log(`   Payment Month: ${payment.paymentMonth}`);
                        console.log(`   Parsed Month: ${month + 1} (${monthNames[month]})`);
                        console.log(`   Parsed Year: ${year}`);
                        console.log(`   Payment Month Date: ${paymentMonthDate.toISOString()}`);
                        console.log(`   Current Month Date: ${currentMonthDate.toISOString()}`);
                        console.log(`   Payment Month > Current Month: ${paymentMonthDate > currentMonthDate}`);
                        
                        if (paymentMonthDate > currentMonthDate) {
                            isAdvancePayment = true;
                            console.log(`✅ Identified as ADVANCE PAYMENT for future month`);
                        } else if (paymentMonthDate.getTime() === currentMonthDate.getTime()) {
                            isCurrentPeriodPayment = true;
                            console.log(`✅ Identified as CURRENT PERIOD PAYMENT`);
                        } else {
                            isPastDuePayment = true;
                            console.log(`✅ Identified as PAST DUE PAYMENT`);
                        }
                    } else {
                        console.log(`⚠️ Could not identify month from: ${payment.paymentMonth}`);
                        console.log(`   Month value: ${month}, Year value: ${year}`);
                    }
                } catch (error) {
                    console.log(`⚠️ Error parsing payment month: ${payment.paymentMonth}`, error.message);
                }
            } else {
                console.log(`⚠️ No payment month specified, will use fallback logic`);
            }

            // Check if student has outstanding debt
            const Debtor = require('../models/Debtor');
            const debtor = await Debtor.findOne({ user: payment.student });
            const studentHasOutstandingDebt = debtor && debtor.currentBalance > 0;
            const hasAccruedRentals = debtor && debtor.currentBalance > 0;
            
            // 🆕 NEW: Check if payment is made before lease start date (additional advance payment rule)
            let isPaymentBeforeLeaseStart = false;
            if (debtor && debtor.startDate) {
                const leaseStartDate = new Date(debtor.startDate);
                const paymentDate = new Date(payment.date);
                
                if (paymentDate < leaseStartDate) {
                    isPaymentBeforeLeaseStart = true;
                    console.log(`📅 Payment made before lease start date:`);
                    console.log(`   Payment Date: ${paymentDate.toISOString().split('T')[0]}`);
                    console.log(`   Lease Start: ${leaseStartDate.toISOString().split('T')[0]}`);
                    console.log(`   ✅ Identified as ADVANCE PAYMENT (before lease start)`);
                }
            }
            
            // 🆕 NEW: Check if payment date is before allocation month (payment date vs allocation month)
            let isPaymentDateBeforeAllocationMonth = false;
            if (paymentMonthDate && payment.date) {
                const paymentDate = new Date(payment.date);
                const paymentDateMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);
                
                if (paymentDateMonth < paymentMonthDate) {
                    isPaymentDateBeforeAllocationMonth = true;
                    console.log(`📅 Payment date is before allocation month:`);
                    console.log(`   Payment Date: ${paymentDate.toISOString().split('T')[0]} (Month: ${paymentDate.getMonth() + 1}/${paymentDate.getFullYear()})`);
                    console.log(`   Allocation Month: ${paymentMonthDate.toISOString().split('T')[0]} (Month: ${paymentMonthDate.getMonth() + 1}/${paymentMonthDate.getFullYear()})`);
                    console.log(`   ✅ Identified as ADVANCE PAYMENT (payment date before allocation month)`);
                }
            }
            
            // Update advance payment flag to include payments before lease start OR payment date before allocation month
            if (isPaymentBeforeLeaseStart || isPaymentDateBeforeAllocationMonth) {
                isAdvancePayment = true;
            }
            
            // 🆕 CRITICAL: Advance payments should NEVER be treated as debt settlement
            // Even if student has outstanding debt, future month payments go to Deferred Income
            if (isAdvancePayment && studentHasOutstandingDebt) {
                console.log(`⚠️ Student has outstanding debt ($${debtor.currentBalance}) but payment is for future month`);
                console.log(`   This payment will be routed to Deferred Income, NOT to settle existing debt`);
                console.log(`   Outstanding debt should be settled with separate payments for past months`);
            }

            console.log(`   Payment Analysis:`);
            console.log(`     Current Month: ${currentMonth + 1}/${currentYear}`);
            console.log(`     Payment Month: ${payment.paymentMonth}`);
            console.log(`     Is Advance Payment: ${isAdvancePayment}`);
            console.log(`     Is Payment Before Lease Start: ${isPaymentBeforeLeaseStart}`);
            console.log(`     Is Payment Date Before Allocation Month: ${isPaymentDateBeforeAllocationMonth}`);
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

            // 🆕 SHORT-CIRCUIT: Smart FIFO now posts per-allocation transactions (Cash ↔ AR/Deferred).
            // Avoid creating an umbrella "Debt settlement" entry that double-posts Cash/AR.
            if (payment && Array.isArray(payment.payments) && payment.payments.length > 0) {
                console.log('⚠️ Skipping umbrella payment TransactionEntry - handled by Smart FIFO allocation per month.');
                return { transaction: null, transactionEntry: null, message: 'Handled by Smart FIFO allocation' };
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
                
                // 🆕 FIXED: Set transaction type based on payment analysis (not debt status)
                if (isAdvancePayment) {
                    transaction.type = 'advance_payment';
                    console.log(`✅ Transaction type set to: advance_payment`);
                } else if (isPastDuePayment) {
                    transaction.type = 'debt_settlement';
                    console.log(`✅ Transaction type set to: debt_settlement`);
                } else if (isCurrentPeriodPayment) {
                    transaction.type = 'current_payment';
                    console.log(`✅ Transaction type set to: current_payment`);
                } else {
                    // 🆕 FALLBACK: Determine type based on payment month analysis
                    if (paymentMonthDate && paymentMonthDate > new Date(currentYear, currentMonth, 1)) {
                        transaction.type = 'advance_payment';
                        console.log(`✅ Fallback: Transaction type set to: advance_payment (future month detected)`);
                    } else {
                        transaction.type = 'current_payment';
                        console.log(`✅ Fallback: Transaction type set to: current_payment`);
                    }
                }
                await transaction.save();
                
            } else {
                // 🚨 FALLBACK: Old logic for payments without breakdown
                console.log('⚠️ No payment breakdown found, using fallback logic');
                
                // 🆕 FIXED: Prioritize advance payment logic over debt settlement
                if (isAdvancePayment && deferredIncomeAccount) {
                    // Advance payment goes to Deferred Income (highest priority)
                    console.log(`💰 Processing advance payment for ${payment.paymentMonth} - routing to Deferred Income`);
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
                } else if (isPastDuePayment || (studentHasOutstandingDebt && !isAdvancePayment)) {
                    // Payment settles existing debt (only if NOT an advance payment)
                    console.log(`💰 Processing debt settlement payment - routing to Accounts Receivable`);
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
                } else if (isCurrentPeriodPayment) {
                    // Current period payment
                    console.log(`💰 Processing current period payment - routing to Rent Income`);
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
                } else {
                    // 🆕 FALLBACK: Default to advance payment if month is in the future
                    console.log(`💰 No specific payment type determined, defaulting to advance payment routing`);
                    if (deferredIncomeAccount) {
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
                            description: `Deferred rent income from ${studentName} for ${payment.paymentMonth || 'future period'} (${payment.paymentId})`
                        });
                    } else {
                        // Last resort: route to rent income
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
                            description: `Rent income from ${studentName} (${payment.paymentId})`
                        });
                    }
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
     * NEW: Record student rent payment with proper advance balance handling
     * This method implements the simple, logical approach for multiple advance payments:
     * 1. Check existing advance balance
     * 2. Calculate what's actually owed for the target month
     * 3. Split payment between settling the target month and creating new advance for next month
     * 
     * Handles scenarios like:
     * - August 1st: Pay ZWL 110.32 advance for September
     * - August 25th: Pay ZWL 180 advance for September
     * Result: September fully paid, ZWL 110.32 advance for October
     */
    static async recordStudentRentPaymentWithAdvanceHandling(payment, user) {
        try {
            console.log('💰 Recording student rent payment with advance balance handling');
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

            // Get student details
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

            // Get debtor information to check existing advance balance
            const Debtor = require('../models/Debtor');
            const debtor = await Debtor.findOne({ user: payment.student });
            
            if (!debtor) {
                throw new Error(`No debtor record found for student ${payment.student}`);
            }

            // Calculate existing advance balance (credit balance means they've overpaid)
            const existingAdvanceBalance = Math.max(0, -debtor.currentBalance || 0);
            console.log(`   Existing advance balance: $${existingAdvanceBalance}`);

            // Parse payment breakdown
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

            // If no rent amount in breakdown, assume entire payment is for rent
            if (rentAmount === 0) {
                rentAmount = payment.totalAmount;
            }

            console.log(`   Payment breakdown: Rent $${rentAmount}, Admin $${adminAmount}, Deposit $${depositAmount}`);
            console.log(`   Total rent amount to process: $${rentAmount}`);

            // 🎯 THE KEY LOGIC: Calculate what's actually owed vs what becomes new advance
            const monthlyRentExpected = Number(
                (debtor.financialBreakdown?.monthlyRent) ||
                (debtor.billingPeriod?.amount?.monthly) ||
                debtor.roomPrice ||
                0
            ) || 0;

            console.log(`   Expected monthly rent: $${monthlyRentExpected}`);

            // Check if this payment is for a future month (advance payment)
            const isAdvancePayment = payment.paymentMonth && 
                payment.paymentMonth.toLowerCase() !== 'current' && 
                payment.paymentMonth.toLowerCase() !== 'now';

            // Declare variables that will be used throughout the method
            let amountForCurrentMonth = 0;
            let amountForNewAdvance = 0;
            let remainingRentOwed = 0;

            if (isAdvancePayment) {
                console.log(`   📅 This is an advance payment for: ${payment.paymentMonth}`);
                
                // For advance payments, we need to check if we're completing a month or creating excess
                const targetMonthAdvances = await this.getAdvanceBalanceForMonth(debtor.user, payment.paymentMonth);
                const totalAdvancesForTargetMonth = targetMonthAdvances + existingAdvanceBalance;
                
                console.log(`   💰 Total advances for ${payment.paymentMonth}: $${totalAdvancesForTargetMonth}`);
                
                // Calculate how much completes the target month vs becomes excess
                const amountToCompleteTargetMonth = Math.max(0, monthlyRentExpected - totalAdvancesForTargetMonth);
                amountForCurrentMonth = Math.min(rentAmount, amountToCompleteTargetMonth);
                amountForNewAdvance = Math.max(0, rentAmount - amountForCurrentMonth);
                
                console.log(`   🎯 Amount to complete ${payment.paymentMonth}: $${amountToCompleteTargetMonth}`);
                console.log(`   🎯 Amount for ${payment.paymentMonth}: $${amountForCurrentMonth}`);
                console.log(`   🎯 Amount for new advance: $${amountForNewAdvance}`);
            } else {
                // Regular payment logic for current month
                console.log(`   📅 This is a payment for the current month`);
                
                // Calculate how much of the new payment actually settles the current month
                remainingRentOwed = Math.max(0, monthlyRentExpected - existingAdvanceBalance);
                amountForCurrentMonth = Math.min(rentAmount, remainingRentOwed);
                amountForNewAdvance = Math.max(0, rentAmount - amountForCurrentMonth);
                
                console.log(`   🎯 Remaining rent owed for current month: $${remainingRentOwed}`);
                console.log(`   🎯 Amount for current month: $${amountForCurrentMonth}`);
                console.log(`   🎯 Amount for new advance: $${amountForNewAdvance}`);
            }

            console.log(`   Analysis:`);
            if (isAdvancePayment) {
                console.log(`     Amount for ${payment.paymentMonth}: $${amountForCurrentMonth}`);
                console.log(`     Amount for new advance: $${amountForNewAdvance}`);
            } else {
                console.log(`     Remaining rent owed for current month: $${remainingRentOwed}`);
                console.log(`     Amount from new payment for current month: $${amountForCurrentMonth}`);
                console.log(`     Amount from new payment for new advance: $${amountForNewAdvance}`);
            }

            // Ensure we have a valid residence ID
            const residenceId = payment.residence || debtor.residence;
            if (!residenceId) {
                throw new Error('Residence ID is required for transaction creation');
            }

            // Handle payment date - prioritize actual payment date for cashflow accuracy
            let transactionDate;
            try {
                // First try to use the payment date from the payment record
                if (payment.date instanceof Date) {
                    transactionDate = payment.date;
                } else if (typeof payment.date === 'string' && payment.date) {
                    transactionDate = new Date(payment.date);
                    if (isNaN(transactionDate.getTime())) {
                        throw new Error('Invalid payment date string');
                    }
                } else {
                    // Fallback to current date if no payment date is available
                    transactionDate = new Date();
                    console.log('⚠️ No payment date provided, using current date for transaction');
                }
            } catch (error) {
                console.log('⚠️ Invalid payment date, using current date');
                transactionDate = new Date();
            }

            // Create transaction description
            let transactionDescription;
            if (amountForNewAdvance > 0) {
                transactionDescription = `Payment from ${studentName}: $${amountForCurrentMonth} for current month, $${amountForNewAdvance} advance`;
            } else {
                transactionDescription = `Payment from ${studentName} for current month rent`;
            }

            const transactionId = await this.generateTransactionId();
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

            // Get required accounts
            const receivingAccount = await this.getPaymentSourceAccount(payment.method);
            const rentAccount = await this.getRentIncomeAccount();
            const deferredIncomeAccount = await this.getDeferredIncomeAccount();
            const adminFeeAccount = await this.getAdminIncomeAccount();
            const depositAccount = await this.getDepositLiabilityAccount();
            const studentAccount = await this.getAccountsReceivableAccount();

            // Create double-entry entries
            const entries = [];

            // 1. DEBIT: Cash/Bank (Payment Method) - Money coming IN
            entries.push({
                accountCode: receivingAccount,
                accountName: this.getPaymentAccountName(payment.method),
                accountType: 'Asset',
                debit: payment.totalAmount,
                credit: 0,
                description: `Payment received from ${studentName} (${payment.method}, ${payment.paymentId})`
            });

            // 2. Process each payment component
            for (const paymentItem of parsedPayments) {
                const amount = paymentItem.amount || 0;
                if (amount <= 0) continue;

                switch (paymentItem.type) {
                    case 'admin':
                        // Settle AR for admin fee
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
                        // Settle AR for deposit
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
                        // 🎯 THE KEY LOGIC: Split between current month and new advance
                        if (amountForCurrentMonth > 0) {
                            // Part of payment settles current month's rent
                            const currentMonthAmount = Math.min(amount, amountForCurrentMonth);
                            entries.push({
                                accountCode: rentAccount,
                                accountName: 'Rental Income - Residential',
                                accountType: 'Income',
                                debit: 0,
                                credit: currentMonthAmount,
                                description: `Rent income from ${studentName} for current month (${payment.paymentId})`
                            });
                        }

                        if (amountForNewAdvance > 0 && deferredIncomeAccount) {
                            // Remaining amount becomes new advance
                            const advanceAmount = Math.min(amount, amountForNewAdvance);
                            entries.push({
                                accountCode: deferredIncomeAccount,
                                accountName: 'Deferred Income - Tenant Advances',
                                accountType: 'Liability',
                                debit: 0,
                                credit: advanceAmount,
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

            // Create transaction entry
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
                    paymentType: 'advance_handling',
                    paymentMonth: payment.paymentMonth,
                    existingAdvanceBalance: existingAdvanceBalance,
                    monthlyRentExpected: monthlyRentExpected,
                    amountForCurrentMonth: amountForCurrentMonth,
                    amountForNewAdvance: amountForNewAdvance,
                    studentBalance: debtor.currentBalance || 0,
                    paymentBreakdown: {
                        rent: rentAmount,
                        admin: adminAmount,
                        deposit: depositAmount
                    }
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
                throw saveError;
            }
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();

            console.log(`✅ Student payment recorded with advance balance handling`);
            console.log(`   📊 Payment split: $${amountForCurrentMonth} for current month, $${amountForNewAdvance} for advance`);
            console.log(`   💰 Proper double-entry: Cash ↑, Income ↑ (current month), Deferred Income ↑ (advance)`);
            
            return { transaction, transactionEntry };

        } catch (error) {
            console.error('❌ Error recording student rent payment with advance handling:', error);
            throw error;
        }
    }

    /**
     * Helper method to get advance balance for a specific month
     */
    static async getAdvanceBalanceForMonth(userId, targetMonth) {
        try {
            // Parse target month
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                               'july', 'august', 'september', 'october', 'november', 'december'];
            const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                              'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            
            let month = -1;
            let year = new Date().getFullYear();
            
            const lowerTargetMonth = targetMonth.toLowerCase();
            month = monthNames.findIndex(m => lowerTargetMonth.includes(m));
            if (month === -1) {
                month = monthAbbr.findIndex(m => lowerTargetMonth.includes(m));
            }
            
            const yearMatch = targetMonth.match(/\b(20\d{2})\b/);
            if (yearMatch) {
                year = parseInt(yearMatch[1]);
            }
            
            if (month === -1) {
                console.log(`⚠️ Could not parse target month: ${targetMonth}`);
                return 0;
            }
            
            // Look for advance payments for this specific month
            const advancePayments = await TransactionEntry.find({
                source: 'payment',
                'metadata.paymentMonth': targetMonth,
                'metadata.paymentType': 'advance_handling',
                status: 'posted'
            }).lean();
            
            let totalAdvanceForMonth = 0;
            for (const payment of advancePayments) {
                if (payment.metadata?.amountForNewAdvance) {
                    totalAdvanceForMonth += Number(payment.metadata.amountForNewAdvance) || 0;
                }
            }
            
            console.log(`   💰 Found $${totalAdvanceForMonth} in advance payments for ${targetMonth}`);
            return totalAdvanceForMonth;
            
        } catch (error) {
            console.log(`⚠️ Error getting advance balance for month ${targetMonth}:`, error.message);
            return 0;
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
                date: invoice.invoiceDate || new Date(),
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
                date: invoice.paymentDate || new Date(),
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
            code: '2200'
        });
        if (!account) {
            account = await this.getOrCreateAccount('2200', 'Advance Payment Liability', 'Liability');
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

    static async getOrCreateVendorPayableAccount(vendorId, providerName = null) {
        let vendor = null;
        
        // If vendorId is provided and valid, try to find vendor by ID
        if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
            vendor = await Vendor.findById(vendorId);
        }
        
        // If vendor not found by ID but providerName is provided, try to find by business name
        if (!vendor && providerName) {
            console.log(`🔍 Looking up vendor by provider name: ${providerName}`);
            vendor = await Vendor.findOne({ 
                businessName: { $regex: new RegExp(providerName, 'i') } 
            });
            
            if (vendor) {
                console.log(`✅ Found vendor by provider name: ${vendor.businessName} (${vendor._id})`);
            }
        }
        
        // If still no vendor found, use general accounts payable
        if (!vendor) {
            if (vendorId) {
                console.warn(`⚠️ Vendor not found by ID: ${vendorId}, using general accounts payable`);
            } else if (providerName) {
                console.warn(`⚠️ Vendor not found by provider name: ${providerName}, using general accounts payable`);
            } else {
                console.warn(`⚠️ No vendorId or providerName provided, using general accounts payable`);
            }
            return '2000'; // General Accounts Payable
        }

        // First, try to find account by vendor's chartOfAccountsCode
        let account = await Account.findOne({ 
            code: vendor.chartOfAccountsCode,
            type: 'Liability'
        });
        
        // If not found by code, try by name
        if (!account) {
            account = await Account.findOne({ 
                name: `Accounts Payable - ${vendor.businessName}`,
                type: 'Liability'
            });
        }
        
        // If still not found, create a new vendor-specific account
        if (!account) {
            // Generate a unique account code for this vendor
            // Ensure vendor codes follow 200xxx format to avoid conflicts
            let vendorCode;
            if (vendor.chartOfAccountsCode && vendor.chartOfAccountsCode.match(/^200[0-9]{3}$/)) {
                // Already in correct format
                vendorCode = vendor.chartOfAccountsCode;
            } else {
                // Generate new code in 200xxx format using consistent logic
                // Use the same logic as vendorController.js to ensure consistency
                const vendorCount = await Vendor.countDocuments();
                vendorCode = `200${(vendorCount + 1).toString().padStart(3, '0')}`;
            }
            
            account = await this.getOrCreateAccount(
                vendorCode, 
                `Accounts Payable - ${vendor.businessName}`, 
                'Liability'
            );
            
            // Update vendor with the new account code
            vendor.chartOfAccountsCode = vendorCode;
            await vendor.save();
            
            console.log(`✅ Created vendor-specific accounts payable account: ${vendorCode} for ${vendor.businessName}`);
        }
        
        return account.code;
    }

    static async getPaymentSourceAccount(paymentMethod) {
        const methodAccounts = {
            'Bank Transfer': '1000', // Bank Account
            'Cash': '1000', // Bank Account (corrected)
            'Ecocash': '1000', // Bank Account (corrected)
            'Innbucks': '1000', // Bank Account (corrected)
            'Online Payment': '1000', // Bank Account (corrected)
            'MasterCard': '1000', // Bank Account (corrected)
            'Visa': '1000', // Bank Account (corrected)
            'PayPal': '1000' // Bank Account (corrected)
        };

        const accountCode = methodAccounts[paymentMethod] || '1000'; // Default to Bank Account
        
        let account = await Account.findOne({ code: accountCode });
        if (!account) {
            account = await this.getOrCreateAccount(accountCode, this.getPaymentAccountName(paymentMethod), 'Asset');
        }
        
        return account.code;
    }

    static getPaymentAccountName(paymentMethod) {
        const methodNames = {
            'Bank Transfer': 'Bank Account',
            'Cash': 'Bank Account',
            'Ecocash': 'Bank Account',
            'Innbucks': 'Bank Account',
            'Online Payment': 'Bank Account',
            'MasterCard': 'Bank Account',
            'Visa': 'Bank Account',
            'PayPal': 'Bank Account'
        };

        return methodNames[paymentMethod] || 'Bank Account';
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
            
            // Log account creation
            await logSystemOperation('create', 'Account', account._id, {
                source: 'Double Entry Accounting Service',
                type: 'auto_created_account',
                accountCode: code,
                accountName: name,
                accountType: type
            });
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
            
            // Fuel and transportation related
            if (desc.includes('fuel') || desc.includes('gas') || desc.includes('petrol') || 
                desc.includes('diesel') || desc.includes('transport') || desc.includes('vehicle')) {
                return '5011'; // Maintenance Supplies (or could be Transportation if that account exists)
            }
            
            // Food and meals
            if (desc.includes('food') || desc.includes('meal') || desc.includes('lunch') || 
                desc.includes('dinner') || desc.includes('breakfast') || desc.includes('catering')) {
                return '5011'; // Maintenance Supplies (or could be Meals & Entertainment if that account exists)
            }
            
            // Supplies and materials (including twine, oil, etc.)
            if (desc.includes('supply') || desc.includes('material') || desc.includes('part') ||
                desc.includes('tool') || desc.includes('equipment') || desc.includes('hardware') ||
                desc.includes('twine') || desc.includes('oil') || desc.includes('lubricant') ||
                desc.includes('rope') || desc.includes('string') || desc.includes('wire')) {
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
            
            // Strategy 2: Use intelligent name matching on description (prioritize this for operational requests)
            // This should run before request type to catch specific items like fuel, food, etc.
            if (item.description) {
                const descAccount = await this.resolveExpenseAccountByDescription(item.description);
                // If description matching found a specific account (not default 5007), use it
                if (descAccount !== '5007') {
                    return descAccount;
                }
                // For operational requests, even if description returns 5007, continue to check request category
                // This allows request category to override the default for operational requests
            }
            
            // Strategy 3: Use request category for operational requests (before request type)
            // This is important because operational requests can have different categories (cleaning, security, etc.)
            if (request.type === 'operational' && request.category) {
                const categoryMap = {
                    'cleaning': '5009',         // Cleaning Services
                    'security': '5014',         // Security Services
                    'landscaping': '5012',      // Garden & Landscaping
                    'maintenance': '5007',      // Property Maintenance
                    'supplies': '5011',         // Maintenance Supplies
                    'utilities': '5003',        // Utilities - Electricity
                    'services': '5062'          // Professional Fees
                };
                
                if (categoryMap[request.category.toLowerCase()]) {
                    return categoryMap[request.category.toLowerCase()];
                }
            }
            
            // Strategy 4: Use request type (but not for operational - already handled above)
            if (request.type && request.type !== 'operational') {
                const typeMap = {
                    'maintenance': '5007',         // Property Maintenance
                    'student_maintenance': '5007', // Property Maintenance
                    'financial': '5062',           // Professional Fees
                    'administrative': '5062'       // Professional Fees
                };
                
                if (typeMap[request.type.toLowerCase()]) {
                    return typeMap[request.type.toLowerCase()];
                }
            }
            
            // Strategy 5: Use request title for context
            if (request.title) {
                return await this.resolveExpenseAccountByDescription(request.title);
            }
            
            // Strategy 6: Fallback to maintenance expense
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
            const { Residence } = require('../models/Residence');
            const defaultResidence = await Residence.findOne().sort({ createdAt: 1 });
            return defaultResidence?._id || null;
        } catch (error) {
            console.error('Error getting default residence:', error);
            return null;
        }
    }
}

module.exports = DoubleEntryAccountingService; 