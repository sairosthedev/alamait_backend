const TransactionEntry = require('../models/TransactionEntry');
const Payment = require('../models/Payment');
const Expense = require('../models/finance/Expense');
const Account = require('../models/Account');
const Residence = require('../models/Residence');
const mongoose = require('mongoose');

/**
 * Enhanced Cash Flow Service
 * 
 * Provides detailed cash flow analysis with comprehensive breakdowns:
 * - Detailed income sources (rent, admin fees, deposits, utilities, etc.)
 * - Detailed expense categories (maintenance, utilities, management, etc.)
 * - Transaction-level details with source and destination information
 * - Monthly and period-based analysis
 * - Residence-specific breakdowns
 */
class EnhancedCashFlowService {
    
    /**
     * Generate comprehensive detailed cash flow statement
     * @param {string} period - Year (e.g., "2024")
     * @param {string} basis - "cash" or "accrual"
     * @param {string} residenceId - Optional residence filter
     * @returns {Object} Detailed cash flow analysis
     */
    static async generateDetailedCashFlowStatement(period, basis = 'cash', residenceId = null) {
        try {
            console.log(`💰 Generating Enhanced Detailed Cash Flow Statement for ${period} (${basis} basis)${residenceId ? ` - Residence: ${residenceId}` : ''}`);
            
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            // Get all transaction entries for the period
            const transactionQuery = {
                date: { $gte: startDate, $lte: endDate }
            };
            
            if (residenceId) {
                transactionQuery.residence = residenceId;
            }
            
            if (basis === 'cash') {
                transactionQuery.source = {
                    $in: ['payment', 'expense_payment', 'rental_payment', 'manual', 'payment_collection', 'bank_transfer', 'advance_payment']
                };
            }
            
            const transactionEntries = await TransactionEntry.find(transactionQuery)
                .populate('residence')
                .populate('entries')
                .sort({ date: 1 });
            
            // Get payments for additional income details
            const paymentQuery = {
                date: { $gte: startDate, $lte: endDate },
                status: { $in: ['confirmed', 'completed', 'paid', 'Confirmed', 'Completed', 'Paid'] }
            };
            
            if (residenceId) {
                paymentQuery.residence = residenceId;
            }
            
            const payments = await Payment.find(paymentQuery)
                .populate('student')
                .populate('residence')
                .sort({ date: 1 });
            
            // Get expenses for additional expense details
            const expenseQuery = {
                expenseDate: { $gte: startDate, $lte: endDate },
                paymentStatus: 'Paid'
            };
            
            if (residenceId) {
                expenseQuery.residence = residenceId;
            }
            
            const expenses = await Expense.find(expenseQuery)
                .populate('residence')
                .sort({ expenseDate: 1 });
            
            // Process detailed income breakdown
            const incomeBreakdown = await this.processDetailedIncome(transactionEntries, payments, period);
            
            // Process detailed expense breakdown
            const expenseBreakdown = await this.processDetailedExpenses(transactionEntries, expenses, period);
            
            // Calculate cash flow by activity
            const operatingActivities = this.calculateOperatingActivities(incomeBreakdown, expenseBreakdown);
            const investingActivities = this.calculateInvestingActivities(transactionEntries);
            const financingActivities = this.calculateFinancingActivities(transactionEntries);
            
            // Calculate net cash flow
            const netOperatingCashFlow = operatingActivities.cash_received_from_customers - 
                                       operatingActivities.cash_paid_to_suppliers - 
                                       operatingActivities.cash_paid_for_expenses;
            
            const netInvestingCashFlow = -(investingActivities.purchase_of_equipment + 
                                       investingActivities.purchase_of_buildings);
            
            const netFinancingCashFlow = financingActivities.owners_contribution + 
                                       financingActivities.loan_proceeds;
            
            const netChangeInCash = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;
            
            // Calculate cash breakdown
            const cashBreakdown = await this.calculateCashBreakdown(transactionEntries, payments, period);
            
            // Generate monthly breakdown
            const monthlyBreakdown = this.generateMonthlyBreakdown(transactionEntries, payments, expenses, period);
            
            const cashFlowData = {
                period,
                basis,
                summary: {
                    net_change_in_cash: netChangeInCash,
                    net_operating_cash_flow: netOperatingCashFlow,
                    net_investing_cash_flow: netInvestingCashFlow,
                    net_financing_cash_flow: netFinancingCashFlow,
                    total_income: incomeBreakdown.total,
                    total_expenses: expenseBreakdown.total,
                    transaction_count: transactionEntries.length,
                    payment_count: payments.length,
                    expense_count: expenses.length
                },
                cash_breakdown: cashBreakdown,
                operating_activities: operatingActivities,
                investing_activities: investingActivities,
                financing_activities: financingActivities,
                detailed_breakdown: {
                    income: incomeBreakdown,
                    expenses: expenseBreakdown,
                    transactions: this.processTransactionDetails(transactionEntries),
                    payments: this.processPaymentDetails(payments),
                    expenses_detail: this.processExpenseDetails(expenses),
                    monthly_breakdown: monthlyBreakdown
                },
                metadata: {
                    generated_at: new Date(),
                    residence_filter: residenceId,
                    data_sources: ['TransactionEntry', 'Payment', 'Expense'],
                    basis_type: basis
                }
            };
            
            // Add formatted cash flow statement
            cashFlowData.formatted_cash_flow_statement = this.formatCashFlowStatement(cashFlowData);
            
            return cashFlowData;
            
        } catch (error) {
            console.error('Error generating detailed cash flow statement:', error);
            throw error;
        }
    }
    
    /**
     * Process detailed income breakdown
     */
    static async processDetailedIncome(transactionEntries, payments, period) {
        const incomeBreakdown = {
            total: 0,
            by_source: {
                rental_income: { total: 0, transactions: [] },
                admin_fees: { total: 0, transactions: [] },
                deposits: { total: 0, transactions: [] },
                utilities: { total: 0, transactions: [] },
                advance_payments: { total: 0, transactions: [] },
                other_income: { total: 0, transactions: [] }
            },
            by_residence: {},
            by_month: {},
            payment_details: [],
            advance_payments: {
                total: 0,
                by_student: {},
                by_residence: {},
                by_month: {},
                transactions: []
            }
        };
        
        // Create a map of transaction entries to their corresponding payments for accurate date handling
        const transactionToPaymentMap = new Map();
        
        // Debug: Log all transaction IDs to see what we're working with
        console.log(`🔍 Total transactions loaded: ${transactionEntries.length}`);
        const transactionIds = transactionEntries.map(t => t.transactionId);
        console.log(`🔍 Transaction IDs:`, transactionIds);
        
        // Check if R180 transaction is in the loaded transactions
        const r180Transaction = transactionEntries.find(t => t.transactionId === 'TXN17570154497464WBST');
        if (r180Transaction) {
            console.log(`✅ R180 Transaction found in loaded transactions:`, {
                transactionId: r180Transaction.transactionId,
                reference: r180Transaction.reference,
                date: r180Transaction.date
            });
        } else {
            console.log(`❌ R180 Transaction NOT found in loaded transactions`);
        }
        
        // First, create a simple mapping based on reference field
        transactionEntries.forEach(entry => {
            if (entry.reference) {
                const payment = payments.find(p => p._id.toString() === entry.reference);
                if (payment) {
                    transactionToPaymentMap.set(entry.transactionId, payment);
                    console.log(`🔗 Mapped transaction ${entry.transactionId} to payment ${payment.paymentId}`);
                } else {
                    console.log(`⚠️ No payment found for reference ${entry.reference} in transaction ${entry.transactionId}`);
                }
            } else {
                console.log(`📝 Processing transaction ${entry.transactionId} without payment reference`);
            }
            
            // Special logging for R180 transaction
            if (entry.transactionId === 'TXN17570154497464WBST') {
                console.log(`🔍 R180 Transaction in mapping loop:`, {
                    transactionId: entry.transactionId,
                    reference: entry.reference,
                    hasReference: !!entry.reference,
                    foundPayment: !!payments.find(p => p._id.toString() === entry.reference)
                });
            }
        });
        
        if (payments.length > 0) {
            payments.forEach(payment => {
            // Find transaction entries that correspond to this payment
            const relatedTransactions = transactionEntries.filter(entry => {
                // Match by payment ID in description
                if (entry.description?.includes(payment.paymentId)) {
                    return true;
                }
                
                // Match by payment _id in reference field (this is the key fix!)
                if (entry.reference && entry.reference === payment._id.toString()) {
                    return true;
                }
                
                // Match by amount and date proximity (for cases where payment ID is not in description)
                // Check if any payment component matches the transaction amount
                const paymentComponents = payment.payments || [];
                const amountMatch = paymentComponents.some(comp => 
                    Math.abs(entry.totalDebit - comp.amount) < 0.01
                ) || Math.abs(entry.totalDebit - payment.totalAmount) < 0.01;
                
                const dateProximity = Math.abs(entry.date.getTime() - payment.date.getTime()) < 30 * 24 * 60 * 60 * 1000; // Within 30 days
                
                // Also check if the transaction description contains payment-related keywords
                const descriptionMatch = entry.description && (
                    entry.description.toLowerCase().includes('payment') ||
                    entry.description.toLowerCase().includes('allocation') ||
                    entry.description.toLowerCase().includes('rent') ||
                    entry.description.toLowerCase().includes('admin')
                );
                
                return amountMatch && dateProximity && descriptionMatch;
            });
            
            relatedTransactions.forEach(transaction => {
                transactionToPaymentMap.set(transaction.transactionId, payment);
            });
        });
        } else {
            console.log('⚠️ No payments found in database. Using transaction dates for cash flow.');
        }
        
        // Ensure ALL transactions are processed, even those without valid payment references
        transactionEntries.forEach(entry => {
            if (!transactionToPaymentMap.has(entry.transactionId)) {
                // This transaction doesn't have a valid payment reference, but we still need to process it
                console.log(`📝 Processing transaction ${entry.transactionId} without payment reference`);
            }
        });
        
        console.log(`📊 Transaction-to-Payment mapping created: ${transactionToPaymentMap.size} transactions linked to payments`);
        
        // Process transaction entries for income
        transactionEntries.forEach(entry => {
            // Get the corresponding payment for accurate date handling
            const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
            const effectiveDate = correspondingPayment ? correspondingPayment.date : entry.date;
            
            if (correspondingPayment) {
                console.log(`💰 Processing transaction ${entry.transactionId} with payment date ${effectiveDate.toISOString().slice(0, 7)} (was ${entry.date.toISOString().slice(0, 7)})`);
            } else if (entry.reference) {
                console.log(`💰 Processing transaction ${entry.transactionId} with transaction date ${effectiveDate.toISOString().slice(0, 7)} (invalid payment reference)`);
            }
            
            // Special logging for R180 transaction
            if (entry.transactionId === 'TXN17570154497464WBST') {
                console.log(`🔍 R180 Transaction Debug:`, {
                    transactionId: entry.transactionId,
                    reference: entry.reference,
                    hasPayment: !!correspondingPayment,
                    effectiveDate: effectiveDate.toISOString().slice(0, 7),
                    originalDate: entry.date.toISOString().slice(0, 7)
                });
            }
            
            if (entry.entries && entry.entries.length > 0) {
                // Look for Cash/Bank debits (income received) - check both Cash and Bank Account
                const cashEntry = entry.entries.find(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    return accountCode === '1000' && (accountName === 'Cash' || accountName === 'Bank Account') && line.debit > 0;
                });
                
                if (cashEntry) {
                    const incomeAmount = cashEntry.debit;
                    incomeBreakdown.total += incomeAmount;
                    
                    // Special logging for R180 transaction
                    if (entry.transactionId === 'TXN17570154497464WBST') {
                        console.log(`🔍 R180 Cash Entry Found:`, {
                            amount: incomeAmount,
                            accountCode: cashEntry.accountCode,
                            accountName: cashEntry.accountName
                        });
                    }
                    
                    // Categorize based on description and source
                    let category = 'other_income';
                    let description = entry.description || 'Cash Income';
                    let isAdvancePayment = false;
                    
                    if (entry.description) {
                        const desc = entry.description.toLowerCase();
                        // Check for advance payments first (most specific)
                        if (desc.includes('advance') || desc.includes('prepaid') || desc.includes('future')) {
                            category = 'advance_payments';
                            description = 'Advance Payment from Student';
                            isAdvancePayment = true;
                        } 
                        // Check for specific payment allocations
                        else if (desc.includes('payment allocation: rent')) {
                            category = 'rental_income';
                            description = 'Rental Income from Students';
                        } else if (desc.includes('payment allocation: admin')) {
                            category = 'admin_fees';
                            description = 'Administrative Fees';
                        } 
                        // Fallback to general keywords
                        else if (desc.includes('rent')) {
                            category = 'rental_income';
                            description = 'Rental Income from Students';
                        } else if (desc.includes('admin')) {
                            category = 'admin_fees';
                            description = 'Administrative Fees';
                        } else if (desc.includes('deposit')) {
                            category = 'deposits';
                            description = 'Security Deposits';
                        } else if (desc.includes('utilit')) {
                            category = 'utilities';
                            description = 'Utilities Income';
                        }
                    }
                    
                    // Check if this is a direct advance payment transaction (only if not already categorized)
                    if ((entry.source === 'advance_payment' || entry.sourceModel === 'AdvancePayment') && category === 'other_income') {
                        category = 'advance_payments';
                        description = 'Advance Payment Transaction';
                        isAdvancePayment = true;
                    }
                    
                    // Check if this is an advance payment by looking at payment details (only if not already categorized)
                    if (correspondingPayment && category === 'other_income') {
                        const paymentDate = correspondingPayment.date;
                        const paymentMonth = paymentDate.getMonth() + 1; // 1-12
                        const paymentYear = paymentDate.getFullYear();
                        
                        // Check if payment is for future months (advance payment)
                        if (correspondingPayment.allocation && correspondingPayment.allocation.monthlyBreakdown) {
                            // Try to match this specific transaction amount to a specific allocation
                            const matchingAllocation = correspondingPayment.allocation.monthlyBreakdown.find(allocation => {
                                if (allocation.amountAllocated && Math.abs(allocation.amountAllocated - incomeAmount) < 0.01) {
                                    return true; // Found matching amount
                                }
                                return false;
                            });
                            
                            if (matchingAllocation) {
                                // Check if the matching allocation is for a future month
                                if (matchingAllocation.month && matchingAllocation.year) {
                                    // Parse month string like "2025-09" or just month number
                                    let allocationMonth, allocationYear;
                                    if (typeof matchingAllocation.month === 'string' && matchingAllocation.month.includes('-')) {
                                        // Format: "2025-09"
                                        const [year, month] = matchingAllocation.month.split('-');
                                        allocationYear = parseInt(year);
                                        allocationMonth = parseInt(month);
                                    } else if (matchingAllocation.month && matchingAllocation.year) {
                                        // Format: month number and year
                                        allocationYear = matchingAllocation.year;
                                        allocationMonth = matchingAllocation.month;
                                    }
                                    
                                    if (allocationYear && allocationMonth) {
                                        // If allocation is for a future month/year, it's an advance payment
                                        if (allocationYear > paymentYear) {
                                            category = 'advance_payments';
                                            description = 'Advance Payment for Future Periods';
                                            isAdvancePayment = true;
                                            console.log(`🔍 Advance payment detected (future year): ${incomeAmount} - Transaction: ${entry.transactionId} - Payment: ${correspondingPayment.paymentId} - Allocation: ${matchingAllocation.month}/${matchingAllocation.year}`);
                                        } else if (allocationYear === paymentYear && allocationMonth > paymentMonth) {
                                            category = 'advance_payments';
                                            description = 'Advance Payment for Future Periods';
                                            isAdvancePayment = true;
                                            console.log(`🔍 Advance payment detected (future month): ${incomeAmount} - Transaction: ${entry.transactionId} - Payment: ${correspondingPayment.paymentId} - Allocation: ${matchingAllocation.month}/${matchingAllocation.year}`);
                                        } else {
                                            // Current month allocation - categorize based on type (only if not already categorized)
                                            if (category === 'other_income') {
                                                if (matchingAllocation.allocationType === 'rent_settlement') {
                                                    category = 'rental_income';
                                                    description = 'Rental Income from Students';
                                                } else if (matchingAllocation.allocationType === 'admin_settlement') {
                                                    category = 'admin_fees';
                                                    description = 'Administrative Fees';
                                                } else if (matchingAllocation.allocationType === 'advance_payment') {
                                                    category = 'advance_payments';
                                                    description = 'Advance Payment for Future Periods';
                                                    isAdvancePayment = true;
                                                }
                                            }
                                            console.log(`🔍 Current allocation detected: ${incomeAmount} - Transaction: ${entry.transactionId} - Payment: ${correspondingPayment.paymentId} - Allocation: ${matchingAllocation.month}/${matchingAllocation.year} - Type: ${matchingAllocation.allocationType} - Final Category: ${category}`);
                                        }
                                    }
                                }
                            } else {
                                // No exact amount match found, fall back to checking if any allocation is for future months
                                const hasFutureAllocation = correspondingPayment.allocation.monthlyBreakdown.some(allocation => {
                                    if (allocation.month && allocation.year) {
                                        // Parse month string like "2025-09" or just month number
                                        let allocationMonth, allocationYear;
                                        if (typeof allocation.month === 'string' && allocation.month.includes('-')) {
                                            // Format: "2025-09"
                                            const [year, month] = allocation.month.split('-');
                                            allocationYear = parseInt(year);
                                            allocationMonth = parseInt(month);
                                        } else if (allocation.month && allocation.year) {
                                            // Format: month number and year
                                            allocationYear = allocation.year;
                                            allocationMonth = allocation.month;
                                        }
                                        
                                        if (allocationYear && allocationMonth) {
                                            // If allocation is for a future month/year, it's an advance payment
                                            if (allocationYear > paymentYear) {
                                                return true; // Future year
                                            } else if (allocationYear === paymentYear && allocationMonth > paymentMonth) {
                                                return true; // Future month in same year
                                            }
                                        }
                                    }
                                    return false;
                                });
                                
                                if (hasFutureAllocation && category === 'other_income') {
                                    category = 'advance_payments';
                                    description = 'Advance Payment for Future Periods';
                                    isAdvancePayment = true;
                                    console.log(`🔍 Advance payment detected (fallback): ${incomeAmount} - Transaction: ${entry.transactionId} - Payment: ${correspondingPayment.paymentId}`);
                                }
                            }
                        }
                        
                        // Fallback: Check if payment is for future months using old structure
                        if (!isAdvancePayment && correspondingPayment.payments && correspondingPayment.payments.length > 0) {
                            const hasFutureAllocation = correspondingPayment.payments.some(payment => {
                                if (payment.month && payment.year) {
                                    const allocationDate = new Date(payment.year, payment.month - 1);
                                    return allocationDate > paymentDate;
                                }
                                return false;
                            });
                            
                            if (hasFutureAllocation && category === 'other_income') {
                                category = 'advance_payments';
                                description = 'Advance Payment for Future Rent';
                                isAdvancePayment = true;
                            }
                        }
                        
                        // Check monthlyBreakdown for advance payments
                        if (correspondingPayment.monthlyBreakdown && correspondingPayment.monthlyBreakdown.length > 0) {
                            const advanceAllocations = correspondingPayment.monthlyBreakdown.filter(
                                allocation => allocation.allocationType === 'advance_payment'
                            );
                            
                            if (advanceAllocations.length > 0) {
                                // Calculate advance payment amount
                                const advanceAmount = advanceAllocations.reduce((sum, allocation) => 
                                    sum + (allocation.amountAllocated || 0), 0
                                );
                                
                                // If this transaction amount matches the advance amount, it's an advance payment
                                if (Math.abs(incomeAmount - advanceAmount) < 0.01 && category === 'other_income') {
                                    category = 'advance_payments';
                                    description = 'Advance Payment for Future Periods';
                                    isAdvancePayment = true;
                                }
                            }
                        }
                        
                        // Also check if the payment amount is larger than what's allocated for current month
                        // This could indicate an advance payment
                        if (correspondingPayment.payments && correspondingPayment.payments.length > 0) {
                            const currentMonth = paymentDate.getMonth() + 1;
                            const currentYear = paymentDate.getFullYear();
                            
                            const currentMonthAllocations = correspondingPayment.payments.filter(payment => 
                                payment.month === currentMonth && payment.year === currentYear
                            );
                            
                            const currentMonthTotal = currentMonthAllocations.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                            
                            // If payment amount is significantly larger than current month allocation, it might be advance
                            if (correspondingPayment.totalAmount > currentMonthTotal * 1.5 && category === 'other_income') {
                                category = 'advance_payments';
                                description = 'Advance Payment (Excess Amount)';
                                isAdvancePayment = true;
                            }
                        }
                    }
                    
                    // Add to appropriate category
                    incomeBreakdown.by_source[category].total += incomeAmount;
                    incomeBreakdown.by_source[category].transactions.push({
                        transactionId: entry.transactionId,
                        date: effectiveDate, // Use payment date instead of transaction date
                        amount: incomeAmount,
                        accountCode: cashEntry.accountCode,
                        accountName: cashEntry.accountName,
                        residence: entry.residence?.name || 'Unknown',
                        description: description,
                        source: 'Cash Payment',
                        isAdvancePayment: isAdvancePayment
                    });
                    
                    // Track advance payments separately
                    if (isAdvancePayment) {
                        incomeBreakdown.advance_payments.total += incomeAmount;
                        incomeBreakdown.advance_payments.transactions.push({
                            transactionId: entry.transactionId,
                            date: effectiveDate,
                            amount: incomeAmount,
                            student: correspondingPayment?.student?.firstName + ' ' + correspondingPayment?.student?.lastName || 'Unknown Student',
                            residence: entry.residence?.name || 'Unknown',
                            description: description,
                            paymentId: correspondingPayment?.paymentId || 'Unknown',
                            futureAllocations: correspondingPayment?.payments?.filter(p => {
                                if (p.month && p.year) {
                                    const allocationDate = new Date(p.year, p.month - 1);
                                    return allocationDate > effectiveDate;
                                }
                                return false;
                            }) || []
                        });
                        
                        // Group advance payments by student
                        const studentName = correspondingPayment?.student?.firstName + ' ' + correspondingPayment?.student?.lastName || 'Unknown Student';
                        if (!incomeBreakdown.advance_payments.by_student[studentName]) {
                            incomeBreakdown.advance_payments.by_student[studentName] = 0;
                        }
                        incomeBreakdown.advance_payments.by_student[studentName] += incomeAmount;
                        
                        // Group advance payments by residence
                        const residenceName = entry.residence?.name || 'Unknown';
                        if (!incomeBreakdown.advance_payments.by_residence[residenceName]) {
                            incomeBreakdown.advance_payments.by_residence[residenceName] = 0;
                        }
                        incomeBreakdown.advance_payments.by_residence[residenceName] += incomeAmount;
                        
                        // Group advance payments by month
                        const monthKey = effectiveDate.toISOString().slice(0, 7);
                        if (!incomeBreakdown.advance_payments.by_month[monthKey]) {
                            incomeBreakdown.advance_payments.by_month[monthKey] = 0;
                        }
                        incomeBreakdown.advance_payments.by_month[monthKey] += incomeAmount;
                    }
                    
                    // Group by residence
                    const residenceName = entry.residence?.name || 'Unknown';
                    if (!incomeBreakdown.by_residence[residenceName]) {
                        incomeBreakdown.by_residence[residenceName] = 0;
                    }
                    incomeBreakdown.by_residence[residenceName] += incomeAmount;
                    
                    // Group by month using the effective date (payment date)
                    const monthKey = effectiveDate.toISOString().slice(0, 7); // YYYY-MM
                    if (!incomeBreakdown.by_month[monthKey]) {
                        incomeBreakdown.by_month[monthKey] = 0;
                    }
                    incomeBreakdown.by_month[monthKey] += incomeAmount;
                }
                
                // Also check for traditional Income account types (for completeness)
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const credit = line.credit || 0;
                    
                    if (accountType === 'Income' || accountType === 'income') {
                        incomeBreakdown.total += credit;
                        
                        // Categorize by account code
                        if (accountCode.startsWith('4001') || accountName.toLowerCase().includes('rent')) {
                            incomeBreakdown.by_source.rental_income.total += credit;
                            incomeBreakdown.by_source.rental_income.transactions.push({
                                transactionId: entry.transactionId,
                                date: effectiveDate, // Use payment date instead of transaction date
                                amount: credit,
                                accountCode,
                                accountName,
                                residence: entry.residence?.name || 'Unknown',
                                description: entry.description || 'Rental Income'
                            });
                        } else if (accountCode.startsWith('4002') || accountName.toLowerCase().includes('admin')) {
                            incomeBreakdown.by_source.admin_fees.total += credit;
                            incomeBreakdown.by_source.admin_fees.transactions.push({
                                transactionId: entry.transactionId,
                                date: effectiveDate, // Use payment date instead of transaction date
                                amount: credit,
                                accountCode,
                                accountName,
                                residence: entry.residence?.name || 'Unknown',
                                description: entry.description || 'Admin Fee'
                            });
                        } else if (accountCode.startsWith('4003') || accountName.toLowerCase().includes('deposit')) {
                            incomeBreakdown.by_source.deposits.total += credit;
                            incomeBreakdown.by_source.deposits.transactions.push({
                                transactionId: entry.transactionId,
                                date: effectiveDate, // Use payment date instead of transaction date
                                amount: credit,
                                accountCode,
                                accountName,
                                residence: entry.residence?.name || 'Unknown',
                                description: entry.description || 'Security Deposit'
                            });
                        } else if (accountCode.startsWith('4004') || accountName.toLowerCase().includes('utilit')) {
                            incomeBreakdown.by_source.utilities.total += credit;
                            incomeBreakdown.by_source.utilities.transactions.push({
                                transactionId: entry.transactionId,
                                date: effectiveDate, // Use payment date instead of transaction date
                                amount: credit,
                                accountCode,
                                accountName,
                                residence: entry.residence?.name || 'Unknown',
                                description: entry.description || 'Utilities Income'
                            });
                        } else {
                            incomeBreakdown.by_source.other_income.total += credit;
                            incomeBreakdown.by_source.other_income.transactions.push({
                                transactionId: entry.transactionId,
                                date: effectiveDate, // Use payment date instead of transaction date
                                amount: credit,
                                accountCode,
                                accountName,
                                residence: entry.residence?.name || 'Unknown',
                                description: entry.description || 'Other Income'
                            });
                        }
                        
                        // Group by residence
                        const residenceName = entry.residence?.name || 'Unknown';
                        if (!incomeBreakdown.by_residence[residenceName]) {
                            incomeBreakdown.by_residence[residenceName] = 0;
                        }
                        incomeBreakdown.by_residence[residenceName] += credit;
                        
                        // Group by month using the effective date (payment date)
                        const monthKey = effectiveDate.toISOString().slice(0, 7); // YYYY-MM
                        if (!incomeBreakdown.by_month[monthKey]) {
                            incomeBreakdown.by_month[monthKey] = 0;
                        }
                        incomeBreakdown.by_month[monthKey] += credit;
                    }
                });
            }
        });
        
        // Process payment details for additional income information
        payments.forEach(payment => {
            const paymentDetail = {
                paymentId: payment.paymentId,
                date: payment.date,
                student: payment.student?.firstName + ' ' + payment.student?.lastName || 'Unknown Student',
                residence: payment.residence?.name || 'Unknown',
                totalAmount: payment.totalAmount || 0,
                rentAmount: payment.rentAmount || 0,
                adminFee: payment.adminFee || 0,
                deposit: payment.deposit || 0,
                utilities: payment.utilities || 0,
                other: payment.other || 0,
                paymentMethod: payment.method || 'Unknown',
                status: payment.status
            };
            
            incomeBreakdown.payment_details.push(paymentDetail);
        });
        
        return incomeBreakdown;
    }
    
    /**
     * Process detailed expense breakdown
     */
    static async processDetailedExpenses(transactionEntries, expenses, period) {
        const expenseBreakdown = {
            total: 0,
            by_category: {
                maintenance: { total: 0, transactions: [] },
                utilities: { total: 0, transactions: [] },
                cleaning: { total: 0, transactions: [] },
                security: { total: 0, transactions: [] },
                management: { total: 0, transactions: [] }
            },
            by_residence: {},
            by_month: {},
            expense_details: []
        };
        
        // Process transaction entries for expenses (Cash credits = expenses paid)
        const processedTransactions = new Set();
        const processedExpenses = new Set(); // Track processed expense IDs
        
        // Helper function to get residence name from transaction entry or related expense
        const getResidenceName = (entry, expenses) => {
            let residenceName = entry.residence?.name || 'Unknown';
            
            // If residence is unknown, try to get it from the expense record
            if (residenceName === 'Unknown' && entry.reference) {
                // Look for expense by reference
                const relatedExpense = expenses.find(expense => 
                    expense._id.toString() === entry.reference || 
                    expense.expenseId === entry.reference ||
                    entry.reference.includes(expense._id.toString())
                );
                
                if (relatedExpense && relatedExpense.residence) {
                    residenceName = relatedExpense.residence.name || 'Unknown';
                    console.log(`🏠 Found residence for transaction ${entry.transactionId}: ${residenceName} from expense ${relatedExpense._id}`);
                } else {
                    console.log(`⚠️ Could not find residence for transaction ${entry.transactionId} with reference ${entry.reference}`);
                }
            }
            
            return residenceName;
        };
        
        transactionEntries.forEach(entry => {
            if (entry.entries && entry.entries.length > 0) {
                // Look for Cash/Bank credits (expenses paid)
                const cashEntry = entry.entries.find(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    return accountCode === '1000' && (accountName === 'Cash' || accountName === 'Bank Account') && line.credit > 0;
                });
                
                // Skip petty cash transfers - they are not expenses
                const isPettyCashTransfer = entry.description && (
                    entry.description.toLowerCase().includes('petty cash') ||
                    entry.description.toLowerCase().includes('cash allocation')
                );
                
                if (cashEntry && !isPettyCashTransfer) {
                    // Check if this expense was already processed
                    let expenseId = null;
                    if (entry.reference) {
                        // Check for EXP- prefix or direct expense ID
                        if (entry.reference.startsWith('EXP-')) {
                            expenseId = entry.reference;
                        } else {
                            // Check if reference contains an expense ID pattern
                            const expenseIdMatch = entry.reference.match(/EXP-[\w-]+/);
                            if (expenseIdMatch) {
                                expenseId = expenseIdMatch[0];
                            } else {
                                // Use the reference as expense ID if it looks like an ObjectId
                                expenseId = entry.reference;
                            }
                        }
                    }
                    
                    // Also check if this transaction is related to any expense by looking at the description
                    if (entry.description && entry.description.includes('Payment for Expense')) {
                        const expenseIdFromDesc = entry.description.match(/EXP-[\w-]+/);
                        if (expenseIdFromDesc) {
                            expenseId = expenseIdFromDesc[0];
                        }
                    }
                    
                    // Also check sourceId field which contains the actual expense _id
                    if (entry.sourceId) {
                        // Add the sourceId to processed expenses to prevent duplicate processing
                        processedExpenses.add(entry.sourceId);
                    }
                    
                    // Skip if this expense was already processed
                    if (expenseId && processedExpenses.has(expenseId)) {
                        return; // Skip this transaction
                    }
                    
                    // Mark this transaction as processed
                    processedTransactions.add(entry.transactionId);
                    
                    // Mark the expense as processed
                    if (expenseId) {
                        processedExpenses.add(expenseId);
                    }
                    
                    // Also mark any related expense transaction IDs and expense IDs
                    if (entry.reference) {
                        processedTransactions.add(entry.reference);
                        // If reference looks like an expense ID, also add it as processed
                        if (entry.reference.startsWith('EXP-')) {
                            processedTransactions.add(entry.reference);
                        }
                    }
                    
                    const expenseAmount = cashEntry.credit;
                    expenseBreakdown.total += expenseAmount;
                    
                    // Categorize based on description
                    let category = 'maintenance'; // Default to maintenance instead of other_expenses
                    let description = entry.description || 'Cash Expense';
                    
                    if (entry.description) {
                        const desc = entry.description.toLowerCase();
                        if (desc.includes('maintenance')) {
                            category = 'maintenance';
                        } else if (desc.includes('utilit')) {
                            category = 'utilities';
                        } else if (desc.includes('clean')) {
                            category = 'cleaning';
                        } else if (desc.includes('security')) {
                            category = 'security';
                        } else if (desc.includes('management')) {
                            category = 'management';
                        }
                    }
                    
                    // Get residence name using helper function
                    const residenceName = getResidenceName(entry, expenses);
                    
                    // Add to appropriate category
                    expenseBreakdown.by_category[category].total += expenseAmount;
                    expenseBreakdown.by_category[category].transactions.push({
                        transactionId: entry.transactionId,
                        date: entry.date,
                        amount: expenseAmount,
                        accountCode: cashEntry.accountCode,
                        accountName: cashEntry.accountName,
                        residence: residenceName,
                        description: description
                    });
                    
                    // Group by residence
                    if (!expenseBreakdown.by_residence[residenceName]) {
                        expenseBreakdown.by_residence[residenceName] = 0;
                    }
                    expenseBreakdown.by_residence[residenceName] += expenseAmount;
                    
                    // Group by month
                    const monthKey = entry.date.toISOString().slice(0, 7); // YYYY-MM
                    if (!expenseBreakdown.by_month[monthKey]) {
                        expenseBreakdown.by_month[monthKey] = 0;
                    }
                    expenseBreakdown.by_month[monthKey] += expenseAmount;
                }
                
                // Also check for traditional Expense account types (for completeness)
                // Skip if this transaction was already processed in the Cash credits section
                if (!processedTransactions.has(entry.transactionId)) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode || line.account?.code;
                        const accountName = line.accountName || line.account?.name;
                        const accountType = line.accountType || line.account?.type;
                        const debit = line.debit || 0;
                        
                        if (accountType === 'Expense' || accountType === 'expense') {
                            // Check if this expense was already processed
                            let expenseId = null;
                            if (entry.reference) {
                                if (entry.reference.startsWith('EXP-')) {
                                    expenseId = entry.reference;
                                } else {
                                    const expenseIdMatch = entry.reference.match(/EXP-[\w-]+/);
                                    if (expenseIdMatch) {
                                        expenseId = expenseIdMatch[0];
                                    } else {
                                        expenseId = entry.reference;
                                    }
                                }
                            }
                            
                            // Also check sourceId field
                            if (entry.sourceId) {
                                processedExpenses.add(entry.sourceId);
                            }
                            
                            // Skip if this expense was already processed
                            if (expenseId && processedExpenses.has(expenseId)) {
                                return; // Skip this line
                            }
                            
                            // Mark this transaction as processed
                            processedTransactions.add(entry.transactionId);
                            
                            // Mark the expense as processed
                            if (expenseId) {
                                processedExpenses.add(expenseId);
                            }
                            
                            expenseBreakdown.total += debit;
                        
                        // Get residence name using helper function
                        const residenceName = getResidenceName(entry, expenses);
                        
                        // Categorize by account code
                        if (accountCode.startsWith('5001') || accountName.toLowerCase().includes('maintenance')) {
                            expenseBreakdown.by_category.maintenance.total += debit;
                            expenseBreakdown.by_category.maintenance.transactions.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: debit,
                                accountCode,
                                accountName,
                                residence: residenceName,
                                description: entry.description || 'Maintenance Expense'
                            });
                        } else if (accountCode.startsWith('5002') || accountName.toLowerCase().includes('utilit')) {
                            expenseBreakdown.by_category.utilities.total += debit;
                            expenseBreakdown.by_category.utilities.transactions.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: debit,
                                accountCode,
                                accountName,
                                residence: residenceName,
                                description: entry.description || 'Utilities Expense'
                            });
                        } else if (accountCode.startsWith('5003') || accountName.toLowerCase().includes('clean')) {
                            expenseBreakdown.by_category.cleaning.total += debit;
                            expenseBreakdown.by_category.cleaning.transactions.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: debit,
                                accountCode,
                                accountName,
                                residence: residenceName,
                                description: entry.description || 'Cleaning Expense'
                            });
                        } else if (accountCode.startsWith('5004') || accountName.toLowerCase().includes('security')) {
                            expenseBreakdown.by_category.security.total += debit;
                            expenseBreakdown.by_category.security.transactions.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: debit,
                                accountCode,
                                accountName,
                                residence: residenceName,
                                description: entry.description || 'Security Expense'
                            });
                        } else if (accountCode.startsWith('5005') || accountName.toLowerCase().includes('management')) {
                            expenseBreakdown.by_category.management.total += debit;
                            expenseBreakdown.by_category.management.transactions.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: debit,
                                accountCode,
                                accountName,
                                residence: residenceName,
                                description: entry.description || 'Management Expense'
                            });
                        } else {
                            // Default to maintenance category instead of other_expenses
                            expenseBreakdown.by_category.maintenance.total += debit;
                            expenseBreakdown.by_category.maintenance.transactions.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: debit,
                                accountCode,
                                accountName,
                                residence: residenceName,
                                description: entry.description || 'Other Expense'
                            });
                        }
                        
                        // Group by residence
                        if (!expenseBreakdown.by_residence[residenceName]) {
                            expenseBreakdown.by_residence[residenceName] = 0;
                        }
                        expenseBreakdown.by_residence[residenceName] += debit;
                        
                        // Group by month
                        const monthKey = entry.date.toISOString().slice(0, 7); // YYYY-MM
                        if (!expenseBreakdown.by_month[monthKey]) {
                            expenseBreakdown.by_month[monthKey] = 0;
                        }
                        expenseBreakdown.by_month[monthKey] += debit;
                    }
                });
                }
            }
        });
        
        // Process expense details from Expense model
        // Only process expenses that haven't been counted in transaction entries
        expenses.forEach(expense => {
            const expenseAmount = expense.amount || 0;
            
            // Skip if this expense was already processed in transaction entries
            const expenseTransactionId = expense.transactionId || expense._id;
            const expenseId = expense._id.toString();
            
            // Check if this expense was already processed by checking:
            // 1. Direct transaction ID match
            // 2. Expense ID match (in case expense._id was used as reference)
            // 3. Reference field match (in case expense ID was used as reference)
            // 4. Expense ID in processedExpenses Set
            // 5. Check if any processed expense ID matches this expense's ID pattern
            // 6. Check if the expense reference matches any processed expense ID
            // 7. Check if this expense's reference field matches any processed expense ID
            // 8. Check if this expense's expenseId field matches any processed expense ID
            const isAlreadyProcessed = processedTransactions.has(expenseTransactionId) || 
                processedTransactions.has(expenseId) ||
                processedTransactions.has(expense.reference) ||
                processedExpenses.has(expenseId) ||
                processedExpenses.has(expense.reference) ||
                processedExpenses.has(expense.expenseId) || // Check expenseId field
                Array.from(processedExpenses).some(processedId => {
                    // Check if the processed expense ID matches this expense in any way
                    return processedId.includes(expenseId) || 
                        expenseId.includes(processedId) ||
                        (expense.reference && processedId.includes(expense.reference)) ||
                        (expense.reference && expense.reference.includes(processedId)) ||
                        // Check if the processed expense ID is in the expense's reference field
                        (expense.reference && expense.reference.includes(processedId)) ||
                        // Check if this expense's reference is in any processed expense ID
                        (expense.reference && Array.from(processedExpenses).some(p => p.includes(expense.reference))) ||
                        // Check if this expense's expenseId matches any processed expense ID
                        (expense.expenseId && processedId.includes(expense.expenseId)) ||
                        (expense.expenseId && expense.expenseId.includes(processedId));
                });
            
            if (isAlreadyProcessed) {
                return; // Skip this expense
            }
            
            expenseBreakdown.total += expenseAmount;
            
            // Categorize expense based on category field
            let category = 'maintenance'; // Default to maintenance instead of other_expenses
            if (expense.category) {
                const expCategory = expense.category.toLowerCase();
                if (expCategory.includes('maintenance')) {
                    category = 'maintenance';
                } else if (expCategory.includes('utilit')) {
                    category = 'utilities';
                } else if (expCategory.includes('clean')) {
                    category = 'cleaning';
                } else if (expCategory.includes('security')) {
                    category = 'security';
                } else if (expCategory.includes('management')) {
                    category = 'management';
                }
            }
            
            // Add to appropriate category
            expenseBreakdown.by_category[category].total += expenseAmount;
            expenseBreakdown.by_category[category].transactions.push({
                transactionId: expense.transactionId || expense._id,
                date: expense.expenseDate,
                amount: expenseAmount,
                accountCode: '5000', // General expense account
                accountName: expense.category || 'Other Expense',
                residence: expense.residence?.name || 'Unknown',
                description: expense.description || 'Expense Payment',
                vendor: expense.vendorName || 'Unknown Vendor'
            });
            
            // Group by residence
            const residenceName = expense.residence?.name || 'Unknown';
            if (!expenseBreakdown.by_residence[residenceName]) {
                expenseBreakdown.by_residence[residenceName] = 0;
            }
            expenseBreakdown.by_residence[residenceName] += expenseAmount;
            
            // Group by month
            const monthKey = expense.expenseDate.toISOString().slice(0, 7); // YYYY-MM
            if (!expenseBreakdown.by_month[monthKey]) {
                expenseBreakdown.by_month[monthKey] = 0;
            }
            expenseBreakdown.by_month[monthKey] += expenseAmount;
            
            const expenseDetail = {
                expenseId: expense._id,
                date: expense.expenseDate,
                vendor: expense.vendorName || 'Unknown Vendor',
                category: expense.category || 'Unknown Category',
                residence: expense.residence?.name || 'Unknown',
                amount: expenseAmount,
                description: expense.description || 'No Description',
                paymentStatus: expense.paymentStatus,
                paymentMethod: expense.paymentMethod || 'Unknown'
            };
            
            expenseBreakdown.expense_details.push(expenseDetail);
        });
        
        return expenseBreakdown;
    }
    
    /**
     * Calculate operating activities
     */
    static calculateOperatingActivities(incomeBreakdown, expenseBreakdown) {
        return {
            cash_received_from_customers: incomeBreakdown.total,
            cash_paid_to_suppliers: 0, // Would need to be calculated from specific supplier payments
            cash_paid_for_expenses: expenseBreakdown.total,
            income_breakdown: incomeBreakdown.by_source,
            expense_breakdown: expenseBreakdown.by_category
        };
    }
    
    /**
     * Calculate investing activities
     */
    static calculateInvestingActivities(transactionEntries) {
        let purchase_of_equipment = 0;
        let purchase_of_buildings = 0;
        
        transactionEntries.forEach(entry => {
            if (entry.entries && entry.entries.length > 0) {
                entry.entries.forEach(line => {
                    const accountName = line.accountName;
                    const debit = line.debit || 0;
                    
                    if (accountName.toLowerCase().includes('equipment') || 
                        accountName.toLowerCase().includes('furniture') ||
                        accountName.toLowerCase().includes('machinery')) {
                        purchase_of_equipment += debit;
                    } else if (accountName.toLowerCase().includes('building') || 
                               accountName.toLowerCase().includes('construction') ||
                               accountName.toLowerCase().includes('property')) {
                        purchase_of_buildings += debit;
                    }
                });
            }
        });
        
        return {
            purchase_of_equipment,
            purchase_of_buildings
        };
    }
    
    /**
     * Calculate financing activities
     */
    static calculateFinancingActivities(transactionEntries) {
        let owners_contribution = 0;
        let loan_proceeds = 0;
        
        transactionEntries.forEach(entry => {
            if (entry.entries && entry.entries.length > 0) {
                entry.entries.forEach(line => {
                    const accountName = line.accountName;
                    const credit = line.credit || 0;
                    
                    if (accountName.toLowerCase().includes('owner') || 
                        accountName.toLowerCase().includes('contribution') ||
                        accountName.toLowerCase().includes('capital')) {
                        owners_contribution += credit;
                    } else if (accountName.toLowerCase().includes('loan') || 
                               accountName.toLowerCase().includes('borrowing')) {
                        loan_proceeds += credit;
                    }
                });
            }
        });
        
        return {
            owners_contribution,
            loan_proceeds
        };
    }
    
    /**
     * Process transaction details for detailed view
     */
    static processTransactionDetails(transactionEntries) {
        return transactionEntries.map(entry => ({
            transactionId: entry.transactionId,
            date: entry.date,
            source: entry.source,
            description: entry.description,
            residence: entry.residence?.name || 'Unknown',
            totalDebit: entry.totalDebit || 0,
            totalCredit: entry.totalCredit || 0,
            entries: entry.entries?.map(line => ({
                accountCode: line.accountCode,
                accountName: line.accountName,
                accountType: line.accountType,
                debit: line.debit || 0,
                credit: line.credit || 0
            })) || []
        }));
    }
    
    /**
     * Process payment details
     */
    static processPaymentDetails(payments) {
        return payments.map(payment => ({
            paymentId: payment.paymentId,
            date: payment.date,
            student: payment.student?.firstName + ' ' + payment.student?.lastName || 'Unknown',
            residence: payment.residence?.name || 'Unknown',
            totalAmount: payment.totalAmount || 0,
            rentAmount: payment.rentAmount || 0,
            adminFee: payment.adminFee || 0,
            deposit: payment.deposit || 0,
            utilities: payment.utilities || 0,
            other: payment.other || 0,
            paymentMethod: payment.method || 'Unknown',
            status: payment.status
        }));
    }
    
    /**
     * Process expense details
     */
    static processExpenseDetails(expenses) {
        return expenses.map(expense => ({
            expenseId: expense._id,
            date: expense.expenseDate,
            vendor: expense.vendorName || 'Unknown',
            category: expense.category || 'Unknown',
            residence: expense.residence?.name || 'Unknown',
            amount: expense.amount || 0,
            description: expense.description || 'No Description',
            paymentStatus: expense.paymentStatus,
            paymentMethod: expense.paymentMethod || 'Unknown'
        }));
    }
    
    /**
     * Generate monthly breakdown
     */
    static generateMonthlyBreakdown(transactionEntries, payments, expenses, period) {
        const months = {};
        
        // Initialize all months
        for (let month = 1; month <= 12; month++) {
            const monthKey = `${period}-${String(month).padStart(2, '0')}`;
            months[monthKey] = {
                income: {
                    total: 0,
                    rental_income: 0,
                    admin_fees: 0,
                    deposits: 0,
                    utilities: 0,
                    advance_payments: 0,
                    other_income: 0
                },
                expenses: {
                    total: 0,
                    maintenance: 0,
                    utilities: 0,
                    cleaning: 0,
                    security: 0,
                    management: 0,
                    transactions: [] // Add detailed expense transactions
                },
                net_cash_flow: 0,
                transaction_count: 0,
                payment_count: 0,
                expense_count: 0
            };
        }
        
        // Create a map of transaction entries to their corresponding payments for accurate date handling
        const transactionToPaymentMap = new Map();
        
        if (payments.length > 0) {
            payments.forEach(payment => {
            // Find transaction entries that correspond to this payment
            const relatedTransactions = transactionEntries.filter(entry => {
                // Match by payment ID in description
                if (entry.description?.includes(payment.paymentId)) {
                    return true;
                }
                
                // Match by payment _id in reference field (this is the key fix!)
                if (entry.reference && entry.reference === payment._id.toString()) {
                    return true;
                }
                
                // Match by amount and date proximity (for cases where payment ID is not in description)
                // Check if any payment component matches the transaction amount
                const paymentComponents = payment.payments || [];
                const amountMatch = paymentComponents.some(comp => 
                    Math.abs(entry.totalDebit - comp.amount) < 0.01
                ) || Math.abs(entry.totalDebit - payment.totalAmount) < 0.01;
                
                const dateProximity = Math.abs(entry.date.getTime() - payment.date.getTime()) < 30 * 24 * 60 * 60 * 1000; // Within 30 days
                
                // Also check if the transaction description contains payment-related keywords
                const descriptionMatch = entry.description && (
                    entry.description.toLowerCase().includes('payment') ||
                    entry.description.toLowerCase().includes('allocation') ||
                    entry.description.toLowerCase().includes('rent') ||
                    entry.description.toLowerCase().includes('admin')
                );
                
                return amountMatch && dateProximity && descriptionMatch;
            });
            
            relatedTransactions.forEach(transaction => {
                transactionToPaymentMap.set(transaction.transactionId, payment);
            });
        });
        } else {
            console.log('⚠️ No payments found in database. Using transaction dates for cash flow.');
        }
        
        // Process transaction entries by month
        transactionEntries.forEach(entry => {
            // Get the corresponding payment for accurate date handling
            const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
            const effectiveDate = correspondingPayment ? correspondingPayment.date : entry.date;
            const monthKey = effectiveDate.toISOString().slice(0, 7);
            
            if (months[monthKey]) {
                months[monthKey].transaction_count++;
                
                if (entry.entries && entry.entries.length > 0) {
                    // Process Cash/Bank debits (income) - check both Cash and Bank Account
                    const cashDebit = entry.entries.find(line => {
                        const accountCode = line.accountCode || line.account?.code;
                        const accountName = line.accountName || line.account?.name;
                        return accountCode === '1000' && (accountName === 'Cash' || accountName === 'Bank Account') && line.debit > 0;
                    });
                    
                    if (cashDebit) {
                        const incomeAmount = cashDebit.debit;
                        months[monthKey].income.total += incomeAmount;
                        
                        // Categorize income
                        let isAdvancePayment = false;
                        
                        // Check if this is an advance payment by looking at payment details
                        if (correspondingPayment) {
                            const paymentDate = correspondingPayment.date;
                            const paymentMonth = paymentDate.getMonth() + 1; // 1-12
                            const paymentYear = paymentDate.getFullYear();
                            
                            // Check if payment is for future months (advance payment)
                            if (correspondingPayment.allocation && correspondingPayment.allocation.monthlyBreakdown) {
                                // Try to match this specific transaction amount to a specific allocation
                                const matchingAllocation = correspondingPayment.allocation.monthlyBreakdown.find(allocation => {
                                    if (allocation.amountAllocated && Math.abs(allocation.amountAllocated - incomeAmount) < 0.01) {
                                        return true; // Found matching amount
                                    }
                                    return false;
                                });
                                
                                if (matchingAllocation) {
                                    // Check if the matching allocation is for a future month
                                    if (matchingAllocation.month && matchingAllocation.year) {
                                        // Parse month string like "2025-09" or just month number
                                        let allocationMonth, allocationYear;
                                        if (typeof matchingAllocation.month === 'string' && matchingAllocation.month.includes('-')) {
                                            // Format: "2025-09"
                                            const [year, month] = matchingAllocation.month.split('-');
                                            allocationYear = parseInt(year);
                                            allocationMonth = parseInt(month);
                                        } else if (matchingAllocation.month && matchingAllocation.year) {
                                            // Format: month number and year
                                            allocationYear = matchingAllocation.year;
                                            allocationMonth = matchingAllocation.month;
                                        }
                                        
                                        if (allocationYear && allocationMonth) {
                                            // If allocation is for a future month/year, it's an advance payment
                                            if (allocationYear > paymentYear) {
                                                isAdvancePayment = true;
                                            } else if (allocationYear === paymentYear && allocationMonth > paymentMonth) {
                                                isAdvancePayment = true;
                                            }
                                        }
                                    }
                                } else {
                                    // No exact amount match found, fall back to checking if any allocation is for future months
                                    const hasFutureAllocation = correspondingPayment.allocation.monthlyBreakdown.some(allocation => {
                                        if (allocation.month && allocation.year) {
                                            // Parse month string like "2025-09" or just month number
                                            let allocationMonth, allocationYear;
                                            if (typeof allocation.month === 'string' && allocation.month.includes('-')) {
                                                // Format: "2025-09"
                                                const [year, month] = allocation.month.split('-');
                                                allocationYear = parseInt(year);
                                                allocationMonth = parseInt(month);
                                            } else if (allocation.month && allocation.year) {
                                                // Format: month number and year
                                                allocationYear = allocation.year;
                                                allocationMonth = allocation.month;
                                            }
                                            
                                            if (allocationYear && allocationMonth) {
                                                // If allocation is for a future month/year, it's an advance payment
                                                if (allocationYear > paymentYear) {
                                                    return true; // Future year
                                                } else if (allocationYear === paymentYear && allocationMonth > paymentMonth) {
                                                    return true; // Future month in same year
                                                }
                                            }
                                        }
                                        return false;
                                    });
                                    
                                    if (hasFutureAllocation) {
                                        isAdvancePayment = true;
                                    }
                                }
                            }
                        }
                        
                        // Recalculate category for monthly breakdown (same logic as main processing)
                        let monthlyCategory = 'other_income';
                        if (entry.description) {
                            const desc = entry.description.toLowerCase();
                            // Check for advance payments first (most specific)
                            if (desc.includes('advance') || desc.includes('prepaid') || desc.includes('future')) {
                                monthlyCategory = 'advance_payments';
                            } 
                            // Check for specific payment allocations
                            else if (desc.includes('payment allocation: rent')) {
                                monthlyCategory = 'rental_income';
                            } else if (desc.includes('payment allocation: admin')) {
                                monthlyCategory = 'admin_fees';
                            } 
                            // Fallback to general keywords
                            else if (desc.includes('rent')) {
                                monthlyCategory = 'rental_income';
                            } else if (desc.includes('admin')) {
                                monthlyCategory = 'admin_fees';
                            } else if (desc.includes('deposit')) {
                                monthlyCategory = 'deposits';
                            } else if (desc.includes('utilit')) {
                                monthlyCategory = 'utilities';
                            }
                        }
                        
                        // Apply categorization to monthly breakdown
                        if (monthlyCategory === 'advance_payments') {
                            months[monthKey].income.advance_payments += incomeAmount;
                            console.log(`💰 Advance payment detected: ${incomeAmount} for ${monthKey} - Transaction: ${entry.transactionId}`);
                        } else if (monthlyCategory === 'rental_income') {
                            months[monthKey].income.rental_income += incomeAmount;
                            console.log(`💰 Rental income detected: ${incomeAmount} for ${monthKey} - Transaction: ${entry.transactionId}`);
                        } else if (monthlyCategory === 'admin_fees') {
                            months[monthKey].income.admin_fees += incomeAmount;
                            console.log(`💰 Admin fees detected: ${incomeAmount} for ${monthKey} - Transaction: ${entry.transactionId}`);
                        } else if (monthlyCategory === 'deposits') {
                            months[monthKey].income.deposits += incomeAmount;
                        } else if (monthlyCategory === 'utilities') {
                            months[monthKey].income.utilities += incomeAmount;
                        } else {
                            months[monthKey].income.other_income += incomeAmount;
                        }
                    }
                    
                    // Process Cash/Bank credits (expenses) - check both Cash and Bank Account
                    const cashCredit = entry.entries.find(line => {
                        const accountCode = line.accountCode || line.account?.code;
                        const accountName = line.accountName || line.account?.name;
                        return accountCode === '1000' && (accountName === 'Cash' || accountName === 'Bank Account') && line.credit > 0;
                    });
                    
                    if (cashCredit) {
                        const expenseAmount = cashCredit.credit;
                        
                        // Check if this is a petty cash allocation (should not be counted as expense)
                        const isPettyCashTransfer = entry.description && (
                            entry.description.toLowerCase().includes('petty cash') ||
                            entry.description.toLowerCase().includes('cash allocation')
                        );
                        
                        if (isPettyCashTransfer) {
                            // Don't count as expense - skip to next entry
                            console.log(`💰 Petty cash transfer excluded from monthly expenses: ${expenseAmount}`);
                            return; // Skip this transaction entry
                        }
                        
                        months[monthKey].expenses.total += expenseAmount;
                        
                        // Get residence name
                        const residenceName = entry.residence?.name || 'Unknown';
                        
                        // Create detailed expense transaction
                        const expenseTransaction = {
                            transactionId: entry.transactionId,
                            date: effectiveDate,
                            amount: expenseAmount,
                            accountCode: cashCredit.accountCode,
                            accountName: cashCredit.accountName,
                            residence: residenceName,
                            description: entry.description || 'Cash Expense',
                            source: entry.source || 'Unknown'
                        };
                        
                        // Categorize expenses and add to detailed transactions
                        if (entry.description) {
                            const desc = entry.description.toLowerCase();
                            if (desc.includes('maintenance')) {
                                months[monthKey].expenses.maintenance += expenseAmount;
                                expenseTransaction.category = 'maintenance';
                            } else if (desc.includes('utilit')) {
                                months[monthKey].expenses.utilities += expenseAmount;
                                expenseTransaction.category = 'utilities';
                            } else if (desc.includes('clean')) {
                                months[monthKey].expenses.cleaning += expenseAmount;
                                expenseTransaction.category = 'cleaning';
                            } else if (desc.includes('security')) {
                                months[monthKey].expenses.security += expenseAmount;
                                expenseTransaction.category = 'security';
                            } else if (desc.includes('management')) {
                                months[monthKey].expenses.management += expenseAmount;
                                expenseTransaction.category = 'management';
                            } else {
                                // Default to maintenance instead of other_expenses
                                months[monthKey].expenses.maintenance += expenseAmount;
                                expenseTransaction.category = 'maintenance';
                            }
                        } else {
                            // Default to maintenance instead of other_expenses
                            months[monthKey].expenses.maintenance += expenseAmount;
                            expenseTransaction.category = 'maintenance';
                        }
                        
                        // Add to detailed transactions
                        months[monthKey].expenses.transactions.push(expenseTransaction);
                    }
                }
            }
        });
        
        // Process expenses by month - ONLY count expenses that haven't been processed in transaction entries
        // This prevents double counting since expenses are already counted in transaction entries
        const processedExpenseIds = new Set();
        
        // First, collect all expense IDs that were processed in transaction entries
        transactionEntries.forEach(entry => {
            if (entry.entries && entry.entries.length > 0) {
                // Look for Cash/Bank credits (expenses paid)
                const cashEntry = entry.entries.find(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    return accountCode === '1000' && (accountName === 'Cash' || accountName === 'Bank Account') && line.credit > 0;
                });
                
                if (cashEntry) {
                    // Extract expense ID from reference or description
                    let expenseId = null;
                    if (entry.reference) {
                        if (entry.reference.startsWith('EXP-')) {
                            expenseId = entry.reference;
                        } else {
                            const expenseIdMatch = entry.reference.match(/EXP-[\w-]+/);
                            if (expenseIdMatch) {
                                expenseId = expenseIdMatch[0];
                            } else {
                                expenseId = entry.reference;
                            }
                        }
                    }
                    
                    if (entry.description && entry.description.includes('Payment for Expense')) {
                        const expenseIdFromDesc = entry.description.match(/EXP-[\w-]+/);
                        if (expenseIdFromDesc) {
                            expenseId = expenseIdFromDesc[0];
                        }
                    }
                    
                    if (entry.sourceId) {
                        processedExpenseIds.add(String(entry.sourceId));
                    }
                    
                    if (expenseId) {
                        processedExpenseIds.add(String(expenseId));
                    }
                }
            }
        });
        
        // Only process expenses that haven't been counted in transaction entries
        expenses.forEach(expense => {
            const expenseId = expense._id.toString();
            const expenseTransactionId = expense.transactionId || expense._id;
            
            // Check if this expense was already processed in transaction entries
            const isAlreadyProcessed = processedExpenseIds.has(expenseId) || 
                processedExpenseIds.has(expenseTransactionId) ||
                processedExpenseIds.has(expense.reference) ||
                Array.from(processedExpenseIds).some(processedId => {
                    // Ensure both values are strings before calling includes
                    const processedIdStr = String(processedId);
                    const expenseIdStr = String(expenseId);
                    const expenseRefStr = expense.reference ? String(expense.reference) : '';
                    
                    return processedIdStr.includes(expenseIdStr) || 
                        expenseIdStr.includes(processedIdStr) ||
                        (expenseRefStr && processedIdStr.includes(expenseRefStr)) ||
                        (expenseRefStr && expenseRefStr.includes(processedIdStr));
                });
            
            if (isAlreadyProcessed) {
                return; // Skip this expense - it was already counted in transaction entries
            }
            
            const monthKey = expense.expenseDate.toISOString().slice(0, 7);
            if (months[monthKey]) {
                months[monthKey].expense_count++;
                const expenseAmount = expense.amount || 0;
                months[monthKey].expenses.total += expenseAmount;
                
                // Create detailed expense transaction
                const expenseTransaction = {
                    transactionId: expense.transactionId || expense._id,
                    date: expense.expenseDate,
                    amount: expenseAmount,
                    accountCode: '5000', // General expense account
                    accountName: expense.category || 'Other Expense',
                    residence: expense.residence?.name || 'Unknown',
                    description: expense.description || 'Expense Payment',
                    source: 'Expense Model',
                    vendor: expense.vendorName || 'Unknown Vendor',
                    category: expense.category || 'maintenance'
                };
                
                // Categorize expense and add to detailed transactions
                if (expense.category) {
                    const category = expense.category.toLowerCase();
                    if (category.includes('maintenance')) {
                        months[monthKey].expenses.maintenance += expenseAmount;
                        expenseTransaction.category = 'maintenance';
                    } else if (category.includes('utilit')) {
                        months[monthKey].expenses.utilities += expenseAmount;
                        expenseTransaction.category = 'utilities';
                    } else if (category.includes('clean')) {
                        months[monthKey].expenses.cleaning += expenseAmount;
                        expenseTransaction.category = 'cleaning';
                    } else if (category.includes('security')) {
                        months[monthKey].expenses.security += expenseAmount;
                        expenseTransaction.category = 'security';
                    } else if (category.includes('management')) {
                        months[monthKey].expenses.management += expenseAmount;
                        expenseTransaction.category = 'management';
                    } else {
                        // Default to maintenance instead of other_expenses
                        months[monthKey].expenses.maintenance += expenseAmount;
                        expenseTransaction.category = 'maintenance';
                    }
                } else {
                    // Default to maintenance instead of other_expenses
                    months[monthKey].expenses.maintenance += expenseAmount;
                    expenseTransaction.category = 'maintenance';
                }
                
                // Add to detailed transactions
                months[monthKey].expenses.transactions.push(expenseTransaction);
            }
        });
        
        // Process payments by month
        payments.forEach(payment => {
            const monthKey = payment.date.toISOString().slice(0, 7);
            if (months[monthKey]) {
                months[monthKey].payment_count++;
            }
        });
        
        // Calculate net cash flow for each month
        Object.keys(months).forEach(monthKey => {
            months[monthKey].net_cash_flow = months[monthKey].income.total - months[monthKey].expenses.total;
        });
        
        return months;
    }
    
    /**
     * Calculate comprehensive cash breakdown
     */
    static async calculateCashBreakdown(transactionEntries, payments, period) {
        const cashBreakdown = {
            beginning_cash: 0,
            ending_cash: 0,
            cash_inflows: {
                total: 0,
                from_customers: 0,
                from_advance_payments: 0,
                from_other_sources: 0
            },
            cash_outflows: {
                total: 0,
                to_suppliers: 0,
                for_expenses: 0,
                for_other_purposes: 0
            },
            internal_cash_transfers: {
                total: 0,
                by_month: {},
                transactions: []
            },
            net_change_in_cash: 0,
            cash_reconciliation: {
                beginning_cash: 0,
                cash_inflows: 0,
                cash_outflows: 0,
                calculated_ending_cash: 0,
                actual_ending_cash: 0,
                difference: 0
            },
            by_month: {},
            advance_payments_impact: {
                total_advance_received: 0,
                advance_utilized: 0,
                advance_outstanding: 0,
                by_student: {},
                by_residence: {}
            }
        };
        
        // Initialize monthly breakdown
        for (let month = 1; month <= 12; month++) {
            const monthKey = `${period}-${String(month).padStart(2, '0')}`;
            cashBreakdown.by_month[monthKey] = {
                beginning_cash: 0,
                cash_inflows: 0,
                cash_outflows: 0,
                net_change: 0,
                ending_cash: 0,
                advance_payments_received: 0,
                advance_payments_utilized: 0,
                internal_transfers: 0
            };
        }
        
        // Create a map of transaction entries to their corresponding payments for accurate date handling
        const transactionToPaymentMap = new Map();
        
        // Process transaction entries to calculate cash flows
        transactionEntries.forEach(entry => {
            if (entry.entries && entry.entries.length > 0) {
                // Use payment date if available, otherwise use transaction date
                let effectiveDate = entry.date;
                
                // For expense payments, prioritize datePaid from metadata
                if (entry.source === 'expense_payment' && entry.metadata && entry.metadata.datePaid) {
                    effectiveDate = new Date(entry.metadata.datePaid);
                    console.log(`💰 Using datePaid from expense payment: ${entry.transactionId} - ${effectiveDate.toISOString().slice(0, 7)}`);
                }
                // Try to find corresponding payment for accurate date
                else if (entry.reference) {
                    // Look for payment by reference
                    const payment = payments.find(p => p._id.toString() === entry.reference);
                    if (payment) {
                        effectiveDate = payment.date;
                        transactionToPaymentMap.set(entry.transactionId, payment);
                        console.log(`🔗 Linked transaction ${entry.transactionId} to payment ${payment.paymentId} with date ${payment.date.toISOString().slice(0, 7)}`);
                    } else {
                        console.log(`⚠️ No payment found for reference ${entry.reference} in transaction ${entry.transactionId} - using transaction date`);
                        // Use transaction date if payment reference is invalid
                        effectiveDate = entry.date;
                    }
                }
                
                const monthKey = effectiveDate.toISOString().slice(0, 7);
                
                // Process cash inflows (debits to cash accounts)
                const cashInflow = entry.entries.find(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    return accountCode === '1000' && (accountName === 'Cash' || accountName === 'Bank Account') && line.debit > 0;
                });
                
                // Also check for petty cash account inflows (internal transfers)
                const pettyCashInflow = entry.entries.find(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    return accountCode === '1011' && accountName === 'Admin Petty Cash' && line.debit > 0;
                });
                
                if (cashInflow) {
                    const amount = cashInflow.debit;
                    cashBreakdown.cash_inflows.total += amount;
                    cashBreakdown.cash_inflows.from_customers += amount;
                    
                    // Check if this is an advance payment
                    const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
                    let isAdvancePayment = false;
                    
                    // Check description for advance payment keywords
                    if (entry.description && (
                        entry.description.toLowerCase().includes('advance') ||
                        entry.description.toLowerCase().includes('prepaid') ||
                        entry.description.toLowerCase().includes('future')
                    )) {
                        isAdvancePayment = true;
                    }
                    
                    // Check if this is a direct advance payment transaction
                    if (entry.source === 'advance_payment' || entry.sourceModel === 'AdvancePayment') {
                        isAdvancePayment = true;
                    }
                    
                    // Check monthlyBreakdown for advance payments
                    if (correspondingPayment && correspondingPayment.monthlyBreakdown && correspondingPayment.monthlyBreakdown.length > 0) {
                        const advanceAllocations = correspondingPayment.monthlyBreakdown.filter(
                            allocation => allocation.allocationType === 'advance_payment'
                        );
                        
                        if (advanceAllocations.length > 0) {
                            // Calculate advance payment amount
                            const advanceAmount = advanceAllocations.reduce((sum, allocation) => 
                                sum + (allocation.amountAllocated || 0), 0
                            );
                            
                            // If this transaction amount matches the advance amount, it's an advance payment
                            if (Math.abs(amount - advanceAmount) < 0.01) {
                                isAdvancePayment = true;
                            }
                        }
                    }
                    
                    // Also check payment details for advance payments
                    if (correspondingPayment && correspondingPayment.payments && correspondingPayment.payments.length > 0) {
                        const hasFutureAllocation = correspondingPayment.payments.some(payment => {
                            if (payment.month && payment.year) {
                                const allocationDate = new Date(payment.year, payment.month - 1);
                                return allocationDate > correspondingPayment.date;
                            }
                            return false;
                        });
                        
                        if (hasFutureAllocation) {
                            isAdvancePayment = true;
                        }
                    }
                    
                    if (isAdvancePayment) {
                        cashBreakdown.cash_inflows.from_advance_payments += amount;
                        cashBreakdown.advance_payments_impact.total_advance_received += amount;
                        
                        if (cashBreakdown.by_month[monthKey]) {
                            cashBreakdown.by_month[monthKey].advance_payments_received += amount;
                        }
                    }
                    
                    if (cashBreakdown.by_month[monthKey]) {
                        cashBreakdown.by_month[monthKey].cash_inflows += amount;
                    }
                }
                
                // Handle petty cash inflows (internal transfers)
                if (pettyCashInflow) {
                    const amount = pettyCashInflow.debit;
                    
                    // Check if this is a petty cash allocation (cash transfer, not income)
                    const isPettyCashTransfer = entry.description && (
                        entry.description.toLowerCase().includes('petty cash') ||
                        entry.description.toLowerCase().includes('cash allocation')
                    );
                    
                    if (isPettyCashTransfer) {
                        // This is an internal cash transfer - don't count as income
                        // The cash is just moving between accounts (Bank to Petty Cash)
                        console.log(`💰 Petty cash inflow tracked: ${amount} - internal transfer`);
                        
                        // Track the corresponding outflow was already handled above
                        // This inflow balances the outflow, so net effect is zero
                    }
                }
                
                // Process cash outflows (credits to cash accounts)
                const cashOutflow = entry.entries.find(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    return accountCode === '1000' && (accountName === 'Cash' || accountName === 'Bank Account') && line.credit > 0;
                });
                
                if (cashOutflow) {
                    const amount = cashOutflow.credit;
                    
                    // Check if this is a petty cash allocation (cash transfer, not expense)
                    const isPettyCashTransfer = entry.description && (
                        entry.description.toLowerCase().includes('petty cash') ||
                        entry.description.toLowerCase().includes('cash allocation')
                    );
                    
                    if (isPettyCashTransfer) {
                        // This is a cash transfer between accounts - track it as internal transfer only
                        // DO NOT count as cash outflow since it's just moving money between accounts
                        
                        // Track as internal cash transfer
                        if (!cashBreakdown.internal_cash_transfers) {
                            cashBreakdown.internal_cash_transfers = {
                                total: 0,
                                by_month: {},
                                transactions: []
                            };
                        }
                        cashBreakdown.internal_cash_transfers.total += amount;
                        cashBreakdown.internal_cash_transfers.transactions.push({
                            transactionId: entry.transactionId,
                            date: effectiveDate,
                            amount: amount,
                            from_account: 'Bank Account',
                            to_account: 'Admin Petty Cash',
                            description: entry.description
                        });
                        
                        if (cashBreakdown.by_month[monthKey]) {
                            if (!cashBreakdown.by_month[monthKey].internal_transfers) {
                                cashBreakdown.by_month[monthKey].internal_transfers = 0;
                            }
                            cashBreakdown.by_month[monthKey].internal_transfers += amount;
                        }
                        
                        console.log(`💰 Petty cash transfer tracked: ${amount} - internal transfer (not counted as outflow)`);
                        return; // Skip to next entry - don't count as expense
                    }
                    
                    // Only count actual business expenses as cash outflows
                    cashBreakdown.cash_outflows.total += amount;
                    cashBreakdown.cash_outflows.for_expenses += amount;
                    
                    if (cashBreakdown.by_month[monthKey]) {
                        cashBreakdown.by_month[monthKey].cash_outflows += amount;
                    }
                }
            }
        });
        
        // Calculate net change in cash
        cashBreakdown.net_change_in_cash = cashBreakdown.cash_inflows.total - cashBreakdown.cash_outflows.total;
        
        // Calculate monthly ending cash balances
        let runningBalance = cashBreakdown.beginning_cash;
        Object.keys(cashBreakdown.by_month).forEach(monthKey => {
            const month = cashBreakdown.by_month[monthKey];
            month.beginning_cash = runningBalance;
            month.net_change = month.cash_inflows - month.cash_outflows;
            month.ending_cash = month.beginning_cash + month.net_change;
            runningBalance = month.ending_cash;
        });
        
        // Set ending cash
        cashBreakdown.ending_cash = runningBalance;
        
        // Calculate cash reconciliation
        // Note: Internal transfers don't affect net cash flow, so they're excluded from reconciliation
        cashBreakdown.cash_reconciliation.cash_inflows = cashBreakdown.cash_inflows.total;
        cashBreakdown.cash_reconciliation.cash_outflows = cashBreakdown.cash_outflows.total;
        cashBreakdown.cash_reconciliation.calculated_ending_cash = cashBreakdown.beginning_cash + cashBreakdown.net_change_in_cash;
        cashBreakdown.cash_reconciliation.actual_ending_cash = cashBreakdown.ending_cash;
        
        // The difference should now be zero since internal transfers are properly excluded
        cashBreakdown.cash_reconciliation.difference = cashBreakdown.cash_reconciliation.actual_ending_cash - cashBreakdown.cash_reconciliation.calculated_ending_cash;
        
        return cashBreakdown;
    }
    
    /**
     * Format cash flow statement in standard format
     */
    static formatCashFlowStatement(cashFlowData) {
        const { period, cash_breakdown, operating_activities, investing_activities, financing_activities, summary } = cashFlowData;
        
        return {
            period,
            cash_flow_statement: {
                // Operating Activities
                operating_activities: {
                    cash_received_from_customers: operating_activities.cash_received_from_customers,
                    cash_paid_to_suppliers: operating_activities.cash_paid_to_suppliers,
                    cash_paid_for_expenses: operating_activities.cash_paid_for_expenses,
                    net_cash_from_operating_activities: operating_activities.cash_received_from_customers - 
                                                       operating_activities.cash_paid_to_suppliers - 
                                                       operating_activities.cash_paid_for_expenses
                },
                
                // Investing Activities
                investing_activities: {
                    purchase_of_equipment: investing_activities.purchase_of_equipment,
                    purchase_of_buildings: investing_activities.purchase_of_buildings,
                    net_cash_from_investing_activities: -(investing_activities.purchase_of_equipment + 
                                                         investing_activities.purchase_of_buildings)
                },
                
                // Financing Activities
                financing_activities: {
                    owners_contribution: financing_activities.owners_contribution,
                    loan_proceeds: financing_activities.loan_proceeds,
                    net_cash_from_financing_activities: financing_activities.owners_contribution + 
                                                       financing_activities.loan_proceeds
                },
                
                // Net Change in Cash
                net_change_in_cash: summary.net_change_in_cash,
                
                // Cash at Beginning of Period
                cash_at_beginning_of_period: cash_breakdown.beginning_cash,
                
                // Cash at End of Period
                cash_at_end_of_period: cash_breakdown.ending_cash,
                
                // Cash Reconciliation
                cash_reconciliation: {
                    beginning_cash: cash_breakdown.beginning_cash,
                    net_change_in_cash: summary.net_change_in_cash,
                    calculated_ending_cash: cash_breakdown.beginning_cash + summary.net_change_in_cash,
                    actual_ending_cash: cash_breakdown.ending_cash,
                    difference: cash_breakdown.ending_cash - (cash_breakdown.beginning_cash + summary.net_change_in_cash),
                    note: "Internal cash transfers are excluded from net cash flow calculation"
                }
            },
            
            // Detailed Cash Breakdown
            detailed_cash_breakdown: {
                cash_inflows: {
                    from_customers: cash_breakdown.cash_inflows.from_customers,
                    from_advance_payments: cash_breakdown.cash_inflows.from_advance_payments,
                    from_other_sources: cash_breakdown.cash_inflows.from_other_sources,
                    total_cash_inflows: cash_breakdown.cash_inflows.total
                },
                cash_outflows: {
                    to_suppliers: cash_breakdown.cash_outflows.to_suppliers,
                    for_expenses: cash_breakdown.cash_outflows.for_expenses,
                    for_other_purposes: cash_breakdown.cash_outflows.for_other_purposes,
                    total_cash_outflows: cash_breakdown.cash_outflows.total
                },
                internal_cash_transfers: cash_breakdown.internal_cash_transfers,
                advance_payments_impact: cash_breakdown.advance_payments_impact
            }
        };
    }
}

module.exports = EnhancedCashFlowService;
