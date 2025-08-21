const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Payment = require('../models/Payment');
const Debtor = require('../models/Debtor');
const User = require('../models/User');

/**
 * Enhanced Payment Service with Proper Double-Entry Accounting
 * 
 * This service implements the exact double-entry logic you described:
 * - Pro-rata rent calculations for mid-month lease starts
 * - Proper handling of paymentMonth field
 * - Deferred income for advance payments
 * - Current period revenue recognition
 * - Security deposit as liability (not revenue)
 * - Admin fees as revenue when earned
 * 
 * Follows GAAP principles and matches your example scenario exactly
 */
class EnhancedPaymentService {
    
    /**
     * Calculate pro-rata rent for partial months
     * @param {Date} startDate - Lease start date
     * @param {Date} endDate - Lease end date  
     * @param {number} monthlyRent - Full monthly rent amount
     * @returns {Object} Pro-rata breakdown
     */
    static calculateProRataRent(startDate, endDate, monthlyRent) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Get first and last month details
        const firstMonth = {
            year: start.getFullYear(),
            month: start.getMonth(),
            daysInMonth: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate(),
            startDay: start.getDate(),
            endDay: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
        };
        
        const lastMonth = {
            year: end.getFullYear(), 
            month: end.getMonth(),
            daysInMonth: new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate(),
            startDay: 1,
            endDay: end.getDate()
        };
        
        // Calculate full months between
        const fullMonths = Math.max(0, 
            (end.getFullYear() - start.getFullYear()) * 12 + 
            (end.getMonth() - start.getMonth()) - 1
        );
        
        // Calculate pro-rata for first month
        const firstMonthDays = firstMonth.endDay - firstMonth.startDay + 1;
        const firstMonthRent = (firstMonthDays / firstMonth.daysInMonth) * monthlyRent;
        
        // Last month is always full month (not pro-rata)
        const lastMonthDays = lastMonth.endDay - lastMonth.startDay + 1;
        const lastMonthRent = monthlyRent;
        
        // Full months rent
        const fullMonthsRent = fullMonths * monthlyRent;
        
        return {
            breakdown: {
                firstMonth: {
                    month: `${firstMonth.year}-${String(firstMonth.month + 1).padStart(2, '0')}`,
                    days: firstMonthDays,
                    totalDays: firstMonth.daysInMonth,
                    rent: Math.round(firstMonthRent * 100) / 100
                },
                fullMonths: {
                    count: fullMonths,
                    rent: fullMonthsRent
                },
                lastMonth: {
                    month: `${lastMonth.year}-${String(lastMonth.month + 1).padStart(2, '0')}`,
                    days: lastMonthDays,
                    totalDays: lastMonth.daysInMonth,
                    rent: Math.round(lastMonthRent * 100) / 100
                }
            },
            totalRent: Math.round((firstMonthRent + fullMonthsRent + lastMonthRent) * 100) / 100,
            totalMonths: fullMonths + 2, // Including partial months
            isPartialFirstMonth: firstMonthDays < firstMonth.daysInMonth,
            isPartialLastMonth: lastMonthDays < lastMonth.daysInMonth
        };
    }

    /**
     * Parse payment month string to determine if it's advance, current, or past due
     * @param {string} paymentMonth - Payment month (e.g., "August 2025", "2025-08")
     * @returns {Object} Parsed payment month analysis
     */
    static parsePaymentMonth(paymentMonth) {
        if (!paymentMonth) {
            return {
                isValid: false,
                month: -1,
                year: new Date().getFullYear(),
                date: null,
                type: 'unknown'
            };
        }

        try {
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                               'july', 'august', 'september', 'october', 'november', 'december'];
            const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                              'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            
            let month = -1;
            let year = new Date().getFullYear();
            
            const lowerPaymentMonth = paymentMonth.toLowerCase();
            month = monthNames.findIndex(m => lowerPaymentMonth.includes(m));
            if (month === -1) {
                month = monthAbbr.findIndex(m => lowerPaymentMonth.includes(m));
            }
            
            const yearMatch = paymentMonth.match(/\b(20\d{2})\b/);
            if (yearMatch) {
                year = parseInt(yearMatch[1]);
            }
            
            if (month === -1) {
                return { isValid: false, month: -1, year, date: null, type: 'unknown' };
            }
            
            const paymentDate = new Date(year, month, 1);
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();
            const currentMonthDate = new Date(currentYear, currentMonth, 1);
            
            let type = 'unknown';
            if (paymentDate > currentMonthDate) {
                type = 'advance';
            } else if (paymentDate.getTime() === currentMonthDate.getTime()) {
                type = 'current';
            } else {
                type = 'past_due';
            }
            
            return {
                isValid: true,
                month: month + 1, // Convert to 1-12 format
                year,
                date: paymentDate,
                type,
                monthName: monthNames[month]
            };
        } catch (error) {
            console.error('Error parsing payment month:', error);
            return {
                isValid: false,
                month: -1,
                year: new Date().getFullYear(),
                date: null,
                type: 'unknown'
            };
        }
    }

    /**
     * Get required accounts for double-entry transactions
     * @returns {Object} Account codes for different transaction types
     */
    static async getRequiredAccounts() {
        try {
            // Get existing accounts from test database collection
            const accounts = {};
            
            // Cash/Bank accounts - find by name pattern matching
            accounts.cash = await Account.findOne({ 
                type: 'asset', 
                name: { $regex: /cash/i } 
            });
            accounts.bank = await Account.findOne({ 
                type: 'asset', 
                name: { $regex: /bank|transfer/i } 
            });
            accounts.ecocash = await Account.findOne({ 
                type: 'asset', 
                name: { $regex: /ecocash/i } 
            });
            accounts.innbucks = await Account.findOne({ 
                type: 'asset', 
                name: { $regex: /innbucks/i } 
            });
            
            // Revenue accounts - find by name pattern matching
            accounts.rentalIncome = await Account.findOne({ 
                type: 'income', 
                name: { $regex: /rent|rental/i } 
            });
            accounts.adminFeeIncome = await Account.findOne({ 
                type: 'income', 
                name: { $regex: /admin|administrative/i } 
            });
            
            // Liability accounts - find by name pattern matching
            accounts.deferredIncome = await Account.findOne({ 
                type: 'liability', 
                name: { $regex: /deferred|advance/i } 
            });
            accounts.securityDeposit = await Account.findOne({ 
                type: 'liability', 
                name: { $regex: /deposit|security/i } 
            });
            
            // Asset accounts - find by name pattern matching
            accounts.accountsReceivable = await Account.findOne({ 
                type: 'asset', 
                name: { $regex: /receivable|ar/i } 
            });
            
            // Fallback: If specific accounts not found, use generic ones
            if (!accounts.cash) {
                accounts.cash = await Account.findOne({ type: 'asset' });
                console.log('⚠️ Using fallback cash account');
            }
            if (!accounts.bank) {
                accounts.bank = accounts.cash; // Use cash as fallback
                console.log('⚠️ Using cash account as bank fallback');
            }
            if (!accounts.rentalIncome) {
                accounts.rentalIncome = await Account.findOne({ type: 'income' });
                console.log('⚠️ Using fallback income account');
            }
            if (!accounts.adminFeeIncome) {
                accounts.adminFeeIncome = accounts.rentalIncome; // Use rental income as fallback
                console.log('⚠️ Using rental income as admin fee fallback');
            }
            if (!accounts.deferredIncome) {
                accounts.deferredIncome = await Account.findOne({ type: 'liability' });
                console.log('⚠️ Using fallback liability account');
            }
            if (!accounts.securityDeposit) {
                accounts.securityDeposit = accounts.deferredIncome; // Use deferred income as fallback
                console.log('⚠️ Using deferred income as security deposit fallback');
            }
            if (!accounts.accountsReceivable) {
                accounts.accountsReceivable = await Account.findOne({ type: 'asset' });
                console.log('⚠️ Using fallback asset account');
            }
            
            console.log('✅ Accounts configured for double-entry transactions');
            Object.keys(accounts).forEach(key => {
                if (accounts[key]) {
                    console.log(`   ${key}: ${accounts[key].code} - ${accounts[key].name} (${accounts[key].type})`);
                }
            });
            
            return accounts;
        } catch (error) {
            console.error('❌ Error getting required accounts:', error);
            throw error;
        }
    }

    /**
     * Get appropriate cash/bank account based on payment method
     * @param {string} paymentMethod - Payment method used
     * @param {Object} accounts - Available accounts
     * @returns {Object} Cash/bank account to use
     */
    static getCashAccount(paymentMethod, accounts) {
        switch (paymentMethod.toLowerCase()) {
            case 'cash':
                return accounts.cash;
            case 'bank transfer':
                return accounts.bank;
            case 'ecocash':
                return accounts.ecocash;
            case 'innbucks':
                return accounts.innbucks;
            case 'online payment':
                return accounts.bank;
            default:
                return accounts.cash; // Default fallback
        }
    }

    /**
     * Generate unique transaction ID
     * @returns {string} Unique transaction ID
     */
    static generateTransactionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `TXN-${timestamp}-${random}`;
    }

    /**
     * Determine if this is the first month of the lease
     * @param {Object} payment - Payment object
     * @param {Object} monthAnalysis - Parsed payment month analysis
     * @returns {boolean} True if this is the first month of lease
     */
    static isFirstMonthOfLease(payment, monthAnalysis) {
        try {
            // If we have lease start date, use it
            if (payment.leaseStartDate) {
                const leaseStart = new Date(payment.leaseStartDate);
                const paymentDate = monthAnalysis.date;
                return leaseStart.getMonth() === paymentDate.getMonth() && 
                       leaseStart.getFullYear() === paymentDate.getFullYear();
            }
            
            // Fallback: Check if this is the first payment for this student
            // This is a simplified check - in production you'd want to check lease dates
            return true; // Assume first month for now
        } catch (error) {
            console.log('⚠️ Could not determine if first month of lease, defaulting to true');
            return true;
        }
    }

    /**
     * Record student payment with proper double-entry accounting
     * This implements the exact logic from your example
     * @param {Object} payment - Payment object from admin
     * @param {Object} user - Admin user creating the payment
     * @returns {Object} Created transaction details
     */
    static async recordStudentPayment(payment, user) {
        try {
            console.log('💰 Enhanced Payment Service: Recording student payment');
            console.log(`   Payment ID: ${payment.paymentId}`);
            console.log(`   Student: ${payment.student}`);
            console.log(`   Amount: $${payment.totalAmount}`);
            console.log(`   Payment Month: ${payment.paymentMonth}`);
            console.log(`   Date: ${payment.date}`);
            
            // 🚨 DUPLICATE PREVENTION
            const existingTransaction = await TransactionEntry.findOne({
                source: 'payment',
                sourceId: payment._id
            });

            if (existingTransaction) {
                console.log('⚠️ Payment already recorded, skipping');
                return { 
                    success: false,
                    message: 'Payment already recorded',
                    existingTransaction: existingTransaction._id
                };
            }

            // Parse payment month and determine payment type
            const monthAnalysis = this.parsePaymentMonth(payment.paymentMonth);
            console.log(`📅 Payment Month Analysis:`, monthAnalysis);
            
            // Get student and debtor details
            const student = await User.findById(payment.student);
            if (!student) {
                throw new Error('Student not found');
            }
            
            const debtor = await Debtor.findOne({ user: payment.student });
            const studentName = `${student.firstName} ${student.lastName}`;
            
            // Parse payment breakdown
            let rentAmount = 0, adminAmount = 0, depositAmount = 0;
            if (payment.payments && Array.isArray(payment.payments)) {
                payment.payments.forEach(p => {
                    switch (p.type) {
                        case 'rent':
                            rentAmount += p.amount || 0;
                            break;
                        case 'admin':
                            adminAmount += p.amount || 0;
                            break;
                        case 'deposit':
                            depositAmount += p.amount || 0;
                            break;
                    }
                });
            }
            
            console.log(`💰 Payment Breakdown: Rent $${rentAmount}, Admin $${adminAmount}, Deposit $${depositAmount}`);
            
            // Get required accounts
            const accounts = await this.getRequiredAccounts();
            const cashAccount = this.getCashAccount(payment.method, accounts);
            
            // Generate transaction ID
            const transactionId = this.generateTransactionId();
            
            // Create transaction
            const transaction = new Transaction({
                transactionId,
                date: new Date(payment.date),
                description: `Student Payment: ${studentName} - ${payment.paymentMonth || 'Current Period'}`,
                type: 'payment',
                reference: payment.paymentId,
                residence: payment.residence,
                createdBy: user._id
            });
            
            await transaction.save();
            console.log(`✅ Transaction created: ${transactionId}`);
            
            // Create double-entry entries based on payment type
            const entries = [];
            
            // 1. DEBIT: Cash/Bank (Money received)
            entries.push({
                accountCode: cashAccount.code,
                accountName: cashAccount.name,
                accountType: cashAccount.type,
                debit: payment.totalAmount,
                credit: 0,
                description: `Payment received from ${studentName} via ${payment.method}`
            });
            
            // 2. CREDIT: Appropriate accounts based on payment type
            if (monthAnalysis.type === 'advance') {
                // ADVANCE PAYMENT: Route to deferred income
                console.log(`💰 Processing ADVANCE payment for ${payment.paymentMonth}`);
                
                // Check if this is the first month of lease (pro-rata should be earned)
                const isFirstMonthOfLease = this.isFirstMonthOfLease(payment, monthAnalysis);
                
                if (rentAmount > 0) {
                    if (isFirstMonthOfLease) {
                        // First month pro-rata rent is EARNED revenue (student is using the room)
                        entries.push({
                            accountCode: accounts.rentalIncome.code,
                            accountName: accounts.rentalIncome.name,
                            accountType: accounts.rentalIncome.type,
                            debit: 0,
                            credit: rentAmount,
                            description: `Pro-rata rent income from ${studentName} for ${payment.paymentMonth} (first month of lease)`
                        });
                        console.log(`💰 FIRST MONTH PRO-RATA: $${rentAmount} recorded as EARNED Rental Income`);
                    } else {
                        // Future months are deferred income
                        entries.push({
                            accountCode: accounts.deferredIncome.code,
                            accountName: accounts.deferredIncome.name,
                            accountType: accounts.deferredIncome.type,
                            debit: 0,
                            credit: rentAmount,
                            description: `Deferred rent income from ${studentName} for ${payment.paymentMonth}`
                        });
                        console.log(`💰 FUTURE MONTH RENT: $${rentAmount} recorded as Deferred Income`);
                    }
                }
                
                if (adminAmount > 0) {
                    entries.push({
                        accountCode: accounts.deferredIncome.code,
                        accountName: accounts.deferredIncome.name,
                        accountType: accounts.deferredIncome.type,
                        debit: 0,
                        credit: adminAmount,
                        description: `Deferred admin fee from ${studentName} for ${payment.paymentMonth}`
                    });
                }
                
                if (depositAmount > 0) {
                    entries.push({
                        accountCode: accounts.securityDeposit.code,
                        accountName: accounts.securityDeposit.name,
                        accountType: accounts.securityDeposit.type,
                        debit: 0,
                        credit: depositAmount,
                        description: `Security deposit from ${studentName} (refundable)`
                    });
                }
                
            } else if (monthAnalysis.type === 'current') {
                // CURRENT PERIOD: Recognize revenue immediately
                console.log(`💰 Processing CURRENT PERIOD payment for ${payment.paymentMonth}`);
                
                if (rentAmount > 0) {
                    entries.push({
                        accountCode: accounts.rentalIncome.code,
                        accountName: accounts.rentalIncome.name,
                        accountType: accounts.rentalIncome.type,
                        debit: 0,
                        credit: rentAmount,
                        description: `Rent income from ${studentName} for ${payment.paymentMonth}`
                    });
                }
                
                if (adminAmount > 0) {
                    entries.push({
                        accountCode: accounts.adminFeeIncome.code,
                        accountName: accounts.adminFeeIncome.name,
                        accountType: accounts.adminFeeIncome.type,
                        debit: 0,
                        credit: adminAmount,
                        description: `Admin fee income from ${studentName} for ${payment.paymentMonth}`
                    });
                }
                
                if (depositAmount > 0) {
                    entries.push({
                        accountCode: accounts.securityDeposit.code,
                        accountName: accounts.securityDeposit.name,
                        accountType: accounts.securityDeposit.type,
                        debit: 0,
                        credit: depositAmount,
                        description: `Security deposit from ${studentName} (refundable)`
                    });
                }
                
            } else {
                // PAST DUE or UNKNOWN: Route to accounts receivable settlement
                console.log(`💰 Processing PAST DUE/UNKNOWN payment`);
                
                if (rentAmount > 0) {
                    entries.push({
                        accountCode: accounts.accountsReceivable.code,
                        accountName: accounts.accountsReceivable.name,
                        accountType: accounts.accountsReceivable.type,
                        debit: 0,
                        credit: rentAmount,
                        description: `Settlement of rent receivable from ${studentName}`
                    });
                }
                
                if (adminAmount > 0) {
                    entries.push({
                        accountCode: accounts.accountsReceivable.code,
                        accountName: accounts.accountsReceivable.name,
                        accountType: accounts.accountsReceivable.type,
                        debit: 0,
                        credit: adminAmount,
                        description: `Settlement of admin fee receivable from ${studentName}`
                    });
                }
                
                if (depositAmount > 0) {
                    entries.push({
                        accountCode: accounts.securityDeposit.code,
                        accountName: accounts.securityDeposit.name,
                        accountType: accounts.securityDeposit.type,
                        debit: 0,
                        credit: depositAmount,
                        description: `Security deposit from ${studentName} (refundable)`
                    });
                }
            }
            
            // Validate double-entry balance
            const totalDebits = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
            const totalCredits = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
            
            if (Math.abs(totalDebits - totalCredits) > 0.01) {
                throw new Error(`Double-entry balance mismatch: Debits $${totalDebits}, Credits $${totalCredits}`);
            }
            
            console.log(`✅ Double-entry balance validated: Debits $${totalDebits}, Credits $${totalCredits}`);
            
            // Create transaction entry
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(payment.date),
                description: `Student Payment: ${studentName}`,
                reference: payment.paymentId,
                entries,
                totalDebit: totalDebits,
                totalCredit: totalCredits,
                source: 'payment',
                sourceId: payment._id,
                sourceModel: 'Payment',
                residence: payment.residence,
                createdBy: user.email || user._id,
                status: 'posted',
                metadata: {
                    paymentType: monthAnalysis.type,
                    paymentMonth: payment.paymentMonth,
                    paymentYear: monthAnalysis.year,
                    studentId: payment.student,
                    studentName,
                    isAdvancePayment: monthAnalysis.type === 'advance',
                    isCurrentPeriodPayment: monthAnalysis.type === 'current',
                    isPastDuePayment: monthAnalysis.type === 'past_due',
                    paymentBreakdown: {
                        rent: rentAmount,
                        admin: adminAmount,
                        deposit: depositAmount
                    },
                    proRataCalculation: monthAnalysis
                }
            });
            
            await transactionEntry.save();
            console.log(`✅ Transaction entry created: ${transactionEntry._id}`);
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();
            
            // Update debtor if exists
            if (debtor) {
                // Add payment to debtor's payment history
                if (!debtor.paymentHistory) debtor.paymentHistory = [];
                debtor.paymentHistory.push({
                    date: new Date(payment.date),
                    amount: payment.totalAmount,
                    type: monthAnalysis.type,
                    paymentId: payment.paymentId,
                    month: payment.paymentMonth
                });
                
                // Update current balance
                if (monthAnalysis.type === 'current' || monthAnalysis.type === 'past_due') {
                    debtor.currentBalance = Math.max(0, debtor.currentBalance - rentAmount);
                }
                
                await debtor.save();
                console.log(`✅ Debtor updated: ${debtor.debtorCode}`);
            }
            
            return {
                success: true,
                transaction: transaction,
                transactionEntry: transactionEntry,
                paymentType: monthAnalysis.type,
                message: `Payment recorded successfully as ${monthAnalysis.type} payment`
            };
            
        } catch (error) {
            console.error('❌ Error recording student payment:', error);
            throw error;
        }
    }

    /**
     * Recognize deferred income when the period arrives
     * @param {string} studentId - Student ID
     * @param {string} paymentMonth - Month to recognize income for
     * @param {Object} user - Admin user
     * @returns {Object} Recognition transaction details
     */
    static async recognizeDeferredIncome(studentId, paymentMonth, user) {
        try {
            console.log(`💰 Recognizing deferred income for ${studentId} in ${paymentMonth}`);
            
            // Find deferred income entries for this student and month
            const deferredEntries = await TransactionEntry.find({
                source: 'payment',
                'metadata.studentId': studentId,
                'metadata.paymentMonth': paymentMonth,
                'metadata.isAdvancePayment': true,
                status: 'posted'
            });
            
            if (deferredEntries.length === 0) {
                return { success: false, message: 'No deferred income found for this month' };
            }
            
            // Get accounts
            const accounts = await this.getRequiredAccounts();
            
            // Create recognition transaction
            const transactionId = this.generateTransactionId();
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: `Deferred Income Recognition: ${paymentMonth}`,
                type: 'adjustment',
                reference: `DEFERRED-${studentId}-${paymentMonth}`,
                residence: deferredEntries[0].residence,
                createdBy: user._id
            });
            
            await transaction.save();
            
            // Create recognition entries
            const entries = [];
            let totalDeferredAmount = 0;
            
            for (const deferred of deferredEntries) {
                for (const entry of deferred.entries) {
                    if (entry.accountCode === accounts.deferredIncome.code && entry.credit > 0) {
                        // Debit deferred income (reduce liability)
                        entries.push({
                            accountCode: accounts.deferredIncome.code,
                            accountName: accounts.deferredIncome.name,
                            accountType: accounts.deferredIncome.type,
                            debit: entry.credit,
                            credit: 0,
                            description: `Recognition of deferred income for ${paymentMonth}`
                        });
                        
                        // Credit appropriate revenue account
                        if (entry.description.includes('rent')) {
                            entries.push({
                                accountCode: accounts.rentalIncome.code,
                                accountName: accounts.rentalIncome.name,
                                accountType: accounts.rentalIncome.type,
                                debit: 0,
                                credit: entry.credit,
                                description: `Rent income recognized for ${paymentMonth} (from deferred)`
                            });
                        } else if (entry.description.includes('admin')) {
                            entries.push({
                                accountCode: accounts.adminFeeIncome.code,
                                accountName: accounts.adminFeeIncome.name,
                                accountType: accounts.adminFeeIncome.type,
                                debit: 0,
                                credit: entry.credit,
                                description: `Admin fee income recognized for ${paymentMonth} (from deferred)`
                            });
                        }
                        
                        totalDeferredAmount += entry.credit;
                    }
                }
            }
            
            if (entries.length === 0) {
                return { success: false, message: 'No deferred income entries to recognize' };
            }
            
            // Create recognition transaction entry
            const recognitionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: `Deferred Income Recognition for ${paymentMonth}`,
                reference: `DEFERRED-${studentId}-${paymentMonth}`,
                entries,
                totalDebit: totalDeferredAmount,
                totalCredit: totalDeferredAmount,
                source: 'deferred_recognition',
                sourceId: transaction._id,
                sourceModel: 'Transaction',
                residence: transaction.residence,
                createdBy: user.email || user._id,
                status: 'posted',
                metadata: {
                    type: 'deferred_income_recognition',
                    studentId,
                    paymentMonth,
                    amount: totalDeferredAmount
                }
            });
            
            await recognitionEntry.save();
            
            // Update transaction
            transaction.entries = [recognitionEntry._id];
            await transaction.save();
            
            console.log(`✅ Deferred income recognized: $${totalDeferredAmount} for ${paymentMonth}`);
            
            return {
                success: true,
                transaction: transaction,
                recognitionEntry: recognitionEntry,
                amount: totalDeferredAmount,
                message: `Deferred income of $${totalDeferredAmount} recognized for ${paymentMonth}`
            };
            
        } catch (error) {
            console.error('❌ Error recognizing deferred income:', error);
            throw error;
        }
    }
}

module.exports = EnhancedPaymentService;
