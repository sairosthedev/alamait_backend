const TransactionEntry = require('../models/TransactionEntry');
const mongoose = require('mongoose');

/**
 * Debtor Ledger Service
 * 
 * Computes debtor ledger directly from transaction entries:
 * - Expected amounts from accrued transactions (debits to AR accounts)
 * - Paid amounts from payment transactions (credits to AR accounts)
 * - Provides accurate financial position based on actual accounting entries
 */
class DebtorLedgerService {
    
    /**
     * Get comprehensive ledger data for a specific debtor
     * @param {string} debtorId - Debtor ID
     * @param {string} studentId - Student ID (for AR account lookup)
     * @returns {Promise<Object>} Ledger data with expected/paid breakdown
     */
    static async getDebtorLedger(debtorId, studentId) {
        try {
            console.log(`📊 Computing ledger for debtor ${debtorId}, student ${studentId}`);
            
            // CRITICAL: Get Debtor to access accountCode (uses Debtor ID, persists after User deletion)
            const Debtor = require('../models/Debtor');
            const debtor = await Debtor.findById(debtorId);
            if (!debtor) {
                throw new Error(`Debtor not found: ${debtorId}`);
            }
            
            // Use Debtor's accountCode as primary (stable, never deleted)
            // Format: 1100-<debtorId> (new) or 1100-<userId> (legacy)
            const arAccountCode = debtor.accountCode || `1100-${studentId}`;
            
            console.log(`   📋 Using AR account code: ${arAccountCode} (from Debtor record)`);
            
            // Build comprehensive query to find ALL transactions for this debtor
            // Include: AR account code, advance payments by sourceId, and metadata
            const transactionQuery = {
                $or: [
                    { 'entries.accountCode': arAccountCode },
                    // Legacy support: Also check by User ID if different from Debtor ID
                    ...(arAccountCode !== `1100-${studentId}` ? [{ 'entries.accountCode': `1100-${studentId}` }] : []),
                    // CRITICAL: Include advance payments by sourceId (payment ID) as fallback
                    // This catches advance payments even if they have wrong AR codes
                    { 
                        source: 'advance_payment',
                        'metadata.studentId': studentId?.toString()
                    },
                    {
                        source: 'advance_payment',
                        'metadata.studentId': studentId
                    },
                    // Also check by debtorId in metadata
                    {
                        'metadata.debtorId': debtorId.toString()
                    },
                    {
                        'metadata.debtorId': debtorId
                    },
                    // 🆕 CRITICAL: Include reversal transactions by sourceId (original accrual ID)
                    // Reversals reference the original accrual transaction, so we need to find them
                    {
                        source: 'rental_accrual_reversal',
                        'metadata.debtorId': debtorId.toString()
                    },
                    {
                        source: 'rental_accrual_reversal',
                        'metadata.studentId': studentId?.toString()
                    },
                    {
                        source: 'rental_accrual_reversal',
                        'metadata.studentId': studentId
                    }
                ],
                status: { $nin: ['reversed', 'draft', 'deleted'] }
            };
            
            // 🆕 ENHANCED: Also find reversal transactions by looking up the original accruals
            // This handles cases where reversals use old account codes
            try {
                // Find all accruals for this student (including those with old account codes)
                const originalAccruals = await TransactionEntry.find({
                    source: 'rental_accrual',
                    $or: [
                        { 'entries.accountCode': arAccountCode },
                        ...(arAccountCode !== `1100-${studentId}` ? [{ 'entries.accountCode': `1100-${studentId}` }] : []),
                        { 'metadata.debtorId': debtorId.toString() },
                        { 'metadata.studentId': studentId?.toString() },
                        { 'metadata.studentId': studentId }
                    ],
                    status: 'posted'
                }).select('_id transactionId entries.accountCode').lean();
                
                if (originalAccruals.length > 0) {
                    const accrualIds = originalAccruals.map(a => a._id);
                    transactionQuery.$or.push({
                        source: 'rental_accrual_reversal',
                        sourceId: { $in: accrualIds }
                    });
                    transactionQuery.$or.push({
                        source: 'rental_accrual_reversal',
                        'metadata.originalAccrualId': { $in: accrualIds }
                    });
                    transactionQuery.$or.push({
                        source: 'rental_accrual_reversal',
                        'metadata.originalTransactionId': { $in: originalAccruals.map(a => a.transactionId) }
                    });
                    
                    // Also check for reversals that use the same account codes as the original accruals
                    const accountCodesFromAccruals = new Set();
                    originalAccruals.forEach(accrual => {
                        if (accrual.entries) {
                            accrual.entries.forEach(entry => {
                                if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
                                    accountCodesFromAccruals.add(entry.accountCode);
                                }
                            });
                        }
                    });
                    
                    if (accountCodesFromAccruals.size > 0) {
                        transactionQuery.$or.push({
                            source: 'rental_accrual_reversal',
                            'entries.accountCode': { $in: Array.from(accountCodesFromAccruals) }
                        });
                    }
                }
            } catch (lookupError) {
                console.log(`⚠️ Could not lookup original accruals for reversals: ${lookupError.message}`);
            }
            
            // Also check for advance payments via Payment model (by sourceId)
            const Payment = require('../models/Payment');
            const studentPayments = await Payment.find({ 
                student: studentId 
            }).select('_id').lean();
            
            if (studentPayments.length > 0) {
                const paymentIds = studentPayments.map(p => p._id);
                transactionQuery.$or.push({
                    source: 'advance_payment',
                    sourceId: { $in: paymentIds }
                });
            }
            
            // Fetch all transactions for this debtor's AR account
            const transactions = await TransactionEntry.find(transactionQuery)
            .populate('entries')
            .sort({ date: 1 });
            
            console.log(`📊 Found ${transactions.length} transactions for AR account ${arAccountCode}`);
            
            // Process transactions to build ledger
            const ledgerData = {
                studentId,
                debtorId,
                arAccountCode,
                monthlyBreakdown: {},
                totalExpected: 0,
                totalPaid: 0,
                totalOwing: 0,
                transactions: []
            };
            
            // Process each transaction
            for (const transaction of transactions) {
                const processedTransaction = await this.processTransactionForLedger(transaction, arAccountCode);
                if (processedTransaction) {
                    // Handle case where processTransactionForLedger returns an array (mixed transaction)
                    const transactionsToProcess = Array.isArray(processedTransaction) ? processedTransaction : [processedTransaction];
                    
                    transactionsToProcess.forEach(procTx => {
                        ledgerData.transactions.push(procTx);
                        
                        // Add to monthly breakdown
                        const monthKey = procTx.monthKey;
                        if (!ledgerData.monthlyBreakdown[monthKey]) {
                            ledgerData.monthlyBreakdown[monthKey] = {
                                month: monthKey,
                                expected: 0,
                                paid: 0,
                                owing: 0,
                                transactions: []
                            };
                        }
                        
                        ledgerData.monthlyBreakdown[monthKey].transactions.push(procTx);
                        
                        if (procTx.type === 'accrual') {
                            ledgerData.monthlyBreakdown[monthKey].expected += procTx.amount;
                            ledgerData.totalExpected += procTx.amount;
                        } else if (procTx.type === 'accrual_reversal') {
                            // Reversals reduce the expected amount (negative accrual)
                            ledgerData.monthlyBreakdown[monthKey].expected -= procTx.amount;
                            ledgerData.totalExpected -= procTx.amount;
                        } else if (procTx.type === 'payment') {
                            ledgerData.monthlyBreakdown[monthKey].paid += procTx.amount;
                            ledgerData.totalPaid += procTx.amount;
                        }
                    });
                }
            }
            
            // Calculate owing amounts with carry-forward logic
            // If a month has no accrual but has payments, those payments reduce the next month's balance
            const sortedMonths = Object.keys(ledgerData.monthlyBreakdown).sort();
            let carryForwardCredit = 0; // Excess payments from months without accruals (negative = credit available)
            
            sortedMonths.forEach(monthKey => {
                const month = ledgerData.monthlyBreakdown[monthKey];
                
                if (month.expected > 0) {
                    // Month has an accrual - calculate owing considering carry-forward credit
                    // carryForwardCredit is negative when we have credit, so subtract it (which adds it)
                    month.owing = Math.max(month.expected - month.paid + carryForwardCredit, 0);
                    // Update carry-forward: if payment + credit exceeds expected, carry forward the excess as credit
                    carryForwardCredit = Math.min(carryForwardCredit + month.expected - month.paid, 0);
                } else if (month.paid > 0) {
                    // Month has no accrual but has payments - these create credit for future months
                    month.owing = 0; // No accrual means nothing owed for this month
                    carryForwardCredit = carryForwardCredit - month.paid; // Increase credit (more negative)
                } else {
                    // No accrual and no payment
                    month.owing = 0;
                }
            });
            
            ledgerData.totalOwing = Math.max(ledgerData.totalExpected - ledgerData.totalPaid, 0);
            
            console.log(`📊 Ledger computed: Expected=$${ledgerData.totalExpected}, Paid=$${ledgerData.totalPaid}, Owing=$${ledgerData.totalOwing}`);
            
            return ledgerData;
            
        } catch (error) {
            console.error('❌ Error computing debtor ledger:', error);
            throw error;
        }
    }
    
    /**
     * Process a single transaction for ledger computation
     * @param {Object} transaction - Transaction entry
     * @param {string} arAccountCode - AR account code to filter by
     * @returns {Promise<Object|Array|null>} Processed transaction data
     */
    static async processTransactionForLedger(transaction, arAccountCode) {
        try {
            // Find ALL AR account entries in this transaction (there may be multiple)
            const arEntries = transaction.entries.filter(entry => entry.accountCode === arAccountCode);
            if (arEntries.length === 0) {
                return null;
            }
            
            // Sum all AR entries to get net effect
            const totalDebit = arEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
            const totalCredit = arEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
            const netAmount = totalDebit - totalCredit;
            
            // 🆕 CRITICAL FIX: Handle reversal transactions specially
            // Reversal transactions reverse an accrual, so they should reduce expected amount
            if (transaction.source === 'rental_accrual_reversal') {
                // Reversals have AR credits (reversing the original debit)
                // They should show as reducing the expected amount (negative accrual)
                if (totalCredit > 0) {
                    const transactionDate = new Date(transaction.date);
                    const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    // Try to get the original accrual month from metadata
                    let accrualMonthKey = monthKey;
                    if (transaction.metadata?.accrualMonth && transaction.metadata?.accrualYear) {
                        const year = transaction.metadata.accrualYear;
                        const month = String(transaction.metadata.accrualMonth).padStart(2, '0');
                        accrualMonthKey = `${year}-${month}`;
                    }
                    
                    return {
                        transactionId: transaction.transactionId,
                        date: transaction.date,
                        monthKey: accrualMonthKey, // Use original accrual month for proper grouping
                        type: 'accrual_reversal',
                        category: 'rent',
                        amount: totalCredit,
                        description: transaction.description || 'Accrual reversal',
                        source: transaction.source,
                        metadata: {
                            ...transaction.metadata,
                            isReversal: true,
                            originalTransactionId: transaction.metadata?.originalTransactionId,
                            originalAccrualId: transaction.metadata?.originalAccrualId
                        },
                        arEntry: {
                            accountCode: arAccountCode,
                            accountName: arEntries.find(e => e.credit > 0)?.accountName || `Accounts Receivable`,
                            debit: 0,
                            credit: totalCredit
                        }
                    };
                }
                return null;
            }
            
            // 🆕 CRITICAL FIX: Handle advance_payment transactions specially
            // Advance payments have AR entries that cancel out (debit and credit)
            // But we want to show them as payments in the ledger (when payment was made)
            // The actual allocation happens when accrual is created, so we only show the payment side
            if (transaction.source === 'advance_payment') {
                // For advance payments, only show the credit side (payment received)
                // The debit side is just transferring to deferred income, which doesn't affect AR balance
                if (totalCredit > 0) {
                    const transactionDate = new Date(transaction.date);
                    const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    return {
                        transactionId: transaction.transactionId,
                        date: transaction.date,
                        monthKey,
                        type: 'payment',
                        category: 'rent',
                        amount: totalCredit,
                        description: transaction.description || 'Advance rent payment for future periods',
                        source: transaction.source,
                        metadata: {
                            ...transaction.metadata,
                            isAdvancePayment: true,
                            note: 'Advance payment - will be allocated when accrual is created'
                        },
                        arEntry: {
                            accountCode: arAccountCode,
                            accountName: arEntries.find(e => e.credit > 0)?.accountName || `Accounts Receivable`,
                            debit: 0,
                            credit: totalCredit
                        }
                    };
                }
                // If no credit, skip it (shouldn't happen for advance payments)
                return null;
            }
            
            const transactionDate = new Date(transaction.date);
            const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
            
            let description = transaction.description || 'Transaction';
            
            // Check if this is a mixed transaction (has both debit and credit)
            // For mixed transactions, return both entries separately so ledger shows both accrual and payment
            if (totalDebit > 0 && totalCredit > 0) {
                // Try to find the original advance payment transaction to get the payment date
                let advancePaymentDate = transaction.date; // Default to accrual date
                let advancePaymentMonthKey = monthKey; // Default to accrual month
                
                // Look for advance payment transaction in metadata or by finding the original payment
                if (transaction.metadata?.advancePaymentDate) {
                    advancePaymentDate = new Date(transaction.metadata.advancePaymentDate);
                    const paymentDate = new Date(advancePaymentDate);
                    advancePaymentMonthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
                } else {
                    // Try to find the advance payment transaction by looking for deferred income entries
                    // and matching by amount and student
                    try {
                        const TransactionEntry = require('../models/TransactionEntry');
                        const advancePayment = await TransactionEntry.findOne({
                            source: 'advance_payment',
                            'metadata.debtorId': transaction.metadata?.debtorId || transaction.metadata?.studentId,
                            'entries.accountCode': '2200',
                            'entries.credit': totalCredit,
                            status: { $ne: 'reversed' }
                        })
                        .sort({ date: 1 })
                        .lean();
                        
                        if (advancePayment) {
                            advancePaymentDate = new Date(advancePayment.date);
                            const paymentDate = new Date(advancePaymentDate);
                            advancePaymentMonthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
                        }
                    } catch (lookupError) {
                        // If lookup fails, use accrual date
                        console.log(`⚠️ Could not find advance payment transaction: ${lookupError.message}`);
                    }
                }
                
                // Mixed transaction - has both accrual and payment
                // Return both as separate entries so ledger shows both accrual and payment
                return [
                    {
                        transactionId: transaction.transactionId,
                        date: transaction.date,
                        monthKey,
                        type: 'accrual',
                        category: 'rent',
                        amount: totalDebit,
                        description: description,
                        source: transaction.source,
                        metadata: transaction.metadata,
                        arEntry: {
                            accountCode: arAccountCode,
                            accountName: arEntries[0]?.accountName || `Accounts Receivable`,
                            debit: totalDebit,
                            credit: 0
                        }
                    },
                    {
                        transactionId: transaction.transactionId,
                        date: advancePaymentDate, // Use original payment date, not accrual date
                        monthKey: advancePaymentMonthKey, // Use payment month for proper sorting
                        type: 'payment',
                        category: 'rent',
                        amount: totalCredit,
                        description: description + ' (advance payment applied)',
                        source: transaction.source,
                        metadata: {
                            ...transaction.metadata,
                            originalPaymentDate: advancePaymentDate,
                            isAdvancePaymentAllocation: true
                        },
                        arEntry: {
                            accountCode: arAccountCode,
                            accountName: arEntries[0]?.accountName || `Accounts Receivable`,
                            debit: 0,
                            credit: totalCredit
                        }
                    }
                ];
            }
            
            // Determine transaction type and amount for single-type transactions
            let type = 'unknown';
            let amount = 0;
            
            if (netAmount > 0) {
                // Net debit to AR = Accrual (student owes money)
                type = 'accrual';
                amount = netAmount;
            } else if (netAmount < 0) {
                // Net credit to AR = Payment (student paid money)
                type = 'payment';
                amount = Math.abs(netAmount);
            }
            
            // Determine what type of accrual/payment this is
            let category = 'rent';
            if (transaction.metadata?.type === 'lease_start') {
                if (transaction.metadata?.proratedRent && amount === transaction.metadata.proratedRent) {
                    category = 'rent';
                } else if (transaction.metadata?.adminFee && amount === transaction.metadata.adminFee) {
                    category = 'admin_fee';
                } else if (transaction.metadata?.securityDeposit && amount === transaction.metadata.securityDeposit) {
                    category = 'deposit';
                }
            } else if (transaction.metadata?.type === 'monthly_rent_accrual') {
                category = 'rent';
            } else if (transaction.description?.toLowerCase().includes('admin')) {
                category = 'admin_fee';
            } else if (transaction.description?.toLowerCase().includes('deposit')) {
                category = 'deposit';
            } else if (transaction.description?.toLowerCase().includes('payment')) {
                category = 'payment';
            }
            
            return {
                transactionId: transaction.transactionId,
                date: transaction.date,
                monthKey,
                type,
                category,
                amount,
                description,
                source: transaction.source,
                metadata: transaction.metadata,
                arEntry: {
                    accountCode: arAccountCode,
                    accountName: arEntries[0]?.accountName || `Accounts Receivable`,
                    debit: totalDebit,
                    credit: totalCredit
                }
            };
            
        } catch (error) {
            console.error('❌ Error processing transaction for ledger:', error);
            return null;
        }
    }
    
    /**
     * Get ledger data for multiple debtors
     * @param {Array} debtorIds - Array of debtor IDs
     * @returns {Promise<Object>} Ledger data for all debtors
     */
    static async getMultipleDebtorLedgers(debtorIds) {
        try {
            const results = {};
            
            for (const debtorId of debtorIds) {
                try {
                    // Get student ID from debtor
                    const Debtor = require('../models/Debtor');
                    const debtor = await Debtor.findById(debtorId).populate('user');
                    
                    if (debtor && debtor.user) {
                        const ledgerData = await this.getDebtorLedger(debtorId, debtor.user._id);
                        results[debtorId] = ledgerData;
                    }
                } catch (error) {
                    console.error(`❌ Error getting ledger for debtor ${debtorId}:`, error);
                    results[debtorId] = { error: error.message };
                }
            }
            
            return results;
            
        } catch (error) {
            console.error('❌ Error getting multiple debtor ledgers:', error);
            throw error;
        }
    }
    
    /**
     * Get summary ledger data for all debtors
     * @param {string} residenceId - Optional residence filter
     * @returns {Promise<Object>} Summary ledger data
     */
    static async getAllDebtorLedgersSummary(residenceId = null) {
        try {
            console.log(`📊 Computing ledger summary for all debtors${residenceId ? ` in residence ${residenceId}` : ''}`);
            
            // Get all debtors
            const Debtor = require('../models/Debtor');
            const query = residenceId ? { residence: residenceId } : {};
            const debtors = await Debtor.find(query).populate('user');
            
            console.log(`📊 Found ${debtors.length} debtors`);
            
            const summary = {
                totalDebtors: debtors.length,
                totalExpected: 0,
                totalPaid: 0,
                totalOwing: 0,
                debtors: []
            };
            
            // Process each debtor
            for (const debtor of debtors) {
                if (debtor.user) {
                    try {
                        const ledgerData = await this.getDebtorLedger(debtor._id, debtor.user._id);
                        
                        summary.debtors.push({
                            debtorId: debtor._id,
                            studentId: debtor.user._id,
                            studentName: debtor.user.firstName + ' ' + debtor.user.lastName,
                            debtorCode: debtor.debtorCode,
                            totalExpected: ledgerData.totalExpected,
                            totalPaid: ledgerData.totalPaid,
                            totalOwing: ledgerData.totalOwing,
                            monthlyBreakdown: ledgerData.monthlyBreakdown
                        });
                        
                        summary.totalExpected += ledgerData.totalExpected;
                        summary.totalPaid += ledgerData.totalPaid;
                        summary.totalOwing += ledgerData.totalOwing;
                        
                    } catch (error) {
                        console.error(`❌ Error processing debtor ${debtor._id}:`, error);
                        summary.debtors.push({
                            debtorId: debtor._id,
                            studentId: debtor.user._id,
                            studentName: debtor.user.firstName + ' ' + debtor.user.lastName,
                            debtorCode: debtor.debtorCode,
                            error: error.message
                        });
                    }
                }
            }
            
            console.log(`📊 Summary computed: ${summary.totalDebtors} debtors, Expected=$${summary.totalExpected}, Paid=$${summary.totalPaid}, Owing=$${summary.totalOwing}`);
            
            return summary;
            
        } catch (error) {
            console.error('❌ Error computing ledger summary:', error);
            throw error;
        }
    }
    
    /**
     * Get monthly breakdown for a specific debtor
     * @param {string} debtorId - Debtor ID
     * @param {string} studentId - Student ID
     * @param {string} startMonth - Start month (YYYY-MM)
     * @param {string} endMonth - End month (YYYY-MM)
     * @returns {Promise<Object>} Monthly breakdown data
     */
    static async getDebtorMonthlyBreakdown(debtorId, studentId, startMonth = null, endMonth = null) {
        try {
            const ledgerData = await this.getDebtorLedger(debtorId, studentId);
            
            let monthlyBreakdown = ledgerData.monthlyBreakdown;
            
            // Filter by date range if provided
            if (startMonth || endMonth) {
                const filtered = {};
                Object.keys(monthlyBreakdown).forEach(monthKey => {
                    if ((!startMonth || monthKey >= startMonth) && (!endMonth || monthKey <= endMonth)) {
                        filtered[monthKey] = monthlyBreakdown[monthKey];
                    }
                });
                monthlyBreakdown = filtered;
            }
            
            // Convert to array and sort
            const breakdownArray = Object.values(monthlyBreakdown).sort((a, b) => a.month.localeCompare(b.month));
            
            return {
                debtorId,
                studentId,
                monthlyBreakdown: breakdownArray,
                totalExpected: breakdownArray.reduce((sum, month) => sum + month.expected, 0),
                totalPaid: breakdownArray.reduce((sum, month) => sum + month.paid, 0),
                totalOwing: breakdownArray.reduce((sum, month) => sum + month.owing, 0)
            };
            
        } catch (error) {
            console.error('❌ Error getting monthly breakdown:', error);
            throw error;
        }
    }
}

module.exports = DebtorLedgerService;
