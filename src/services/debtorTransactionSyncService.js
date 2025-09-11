const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Debtor = require('../models/Debtor');

class DebtorTransactionSyncService {
    /**
     * Recalculate debtor totals from transaction entries
     * @param {Object} debtor - Debtor document
     * @param {string} studentId - Student ID
     */
    static async recalculateDebtorTotalsFromTransactionEntries(debtor, studentId) {
        try {
            console.log(`🔄 Recalculating totals from transaction entries for debtor: ${debtor.debtorCode}`);
            
            // Get all transaction entries for this debtor's account
            const transactionEntries = await TransactionEntry.find({
                'entries.accountCode': debtor.accountCode
            }).sort({ date: 1 });
            
            let totalOwed = 0;
            let totalPaid = 0;
            
            // Process each transaction entry
            transactionEntries.forEach(transaction => {
                // Process each entry in the transaction
                transaction.entries.forEach(entry => {
                    if (entry.accountCode === debtor.accountCode) {
                        if (transaction.source === 'rental_accrual') {
                            // This is expected amount (accrual) - increases total owed
                            totalOwed += entry.debit || 0;
                        } else if (transaction.source === 'payment') {
                            // This is payment received - increases total paid
                            totalPaid += entry.credit || 0;
                        } else if (transaction.source === 'manual') {
                            // Handle manual transactions (negotiations, reversals, etc.)
                            if (transaction.metadata?.type === 'negotiated_payment_adjustment') {
                                // Negotiated payment reduces total owed
                                totalOwed -= entry.credit || 0; // Credit to AR reduces what's owed
                            } else if (transaction.metadata?.type === 'security_deposit_reversal') {
                                // Security deposit reversal reduces total owed
                                totalOwed -= entry.credit || 0; // Credit to AR reduces what's owed
                            } else {
                                // Other manual transactions - treat credits as reducing owed, debits as increasing owed
                                totalOwed += (entry.debit || 0) - (entry.credit || 0);
                            }
                        }
                    }
                });
            });
            
            // Calculate current balance
            const currentBalance = Math.max(0, totalOwed - totalPaid);
            
            // Update debtor totals
            debtor.totalOwed = totalOwed;
            debtor.totalPaid = totalPaid;
            debtor.currentBalance = currentBalance;
            debtor.overdueAmount = currentBalance > 0 ? currentBalance : 0;
            debtor.updatedAt = new Date();
            
            // Update financial breakdown to reflect current totals
            if (debtor.financialBreakdown) {
                debtor.financialBreakdown.totalOwed = totalOwed;
            }
            
            // Update billing period total to reflect current totals
            if (debtor.billingPeriod && debtor.billingPeriod.amount) {
                debtor.billingPeriod.amount.total = totalOwed;
            }
            
            // Update monthsAccrued to reflect actual current amounts
            await this.updateMonthsAccruedFromTransactions(debtor, transactionEntries);
            
            // Update status based on calculated balance and payment timeline
            debtor.status = this.determineDebtorStatus(currentBalance, transactionEntries);
            
            console.log(`✅ Totals recalculated from transaction entries:`);
            console.log(`   Total Owed: $${totalOwed.toFixed(2)}`);
            console.log(`   Total Paid: $${totalPaid.toFixed(2)}`);
            console.log(`   Current Balance: $${currentBalance.toFixed(2)}`);
            console.log(`   Status: ${debtor.status}`);
            
            return {
                totalOwed,
                totalPaid,
                currentBalance,
                transactionCount: transactionEntries.length
            };
            
        } catch (error) {
            console.error(`❌ Error recalculating totals from transaction entries:`, error);
            throw error;
        }
    }
    
    /**
     * Update monthsAccrued data to reflect actual current amounts from transactions
     * @param {Object} debtor - Debtor document
     * @param {Array} transactionEntries - Array of transaction entries
     */
    static async updateMonthsAccruedFromTransactions(debtor, transactionEntries) {
        try {
            console.log(`🔄 Updating monthsAccrued from transaction entries for debtor: ${debtor.debtorCode}`);
            
            // Group transactions by month and calculate actual amounts
            const monthlyData = {};
            
            transactionEntries.forEach(transaction => {
                // Use accrual month/year from metadata if available, otherwise use transaction date
                let monthKey;
                if (transaction.metadata?.accrualMonth && transaction.metadata?.accrualYear) {
                    monthKey = `${transaction.metadata.accrualYear}-${String(transaction.metadata.accrualMonth).padStart(2, '0')}`;
                } else if (transaction.metadata?.monthSettled) {
                    // Use monthSettled for payment transactions
                    monthKey = transaction.metadata.monthSettled;
                } else if (transaction.metadata?.month) {
                    // Use month field if available
                    monthKey = transaction.metadata.month;
                } else if (transaction.metadata?.type === 'security_deposit_reversal') {
                    // For security deposit reversals, find the original lease start month
                    const originalTransactionId = transaction.metadata?.originalTransactionId;
                    if (originalTransactionId) {
                        const originalTransaction = transactionEntries.find(t => t.transactionId === originalTransactionId);
                        if (originalTransaction && originalTransaction.metadata?.accrualMonth && originalTransaction.metadata?.accrualYear) {
                            monthKey = `${originalTransaction.metadata.accrualYear}-${String(originalTransaction.metadata.accrualMonth).padStart(2, '0')}`;
                        } else {
                            // Fallback to transaction date
                            const transactionDate = new Date(transaction.date);
                            monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
                        }
                    } else {
                        // Fallback to transaction date
                        const transactionDate = new Date(transaction.date);
                        monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
                    }
                } else {
                    const transactionDate = new Date(transaction.date);
                    monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
                }
                
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = {
                        month: monthKey,
                        amount: 0,
                        transactionCount: 0,
                        transactions: [],
                        isLeaseStartMonth: false,
                        isProrated: false
                    };
                }
                
                // Process each entry in the transaction
                transaction.entries.forEach(entry => {
                    if (entry.accountCode === debtor.accountCode) {
                        if (transaction.source === 'rental_accrual') {
                            // This is expected amount (accrual) - increases amount
                            monthlyData[monthKey].amount += entry.debit || 0;
                        } else if (transaction.source === 'manual') {
                            // Handle manual transactions (negotiations, reversals, etc.)
                            if (transaction.metadata?.type === 'negotiated_payment_adjustment') {
                                // Negotiated payment reduces amount
                                monthlyData[monthKey].amount -= entry.credit || 0;
                            } else if (transaction.metadata?.type === 'security_deposit_reversal') {
                                // Security deposit reversal reduces amount
                                monthlyData[monthKey].amount -= entry.credit || 0;
                            } else {
                                // Other manual transactions
                                monthlyData[monthKey].amount += (entry.debit || 0) - (entry.credit || 0);
                            }
                        }
                    }
                });
                
                // Add transaction to the month's transaction list
                monthlyData[monthKey].transactions.push({
                    transactionId: transaction.transactionId,
                    amount: transaction.totalDebit || 0,
                    date: transaction.date,
                    type: transaction.metadata?.type || transaction.source
                });
                
                monthlyData[monthKey].transactionCount++;
                
                // Check if this is a lease start month
                if (transaction.metadata?.type === 'lease_start') {
                    monthlyData[monthKey].isLeaseStartMonth = true;
                    monthlyData[monthKey].isProrated = transaction.metadata?.isProrated || false;
                }
            });
            
            // Update debtor's monthsAccrued array
            debtor.monthsAccrued = Object.values(monthlyData).map(monthData => ({
                month: monthData.month,
                amount: Math.max(0, monthData.amount), // Ensure non-negative
                transactionCount: monthData.transactionCount,
                isLeaseStartMonth: monthData.isLeaseStartMonth,
                isProrated: monthData.isProrated,
                transactions: monthData.transactions
            }));
            
            // Update monthsAccruedSummary
            if (debtor.monthsAccrued.length > 0) {
                const sortedAccrued = debtor.monthsAccrued.sort((a, b) => a.month.localeCompare(b.month));
                debtor.monthsAccruedSummary = {
                    totalMonths: sortedAccrued.length,
                    totalAmount: sortedAccrued.reduce((sum, month) => sum + month.amount, 0),
                    firstMonth: sortedAccrued[0].month,
                    lastMonth: sortedAccrued[sortedAccrued.length - 1].month,
                    averageAmount: sortedAccrued.reduce((sum, month) => sum + month.amount, 0) / sortedAccrued.length,
                    leaseStartMonth: sortedAccrued.find(m => m.isLeaseStartMonth)?.month || null,
                    leaseEndMonth: debtor.endDate ? this.getMonthFromDate(debtor.endDate) : null,
                    expectedMonthsFromLease: debtor.startDate && debtor.endDate ? 
                        this.getMonthsBetween(debtor.startDate, debtor.endDate) : 0
                };
            }
            
            console.log(`✅ MonthsAccrued updated: ${debtor.monthsAccrued.length} months, total: $${debtor.monthsAccruedSummary?.totalAmount || 0}`);
            
        } catch (error) {
            console.error(`❌ Error updating monthsAccrued from transactions:`, error);
        }
    }
    
    /**
     * Get month key from date (YYYY-MM format)
     */
    static getMonthFromDate(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    
    /**
     * Get number of months between two dates
     */
    static getMonthsBetween(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    }
    
    /**
     * Determine debtor status based on balance and payment timeline
     * @param {number} currentBalance - Current outstanding balance
     * @param {Array} transactionEntries - Array of transaction entries
     * @returns {string} Status: 'paid', 'active', or 'overdue'
     */
    static determineDebtorStatus(currentBalance, transactionEntries) {
        try {
            // If no balance, status is paid
            if (currentBalance === 0) {
                return 'paid';
            }
            
            // If there's a balance, check if any charges are past due
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // Find the oldest unpaid charge
            let oldestUnpaidCharge = null;
            let hasOverdueCharges = false;
            
            // Group transactions by month to analyze payment timeline
            const monthlyCharges = {};
            
            transactionEntries.forEach(transaction => {
                if (transaction.source === 'rental_accrual' && transaction.metadata?.type) {
                    const monthKey = transaction.metadata.month || (() => {
                        const d = new Date(transaction.date);
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    })();
                    
                    if (!monthlyCharges[monthKey]) {
                        monthlyCharges[monthKey] = {
                            monthKey,
                            amount: 0,
                            date: new Date(transaction.date),
                            isLeaseStart: transaction.metadata.type === 'lease_start'
                        };
                    }
                    
                    monthlyCharges[monthKey].amount += transaction.totalDebit;
                }
            });
            
            // Check each month's charges
            Object.values(monthlyCharges).forEach(charge => {
                // Calculate due date (end of the month + grace period)
                const dueDate = new Date(charge.date);
                dueDate.setMonth(dueDate.getMonth() + 1); // Due at end of next month
                dueDate.setDate(0); // Last day of the month
                
                // Add 7-day grace period
                dueDate.setDate(dueDate.getDate() + 7);
                
                // If charge is past due and still outstanding
                if (dueDate < now && charge.amount > 0) {
                    hasOverdueCharges = true;
                    if (!oldestUnpaidCharge || charge.date < oldestUnpaidCharge.date) {
                        oldestUnpaidCharge = charge;
                    }
                }
            });
            
            // Determine status based on overdue charges
            if (hasOverdueCharges) {
                return 'overdue';
            } else if (currentBalance > 0) {
                return 'active'; // Has balance but not overdue yet
            } else {
                return 'paid';
            }
            
        } catch (error) {
            console.error(`❌ Error determining debtor status:`, error);
            // Fallback to simple logic
            return currentBalance === 0 ? 'paid' : 'active';
        }
    }
    
    /**
     * Update debtor from accrual transaction
     * @param {Object} transactionEntry - Transaction entry document
     * @param {string} studentId - Student ID
     * @param {number} amount - Accrual amount
     * @param {string} monthKey - Month key (YYYY-MM)
     * @param {Object} metadata - Additional metadata
     */
    static async updateDebtorFromAccrual(transactionEntry, studentId, amount, monthKey, metadata) {
        try {
            console.log(`🔄 Updating debtor from accrual for student: ${studentId}, month: ${monthKey}`);
            
            // Find the debtor for this student
            const debtor = await Debtor.findOne({ user: studentId });
            if (!debtor) {
                console.log(`⚠️ No debtor found for student: ${studentId}`);
                return { success: false, error: 'Debtor not found' };
            }
            
            // Recalculate totals from all transaction entries
            await this.recalculateDebtorTotalsFromTransactionEntries(debtor, studentId);
            
            // Save the updated debtor
            await debtor.save();
            
            console.log(`✅ Debtor updated from accrual: ${debtor.debtorCode}`);
            console.log(`   Total Owed: $${debtor.totalOwed}`);
            console.log(`   Current Balance: $${debtor.currentBalance}`);
            
            return { success: true, debtor };
            
        } catch (error) {
            console.error(`❌ Error updating debtor from accrual:`, error);
            throw error;
        }
    }
    
    /**
     * Update debtor from payment transaction
     * @param {Object} transactionEntry - Transaction entry document
     * @param {string} studentId - Student ID
     * @param {number} amount - Payment amount
     * @param {string} monthKey - Month key (YYYY-MM)
     * @param {Object} metadata - Additional metadata
     */
    static async updateDebtorFromPayment(transactionEntry, studentId, amount, monthKey, metadata) {
        try {
            console.log(`🔄 Updating debtor from payment for student: ${studentId}, month: ${monthKey}`);
            
            // Find the debtor for this student
            const debtor = await Debtor.findOne({ user: studentId });
            if (!debtor) {
                console.log(`⚠️ No debtor found for student: ${studentId}`);
                return { success: false, error: 'Debtor not found' };
            }
            
            // Recalculate totals from all transaction entries
            await this.recalculateDebtorTotalsFromTransactionEntries(debtor, studentId);
            
            // Save the updated debtor
            await debtor.save();
            
            console.log(`✅ Debtor updated from payment: ${debtor.debtorCode}`);
            console.log(`   Total Paid: $${debtor.totalPaid}`);
            console.log(`   Current Balance: $${debtor.currentBalance}`);
            
            return { success: true, debtor };
            
        } catch (error) {
            console.error(`❌ Error updating debtor from payment:`, error);
            throw error;
        }
    }
    
    /**
     * Force recalculation for all debtors
     */
    static async recalculateAllDebtorTotals() {
        try {
            console.log(`🔄 Starting recalculation for all debtors...`);
            
            const debtors = await Debtor.find({});
            
            let processedCount = 0;
            let errorCount = 0;
            
            for (const debtor of debtors) {
                try {
                    await this.recalculateDebtorTotalsFromTransactionEntries(debtor, debtor.user);
                    await debtor.save();
                    processedCount++;
                    
                    if (processedCount % 10 === 0) {
                        console.log(`   Processed ${processedCount}/${debtors.length} debtors...`);
                    }
        } catch (error) {
                    console.error(`❌ Error processing debtor ${debtor.debtorCode}:`, error.message);
                    errorCount++;
                }
            }
            
            console.log(`✅ Recalculation completed:`);
            console.log(`   Successfully processed: ${processedCount} debtors`);
            console.log(`   Errors: ${errorCount} debtors`);
            
            return { processedCount, errorCount };
            
        } catch (error) {
            console.error(`❌ Error in bulk recalculation:`, error);
            throw error;
        }
    }
}

module.exports = DebtorTransactionSyncService;
