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
                            // This is expected amount (accrual)
                            totalOwed += entry.debit || 0;
                        } else if (transaction.source === 'payment') {
                            // This is payment received
                            totalPaid += entry.credit || 0;
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
