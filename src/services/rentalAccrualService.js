const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Debtor = require('../models/Debtor');
const User = require('../models/User');
const Residence = require('../models/Residence');
const Lease = require('../models/Lease');

/**
 * Rental Accrual Service
 * 
 * Implements proper accrual accounting for rental income:
 * - Automatically records rental income when earned (lease start date)
 * - Creates Accounts Receivable entries for unpaid amounts
 * - Handles lease periods from start to end dates
 * - Supports monthly, quarterly, semester, and annual billing cycles
 * 
 * This ensures rental income appears in the correct accounting period
 * regardless of when payment is actually received.
 */

class RentalAccrualService {
    
    /**
     * ACCRUE RENTAL INCOME FOR A LEASE
     * 
     * This is the core method that implements accrual accounting:
     * - Records rental income when earned (lease start)
     * - Creates Accounts Receivable for the student
     * - Handles the entire lease period
     */
    static async accrueRentalIncomeForLease(leaseId, user) {
        try {
            console.log(`🏠 Starting rental income accrual for lease: ${leaseId}`);
            
            // Get lease details
            const lease = await Lease.findById(leaseId)
                .populate('student', 'firstName lastName email')
                .populate('residence', 'name')
                .populate('room', 'name price');
            
            if (!lease) {
                throw new Error('Lease not found');
            }
            
            if (!lease.startDate || !lease.endDate) {
                throw new Error('Lease must have start and end dates');
            }
            
            console.log(`📅 Lease period: ${lease.startDate} to ${lease.endDate}`);
            console.log(`💰 Monthly rent: $${lease.rent || lease.room?.price}`);
            
            // Calculate billing periods
            const billingPeriods = this.calculateBillingPeriods(
                lease.startDate, 
                lease.endDate, 
                lease.billingCycle || 'monthly'
            );
            
            console.log(`📊 Generated ${billingPeriods.length} billing periods`);
            
            // Get or create debtor account for student
            const debtor = await this.getOrCreateDebtor(lease.student._id, {
                residence: lease.residence._id,
                roomNumber: lease.room?.name,
                startDate: lease.startDate,
                endDate: lease.endDate,
                roomPrice: lease.rent || lease.room?.price
            });
            
            // Record accrual for each billing period
            const accrualResults = [];
            for (const period of billingPeriods) {
                const result = await this.recordPeriodAccrual(
                    lease, 
                    period, 
                    debtor, 
                    user
                );
                accrualResults.push(result);
            }
            
            console.log(`✅ Rental income accrual completed for ${accrualResults.length} periods`);
            
            return {
                success: true,
                lease: lease._id,
                student: lease.student._id,
                periodsAccrued: accrualResults.length,
                totalAccrued: accrualResults.reduce((sum, r) => sum + r.amount, 0),
                results: accrualResults
            };
            
        } catch (error) {
            console.error('❌ Error accruing rental income:', error);
            throw error;
        }
    }
    
    /**
     * CALCULATE BILLING PERIODS
     * 
     * Breaks down lease period into individual billing periods
     * based on billing cycle (monthly, quarterly, etc.)
     */
    static calculateBillingPeriods(startDate, endDate, billingCycle = 'monthly') {
        const periods = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        let currentPeriodStart = new Date(start);
        
        while (currentPeriodStart < end) {
            let currentPeriodEnd;
            
            switch (billingCycle.toLowerCase()) {
                case 'monthly':
                    currentPeriodEnd = new Date(currentPeriodStart);
                    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
                    break;
                    
                case 'quarterly':
                    currentPeriodEnd = new Date(currentPeriodStart);
                    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 3);
                    break;
                    
                case 'semester':
                    currentPeriodEnd = new Date(currentPeriodStart);
                    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 6);
                    break;
                    
                case 'annual':
                    currentPeriodEnd = new Date(currentPeriodStart);
                    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
                    break;
                    
                default:
                    currentPeriodEnd = new Date(currentPeriodStart);
                    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
            }
            
            // Ensure period doesn't exceed lease end
            if (currentPeriodEnd > end) {
                currentPeriodEnd = new Date(end);
            }
            
            periods.push({
                startDate: new Date(currentPeriodStart),
                endDate: new Date(currentPeriodEnd),
                periodNumber: periods.length + 1,
                daysInPeriod: Math.ceil((currentPeriodEnd - currentPeriodStart) / (1000 * 60 * 60 * 24))
            });
            
            currentPeriodStart = new Date(currentPeriodEnd);
        }
        
        return periods;
    }
    
    /**
     * RECORD PERIOD ACCRUAL
     * 
     * Creates the double-entry transaction for a specific billing period:
     * - Debit: Accounts Receivable (Student owes money)
     * - Credit: Rental Income (Income earned)
     */
    static async recordPeriodAccrual(lease, period, debtor, user) {
        try {
            const monthlyRent = lease.rent || lease.room?.price || 0;
            const daysInMonth = 30.44; // Average days per month
            const periodAmount = (monthlyRent / daysInMonth) * period.daysInPeriod;
            
            console.log(`📝 Recording accrual for period ${period.periodNumber}: $${periodAmount.toFixed(2)}`);
            
            // Get required accounts
            const accountsReceivable = await Account.findOne({ code: '1100' }); // Accounts Receivable
            const rentalIncome = await Account.findOne({ code: '4000' }); // Rental Income
            
            if (!accountsReceivable || !rentalIncome) {
                throw new Error('Required accounts not found: Accounts Receivable (1100) or Rental Income (4000)');
            }
            
            // Create transaction entry
            const transactionEntry = new TransactionEntry({
                transactionId: `RENTAL_ACCRUAL_${lease._id}_${period.periodNumber}_${Date.now()}`,
                date: period.startDate, // Key: Use period start date for accrual
                description: `Rental income accrual: ${lease.student.firstName} ${lease.student.lastName} - ${period.startDate.toLocaleDateString()} to ${period.endDate.toLocaleDateString()}`,
                reference: lease._id.toString(),
                source: 'rental_accrual',
                sourceId: lease._id,
                sourceModel: 'Lease',
                createdBy: user.email,
                status: 'posted',
                metadata: {
                    leaseId: lease._id,
                    studentId: lease.student._id,
                    residenceId: lease.residence._id,
                    roomId: lease.room?._id,
                    periodNumber: period.periodNumber,
                    periodStart: period.startDate,
                    periodEnd: period.endDate,
                    billingCycle: lease.billingCycle || 'monthly',
                    accrualType: 'rental_income'
                }
            });
            
            // Create double-entry accounting entries
            const entries = [
                // Debit: Accounts Receivable (Student owes money)
                {
                    accountCode: accountsReceivable.code,
                    accountName: accountsReceivable.name,
                    accountType: accountsReceivable.type,
                    debit: periodAmount,
                    credit: 0,
                    description: `Rent due from ${lease.student.firstName} ${lease.student.lastName} for ${period.startDate.toLocaleDateString()} to ${period.endDate.toLocaleDateString()}`
                },
                // Credit: Rental Income (Income earned)
                {
                    accountCode: rentalIncome.code,
                    accountName: rentalIncome.name,
                    accountType: rentalIncome.type,
                    debit: 0,
                    credit: periodAmount,
                    description: `Rental income earned from ${lease.student.firstName} ${lease.student.lastName} for ${period.startDate.toLocaleDateString()} to ${period.endDate.toLocaleDateString()}`
                }
            ];
            
            transactionEntry.entries = entries;
            transactionEntry.totalDebit = periodAmount;
            transactionEntry.totalCredit = periodAmount;
            
            await transactionEntry.save();
            
            // Update debtor balance
            await debtor.addCharge(periodAmount, `Rent for ${period.startDate.toLocaleDateString()} to ${period.endDate.toLocaleDateString()}`);
            
            console.log(`✅ Period ${period.periodNumber} accrual recorded: $${periodAmount.toFixed(2)}`);
            
            return {
                periodNumber: period.periodNumber,
                startDate: period.startDate,
                endDate: period.endDate,
                amount: periodAmount,
                transactionEntryId: transactionEntry._id,
                debtorBalance: debtor.currentBalance
            };
            
        } catch (error) {
            console.error(`❌ Error recording period accrual:`, error);
            throw error;
        }
    }
    
    /**
     * GET OR CREATE DEBTOR
     * 
     * Ensures student has a debtor account for tracking outstanding balances
     */
    static async getOrCreateDebtor(studentId, options = {}) {
        try {
            let debtor = await Debtor.findOne({ user: studentId });
            
            if (!debtor) {
                console.log(`👤 Creating new debtor account for student: ${studentId}`);
                
                const user = await User.findById(studentId);
                if (!user) {
                    throw new Error('Student user not found');
                }
                
                debtor = new Debtor({
                    debtorCode: `STU_${studentId}_${Date.now()}`,
                    user: studentId,
                    accountCode: '1100', // Accounts Receivable
                    status: 'active',
                    residence: options.residence,
                    roomNumber: options.roomNumber,
                    startDate: options.startDate,
                    endDate: options.endDate,
                    roomPrice: options.roomPrice,
                    paymentTerms: 'monthly'
                });
                
                await debtor.save();
                console.log(`✅ Debtor account created: ${debtor.debtorCode}`);
            } else {
                console.log(`👤 Using existing debtor account: ${debtor.debtorCode}`);
            }
            
            return debtor;
            
        } catch (error) {
            console.error('❌ Error getting/creating debtor:', error);
            throw error;
        }
    }
    
    /**
     * REVERSE ACCRUAL
     * 
     * Reverses a rental accrual (e.g., if lease is cancelled)
     */
    static async reverseAccrual(transactionEntryId, user) {
        try {
            console.log(`🔄 Reversing rental accrual: ${transactionEntryId}`);
            
            const transactionEntry = await TransactionEntry.findById(transactionEntryId);
            if (!transactionEntry) {
                throw new Error('Transaction entry not found');
            }
            
            if (transactionEntry.source !== 'rental_accrual') {
                throw new Error('Transaction entry is not a rental accrual');
            }
            
            // Create reversal transaction
            const reversalEntry = new TransactionEntry({
                transactionId: `REVERSAL_${transactionEntry.transactionId}_${Date.now()}`,
                date: new Date(),
                description: `Reversal of rental accrual: ${transactionEntry.description}`,
                reference: transactionEntry._id.toString(),
                source: 'rental_accrual_reversal',
                sourceId: transactionEntry._id,
                sourceModel: 'TransactionEntry',
                createdBy: user.email,
                status: 'posted',
                metadata: {
                    originalTransactionId: transactionEntry._id,
                    reversalType: 'rental_accrual',
                    originalAmount: transactionEntry.totalDebit
                }
            });
            
            // Reverse the original entries
            const reversalEntries = transactionEntry.entries.map(entry => ({
                accountCode: entry.accountCode,
                accountName: entry.accountName,
                accountType: entry.accountType,
                debit: entry.credit, // Reverse debit/credit
                credit: entry.debit,  // Reverse credit/debit
                description: `Reversal: ${entry.description}`
            }));
            
            reversalEntry.entries = reversalEntries;
            reversalEntry.totalDebit = transactionEntry.totalCredit;
            reversalEntry.totalCredit = transactionEntry.totalDebit;
            
            await reversalEntry.save();
            
            // Update debtor balance if applicable
            if (transactionEntry.metadata?.studentId) {
                const debtor = await Debtor.findOne({ user: transactionEntry.metadata.studentId });
                if (debtor) {
                    const originalAmount = transactionEntry.totalDebit;
                    await debtor.addPayment(originalAmount, `Reversal of rental accrual`);
                }
            }
            
            console.log(`✅ Rental accrual reversed successfully`);
            
            return {
                success: true,
                originalTransactionId: transactionEntry._id,
                reversalTransactionId: reversalEntry._id,
                reversedAmount: transactionEntry.totalDebit
            };
            
        } catch (error) {
            console.error('❌ Error reversing accrual:', error);
            throw error;
        }
    }
    
    /**
     * GET ACCRUAL SUMMARY
     * 
     * Provides summary of all rental accruals for reporting
     */
    static async getAccrualSummary(period, residenceId = null) {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            const filter = {
                source: 'rental_accrual',
                date: { $gte: startDate, $lte: endDate }
            };
            
            if (residenceId) {
                filter.metadata = { residenceId: residenceId };
            }
            
            const accruals = await TransactionEntry.find(filter)
                .populate('metadata.studentId', 'firstName lastName email')
                .populate('metadata.residenceId', 'name')
                .sort({ date: 1 });
            
            const summary = {
                period: period,
                totalAccrued: 0,
                totalReversed: 0,
                netAccrued: 0,
                byMonth: {},
                byResidence: {},
                byStudent: {}
            };
            
            // Process accruals
            accruals.forEach(accrual => {
                if (accrual.source === 'rental_accrual') {
                    summary.totalAccrued += accrual.totalDebit;
                    
                    // By month
                    const month = accrual.date.getMonth();
                    if (!summary.byMonth[month]) {
                        summary.byMonth[month] = { accrued: 0, reversed: 0, net: 0 };
                    }
                    summary.byMonth[month].accrued += accrual.totalDebit;
                    
                    // By residence
                    const residenceId = accrual.metadata?.residenceId?._id || 'Unknown';
                    if (!summary.byResidence[residenceId]) {
                        summary.byResidence[residenceId] = { 
                            name: accrual.metadata?.residenceId?.name || 'Unknown',
                            accrued: 0, reversed: 0, net: 0 
                        };
                    }
                    summary.byResidence[residenceId].accrued += accrual.totalDebit;
                    
                    // By student
                    const studentId = accrual.metadata?.studentId?._id || 'Unknown';
                    if (!summary.byStudent[studentId]) {
                        summary.byStudent[studentId] = { 
                            name: `${accrual.metadata?.studentId?.firstName || ''} ${accrual.metadata?.studentId?.lastName || ''}`.trim() || 'Unknown',
                            accrued: 0, reversed: 0, net: 0 
                        };
                    }
                    summary.byStudent[studentId].accrued += accrual.totalDebit;
                }
            });
            
            // Process reversals
            const reversals = await TransactionEntry.find({
                source: 'rental_accrual_reversal',
                date: { $gte: startDate, $lte: endDate }
            });
            
            reversals.forEach(reversal => {
                summary.totalReversed += reversal.totalDebit;
            });
            
            summary.netAccrued = summary.totalAccrued - summary.totalReversed;
            
            return summary;
            
        } catch (error) {
            console.error('❌ Error getting accrual summary:', error);
            throw error;
        }
    }
}

module.exports = RentalAccrualService;
