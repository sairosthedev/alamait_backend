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
                    $in: ['payment', 'expense_payment', 'rental_payment', 'manual', 'payment_collection', 'bank_transfer']
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
            
            // Generate monthly breakdown
            const monthlyBreakdown = this.generateMonthlyBreakdown(transactionEntries, payments, expenses, period);
            
            return {
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
                other_income: { total: 0, transactions: [] }
            },
            by_residence: {},
            by_month: {},
            payment_details: []
        };
        
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
        
        // Process transaction entries for income
        transactionEntries.forEach(entry => {
            // Get the corresponding payment for accurate date handling
            const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
            const effectiveDate = correspondingPayment ? correspondingPayment.date : entry.date;
            
            if (entry.entries && entry.entries.length > 0) {
                // Look for Cash debits (income received)
                const cashEntry = entry.entries.find(line => 
                    line.accountCode === '1000' && line.accountName === 'Cash' && line.debit > 0
                );
                
                if (cashEntry) {
                    const incomeAmount = cashEntry.debit;
                    incomeBreakdown.total += incomeAmount;
                    
                    // Categorize based on description and source
                    let category = 'other_income';
                    let description = entry.description || 'Cash Income';
                    
                    if (entry.description) {
                        const desc = entry.description.toLowerCase();
                        if (desc.includes('rent')) {
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
                        source: 'Cash Payment'
                    });
                    
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
        
        transactionEntries.forEach(entry => {
            if (entry.entries && entry.entries.length > 0) {
                // Look for Cash/Bank credits (expenses paid)
                const cashEntry = entry.entries.find(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    return accountCode === '1000' && (accountName === 'Cash' || accountName === 'Bank Account') && line.credit > 0;
                });
                
                if (cashEntry) {
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
                    
                    // Add to appropriate category
                    expenseBreakdown.by_category[category].total += expenseAmount;
                    expenseBreakdown.by_category[category].transactions.push({
                        transactionId: entry.transactionId,
                        date: entry.date,
                        amount: expenseAmount,
                        accountCode: cashEntry.accountCode,
                        accountName: cashEntry.accountName,
                        residence: entry.residence?.name || 'Unknown',
                        description: description
                    });
                    
                    // Group by residence
                    const residenceName = entry.residence?.name || 'Unknown';
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
                        
                        // Categorize by account code
                        if (accountCode.startsWith('5001') || accountName.toLowerCase().includes('maintenance')) {
                            expenseBreakdown.by_category.maintenance.total += debit;
                            expenseBreakdown.by_category.maintenance.transactions.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: debit,
                                accountCode,
                                accountName,
                                residence: entry.residence?.name || 'Unknown',
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
                                residence: entry.residence?.name || 'Unknown',
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
                                residence: entry.residence?.name || 'Unknown',
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
                                residence: entry.residence?.name || 'Unknown',
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
                                residence: entry.residence?.name || 'Unknown',
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
                                residence: entry.residence?.name || 'Unknown',
                                description: entry.description || 'Other Expense'
                            });
                        }
                        
                        // Group by residence
                        const residenceName = entry.residence?.name || 'Unknown';
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
                    other_income: 0
                },
                expenses: {
                    total: 0,
                    maintenance: 0,
                    utilities: 0,
                    cleaning: 0,
                    security: 0,
                    management: 0
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
                    // Process Cash debits (income)
                    const cashDebit = entry.entries.find(line => 
                        line.accountCode === '1000' && line.accountName === 'Cash' && line.debit > 0
                    );
                    
                    if (cashDebit) {
                        const incomeAmount = cashDebit.debit;
                        months[monthKey].income.total += incomeAmount;
                        
                        // Categorize income
                        if (entry.description) {
                            const desc = entry.description.toLowerCase();
                            if (desc.includes('rent')) {
                                months[monthKey].income.rental_income += incomeAmount;
                            } else if (desc.includes('admin')) {
                                months[monthKey].income.admin_fees += incomeAmount;
                            } else if (desc.includes('deposit')) {
                                months[monthKey].income.deposits += incomeAmount;
                            } else if (desc.includes('utilit')) {
                                months[monthKey].income.utilities += incomeAmount;
                            } else {
                                months[monthKey].income.other_income += incomeAmount;
                            }
                        } else {
                            months[monthKey].income.other_income += incomeAmount;
                        }
                    }
                    
                    // Process Cash credits (expenses)
                    const cashCredit = entry.entries.find(line => 
                        line.accountCode === '1000' && line.accountName === 'Cash' && line.credit > 0
                    );
                    
                    if (cashCredit) {
                        const expenseAmount = cashCredit.credit;
                        months[monthKey].expenses.total += expenseAmount;
                        
                        // Categorize expenses
                        if (entry.description) {
                            const desc = entry.description.toLowerCase();
                            if (desc.includes('maintenance')) {
                                months[monthKey].expenses.maintenance += expenseAmount;
                            } else if (desc.includes('utilit')) {
                                months[monthKey].expenses.utilities += expenseAmount;
                            } else if (desc.includes('clean')) {
                                months[monthKey].expenses.cleaning += expenseAmount;
                            } else if (desc.includes('security')) {
                                months[monthKey].expenses.security += expenseAmount;
                            } else if (desc.includes('management')) {
                                months[monthKey].expenses.management += expenseAmount;
                            } else {
                                // Default to maintenance instead of other_expenses
                                months[monthKey].expenses.maintenance += expenseAmount;
                            }
                        } else {
                            // Default to maintenance instead of other_expenses
                            months[monthKey].expenses.maintenance += expenseAmount;
                        }
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
                        processedExpenseIds.add(entry.sourceId);
                    }
                    
                    if (expenseId) {
                        processedExpenseIds.add(expenseId);
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
                
                // Categorize expense
                if (expense.category) {
                    const category = expense.category.toLowerCase();
                    if (category.includes('maintenance')) {
                        months[monthKey].expenses.maintenance += expenseAmount;
                    } else if (category.includes('utilit')) {
                        months[monthKey].expenses.utilities += expenseAmount;
                    } else if (category.includes('clean')) {
                        months[monthKey].expenses.cleaning += expenseAmount;
                    } else if (category.includes('security')) {
                        months[monthKey].expenses.security += expenseAmount;
                    } else if (category.includes('management')) {
                        months[monthKey].expenses.management += expenseAmount;
                    } else {
                        // Default to maintenance instead of other_expenses
                        months[monthKey].expenses.maintenance += expenseAmount;
                    }
                } else {
                    // Default to maintenance instead of other_expenses
                    months[monthKey].expenses.maintenance += expenseAmount;
                }
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
}

module.exports = EnhancedCashFlowService;
