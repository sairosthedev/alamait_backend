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
            
            // Get student-specific AR account code
            const arAccountCode = `1100-${studentId}`;
            
            // Fetch all transactions for this student's AR account
            const transactions = await TransactionEntry.find({
                'entries.accountCode': arAccountCode,
                status: { $nin: ['reversed', 'draft'] }
            })
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
            transactions.forEach(transaction => {
                const processedTransaction = this.processTransactionForLedger(transaction, arAccountCode);
                if (processedTransaction) {
                    ledgerData.transactions.push(processedTransaction);
                    
                    // Add to monthly breakdown
                    const monthKey = processedTransaction.monthKey;
                    if (!ledgerData.monthlyBreakdown[monthKey]) {
                        ledgerData.monthlyBreakdown[monthKey] = {
                            month: monthKey,
                            expected: 0,
                            paid: 0,
                            owing: 0,
                            transactions: []
                        };
                    }
                    
                    ledgerData.monthlyBreakdown[monthKey].transactions.push(processedTransaction);
                    
                    if (processedTransaction.type === 'accrual') {
                        ledgerData.monthlyBreakdown[monthKey].expected += processedTransaction.amount;
                        ledgerData.totalExpected += processedTransaction.amount;
                    } else if (processedTransaction.type === 'payment') {
                        ledgerData.monthlyBreakdown[monthKey].paid += processedTransaction.amount;
                        ledgerData.totalPaid += processedTransaction.amount;
                    }
                }
            });
            
            // Calculate owing amounts
            Object.values(ledgerData.monthlyBreakdown).forEach(month => {
                month.owing = Math.max(month.expected - month.paid, 0);
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
     * @returns {Object|null} Processed transaction data
     */
    static processTransactionForLedger(transaction, arAccountCode) {
        try {
            // Find the AR account entry in this transaction
            const arEntry = transaction.entries.find(entry => entry.accountCode === arAccountCode);
            if (!arEntry) {
                return null;
            }
            
            const transactionDate = new Date(transaction.date);
            const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
            
            // Determine transaction type and amount
            let type = 'unknown';
            let amount = 0;
            let description = transaction.description || 'Transaction';
            
            if (arEntry.debit > 0) {
                // Debit to AR = Accrual (student owes money)
                type = 'accrual';
                amount = arEntry.debit;
            } else if (arEntry.credit > 0) {
                // Credit to AR = Payment (student paid money)
                type = 'payment';
                amount = arEntry.credit;
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
                    accountCode: arEntry.accountCode,
                    accountName: arEntry.accountName,
                    debit: arEntry.debit,
                    credit: arEntry.credit
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
