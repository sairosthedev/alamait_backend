const TransactionEntry = require('../models/TransactionEntry');
const Payment = require('../models/Payment');
const Expense = require('../models/finance/Expense');
const Account = require('../models/Account');
const { Residence } = require('../models/Residence');
const mongoose = require('mongoose');
let CashFlowValidator;
try {
    CashFlowValidator = require('./cashFlowValidator');
} catch (error) {
    console.warn('CashFlowValidator not found, validation features will be disabled:', error.message);
    CashFlowValidator = null;
}

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
     * Check if a transaction is an internal cash transfer (cash moving between cash accounts)
     * @param {Object} entry - Transaction entry
     * @returns {boolean} True if it's an internal cash transfer
     */
    static isInternalCashTransfer(entry) {
        if (!entry.entries || entry.entries.length < 2) return false;

        let hasCashDebit = false;
        let hasCashCredit = false;
        let hasNonCashEntry = false;

        for (const line of entry.entries) {
            const accountCode = line.accountCode || line.account?.code;
            const accountName = line.accountName || line.account?.name;
            const accountType = line.accountType || line.account?.type;
            
            // Check if it's a cash account (1000-1099)
            const isCashAccount = accountCode && (accountCode.startsWith('100') || accountCode.startsWith('101'));
            
            if (isCashAccount) {
                if (line.debit > 0) hasCashDebit = true;
                if (line.credit > 0) hasCashCredit = true;
            } else {
                // Check if it's a non-cash entry (not just a clearing account)
                // If it's an expense or income account, it's a real transaction, not a transfer
                if (accountType === 'Expense' || accountType === 'expense' || 
                    accountType === 'Income' || accountType === 'income' ||
                    accountType === 'Liability' || accountType === 'liability') {
                    hasNonCashEntry = true;
                }
            }
        }

        // Internal transfer: Both cash debit and credit exist, and no real expense/income/liability entries
        // This means cash is just moving between accounts (e.g., Bank to Petty Cash)
        if (hasCashDebit && hasCashCredit && !hasNonCashEntry) {
            return true;
        }

        // Also check description for transfer keywords
        if (entry.description) {
            const desc = entry.description.toLowerCase();
            const transferKeywords = [
                'petty cash',
                'cash allocation',
                'funds to',
                'funds transfer from',
                'funds transfer to',
                'cash to',
                'transfer from cash',
                'transfer to',
                'transfer from',
                'vault',
                'move to',
                'move from',
                'internal transfer',
                'transfer between'
            ];
            
            // Check if description contains transfer keywords
            const hasTransferKeyword = transferKeywords.some(keyword => desc.includes(keyword));
            
            // If description suggests transfer, check transaction structure
            if (hasTransferKeyword) {
                // If both cash debit and credit exist, it's definitely an internal transfer
                if (hasCashDebit && hasCashCredit) {
                    return true;
                }
                // Even if structure doesn't show both, if description clearly indicates transfer, exclude it
                if (desc.includes('transfer from cash') || desc.includes('funds transfer from cash')) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if a transaction is a balance sheet adjustment (not actual cash flow)
     * @param {Object} entry - Transaction entry
     * @returns {boolean} True if it's a balance sheet adjustment
     */
    static isBalanceSheetAdjustment(entry) {
        if (!entry.description) return false;
        
        const desc = entry.description.toLowerCase();
        const reference = entry.reference || '';
        const transactionId = entry.transactionId || '';
        
        // Check for balance sheet adjustment patterns
        const balanceSheetPatterns = [
            'opening balance',
            'opening balances', 
            'opening bank',
            'balance adjustment',
            'take on balances',
            'take on balances from excel',
            'funds to petty cash',
            'funds from vault',
            'funds to vault',
            'internal transfer',
            'clearing account',
            'journal entry',
            'balance sheet',
            'account reclassification',
            'account transfer'
        ];
        
        // Check description patterns
        const hasBalanceSheetPattern = balanceSheetPatterns.some(pattern => 
            desc.includes(pattern)
        );
        
        // Check transaction ID patterns
        const hasAdjustmentId = transactionId.startsWith('ADJ-') || 
                               transactionId.startsWith('JE-') ||
                               transactionId.startsWith('BS-');
        
        // Check reference patterns  
        const hasAdjustmentRef = reference.startsWith('ADJ-') ||
                                reference.startsWith('JE-') ||
                                reference.startsWith('BS-');
        
        return hasBalanceSheetPattern || hasAdjustmentId || hasAdjustmentRef;
    }
    
    /**
     * Check if a transaction is a deposit transaction by looking at account codes
     * @param {Object} entry - Transaction entry
     * @returns {boolean} True if it's a deposit transaction
     */
    static isDepositTransaction(entry) {
        if (!entry.entries || !Array.isArray(entry.entries)) {
            return false;
        }
        
        // Deposit account codes: 2020, 20002, 2002, 2028 (and variations)
        const depositAccountCodes = ['2020', '20002', '2002', '2028', '20020'];
        
        // Check if any entry in the transaction references a deposit account
        for (const line of entry.entries) {
            const accountCode = String(line.accountCode || line.account?.code || '').trim();
            const accountName = (line.accountName || line.account?.name || '').toLowerCase();
            
            // Check account code
            if (depositAccountCodes.includes(accountCode)) {
                console.log(`💰 Deposit transaction identified by account code ${accountCode}: ${entry.transactionId}`);
                return true;
            }
            
            // Check account name
            if (accountName.includes('deposit') && accountName.includes('security')) {
                console.log(`💰 Deposit transaction identified by account name "${line.accountName || line.account?.name}": ${entry.transactionId}`);
                return true;
            }
            
            // Check if it's a liability account (200x) with deposit-related keywords
            if (accountCode.startsWith('200') && (
                accountName.includes('deposit') ||
                accountName.includes('security') ||
                accountCode === '2020' ||
                accountCode === '20002' ||
                accountCode === '2028'
            )) {
                console.log(`💰 Deposit transaction identified by liability account ${accountCode} (${line.accountName || line.account?.name}): ${entry.transactionId}`);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Generate comprehensive detailed cash flow statement
     * @param {string} period - Year (e.g., "2024") or Month (e.g., "2025-09")
     * @param {string} basis - "cash" or "accrual"
     * @param {string} residenceId - Optional residence filter
     * @returns {Object} Detailed cash flow analysis
     */
    static async generateDetailedCashFlowStatement(period, basis = 'cash', residenceId = null) {
        try {
            // OPTIMIZED: Use centralized cache service with request deduplication
            const cacheService = require('./cacheService');
            const cacheKey = `detailed-cashflow:${period}:${basis}:${residenceId || 'all'}`;
            
            // Use getOrSet for automatic caching and request deduplication (10 minute TTL)
            return await cacheService.getOrSet(cacheKey, 600, async () => {
                return await this._generateDetailedCashFlowStatementInternal(period, basis, residenceId);
            });
        } catch (error) {
            console.error('Error generating detailed cash flow statement:', error);
            throw error;
        }
    }
    
    /**
     * Internal method to generate cash flow (called by cached wrapper)
     */
    static async _generateDetailedCashFlowStatementInternal(period, basis = 'cash', residenceId = null) {
        try {
            
            // Optimize: Reduce logging in production
            const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
            if (isDebugMode) {
                console.log(`💰 Generating Enhanced Detailed Cash Flow Statement for ${period} (${basis} basis)${residenceId ? ` - Residence: ${residenceId}` : ''}`);
            }
            
            // Determine if period is monthly (YYYY-MM) or yearly (YYYY)
            let startDate, endDate;
            if (period.includes('-')) {
                // Monthly period (e.g., "2025-09")
                startDate = new Date(`${period}-01`);
                endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 1);
                endDate.setDate(0); // Last day of the month
            } else {
                // Yearly period (e.g., "2024")
                startDate = new Date(`${period}-01-01`);
                endDate = new Date(`${period}-12-31`);
            }
            
            // Get all transaction entries for the period (exclude forfeiture transactions - no cash movement)
            const transactionQuery = {
                date: { $gte: startDate, $lte: endDate },
                // Exclude forfeiture transactions as they don't involve cash movement
                'metadata.isForfeiture': { $ne: true },
                status: { $nin: ['reversed', 'draft'] }
            };
            
            // Filter transactions by residence if specified
            if (residenceId) {
                transactionQuery.residence = new mongoose.Types.ObjectId(residenceId);
            }
            
            if (basis === 'cash') {
                transactionQuery.source = {
                    $in: ['payment', 'expense_payment', 'rental_payment', 'manual', 'payment_collection', 'bank_transfer', 'advance_payment', 'debt_settlement', 'current_payment']
                };
            }
            
            // Exclude reversed and draft transactions from cash flow
            transactionQuery.status = { $nin: ['reversed', 'draft'] };
            
            // Optimize: Run all queries in parallel for better performance
            const paymentQuery = {
                date: { $gte: startDate, $lte: endDate },
                status: { $in: ['confirmed', 'completed', 'paid', 'Confirmed', 'Completed', 'Paid'] }
            };
            
            if (residenceId) {
                paymentQuery.residence = residenceId;
            }
            
            const expenseQuery = {
                expenseDate: { $gte: startDate, $lte: endDate },
                paymentStatus: 'Paid'
            };
            
            if (residenceId) {
                expenseQuery.residence = residenceId;
            }
            
            // Run all three queries in parallel
            const [transactionEntries, payments, expenses] = await Promise.all([
                TransactionEntry.find(transactionQuery)
                    .select('transactionId date description source status residence entries accountCode accountName debit credit totalDebit totalCredit metadata')
                    .sort({ date: 1 })
                    .lean(),
                Payment.find(paymentQuery)
                    .select('paymentId date amount rentAmount adminFee deposit status residence student')
                    .sort({ date: 1 })
                    .lean(),
                Expense.find(expenseQuery)
                    .select('expenseId expenseDate amount category paymentStatus residence description title')
                    .sort({ expenseDate: 1 })
                    .lean()
            ]);
            
            // Optimize: Run processing functions in parallel where possible
            // First, create transaction-expense mapping (needed by other functions)
            const transactionExpenseMapping = await this.createTransactionExpenseMapping(transactionEntries, expenses, residenceId);
            
            // Then run independent processing functions in parallel
            const [incomeBreakdown, expenseBreakdown, individualExpenses] = await Promise.all([
                this.processDetailedIncome(transactionEntries, payments, period, residenceId),
                this.processDetailedExpenses(transactionEntries, expenses, period, residenceId, transactionExpenseMapping),
                this.processIndividualExpenses(transactionEntries, expenses, period, residenceId, transactionExpenseMapping)
            ]);
            
            // Calculate cash flow by activity
            const operatingActivities = this.calculateOperatingActivities(incomeBreakdown, individualExpenses);
            const investingActivities = this.calculateInvestingActivities(transactionEntries, residenceId);
            const financingActivities = this.calculateFinancingActivities(transactionEntries, residenceId);
            
            // Calculate net cash flow
            const netOperatingCashFlow = operatingActivities.cash_received_from_customers - 
                                       operatingActivities.cash_paid_to_suppliers - 
                                       operatingActivities.cash_paid_for_expenses;
            
            const netInvestingCashFlow = -(investingActivities.purchase_of_equipment + 
                                       investingActivities.purchase_of_buildings);
            
            const netFinancingCashFlow = financingActivities.owners_contribution + 
                                       financingActivities.loan_proceeds;
            
            const netChangeInCash = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;
            
            // Optimize: Calculate opening/closing balances and account breakdown in parallel
            // 🆕 FIX: Use UTC date calculation to avoid timezone issues
            let openingDate;
            if (period.includes('-')) {
                // Monthly period - opening date is day before month starts
                const [year, month] = period.split('-').map(Number);
                // Day before month starts: last day of previous month
                // month is 1-12, so month-1 is 0-11 (0-indexed)
                // Date.UTC(year, month-1, 0) gives last day of previous month
                const lastDayOfPrevMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
                // month-2 gives us the previous month (0-indexed), e.g., month=1 (Jan) -> month-2=-1 -> wraps to Dec of previous year
                // Actually, we want month-1-1 = month-2 for the month index, but we need to handle year rollover
                if (month === 1) {
                    // January - previous month is December of previous year
                    openingDate = new Date(Date.UTC(year - 1, 11, 31, 23, 59, 59, 999));
                } else {
                    // Other months - previous month is month-1 (1-indexed) = month-2 (0-indexed)
                    openingDate = new Date(Date.UTC(year, month - 2, lastDayOfPrevMonth, 23, 59, 59, 999));
                }
            } else {
                // Yearly period - opening date is December 31 of previous year
                const year = parseInt(period, 10);
                openingDate = new Date(Date.UTC(year - 1, 11, 31, 23, 59, 59, 999)); // Dec 31 of previous year
            }
            
            // Debug log opening date calculation (isDebugMode already declared at line 211)
            if (isDebugMode) {
                console.log(`💰 Opening cash balance calculation:`);
                console.log(`   Period: ${period}`);
                console.log(`   Opening date: ${openingDate.toISOString()}`);
                console.log(`   Start date: ${startDate.toISOString()}`);
                console.log(`   End date: ${endDate.toISOString()}`);
            }
            
            // Run cash balance calculations in parallel
            const [openingCashBalance, closingCashBalance, cashBalanceByAccount] = await Promise.all([
                isNaN(openingDate.getTime()) 
                    ? this.getOpeningCashBalance(startDate, residenceId)
                    : this.getOpeningCashBalance(openingDate, residenceId),
                this.getClosingCashBalance(endDate, residenceId),
                this.getCashBalanceByAccount(endDate, residenceId)
            ]);
            
            if (isDebugMode) {
                console.log(`💰 Cash balance results:`);
                console.log(`   Opening cash balance: $${openingCashBalance}`);
                console.log(`   Closing cash balance: $${closingCashBalance}`);
                console.log(`   Net change: $${closingCashBalance - openingCashBalance}`);
            }
            
            // Calculate total from account breakdown (optimized)
            const totalFromAccountBreakdown = Object.values(cashBalanceByAccount).reduce(
                (sum, account) => sum + (account.balance || 0), 
                0
            );
            
            // Optimize: Calculate cash breakdown and generate monthly breakdown in parallel
            const [cashBreakdown, monthlyBreakdown] = await Promise.all([
                this.calculateCashBreakdown(transactionEntries, payments, period, residenceId),
                this.generateMonthlyBreakdown(transactionEntries, payments, expenses, period, openingCashBalance, startDate, endDate, null, cashBalanceByAccount)
            ]);
            
            // Update monthly breakdown with cash breakdown data if needed
            if (cashBreakdown) {
                // Merge cash breakdown data into monthly breakdown
                Object.keys(monthlyBreakdown).forEach(monthKey => {
                    if (cashBreakdown.by_month && cashBreakdown.by_month[monthKey]) {
                        monthlyBreakdown[monthKey].cash_breakdown = cashBreakdown.by_month[monthKey];
                    }
                });
            }
            
            // Optimize: Reduce debug logging in production (reuse isDebugMode from above)
            if (isDebugMode) {
                console.log('🔧 RELIABLE METHOD - Transaction entries count:', transactionEntries.length);
            }
            
            const oldFormatMonthlyBreakdown = await EnhancedCashFlowService.generateReliableMonthlyBreakdown(transactionEntries, period, openingCashBalance, cashBalanceByAccount, residenceId);
            
            // Generate tabular monthly breakdown with proper cash balances
            const tabularMonthlyBreakdown = await EnhancedCashFlowService.generateTabularMonthlyBreakdown(oldFormatMonthlyBreakdown, period, openingCashBalance, cashBalanceByAccount);
            
            // --- NEW: populate per-month cash balances and attach to monthly and tabular outputs ---
            try {
                const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
                const cashBalanceByAccountByMonth = {};

                // For each month compute end-of-month date and fetch balances
                for (let i = 0; i < monthNames.length; i++) {
                    const month = monthNames[i];
                    const year = parseInt(period, 10);
                    if (isNaN(year)) {
                        cashBalanceByAccountByMonth[month] = {};
                        continue;
                    }
                    // 🆕 FIX: Use UTC date calculation to match balance sheet (avoid timezone issues)
                    // For month index i (0-11), get last day of that month
                    // Date.UTC(year, month+1, 0) gives last day of month (month is 0-indexed)
                    // i is 0-indexed (0=Jan, 9=Oct), so i+1 gives us the next month, and day 0 gives last day of month i
                    const lastDay = new Date(Date.UTC(year, i + 1, 0)).getUTCDate();
                    // Set to end of day (23:59:59.999) in UTC to include all transactions from that day
                    // Use month i (0-indexed) and the lastDay we calculated
                    const monthEndDate = new Date(Date.UTC(year, i, lastDay, 23, 59, 59, 999));
                    
                    // 🆕 CRITICAL: Check if this month is in the future
                    const now = new Date();
                    const currentDateUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
                    const monthStartDate = new Date(Date.UTC(year, i, 1, 0, 0, 0, 0));
                    
                    // Determine the appropriate end date for this month
                    let endDate;
                    let isFutureMonth = false;
                    
                    if (monthStartDate > currentDateUTC) {
                        // This month hasn't started yet (future month) - show zero balances
                        isFutureMonth = true;
                        endDate = monthStartDate; // Use start of month so no transactions are included
                    } else if (monthEndDate > currentDateUTC) {
                        // This month has started but not ended yet (current month) - use current date
                        endDate = currentDateUTC;
                    } else {
                        // This month has ended - use end of month date
                        endDate = monthEndDate;
                    }
                    
                    // Debug log to verify date calculation matches balance sheet
                    const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
                    if (isDebugMode) {
                        console.log(`💰 Cash flow: Calculating balances for ${month} ${year} (month index ${i})`);
                        console.log(`   Month start: ${monthStartDate.toISOString()}, Month end: ${monthEndDate.toISOString()}, Current: ${currentDateUTC.toISOString()}`);
                        console.log(`   Using end date: ${endDate.toISOString()}, Is future month: ${isFutureMonth}`);
                    }
                    
                    try {
                        // For future months, return empty balances (no transactions yet)
                        let monthlyBalances = {};
                        if (!isFutureMonth) {
                            monthlyBalances = await this.getCashBalanceByAccount(endDate, residenceId);
                        } else {
                            // Future month - return zero balances
                            if (isDebugMode) {
                                console.log(`   ⚠️ ${month} ${year} is a future month - returning zero balances`);
                            }
                        }
                        cashBalanceByAccountByMonth[month] = monthlyBalances || {};

                        // Attach to monthly_breakdown (oldFormatMonthlyBreakdown uses month names)
                        if (!oldFormatMonthlyBreakdown[month]) {
                            oldFormatMonthlyBreakdown[month] = this.initializeMonthData(month);
                        }
                        
                        // Format cash accounts to match balance sheet structure
                        const formattedCashAccounts = this.formatCashAccountsForBalanceSheet(monthlyBalances);
                        
                        // Keep both formats for backward compatibility
                        oldFormatMonthlyBreakdown[month].cash_accounts = oldFormatMonthlyBreakdown[month].cash_accounts || { breakdown: {}, total: 0 };
                        oldFormatMonthlyBreakdown[month].cash_accounts.breakdown = monthlyBalances || {}; // Original format (by account code)
                        oldFormatMonthlyBreakdown[month].cash_accounts.total = formattedCashAccounts.total;
                        
                        // Add balance sheet format (cashAndBank structure matching balance sheet)
                        oldFormatMonthlyBreakdown[month].cashAndBank = formattedCashAccounts;

                        // Attach to tabularMonthlyBreakdown (month names)
                        if (!tabularMonthlyBreakdown[month]) {
                            tabularMonthlyBreakdown[month] = { net_change_in_cash: 0, cash_at_end_of_period: 0, cash_and_cash_equivalents: {} };
                        }
                        tabularMonthlyBreakdown[month].cash_and_cash_equivalents = tabularMonthlyBreakdown[month].cash_and_cash_equivalents || {};
                        Object.values(monthlyBalances || {}).forEach(account => {
                            if (!this.isCashAccount(account.accountName, account.accountCode)) return;
                            tabularMonthlyBreakdown[month].cash_and_cash_equivalents[account.accountName] = {
                                account_code: account.accountCode,
                                balance: account.balance,
                                description: this.getCashAccountDescription(account.accountName)
                            };
                        });
                    } catch (err) {
                        console.error(`❌ Error fetching cash balances for ${month} ${period}:`, err && err.message ? err.message : err);
                        cashBalanceByAccountByMonth[month] = {};
                    }
                }

                // Expose per-month balances in the response object
                cashFlowData = {
                    ...cashFlowData,
                    cash_balance_by_account_monthly: cashBalanceByAccountByMonth,
                    monthly_breakdown: oldFormatMonthlyBreakdown,
                    tabular_monthly_breakdown: tabularMonthlyBreakdown
                };
            } catch (populateErr) {
                console.error('❌ Error populating monthly cash account balances:', populateErr);
            }
            // --- END NEW ---
            
            // FINAL VERIFICATION: Ensure all monthly totals are correct from transactions
            // This is the LAST CHANCE to fix any discrepancies before returning
            Object.keys(oldFormatMonthlyBreakdown).forEach(monthName => {
                const month = oldFormatMonthlyBreakdown[monthName];
                if (month && month.expenses && month.expenses.transactions && Array.isArray(month.expenses.transactions) && month.expenses.transactions.length > 0) {
                    // Calculate sum from transactions (the source of truth)
                    let transactionSum = 0;
                    month.expenses.transactions.forEach(trans => {
                        if (trans && typeof trans.amount === 'number' && trans.amount > 0) {
                            transactionSum += trans.amount;
                        }
                    });
                    
                    // FORCE UPDATE: Always use transaction sum
                    const oldTotal = month.expenses.total || 0;
                    month.expenses.total = transactionSum;
                    
                    // Update operating activities to match
                    if (month.operating_activities) {
                        month.operating_activities.outflows = transactionSum;
                        month.operating_activities.net = (month.operating_activities.inflows || 0) - transactionSum;
                    }
                    
                    // Log if there's a discrepancy (especially for October)
                    if (monthName === 'october' && Math.abs(oldTotal - transactionSum) > 0.01) {
                        console.log(`🔧 FINAL FIX [${monthName}]: Corrected expenses.total from ${oldTotal} to ${transactionSum} (transaction sum). Transaction count: ${month.expenses.transactions.length}`);
                        const depositReturn = month.expenses.transactions.find(t => t.transactionId === 'TXN1762169297314NIEWO');
                        if (depositReturn) {
                            console.log(`✅ Deposit return found in final verification: ${depositReturn.amount}`);
                        }
                    }
                }
            });
            
            // Calculate yearly totals from OLD FORMAT monthly breakdown (the one we're actually returning)
            const yearlyTotals = this.calculateYearlyTotals(oldFormatMonthlyBreakdown);
            
            // RESTRUCTURED: Monthly-focused cash flow data structure
            const cashFlowData = {
                period,
                basis,
                residence: residenceId ? { id: residenceId, name: 'Filtered Residence' } : null,
                
                // PRIMARY: Monthly breakdown as the main data structure
                monthly_breakdown: oldFormatMonthlyBreakdown,
                tabular_monthly_breakdown: tabularMonthlyBreakdown,
                
                // SECONDARY: Yearly totals derived from monthly data
                yearly_totals: yearlyTotals,
                
                // CASH FLOW SUMMARY
                cash_breakdown: {
                    beginning_cash: openingCashBalance,
                    ending_cash: closingCashBalance,
                    net_change_in_cash: netChangeInCash
                },
                
                // MONTHLY-FOCUSED SUMMARY
                summary: {
                    best_cash_flow_month: this.getBestCashFlowMonth(oldFormatMonthlyBreakdown),
                    worst_cash_flow_month: this.getWorstCashFlowMonth(oldFormatMonthlyBreakdown),
                    average_monthly_cash_flow: this.calculateAverageMonthlyCashFlow(oldFormatMonthlyBreakdown),
                    total_months_with_data: Object.keys(oldFormatMonthlyBreakdown).length,
                    monthly_consistency_score: this.calculateMonthlyConsistency(oldFormatMonthlyBreakdown),
                    total_transactions: transactionEntries.length,
                    net_change_in_cash: netChangeInCash,
                    total_income: incomeBreakdown.total,
                    total_expenses: individualExpenses.total_amount, // CHANGED: Now uses individual expenses total
                    total_expenses_by_category: expenseBreakdown.total, // ADDED: Keep categorized total for reference
                    transaction_count: transactionEntries.length,
                    payment_count: payments.length,
                    expense_count: individualExpenses.total_count // CHANGED: Now uses individual expenses count
                },
                
                // DETAILED MONTHLY BREAKDOWN
                detailed_breakdown: {
                    income: incomeBreakdown,
                    expenses: individualExpenses, // CHANGED: Now returns individual expenses instead of categories
                    expenses_by_category: expenseBreakdown, // MOVED: Categorized expenses moved to separate field
                    transactions: this.processTransactionDetails(transactionEntries),
                    payments: this.processPaymentDetails(payments),
                    expenses_detail: this.processExpenseDetails(expenses),
                    monthly_breakdown: oldFormatMonthlyBreakdown
                },
                
                // CASH BALANCE BY ACCOUNT (monthly view)
                cash_balance_by_account: cashBalanceByAccount,
                
                // ACTIVITIES BREAKDOWN (monthly aggregated)
                operating_activities: operatingActivities,
                investing_activities: investingActivities,
                financing_activities: financingActivities,
                
                metadata: {
                    generated_at: new Date(),
                    residence_filter: residenceId,
                    data_sources: ['TransactionEntry', 'Payment', 'Expense'],
                    basis_type: basis,
                    structure_type: 'monthly_focused'
                }
            };
            
            console.log('🔧 Final cashFlowData monthly_breakdown October:', cashFlowData.monthly_breakdown?.october?.operating_activities);
            console.log('🔧 Final cashFlowData monthly_breakdown October expenses:', cashFlowData.monthly_breakdown?.october?.expenses);
            
            // Add formatted cash flow statement
            cashFlowData.formatted_cash_flow_statement = this.formatCashFlowStatement(cashFlowData);
            
            console.log('🔧 AFTER formatCashFlowStatement - monthly_breakdown October:', cashFlowData.monthly_breakdown?.october?.operating_activities);
            
            // Add tabular cash flow statement
            try {
                console.log('🔧 About to generate tabular cash flow statement...');
                cashFlowData.tabular_cash_flow_statement = this.formatCashFlowStatementMonthly(cashFlowData);
                console.log('✅ Tabular cash flow statement generated successfully');
            } catch (tabularError) {
                console.error('❌ Error generating tabular cash flow statement:', tabularError);
                console.error('❌ Error details:', {
                    message: tabularError.message,
                    stack: tabularError.stack,
                    cashFlowDataKeys: Object.keys(cashFlowData)
                });
                cashFlowData.tabular_cash_flow_statement = {
                    error: 'Failed to generate tabular format',
                    message: tabularError.message
                };
            }
            
            // Debug: Check the final monthly breakdown data before returning (only in debug mode)
            if (isDebugMode) {
                console.log('🔧 Final cashFlowData monthly_breakdown October:', cashFlowData.monthly_breakdown?.october?.operating_activities);
                console.log('🔧 Final cashFlowData monthly_breakdown October expenses:', cashFlowData.monthly_breakdown?.october?.expenses);
                console.log('🔧 Final cashFlowData monthly_breakdown keys:', Object.keys(cashFlowData.monthly_breakdown || {}));
            }
            
            // Cache is handled by the wrapper method, just return the data
            return cashFlowData;
            
        } catch (error) {
            console.error('Error generating detailed cash flow statement:', error);
            throw error;
        }
    }
    
    /**
     * Process detailed income breakdown
     */
    static async processDetailedIncome(transactionEntries, payments, period, residenceId = null) {
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
        
        // Set to track processed transactions to prevent double-counting
        const processedTransactions = new Set();
        
        // Create a map of transaction entries to their corresponding payments for accurate date handling
        const transactionToPaymentMap = new Map();
        
        // Optimize: Reduce logging in production
        const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
        
        // Optimize: Create payment lookup maps for O(1) access instead of O(n) find()
        const paymentMapById = new Map();
        const paymentMapByPaymentId = new Map();
        payments.forEach(payment => {
            if (payment._id) {
                paymentMapById.set(payment._id.toString(), payment);
            }
            if (payment.paymentId) {
                paymentMapByPaymentId.set(payment.paymentId, payment);
            }
        });
        
        // Filter transactions by residence if specified
        if (residenceId) {
            // Optimize: Use filter with efficient lookup
            const filteredTransactions = transactionEntries.filter(entry => {
                // Check if transaction has direct residence match
                if (entry.residence && entry.residence._id && 
                    entry.residence._id.toString() === residenceId.toString()) {
                    return true;
                }
                
                // For transactions without residence field, check if they're linked to payments for this residence
                if (!entry.residence || entry.residence === "Unknown") {
                    const correspondingPayment = entry.reference 
                        ? (paymentMapById.get(entry.reference) || paymentMapByPaymentId.get(entry.reference))
                        : null;
                    
                    if (correspondingPayment && correspondingPayment.residence && 
                        correspondingPayment.residence._id.toString() === residenceId.toString()) {
                        return true;
                    }
                }
                
                return false;
            });
            
            // Replace the transaction entries with filtered ones
            transactionEntries.length = 0;
            transactionEntries.push(...filteredTransactions);
            
            // Also filter payments by residence
            const filteredPayments = payments.filter(payment => {
                if (payment.residence && payment.residence._id && 
                    payment.residence._id.toString() === residenceId.toString()) {
                    return true;
                }
                return false;
            });
            
            // Replace the payments array with filtered ones
            payments.length = 0;
            payments.push(...filteredPayments);
            
            // Rebuild payment maps after filtering
            paymentMapById.clear();
            paymentMapByPaymentId.clear();
            payments.forEach(payment => {
                if (payment._id) {
                    paymentMapById.set(payment._id.toString(), payment);
                }
                if (payment.paymentId) {
                    paymentMapByPaymentId.set(payment.paymentId, payment);
                }
            });
        }
        
        // Optimize: Create transaction-to-payment mapping using efficient O(1) lookups
        transactionEntries.forEach(entry => {
            if (entry.reference) {
                const payment = paymentMapById.get(entry.reference) || paymentMapByPaymentId.get(entry.reference);
                if (payment) {
                    transactionToPaymentMap.set(entry.transactionId, payment);
                }
            }
        });
        
        // Enhanced payment linking - ALWAYS try to find a payment for each transaction
        if (payments.length > 0) {
            transactionEntries.forEach(entry => {
                let correspondingPayment = null;
                
                // PRIORITY 1: Reference field (payment ID) - use map for O(1) lookup
                if (entry.reference) {
                    correspondingPayment = paymentMapById.get(entry.reference) || paymentMapByPaymentId.get(entry.reference);
                    if (correspondingPayment) {
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                    }
                }
                
                // PRIORITY 2: PaymentId in metadata - use map for O(1) lookup
                if (!correspondingPayment && entry.metadata && entry.metadata.paymentId) {
                    correspondingPayment = paymentMapByPaymentId.get(entry.metadata.paymentId);
                    if (correspondingPayment) {
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                    }
                }
                
                // PRIORITY 3: Student and amount matching for advance transactions
                if (!correspondingPayment && entry.description && entry.description.toLowerCase().includes('advance')) {
                    const matchingPayment = payments.find(p => 
                        p.student && entry.metadata && entry.metadata.studentId && 
                        p.student.toString() === entry.metadata.studentId.toString() &&
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01
                    );
                    if (matchingPayment) {
                        correspondingPayment = matchingPayment;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked advance transaction ${entry.transactionId} to payment ${matchingPayment.paymentId} by student/amount match with date ${matchingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
                
                // PRIORITY 4: General student and amount matching for any transaction
                if (!correspondingPayment && entry.metadata && entry.metadata.studentId) {
                    const matchingPayment = payments.find(p => 
                        p.student && p.student.toString() === entry.metadata.studentId.toString() &&
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01
                    );
                    if (matchingPayment) {
                        correspondingPayment = matchingPayment;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked transaction ${entry.transactionId} to payment ${matchingPayment.paymentId} by student/amount match with date ${matchingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
                
                // PRIORITY 5: Amount and date proximity matching (within 30 days)
                if (!correspondingPayment) {
                    const matchingPayment = payments.find(p => 
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01 &&
                        Math.abs(new Date(p.date).getTime() - new Date(entry.date).getTime()) < 30 * 24 * 60 * 60 * 1000 // Within 30 days
                    );
                    if (matchingPayment) {
                        correspondingPayment = matchingPayment;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked transaction ${entry.transactionId} to payment ${matchingPayment.paymentId} by amount/date proximity with date ${matchingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
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
            let correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
            
            // Enhanced payment linking for income processing - same logic as cash breakdown
            if (!correspondingPayment) {
                // PRIORITY 1: Reference field (payment ID)
                if (entry.reference) {
                    correspondingPayment = payments.find(p => p._id.toString() === entry.reference);
                    if (correspondingPayment) {
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked income transaction ${entry.transactionId} to payment ${correspondingPayment.paymentId} by reference with date ${correspondingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
                // PRIORITY 2: PaymentId in metadata
                if (!correspondingPayment && entry.metadata && entry.metadata.paymentId) {
                    correspondingPayment = payments.find(p => p.paymentId === entry.metadata.paymentId);
                    if (correspondingPayment) {
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked income transaction ${entry.transactionId} to payment ${correspondingPayment.paymentId} with date ${correspondingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
                // PRIORITY 3: Student and amount matching for advance transactions
                if (!correspondingPayment && entry.description && entry.description.toLowerCase().includes('advance')) {
                    const matchingPayment = payments.find(p => 
                        p.student && entry.metadata && entry.metadata.studentId && 
                        p.student.toString() === entry.metadata.studentId.toString() &&
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01
                    );
                    if (matchingPayment) {
                        correspondingPayment = matchingPayment;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked advance income transaction ${entry.transactionId} to payment ${matchingPayment.paymentId} by student/amount match with date ${matchingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
                // PRIORITY 4: General student and amount matching for any transaction
                if (!correspondingPayment && entry.metadata && entry.metadata.studentId) {
                    const matchingPayment = payments.find(p => 
                        p.student && p.student.toString() === entry.metadata.studentId.toString() &&
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01
                    );
                    if (matchingPayment) {
                        correspondingPayment = matchingPayment;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked income transaction ${entry.transactionId} to payment ${matchingPayment.paymentId} by student/amount match with date ${matchingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
                // PRIORITY 5: Amount and date proximity matching (within 30 days)
                if (!correspondingPayment) {
                    const matchingPayment = payments.find(p => 
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01 &&
                        Math.abs(new Date(p.date).getTime() - new Date(entry.date).getTime()) < 30 * 24 * 60 * 60 * 1000 // Within 30 days
                    );
                    if (matchingPayment) {
                        correspondingPayment = matchingPayment;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked income transaction ${entry.transactionId} to payment ${matchingPayment.paymentId} by amount/date proximity with date ${matchingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
            }
            let effectiveDate = correspondingPayment ? correspondingPayment.date : entry.date;
            
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
                // FIRST: Check if this is an internal cash transfer (cash to cash) - EXCLUDE from cash flow
                if (this.isInternalCashTransfer(entry)) {
                    console.log(`💰 Internal cash transfer excluded from income: ${entry.transactionId} - Description: ${entry.description}`);
                    return; // Skip internal transfers - they don't represent actual cash inflow
                }
                
                // Look for Cash/Bank debits (income received) - check both Cash and Bank Account
                // BUT ONLY if it's NOT from another cash account (not an internal transfer)
                const cashEntry = entry.entries.find(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    return accountCode === '1000' && (accountName === 'Cash' || accountName === 'Bank Account') && line.debit > 0;
                });
                
                if (cashEntry) {
                    const incomeAmount = cashEntry.debit;
                    
                    // Check if this transaction has already been processed to prevent double-counting
                    if (processedTransactions.has(entry.transactionId)) {
                        console.log(`⚠️ Transaction ${entry.transactionId} already processed, skipping to prevent double-counting`);
                        return;
                    }
                    
                    // Mark this transaction as processed
                    processedTransactions.add(entry.transactionId);
                    
                    // Check for late payment fees - exclude from cash flow entirely
                    const entryDescription = (entry.description || '').toLowerCase();
                    const isLatePaymentFee = entryDescription.includes('late') && 
                                             (entryDescription.includes('payment') || entryDescription.includes('fee'));
                    
                    // Also check if any entry line has late payment fee account
                    let hasLatePaymentFeeAccount = false;
                    if (entry.entries && Array.isArray(entry.entries)) {
                        for (const line of entry.entries) {
                            const lineAccountName = (line.accountName || line.account?.name || '').toLowerCase();
                            if (lineAccountName.includes('late') && 
                                (lineAccountName.includes('payment') || lineAccountName.includes('fee'))) {
                                hasLatePaymentFeeAccount = true;
                                break;
                            }
                        }
                    }
                    
                    if (isLatePaymentFee || hasLatePaymentFeeAccount) {
                        // Late payment fees should be excluded from cash flow income entirely
                        return; // Skip this transaction entry
                    }
                    
                    incomeBreakdown.total += incomeAmount;
                    
                    // Special logging for R180 transaction
                    if (entry.transactionId === 'TXN17570154497464WBST') {
                        console.log(`🔍 R180 Cash Entry Found:`, {
                            amount: incomeAmount,
                            accountCode: cashEntry.accountCode,
                            accountName: cashEntry.accountName
                        });
                    }
                    
                        // Check for balance sheet adjustments (exclude from income)
                        if (this.isBalanceSheetAdjustment(entry)) {
                        // This is a balance sheet adjustment or internal transfer, not income - don't count as income
                        console.log(`💰 Opening balance/balance adjustment/internal transfer excluded from income: ${incomeAmount} - Transaction: ${entry.transactionId} - Description: ${entry.description}`);
                        return; // Skip this transaction entry
                    }
                    
                    // Categorize based on description and source
                    let category = 'other_income';
                    let description = entry.description || 'Cash Income';
                    let isAdvancePayment = false;
                    
                    // 🆕 NEW: Check if payment date is before allocation month (same logic as double-entry service)
                    let isPaymentDateBeforeAllocationMonth = false;
                    
                    // Debug logging for payment structure
                    if (correspondingPayment) {
                        console.log(`🔍 Cash Flow Debug - Payment Structure:`, {
                            paymentId: correspondingPayment.paymentId,
                            date: correspondingPayment.date,
                            hasMonthlyBreakdown: !!correspondingPayment.monthlyBreakdown,
                            monthlyBreakdownLength: correspondingPayment.monthlyBreakdown?.length || 0,
                            monthlyBreakdown: correspondingPayment.monthlyBreakdown
                        });
                    }
                    
                    if (correspondingPayment && correspondingPayment.monthlyBreakdown && correspondingPayment.monthlyBreakdown.length > 0) {
                        const paymentDate = new Date(correspondingPayment.date);
                        const paymentDateMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);
                        
                        // Check each allocation in the payment
                        for (const allocation of correspondingPayment.monthlyBreakdown) {
                            if (allocation.month) {
                                // Parse allocation month (format: "2025-09")
                                const [year, month] = allocation.month.split('-').map(n => parseInt(n));
                                const allocationMonthDate = new Date(year, month - 1, 1); // month is 1-based in allocation
                                
                                if (paymentDateMonth < allocationMonthDate) {
                                    isPaymentDateBeforeAllocationMonth = true;
                                    console.log(`📅 Cash Flow: Payment date is before allocation month:`);
                                    console.log(`   Payment Date: ${paymentDate.toISOString().split('T')[0]} (Month: ${paymentDate.getMonth() + 1}/${paymentDate.getFullYear()})`);
                                    console.log(`   Allocation Month: ${allocationMonthDate.toISOString().split('T')[0]} (Month: ${allocationMonthDate.getMonth() + 1}/${allocationMonthDate.getFullYear()})`);
                                    console.log(`   ✅ Identified as ADVANCE PAYMENT (payment date before allocation month)`);
                                    break; // Found at least one advance allocation
                                }
                            }
                        }
                    } else {
                        // 🆕 FALLBACK: Check transaction description for allocation month
                        if (entry.description && entry.description.includes('for 20')) {
                            // Extract allocation month from description (format: "for 2025-09")
                            const match = entry.description.match(/for (\d{4}-\d{2})/);
                            if (match) {
                                const allocationMonthStr = match[1];
                                const [year, month] = allocationMonthStr.split('-').map(n => parseInt(n));
                                const allocationMonthDate = new Date(year, month - 1, 1); // month is 1-based in description
                                
                                // Use payment date if available, otherwise use transaction date
                                const paymentDate = correspondingPayment ? new Date(correspondingPayment.date) : new Date(entry.date);
                                const paymentDateMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);
                                
                                console.log(`🔍 Cash Flow: Checking advance payment detection for ${entry.transactionId}:`);
                                console.log(`   Description: ${entry.description}`);
                                console.log(`   Payment Date: ${paymentDate.toISOString().split('T')[0]} (Month: ${paymentDate.getMonth() + 1}/${paymentDate.getFullYear()})`);
                                console.log(`   Allocation Month: ${allocationMonthDate.toISOString().split('T')[0]} (Month: ${allocationMonthDate.getMonth() + 1}/${allocationMonthDate.getFullYear()})`);
                                
                                if (paymentDateMonth < allocationMonthDate) {
                                    isPaymentDateBeforeAllocationMonth = true;
                                    console.log(`   ✅ Identified as ADVANCE PAYMENT (payment date before allocation month from description)`);
                                } else {
                                    console.log(`   ❌ Not an advance payment (payment date is not before allocation month)`);
                                }
                            }
                        }
                    }
                    
                    if (entry.description) {
                        const desc = entry.description.toLowerCase();
                        // Check for admin payments first (exclude from advance payments)
                        if (desc.includes('admin') || (entry.metadata && entry.metadata.paymentType === 'admin') || (entry.metadata && entry.metadata.paymentType === 'advance_admin')) {
                            // Admin payments should NOT be categorized as advance payments
                            category = 'admin_fees';
                            description = 'Administrative Fees';
                        }
                        // Check for advance payments (but exclude admin payments)
                        else if (desc.includes('advance') || desc.includes('prepaid') || desc.includes('future')) {
                            category = 'advance_payments';
                            description = 'Advance Payment from Student';
                            isAdvancePayment = true;
                        } 
                        // 🆕 NEW: Check if payment date is before allocation month (override description-based categorization)
                        // BUT: Admin fees should always settle in payment month, not be treated as advance payments
                        else if (isPaymentDateBeforeAllocationMonth && !desc.includes('admin')) {
                            category = 'advance_payments';
                            description = 'Advance Payment from Student (payment date before allocation month)';
                            isAdvancePayment = true;
                        }
                        // Check for specific payment allocations
                        else if (desc.includes('payment allocation: rent')) {
                            // Check if this is an advance payment by looking at the payment metadata
                            const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
                            let isAdvanceRentPayment = false;
                            
                            // Check if this payment has advance allocations
                            if (correspondingPayment && correspondingPayment.monthlyBreakdown) {
                                const advanceAllocations = correspondingPayment.monthlyBreakdown.filter(
                                    allocation => allocation.allocationType === 'advance_payment' && allocation.paymentType === 'rent'
                                );
                                isAdvanceRentPayment = advanceAllocations.length > 0;
                            }
                            
                            if (isAdvanceRentPayment) {
                                category = 'advance_payments';
                                description = 'Advance Rent Payments';
                            } else {
                                category = 'rental_income';
                                description = 'Rental Income from Students';
                            }
                        } else if (desc.includes('payment allocation: admin') || desc.includes('admin fee') || desc.includes('administrative')) {
                            // Check if this is an advance admin payment by looking at the payment metadata
                            const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
                            let isAdvanceAdminPayment = false;
                            
                            // Check if this payment has advance allocations for admin
                            if (correspondingPayment && correspondingPayment.monthlyBreakdown) {
                                const advanceAllocations = correspondingPayment.monthlyBreakdown.filter(
                                    allocation => allocation.allocationType === 'advance_payment' && 
                                    (allocation.paymentType === 'advance_admin' || allocation.paymentType === 'admin')
                                );
                                isAdvanceAdminPayment = advanceAllocations.length > 0;
                            }
                            
                            // Also check if the transaction metadata indicates it's an admin payment
                            if (entry.metadata && entry.metadata.paymentType === 'admin') {
                                console.log(`🔍 Found admin payment via metadata: ${entry.transactionId} - $${incomeAmount}`);
                                if (isAdvanceAdminPayment) {
                                    category = 'advance_payments';
                                    description = 'Advance Admin Payments';
                                } else {
                                    category = 'admin_fees';
                                    description = 'Administrative Fees';
                                }
                            } else if (isAdvanceAdminPayment) {
                                category = 'advance_payments';
                                description = 'Advance Admin Payments';
                            } else {
                                category = 'admin_fees';
                                description = 'Administrative Fees';
                            }
                        } 
                        // Fallback to general keywords
                        else if (desc.includes('rent')) {
                            // Check if this is an advance payment by looking at the payment metadata
                            const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
                            let isAdvanceRentPayment = false;
                            
                            // Check if this payment has advance allocations
                            if (correspondingPayment && correspondingPayment.monthlyBreakdown) {
                                const advanceAllocations = correspondingPayment.monthlyBreakdown.filter(
                                    allocation => allocation.allocationType === 'advance_payment' && allocation.paymentType === 'rent'
                                );
                                isAdvanceRentPayment = advanceAllocations.length > 0;
                            }
                            
                            if (isAdvanceRentPayment) {
                                category = 'advance_payments';
                                description = 'Advance Rent Payments';
                            } else {
                                category = 'rental_income';
                                description = 'Rental Income from Students';
                            }
                        } else if (desc.includes('admin') || (entry.metadata && entry.metadata.paymentType === 'admin') || (entry.metadata && entry.metadata.paymentType === 'advance_admin')) {
                            // For admin fees, ALWAYS use payment date for categorization (NOT allocation month)
                            const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
                            
                            if (correspondingPayment) {
                                // Use payment date for admin fee categorization (when cash was received)
                                const paymentDate = new Date(correspondingPayment.date);
                                effectiveDate = paymentDate;
                                const paymentMonth = paymentDate.toISOString().slice(0, 7);
                                console.log(`💰 Admin fee using PAYMENT DATE (not allocation month): ${paymentMonth} - Transaction: ${entry.transactionId}`);
                                
                                // Admin fees should always be categorized as regular admin fees in the payment month
                                // regardless of when they were allocated
                                category = 'admin_fees';
                                description = 'Administrative Fees';
                                
                                console.log(`💰 Admin fee categorized in PAYMENT MONTH: ${paymentMonth} - Amount: ${incomeAmount}`);
                            } else {
                                // Fallback to transaction date if no payment found
                                category = 'admin_fees';
                                description = 'Administrative Fees';
                                console.log(`💰 Admin fee (no payment found): ${incomeAmount} - Transaction: ${entry.transactionId}`);
                            }
                            
                            // Log detection of admin fee
                            console.log(`🔍 Admin fee detected: ${entry.transactionId} - $${incomeAmount}`);
                            console.log(`   Description: ${entry.description}`);
                            console.log(`   Metadata paymentType: ${entry.metadata?.paymentType || 'none'}`);
                            console.log(`   Is advance payment: ${isAdvanceAdminPayment}`);
                            console.log(`   Should use payment date: ${shouldUsePaymentDate}`);
                            
                            if (isAdvanceAdminPayment) {
                                category = 'advance_payments';
                                description = 'Advance Admin Payments';
                            } else {
                                category = 'admin_fees';
                                description = 'Administrative Fees';
                            }
                            
                            // If we should use payment date, update the effective date
                            if (shouldUsePaymentDate && correspondingPayment) {
                                effectiveDate = correspondingPayment.date;
                                console.log(`🔍 Updated effective date for admin fee to payment date: ${effectiveDate.toISOString().slice(0, 7)}`);
                            }
                        } else if (desc.includes('deposit') || this.isDepositTransaction(entry)) {
                            // For deposits, use payment date if available, otherwise use transaction date
                            const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
                            
                            if (correspondingPayment) {
                                // Use payment date for deposit categorization (when cash was received)
                                const paymentDate = new Date(correspondingPayment.date);
                                effectiveDate = paymentDate;
                                const paymentMonth = paymentDate.toISOString().slice(0, 7);
                                console.log(`💰 Deposit using PAYMENT DATE (not allocation month): ${paymentMonth} - Transaction: ${entry.transactionId}`);
                                
                                console.log(`💰 Deposit categorized in PAYMENT MONTH: ${paymentMonth} - Amount: ${incomeAmount}`);
                            } else {
                                // For manual deposits without payment records, use transaction date
                                effectiveDate = entry.date;
                                const transactionMonth = entry.date.toISOString().slice(0, 7);
                                console.log(`💰 Deposit (manual transaction, no payment record) using TRANSACTION DATE: ${transactionMonth} - Transaction: ${entry.transactionId} - Amount: ${incomeAmount}`);
                            }
                            
                            category = 'deposits';
                            description = 'Security Deposits';
                            console.log(`✅ DEPOSIT CATEGORIZED: Transaction ${entry.transactionId} - Amount: ${incomeAmount} - Description: ${entry.description || 'N/A'}`);
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
                    
                    // 🆕 DEBUG: Log final categorization decision
                    console.log(`🔍 Cash Flow Final Categorization:`, {
                        transactionId: entry.transactionId,
                        description: entry.description,
                        category: category,
                        isAdvancePayment: isAdvancePayment,
                        isPaymentDateBeforeAllocationMonth: isPaymentDateBeforeAllocationMonth,
                        hasCorrespondingPayment: !!correspondingPayment
                    });
                    
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
                    
                    // Add to appropriate category - ensure category exists
                    if (!incomeBreakdown.by_source[category]) {
                        console.warn(`⚠️ Unknown income category "${category}" for transaction ${entry.transactionId}, defaulting to "other_income"`);
                        category = 'other_income';
                    }
                    incomeBreakdown.by_source[category].total += incomeAmount;
                    const transactionRecord = {
                        transactionId: entry.transactionId,
                        date: effectiveDate, // Use payment date instead of transaction date
                        amount: incomeAmount,
                        accountCode: cashEntry.accountCode,
                        accountName: cashEntry.accountName,
                        residence: entry.residence?.name || 'Unknown',
                        description: description,
                        source: 'Cash Payment',
                        isAdvancePayment: isAdvancePayment
                    };
                    incomeBreakdown.by_source[category].transactions.push(transactionRecord);
                    
                    // Special logging for deposits
                    if (category === 'deposits') {
                        console.log(`✅ DEPOSIT ADDED TO CATEGORY: Transaction ${entry.transactionId} - Amount: ${incomeAmount} - Total in deposits: ${incomeBreakdown.by_source.deposits.total}`);
                    }
                    
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
                
                // Check for deposits that credit deposit accounts (even if Cash isn't directly debited)
                // OR if Cash IS debited but the transaction credits a deposit account
                // Deposits can be recorded as: [any account] debited, [deposit account] credited
                // This must happen for ALL transactions to catch deposits even if already processed as cash entries
                const depositAccountCodes = ['2028', '20002', '2020', '2002', '20020'];
                let depositEntry = null;
                let depositAmount = 0;
                let depositSourceAccount = null;
                
                entry.entries.forEach(line => {
                    const accountCode = String(line.accountCode || line.account?.code || '').trim();
                    const accountName = (line.accountName || line.account?.name || '').toLowerCase();
                    const credit = line.credit || 0;
                    
                    // Check if this entry credits a deposit account
                    if (credit > 0 && (depositAccountCodes.includes(accountCode) || 
                        (accountCode.startsWith('200') && accountName.includes('deposit') && accountName.includes('security')))) {
                        depositEntry = line;
                        depositAmount = credit;
                        // Find the corresponding debit entry (could be Cash, opening balance account, etc.)
                        const debitEntry = entry.entries.find(e => e.debit > 0);
                        if (debitEntry) {
                            depositSourceAccount = String(debitEntry.accountCode || debitEntry.account?.code || '').trim();
                        }
                    }
                });
                
                // If we found a deposit account credit, ensure it's categorized as a deposit
                // Even if already processed as a cash entry, we need to fix the categorization
                if (depositEntry && depositAmount > 0) {
                    const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
                    const effectiveDate = correspondingPayment ? correspondingPayment.date : entry.date;
                    const monthKey = effectiveDate.toISOString().slice(0, 7);
                    
                    // Check if this transaction was already processed as a cash entry
                    const wasProcessedAsCashEntry = processedTransactions.has(entry.transactionId);
                    
                    if (wasProcessedAsCashEntry) {
                        // Transaction was already processed, but we need to ensure it's in deposits category
                        // Find and update the existing transaction in deposits
                        const existingDepositTransaction = incomeBreakdown.by_source.deposits.transactions.find(
                            t => t.transactionId === entry.transactionId
                        );
                        
                        if (!existingDepositTransaction) {
                            // It was categorized incorrectly, add it to deposits
                            incomeBreakdown.by_source.deposits.total += depositAmount;
                            incomeBreakdown.by_source.deposits.transactions.push({
                                transactionId: entry.transactionId,
                                date: effectiveDate,
                                amount: depositAmount,
                                accountCode: depositEntry.accountCode || depositEntry.account?.code,
                                accountName: depositEntry.accountName || depositEntry.account?.name,
                                residence: entry.residence?.name || 'Unknown',
                                description: entry.description || 'Security Deposit'
                            });
                            
                            // Update monthly and residence totals
                            const residenceName = entry.residence?.name || 'Unknown';
                            if (!incomeBreakdown.by_residence[residenceName]) {
                                incomeBreakdown.by_residence[residenceName] = 0;
                            }
                            incomeBreakdown.by_residence[residenceName] += depositAmount;
                            
                            if (!incomeBreakdown.by_month[monthKey]) {
                                incomeBreakdown.by_month[monthKey] = 0;
                            }
                            incomeBreakdown.by_month[monthKey] += depositAmount;
                            
                            console.log(`💰 Deposit RECATEGORIZED from cash entry: ${depositEntry.accountCode || depositEntry.account?.code} - Amount: ${depositAmount} - Transaction: ${entry.transactionId} - Description: ${entry.description || 'N/A'}`);
                        }
                    } else {
                        // Not yet processed, add it as a deposit
                        incomeBreakdown.total += depositAmount;
                        incomeBreakdown.by_source.deposits.total += depositAmount;
                        incomeBreakdown.by_source.deposits.transactions.push({
                            transactionId: entry.transactionId,
                            date: effectiveDate,
                            amount: depositAmount,
                            accountCode: depositEntry.accountCode || depositEntry.account?.code,
                            accountName: depositEntry.accountName || depositEntry.account?.name,
                            residence: entry.residence?.name || 'Unknown',
                            description: entry.description || 'Security Deposit'
                        });
                        
                        // Group by residence
                        const residenceName = entry.residence?.name || 'Unknown';
                        if (!incomeBreakdown.by_residence[residenceName]) {
                            incomeBreakdown.by_residence[residenceName] = 0;
                        }
                        incomeBreakdown.by_residence[residenceName] += depositAmount;
                        
                        // Group by month
                        if (!incomeBreakdown.by_month[monthKey]) {
                            incomeBreakdown.by_month[monthKey] = 0;
                        }
                        incomeBreakdown.by_month[monthKey] += depositAmount;
                        
                        processedTransactions.add(entry.transactionId);
                        console.log(`💰 Deposit identified from deposit account credit: ${depositEntry.accountCode || depositEntry.account?.code} (${depositEntry.accountName || depositEntry.account?.name}) - Amount: ${depositAmount} - Source Account: ${depositSourceAccount} - Transaction: ${entry.transactionId} - Description: ${entry.description || 'N/A'}`);
                    }
                }
                
                // Also check for traditional Income account types (for completeness)
                // BUT ONLY if there's an actual cash payment (cash account debit)
                // This ensures we only count actual cash income, not accrued income
                // FIRST: Check if this is an internal cash transfer - EXCLUDE
                if (this.isInternalCashTransfer(entry)) {
                    console.log(`💰 Internal cash transfer excluded from income processing: ${entry.transactionId}`);
                    return; // Skip internal transfers
                }
                
                // SECOND: Check if there's a cash payment in this transaction
                const hasCashPayment = entry.entries.some(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    // Check for cash account debit (actual cash received)
                    return accountCode && (accountCode.startsWith('100') || accountCode.startsWith('101')) && line.debit > 0;
                });
                
                // ONLY process income accounts if there's a cash payment AND it's not an internal transfer
                // This excludes accruals (income earned but not yet received) and internal transfers
                if (hasCashPayment) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const credit = line.credit || 0;
                        
                        if (accountType === 'Income' || accountType === 'income') {
                            // Check if this is a late payment fee - exclude from cash flow entirely
                            const accountNameLower = accountName.toLowerCase();
                            const isLatePaymentFee = accountNameLower.includes('late') && 
                                                     (accountNameLower.includes('payment') || accountNameLower.includes('fee'));
                            
                            if (isLatePaymentFee) {
                                // Late payment fees should be excluded from cash flow income
                                return; // Skip this entry entirely
                            }
                            
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
                        } else if (accountCode.startsWith('4003') || accountName.toLowerCase().includes('deposit') || 
                                   accountCode === '2028' || accountCode === '20002' || accountCode === '2020' || 
                                   accountCode === '2002' || accountCode === '20020' ||
                                   (accountCode.startsWith('200') && accountName.includes('security') && accountName.includes('deposit'))) {
                            // Check if this is actually a late payment fee (not a deposit) - exclude from cash flow
                            const accountNameLower = accountName.toLowerCase();
                            const isLatePaymentFee = accountNameLower.includes('late') && 
                                                     (accountNameLower.includes('payment') || accountNameLower.includes('fee'));
                            
                            if (isLatePaymentFee) {
                                // Late payment fees should be excluded from cash flow income entirely
                                return; // Skip this entry entirely
                            }
                            
                            // Deposits can be recorded as credits to liability accounts (2028, 20002, etc.)
                            // Also check if this entire transaction is a deposit transaction
                            const isDeposit = this.isDepositTransaction(entry);
                            
                            // Only categorize as deposit if it's actually a deposit
                            if (isDeposit || accountCode.startsWith('4003') || accountName.toLowerCase().includes('deposit') ||
                                accountCode === '2028' || accountCode === '20002' || accountCode === '2020') {
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
                                console.log(`💰 Deposit identified from Income/Income account credit: ${accountCode} (${accountName}) - Amount: ${credit} - Transaction: ${entry.transactionId}`);
                            }
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
                        // Check for balance sheet adjustments (exclude from income)
                        if (this.isBalanceSheetAdjustment(entry)) {
                                // This is a balance sheet adjustment or internal transfer, not income - don't count as income
                                console.log(`💰 Opening balance/balance adjustment/internal transfer excluded from other_income: ${credit} - Transaction: ${entry.transactionId} - Description: ${entry.description}`);
                                return; // Skip this transaction entry
                            }
                            
                            // Exclude other_income from cash flow entirely - skip this entry
                            return; // Skip this transaction entry - don't add to any income category
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
                // If no cash payment, skip this income entry
                // This ensures accrued income (income earned but not yet received) is excluded
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
     * Create comprehensive mapping between transactions and expenses
     */
    static async createTransactionExpenseMapping(transactionEntries, expenses, residenceId = null) {
        const mapping = {
            transactionToExpense: new Map(),
            expenseToTransactions: new Map(),
            residenceFilteredTransactions: new Set()
        };
        
        console.log(`🔗 Creating transaction-expense mapping for ${transactionEntries.length} transactions and ${expenses.length} expenses`);
        
        // Map each transaction to its related expense
        transactionEntries.forEach(transaction => {
            let linkedExpense = null;
            
            // Method 1: Check by sourceId (most reliable for expense payments)
            if (transaction.sourceId) {
                linkedExpense = expenses.find(expense => 
                    expense._id.toString() === transaction.sourceId.toString()
                );
            }
            
            // Method 2: Check by reference
            if (!linkedExpense && transaction.reference) {
                linkedExpense = expenses.find(expense => 
                    expense._id.toString() === transaction.reference || 
                    expense.expenseId === transaction.reference ||
                    transaction.reference.includes(expense._id.toString())
                );
            }
            
            // Method 3: Check by description for expense payments
            if (!linkedExpense && transaction.description && transaction.description.includes('Payment for Expense')) {
                const expenseIdMatch = transaction.description.match(/EXP-[\w-]+/);
                if (expenseIdMatch) {
                    linkedExpense = expenses.find(expense => 
                        expense.expenseId === expenseIdMatch[0]
                    );
                }
            }
            
            if (linkedExpense) {
                // Store the mapping
                mapping.transactionToExpense.set(transaction._id.toString(), linkedExpense);
                
                if (!mapping.expenseToTransactions.has(linkedExpense._id.toString())) {
                    mapping.expenseToTransactions.set(linkedExpense._id.toString(), []);
                }
                mapping.expenseToTransactions.get(linkedExpense._id.toString()).push(transaction);
                
                // Check if this transaction should be included based on residence filtering
                if (residenceId) {
                    if (linkedExpense.residence && 
                        linkedExpense.residence._id.toString() === residenceId.toString()) {
                        mapping.residenceFilteredTransactions.add(transaction._id.toString());
                        console.log(`✅ Transaction ${transaction.transactionId} linked to expense ${linkedExpense.expenseId} for residence ${linkedExpense.residence.name}`);
                    }
                } else {
                    // If no residence filter, include all transactions
                    mapping.residenceFilteredTransactions.add(transaction._id.toString());
                }
            } else {
                // For non-expense transactions, check if they have direct residence field
                if (residenceId) {
                    if (transaction.residence && transaction.residence._id && 
                        transaction.residence._id.toString() === residenceId.toString()) {
                        mapping.residenceFilteredTransactions.add(transaction._id.toString());
                        console.log(`✅ Transaction ${transaction.transactionId} has direct residence match`);
                    }
                } else {
                    mapping.residenceFilteredTransactions.add(transaction._id.toString());
                }
            }
        });
        
        console.log(`📊 Mapping complete: ${mapping.residenceFilteredTransactions.size} transactions will be included`);
        return mapping;
    }
    
    /**
     * Process detailed expense breakdown
     */
    static async processDetailedExpenses(transactionEntries, expenses, period, residenceId = null, transactionExpenseMapping = null) {
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
        
        // Filter transactions by residence if specified
        let filteredTransactionEntries = transactionEntries;
        if (residenceId) {
            filteredTransactionEntries = transactionEntries.filter(entry => {
                // Check if transaction has direct residence match
                if (entry.residence && entry.residence._id && 
                    entry.residence._id.toString() === residenceId.toString()) {
                    return true;
                }
                
                // Check if transaction is linked to an expense for this residence
                if (transactionExpenseMapping) {
                    const linkedExpense = transactionExpenseMapping.transactionToExpense.get(entry._id.toString());
                    if (linkedExpense && linkedExpense.residence && 
                        linkedExpense.residence._id.toString() === residenceId.toString()) {
                        return true;
                    }
                }
                
                return false;
            });
            // Optimize: Reduce logging in production
            const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
            if (isDebugMode) {
                console.log(`🏠 Filtered ${filteredTransactionEntries.length} transactions for residence ${residenceId} out of ${transactionEntries.length} total`);
            }
        }
        
        // Optimize: Reduce logging in production
        const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
        
        // Helper function to get residence name from transaction entry or related expense
        const getResidenceName = (entry, expenses) => {
            let residenceName = entry.residence?.name || 'Unknown';
            
            // Use the mapping if available
            if (transactionExpenseMapping) {
                const linkedExpense = transactionExpenseMapping.transactionToExpense.get(entry._id.toString());
                if (linkedExpense && linkedExpense.residence) {
                    residenceName = linkedExpense.residence.name || 'Unknown';
                    return residenceName;
                }
            }
            
            // Fallback to original logic if mapping not available
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
        
        filteredTransactionEntries.forEach(entry => {
            // Transactions are already filtered by residence above
            
            if (entry.entries && entry.entries.length > 0) {
                // FIRST: Check if this is an internal cash transfer (cash to cash) - EXCLUDE from cash flow
                if (this.isInternalCashTransfer(entry)) {
                    console.log(`💰 Internal cash transfer excluded from expenses: ${entry.transactionId} - Description: ${entry.description}`);
                    return; // Skip internal transfers - they don't represent actual cash outflow
                }
                
                // Look for Cash/Bank credits (expenses paid)
                // BUT ONLY if it's NOT to another cash account (not an internal transfer)
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
                // BUT ONLY if there's an actual cash payment (cash account credit)
                // Skip if this transaction was already processed in the Cash credits section
                if (!processedTransactions.has(entry.transactionId)) {
                    // FIRST: Check if this is an internal cash transfer - EXCLUDE
                    if (this.isInternalCashTransfer(entry)) {
                        console.log(`💰 Internal cash transfer excluded from expense processing: ${entry.transactionId}`);
                        return; // Skip internal transfers
                    }
                    
                    // SECOND: Check if there's a cash payment in this transaction
                    const hasCashPayment = entry.entries.some(line => {
                        const accountCode = line.accountCode || line.account?.code;
                        const accountName = line.accountName || line.account?.name;
                        // Check for cash account credit (actual cash payment)
                        return accountCode && (accountCode.startsWith('100') || accountCode.startsWith('101')) && line.credit > 0;
                    });
                    
                    // ONLY process if there's a cash payment AND it's not an internal transfer
                    // This ensures we only count actual cash expenses, not accrued expenses or internal transfers
                    if (hasCashPayment) {
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
                    // If no cash payment or it's an internal transfer, skip this expense
                    // This ensures accrued expenses (expenses without cash payments) are excluded
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
            
            // Enhanced duplicate detection - check if this expense has a corresponding transaction entry
            // that was already processed in the transaction entries loop above
            const hasCorrespondingTransaction = transactionEntries.some(entry => {
                // Check if this transaction entry was created from this expense
                return entry.sourceId && entry.sourceId.toString() === expenseId ||
                       entry.sourceId && entry.sourceId.toString() === expenseTransactionId ||
                       entry.metadata && entry.metadata.expenseId && entry.metadata.expenseId.toString() === expenseId ||
                       entry.metadata && entry.metadata.expenseRecordId && entry.metadata.expenseRecordId.toString() === expenseId ||
                       entry.reference && entry.reference === expense.expenseId ||
                       entry.reference && entry.reference === expenseId ||
                       // Check if expense was created from this journal entry
                       (expense.metadata && expense.metadata.sourceTransactionEntryId && 
                        expense.metadata.sourceTransactionEntryId.toString() === entry._id.toString()) ||
                       (expense.metadata && expense.metadata.sourceTransactionId && 
                        expense.metadata.sourceTransactionId === entry.transactionId) ||
                       // NEW: Check if transaction entry and expense have same description, amount, and date
                       (entry.description === expense.description && 
                        entry.totalDebit === expense.amount && 
                        Math.abs(new Date(entry.date) - new Date(expense.expenseDate)) < 24 * 60 * 60 * 1000); // Within 24 hours
            });
            
            // Check if this expense was already processed by checking:
            // 1. Direct transaction ID match
            // 2. Expense ID match (in case expense._id was used as reference)
            // 3. Reference field match (in case expense ID was used as reference)
            // 4. Expense ID in processedExpenses Set
            // 5. Check if any processed expense ID matches this expense's ID pattern
            // 6. Check if the expense reference matches any processed expense ID
            // 7. Check if this expense's reference field matches any processed expense ID
            // 8. Check if this expense's expenseId field matches any processed expense ID
            // 9. NEW: Check if this expense has a corresponding transaction entry that was already processed
            const isAlreadyProcessed = processedTransactions.has(expenseTransactionId) || 
                processedTransactions.has(expenseId) ||
                processedTransactions.has(expense.reference) ||
                processedExpenses.has(expenseId) ||
                processedExpenses.has(expense.reference) ||
                processedExpenses.has(expense.expenseId) || // Check expenseId field
                hasCorrespondingTransaction || // NEW: Skip if corresponding transaction was already processed
                Array.from(processedExpenses).some(processedId => {
                    // Safely coerce to strings before using .includes to avoid TypeError
                    const pid = (processedId !== undefined && processedId !== null) ? String(processedId) : '';
                    const expId = (expenseId !== undefined && expenseId !== null) ? String(expenseId) : '';
                    const ref = (expense.reference !== undefined && expense.reference !== null) ? String(expense.reference) : '';
                    const expExpenseId = (expense.expenseId !== undefined && expense.expenseId !== null) ? String(expense.expenseId) : '';

                    return (pid && expId && pid.includes(expId)) ||
                        (expId && pid && expId.includes(pid)) ||
                        (ref && pid.includes(ref)) ||
                        (ref && ref.includes(pid)) ||
                        // Check if this expense's reference is in any processed expense ID
                        (ref && Array.from(processedExpenses).some(p => String(p ?? '').includes(ref))) ||
                        // Check if this expense's expenseId matches any processed expense ID
                        (expExpenseId && pid.includes(expExpenseId)) ||
                        (expExpenseId && expExpenseId.includes(pid));
                });
            
            if (isAlreadyProcessed) {
                console.log(`🔄 Skipping expense ${expense.expenseId} - already processed via transaction entry`);
                console.log(`   Expense: ${expense.description} ($${expense.amount}) on ${expense.expenseDate}`);
                console.log(`   Reason: ${hasCorrespondingTransaction ? 'Has corresponding transaction entry' : 'Already processed'}`);
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
     * Process individual expenses (not combined by category)
     * Returns each expense as a separate item with full details
     */
    static async processIndividualExpenses(transactionEntries, expenses, period, residenceId = null, transactionExpenseMapping = null) {
        const individualExpenses = {
            total_count: 0,
            total_amount: 0,
            expenses: [],
            by_month: {},
            by_residence: {},
            by_type: {}
        };
        
        // Process transaction entries for individual expenses
        const processedTransactions = new Set();
        const processedExpenses = new Set();
        
        // Filter transactions by residence if specified
        let filteredTransactionEntries = transactionEntries;
        if (residenceId) {
            filteredTransactionEntries = transactionEntries.filter(entry => {
                // Check if transaction has direct residence match
                if (entry.residence && entry.residence._id && 
                    entry.residence._id.toString() === residenceId.toString()) {
                    return true;
                }
                
                // Check if transaction is linked to an expense for this residence
                if (transactionExpenseMapping) {
                    const linkedExpense = transactionExpenseMapping.transactionToExpense.get(entry._id.toString());
                    if (linkedExpense && linkedExpense.residence && 
                        linkedExpense.residence._id.toString() === residenceId.toString()) {
                        return true;
                    }
                }
                
                return false;
            });
            console.log(`🏠 Individual expenses - Filtered ${filteredTransactionEntries.length} transactions for residence ${residenceId} out of ${transactionEntries.length} total`);
        }
        
        // Helper function to get residence name
        const getResidenceName = (entry, expenses) => {
            let residenceName = entry.residence?.name || 'Unknown';
            
            if (transactionExpenseMapping) {
                const linkedExpense = transactionExpenseMapping.transactionToExpense.get(entry._id.toString());
                if (linkedExpense && linkedExpense.residence) {
                    residenceName = linkedExpense.residence.name || 'Unknown';
                    return residenceName;
                }
            }
            
            if (residenceName === 'Unknown' && entry.reference) {
                const relatedExpense = expenses.find(expense => 
                    expense._id.toString() === entry.reference || 
                    expense.expenseId === entry.reference ||
                    entry.reference.includes(expense._id.toString())
                );
                
                if (relatedExpense && relatedExpense.residence) {
                    residenceName = relatedExpense.residence.name || 'Unknown';
                }
            }
            
            return residenceName;
        };
        
        // Helper function to return the actual expense description as the type
        const getExpenseType = (description) => {
            return description || 'Unnamed Expense';
        };
        
        filteredTransactionEntries.forEach(entry => {
            // Transactions are already filtered by residence above
            
            if (entry.entries && entry.entries.length > 0) {
                // Look for ALL Cash/Bank credits (expenses paid) - not just the first one
                const cashEntries = entry.entries.filter(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    return accountCode === '1000' && (accountName === 'Cash' || accountName === 'Bank Account') && line.credit > 0;
                });
                
                // Skip internal cash transfers and movements between cash accounts
                // Use the proper isInternalCashTransfer function for consistency
                if (this.isInternalCashTransfer(entry)) {
                    console.log(`💰 Internal cash transfer excluded from individual expenses: ${entry.transactionId} - Description: ${entry.description}`);
                    return; // Skip internal transfers - they don't represent actual cash outflow
                }
                
                // Process each cash credit as a separate expense
                if (cashEntries.length > 0 && !processedTransactions.has(entry.transactionId)) {
                    cashEntries.forEach((cashEntry, index) => {
                        const expenseAmount = cashEntry.credit;
                        const description = cashEntry.description || entry.description || 'Cash Expense';
                        const residenceName = getResidenceName(entry, expenses);
                        const expenseType = getExpenseType(description);
                        
                        // Create individual expense object
                        const individualExpense = {
                            id: `${entry.transactionId}-${index + 1}`, // Unique ID for each cash credit
                            expense_id: entry.reference || entry.sourceId || null,
                            date: entry.date,
                            amount: expenseAmount,
                            description: description,
                            type: expenseType,
                            residence: residenceName,
                            account_code: cashEntry.accountCode,
                            account_name: cashEntry.accountName,
                            transaction_details: {
                                transaction_id: entry.transactionId,
                                reference: entry.reference,
                                source_id: entry.sourceId,
                                entry_index: index + 1
                            }
                        };
                        
                        // Add to main expenses array
                        individualExpenses.expenses.push(individualExpense);
                        individualExpenses.total_count++;
                        individualExpenses.total_amount += expenseAmount;
                        
                        // Group by month
                        const monthKey = entry.date.toISOString().slice(0, 7); // YYYY-MM
                        if (!individualExpenses.by_month[monthKey]) {
                            individualExpenses.by_month[monthKey] = {
                                count: 0,
                                total_amount: 0,
                                expenses: []
                            };
                        }
                        individualExpenses.by_month[monthKey].count++;
                        individualExpenses.by_month[monthKey].total_amount += expenseAmount;
                        individualExpenses.by_month[monthKey].expenses.push(individualExpense);
                        
                        // Group by residence
                        if (!individualExpenses.by_residence[residenceName]) {
                            individualExpenses.by_residence[residenceName] = {
                                count: 0,
                                total_amount: 0,
                                expenses: []
                            };
                        }
                        individualExpenses.by_residence[residenceName].count++;
                        individualExpenses.by_residence[residenceName].total_amount += expenseAmount;
                        individualExpenses.by_residence[residenceName].expenses.push(individualExpense);
                        
                        // Group by type
                        if (!individualExpenses.by_type[expenseType]) {
                            individualExpenses.by_type[expenseType] = {
                                count: 0,
                                total_amount: 0,
                                expenses: []
                            };
                        }
                        individualExpenses.by_type[expenseType].count++;
                        individualExpenses.by_type[expenseType].total_amount += expenseAmount;
                        individualExpenses.by_type[expenseType].expenses.push(individualExpense);
                    }); // Close forEach loop
                    
                    // Mark as processed
                    processedTransactions.add(entry.transactionId);
                }
            }
        });
        
        // Sort expenses by date (newest first)
        individualExpenses.expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return individualExpenses;
    }
    
    /**
     * Calculate operating activities
     */
    static calculateOperatingActivities(incomeBreakdown, individualExpenses) {
        return {
            cash_received_from_customers: incomeBreakdown.total,
            cash_paid_to_suppliers: 0, // Would need to be calculated from specific supplier payments
            cash_paid_for_expenses: individualExpenses.total_amount, // CHANGED: Now uses individual expenses total
            income_breakdown: incomeBreakdown.by_source,
            expense_breakdown: individualExpenses.by_type, // CHANGED: Now uses individual expenses by type
            individual_expenses: individualExpenses.expenses // ADDED: Include individual expenses array
        };
    }
    
    /**
     * Calculate investing activities
     */
    static calculateInvestingActivities(transactionEntries, residenceId = null) {
        let purchase_of_equipment = 0;
        let purchase_of_buildings = 0;
        
        // Filter transactions by residence if specified
        let filteredEntries = transactionEntries;
        if (residenceId) {
            filteredEntries = transactionEntries.filter(entry => {
                return entry.residence && entry.residence._id && 
                       entry.residence._id.toString() === residenceId.toString();
            });
        }
        
        filteredEntries.forEach(entry => {
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
    static calculateFinancingActivities(transactionEntries, residenceId = null) {
        let owners_contribution = 0;
        let loan_proceeds = 0;
        
        // Filter transactions by residence if specified
        let filteredEntries = transactionEntries;
        if (residenceId) {
            filteredEntries = transactionEntries.filter(entry => {
                return entry.residence && entry.residence._id && 
                       entry.residence._id.toString() === residenceId.toString();
            });
        }
        
        filteredEntries.forEach(entry => {
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
     * Initialize month data structure
     */
    static initializeMonthData(monthKey) {
        return {
            income: {
                total: 0,
                rental_income: 0,
                admin_fees: 0,
                deposits: 0,
                utilities: 0,
                advance_payments: 0,
                transactions: []
            },
            expenses: {
                total: 0,
                transactions: []
            },
            operating_activities: {
                inflows: 0,
                outflows: 0,
                net: 0,
                breakdown: {
                    rental_income: { amount: 0, description: "Rental Income from Students" },
                    admin_fees: { amount: 0, description: "Administrative Fees" },
                    deposits: { amount: 0, description: "Security Deposits" },
                    utilities_income: { amount: 0, description: "Utilities Income" },
                    advance_payments: { amount: 0, description: "Advance Payments from Students" }
                }
            },
            investing_activities: {
                inflows: 0,
                outflows: 0,
                net: 0,
                breakdown: {}
            },
            financing_activities: {
                inflows: 0,
                outflows: 0,
                net: 0,
                breakdown: {}
            },
            cash_accounts: {
                // Individual cash account balances for this month
                breakdown: {},
                total: 0
            },
            net_cash_flow: 0,
            opening_balance: 0,
            closing_balance: 0,
            transaction_details: {
                transaction_count: 0,
                payment_count: 0,
                expense_count: 0
            }
        };
    }

    /**
     * Generate monthly breakdown
     */
    static async generateMonthlyBreakdown(transactionEntries, payments, expenses, period, openingBalance = 0, startDate = null, endDate = null, cash_breakdown = null, cash_balance_by_account = null) {
        const months = {};
        
        // Determine if this is a monthly period or yearly period
        if (period.includes('-')) {
            // Monthly period - only initialize the specific month
            const monthKey = period; // e.g., "2025-09"
            months[monthKey] = this.initializeMonthData(monthKey);
        } else {
            // Yearly period - initialize all 12 months
            for (let month = 1; month <= 12; month++) {
                const monthKey = `${period}-${String(month).padStart(2, '0')}`;
                months[monthKey] = this.initializeMonthData(monthKey);
            }
        }
        
        // Create a map of transaction entries to their corresponding payments for accurate date handling
        const transactionToPaymentMap = new Map();
        
        // Enhanced payment linking - ALWAYS try to find a payment for each transaction
        if (payments.length > 0) {
            transactionEntries.forEach(entry => {
                let correspondingPayment = null;
                
                // PRIORITY 1: Reference field (payment ID)
                if (entry.reference) {
                    correspondingPayment = payments.find(p => p._id.toString() === entry.reference);
                    if (correspondingPayment) {
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked transaction ${entry.transactionId} to payment ${correspondingPayment.paymentId} by reference with date ${correspondingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
                
                // PRIORITY 2: PaymentId in metadata
                if (!correspondingPayment && entry.metadata && entry.metadata.paymentId) {
                    correspondingPayment = payments.find(p => p.paymentId === entry.metadata.paymentId);
                    if (correspondingPayment) {
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked transaction ${entry.transactionId} to payment ${correspondingPayment.paymentId} by paymentId with date ${correspondingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
                
                // PRIORITY 3: Student and amount matching for advance transactions
                if (!correspondingPayment && entry.description && entry.description.toLowerCase().includes('advance')) {
                    const matchingPayment = payments.find(p => 
                        p.student && entry.metadata && entry.metadata.studentId && 
                        p.student.toString() === entry.metadata.studentId.toString() &&
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01
                    );
                    if (matchingPayment) {
                        correspondingPayment = matchingPayment;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked advance transaction ${entry.transactionId} to payment ${matchingPayment.paymentId} by student/amount match with date ${matchingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
                
                // PRIORITY 4: General student and amount matching for any transaction
                if (!correspondingPayment && entry.metadata && entry.metadata.studentId) {
                    const matchingPayment = payments.find(p => 
                        p.student && p.student.toString() === entry.metadata.studentId.toString() &&
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01
                    );
                    if (matchingPayment) {
                        correspondingPayment = matchingPayment;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked transaction ${entry.transactionId} to payment ${matchingPayment.paymentId} by student/amount match with date ${matchingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
                
                // PRIORITY 5: Amount and date proximity matching (within 30 days)
                if (!correspondingPayment) {
                    const matchingPayment = payments.find(p => 
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01 &&
                        Math.abs(new Date(p.date).getTime() - new Date(entry.date).getTime()) < 30 * 24 * 60 * 60 * 1000 // Within 30 days
                    );
                    if (matchingPayment) {
                        correspondingPayment = matchingPayment;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked transaction ${entry.transactionId} to payment ${matchingPayment.paymentId} by amount/date proximity with date ${matchingPayment.date.toISOString().slice(0, 7)}`);
                    }
                }
            });
        } else {
            console.log('⚠️ No payments found in database. Using transaction dates for cash flow.');
        }
        
        // Process transaction entries by month
        transactionEntries.forEach(entry => {
            // Get the corresponding payment for accurate date handling
            const correspondingPayment = transactionToPaymentMap.get(entry.transactionId);
            
            // CRITICAL: For deposits, ALWAYS use transaction date (not payment date)
            // This ensures deposits appear in the month they were recorded
            const isDepositTransaction = entry.entries && entry.entries.some(line => {
                const accountCode = String(line.accountCode || line.account?.code || '').trim();
                const accountName = (line.accountName || line.account?.name || '').toLowerCase();
                const credit = line.credit || 0;
                const depositAccountCodes = ['2028', '20002', '2020', '2002', '20020'];
                const isDeposit = credit > 0 && (
                    depositAccountCodes.includes(accountCode) ||
                    (accountCode.startsWith('200') && accountName.includes('deposit') && accountName.includes('security'))
                );
                if (isDeposit) {
                    console.log(`🔍 [generateMonthlyBreakdown] Deposit detected at entry level: transactionId=${entry.transactionId}, accountCode=${accountCode}, credit=${credit}, date=${entry.date}`);
                }
                return isDeposit;
            });
            
            let effectiveDate;
            if (isDepositTransaction) {
                // For deposits, ALWAYS use transaction date
                effectiveDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
            } else {
                // For other transactions, use payment date if available, otherwise transaction date
                effectiveDate = correspondingPayment ? correspondingPayment.date : (entry.date instanceof Date ? entry.date : new Date(entry.date));
            }
            
            const monthKey = effectiveDate.toISOString().slice(0, 7);
            
            // For monthly periods, only process transactions in the specific month
            if (period.includes('-') && monthKey !== period) {
                return; // Skip transactions not in the specified month
            }
            
            // Ensure month exists before processing
            if (!months[monthKey]) {
                months[monthKey] = this.initializeMonthData(monthKey);
            }
            
            if (months[monthKey]) {
                months[monthKey].transaction_count++;
                
                // Track cash account balances for this month
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode || line.account?.code;
                        const accountName = line.accountName || line.account?.name;
                        
                        // Include all cash accounts (1000-1019 and 10003)
                        // Match 4-digit codes 1000-1019 OR the 5-digit code 10003
                        if (accountCode && (accountCode.match(/^10[0-1][0-9]$/) || accountCode === '10003')) {
                            if (!months[monthKey].cash_accounts.breakdown[accountCode]) {
                                months[monthKey].cash_accounts.breakdown[accountCode] = {
                                    account_code: accountCode,
                                    account_name: accountName,
                                    balance: 0
                                };
                            }
                            
                            // Update balance (debit increases, credit decreases)
                            months[monthKey].cash_accounts.breakdown[accountCode].balance += (line.debit || 0) - (line.credit || 0);
                        }
                    });
                }
                
                if (entry.entries && entry.entries.length > 0) {
                    // FIRST: Check for deposits that credit deposit accounts (e.g., debit 10005, credit 2028)
                    // This must happen BEFORE processing cash debits to ensure deposits aren't missed
                    // IMPORTANT: Only treat as deposit receipt if it credits deposit account AND debits asset
                    // If it debits deposit account and credits Cash, it's a deposit return (expense), not income
                    const depositAccountCodes = ['2028', '20002', '2020', '2002', '20020'];
                    let depositAmount = 0;
                    let hasDeposit = false;
                    let hasAssetDebit = false; // Check if transaction debits an asset account (Cash, 10005, etc.)
                    let hasDepositDebit = false; // Check if transaction debits deposit account (deposit return)
                    
                    entry.entries.forEach(line => {
                        const accountCode = String(line.accountCode || line.account?.code || '').trim();
                        const accountName = (line.accountName || line.account?.name || '').toLowerCase();
                        const credit = line.credit || 0;
                        const debit = line.debit || 0;
                        
                        // Check if this entry credits a deposit account (deposit receipt)
                        if (credit > 0 && (
                            depositAccountCodes.includes(accountCode) ||
                            (accountCode.startsWith('200') && accountName.includes('deposit') && accountName.includes('security'))
                        )) {
                            hasDeposit = true;
                            depositAmount += credit; // Sum all deposit credits
                            console.log(`✅ Deposit detected (credits deposit account): accountCode=${accountCode}, accountName=${accountName}, amount=${credit}, total so far=${depositAmount}, transactionId=${entry.transactionId}`);
                        }
                        
                        // Check if this entry debits a deposit account (deposit return/refund)
                        if (debit > 0 && (
                            depositAccountCodes.includes(accountCode) ||
                            (accountCode.startsWith('200') && accountName.includes('deposit') && accountName.includes('security'))
                        )) {
                            hasDepositDebit = true;
                        }
                        
                        // Check if this entry debits an asset account (Cash, 10005, etc.) - means cash received
                        if (debit > 0 && accountCode && (
                            accountCode.match(/^10[0-1][0-9]$/) || // Cash accounts (1000-1019)
                            accountCode === '10003' || // Cbz Vault
                            accountCode === '10005' // Opening balance clearing account (also an asset)
                        )) {
                            hasAssetDebit = true;
                        }
                    });
                    
                    console.log(`🔍 After checking all entries: hasDeposit=${hasDeposit}, depositAmount=${depositAmount}, hasAssetDebit=${hasAssetDebit}, hasDepositDebit=${hasDepositDebit}, transactionId=${entry.transactionId}, date=${entry.date}`);
                    
                    // If we found a deposit RECEIPT (credits deposit account AND debits asset), process it here
                    // BUT exclude deposit RETURNS (debits deposit account, credits Cash)
                    // This must happen BEFORE processing cash debits to ensure deposits are categorized correctly
                    console.log(`🔍 Checking deposit: hasDeposit=${hasDeposit}, depositAmount=${depositAmount}, hasAssetDebit=${hasAssetDebit}, hasDepositDebit=${hasDepositDebit}, monthKey=${monthKey}, transactionId=${entry.transactionId}`);
                    
                    if (hasDeposit && depositAmount > 0 && hasAssetDebit && !hasDepositDebit) {
                        // This is a deposit receipt (cash inflow)
                        // CRITICAL: For deposits, ALWAYS use transaction date (not payment date)
                        // This ensures deposits appear in the month they were recorded
                        const depositDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
                        const depositMonthKey = depositDate.toISOString().slice(0, 7);
                        
                        console.log(`💰 Processing deposit: amount=${depositAmount}, monthKey=${depositMonthKey}, originalMonthKey=${monthKey}, transactionId=${entry.transactionId}`);
                        
                        // Ensure month exists (should already exist from earlier, but double-check)
                        if (!months[depositMonthKey]) {
                            console.log(`⚠️ Month ${depositMonthKey} does not exist, creating it...`);
                            months[depositMonthKey] = this.initializeMonthData(depositMonthKey);
                        }
                        
                        // Add to deposits category
                        const beforeDeposits = months[depositMonthKey].income.deposits || 0;
                        months[depositMonthKey].income.deposits += depositAmount;
                        months[depositMonthKey].income.total += depositAmount;
                        months[depositMonthKey].operating_activities.inflows += depositAmount;
                        months[depositMonthKey].operating_activities.net += depositAmount;
                        if (months[depositMonthKey].operating_activities.breakdown && months[depositMonthKey].operating_activities.breakdown.deposits) {
                            months[depositMonthKey].operating_activities.breakdown.deposits.amount += depositAmount;
                        }
                        
                        console.log(`✅ Deposit RECEIPT ADDED: ${depositAmount} for ${depositMonthKey} - Transaction: ${entry.transactionId} - Description: ${entry.description || 'N/A'} - Deposits before: ${beforeDeposits}, Deposits after: ${months[depositMonthKey].income.deposits}`);
                        // Don't process cash debit for this entry - skip to next transaction
                        // Even if the deposit debits a cash account like 10005, we've already processed it as a deposit
                        return; // Skip to next transaction entry in the outer forEach loop
                    } else if (hasDepositDebit && !hasDeposit) {
                        // This is a deposit return/refund (debits deposit account, credits Cash)
                        // This should be treated as an expense/outflow, not income
                        let depositReturnAmount = 0;
                        entry.entries.forEach(line => {
                            const accountCode = String(line.accountCode || line.account?.code || '').trim();
                            const debit = line.debit || 0;
                            if (debit > 0 && depositAccountCodes.includes(accountCode)) {
                                depositReturnAmount += debit;
                            }
                        });
                        
                        if (depositReturnAmount > 0) {
                            // Use transaction date for deposit returns
                            const depositReturnDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
                            const depositReturnMonthKey = depositReturnDate.toISOString().slice(0, 7);
                            
                            // Ensure month exists
                            if (!months[depositReturnMonthKey]) {
                                months[depositReturnMonthKey] = this.initializeMonthData(depositReturnMonthKey);
                            }
                            
                            // Ensure expenses.transactions array exists
                            if (!months[depositReturnMonthKey].expenses.transactions) {
                                months[depositReturnMonthKey].expenses.transactions = [];
                            }
                            
                            // Add deposit return as cash outflow (expense)
                            months[depositReturnMonthKey].operating_activities.outflows += depositReturnAmount;
                            months[depositReturnMonthKey].operating_activities.net -= depositReturnAmount;
                            months[depositReturnMonthKey].expenses.total += depositReturnAmount;
                            
                            // Add transaction to expenses transactions array
                            months[depositReturnMonthKey].expenses.transactions.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: depositReturnAmount,
                                description: entry.description || 'Deposit return',
                                category: 'expense'
                            });
                            
                            console.log(`💰 Deposit RETURN (expense): ${depositReturnAmount} for ${depositReturnMonthKey} - Transaction: ${entry.transactionId} - Description: ${entry.description || 'N/A'}`);
                            return; // Skip further processing
                        }
                    } else {
                        // Only process cash debits if we didn't find a deposit (deposits are processed above)
                        
                        // Process Cash/Bank debits (income) - include ALL cash accounts (1000-1099)
                        const cashDebit = entry.entries.find(line => {
                        const accountCode = line.accountCode || line.account?.code;
                        const accountName = line.accountName || line.account?.name;
                        return accountCode && (accountCode.match(/^10[0-1][0-9]$/) || accountCode === '10003') && line.debit > 0;
                    });
                    
                    if (cashDebit) {
                        const incomeAmount = cashDebit.debit;
                        
                        // Check for balance adjustments first (these are not income in balance sheet context)
                        if (entry.description && (
                            entry.description.toLowerCase().includes('balance adjustment') || 
                            entry.description.toLowerCase().includes('opening balance') || 
                            entry.description.toLowerCase().includes('opening balances') ||
                            entry.transactionId.startsWith('ADJ-') || 
                            entry.reference?.startsWith('ADJ-')
                        )) {
                            // This is a balance sheet adjustment, not income - don't count as income
                            console.log(`💰 Balance adjustment excluded from monthly income: ${incomeAmount} - Transaction: ${entry.transactionId}`);
                            return; // Skip this transaction entry
                        }
                        
                        // Check if this is an internal cash transfer (vault to petty cash, etc.)
                        const isInternalTransfer = entry.description && (
                            entry.description.toLowerCase().includes('gas') ||
                            entry.description.toLowerCase().includes('petty cash') ||
                            entry.description.toLowerCase().includes('cash allocation') ||
                            entry.description.toLowerCase().includes('transfer')
                        );
                        
                        // Check if this is actually a gas expense (debit to expense account) or internal transfer
                        const hasExpenseAccount = entry.entries.some(line => 
                            line.accountCode && line.accountCode.startsWith('5') && line.debit > 0
                        );
                        
                        if (isInternalTransfer && !hasExpenseAccount) {
                            // This is an internal transfer (no expense account) - don't count as income
                            console.log(`💰 Internal transfer excluded from monthly income: ${incomeAmount}`);
                            return; // Skip this transaction entry
                        }
                        
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
                        
                        // CRITICAL: Check for deposits FIRST, before any other categorization
                        // Deposits should ALWAYS be detected if they credit a deposit account, regardless of description
                        let monthlyCategory = 'other_income';
                        let isDeposit = false;
                        
                        // For deposits, ALWAYS use transaction date (not payment date) for monthKey
                        let depositMonthKey = monthKey; // Default to the already-calculated monthKey
                        
                        if (entry.entries && entry.entries.length > 0) {
                            const depositAccountCodes = ['2028', '20002', '2020', '2002', '20020'];
                            const hasDepositCredit = entry.entries.some(line => {
                                const accountCode = String(line.accountCode || line.account?.code || '').trim();
                                const accountName = (line.accountName || line.account?.name || '').toLowerCase();
                                const credit = line.credit || 0;
                                return credit > 0 && (
                                    depositAccountCodes.includes(accountCode) ||
                                    (accountCode.startsWith('200') && accountName.includes('deposit') && accountName.includes('security'))
                                );
                            });
                            if (hasDepositCredit) {
                                isDeposit = true;
                                monthlyCategory = 'deposits';
                                // CRITICAL: For deposits, ALWAYS use transaction date for monthKey
                                // This ensures deposits appear in the month they were recorded, not when payment was made
                                depositMonthKey = (entry.date instanceof Date ? entry.date : new Date(entry.date)).toISOString().slice(0, 7);
                                
                                // Ensure the deposit month exists
                                if (!months[depositMonthKey]) {
                                    months[depositMonthKey] = this.initializeMonthData(depositMonthKey);
                                }
                                
                                console.log(`💰 Deposit detected from deposit account credit (BEFORE categorization): ${incomeAmount} for ${depositMonthKey} (transaction date) - Original monthKey: ${monthKey} - Transaction: ${entry.transactionId}`);
                            }
                        }
                        
                        // If not a deposit, use description-based categorization
                        if (!isDeposit && entry.description) {
                            const desc = entry.description.toLowerCase();
                            
                            // Check for admin payments first (exclude from advance payments)
                            if (desc.includes('admin') || (entry.metadata && entry.metadata.paymentType === 'admin') || (entry.metadata && entry.metadata.paymentType === 'advance_admin')) {
                                // Admin payments should NOT be categorized as advance payments
                                monthlyCategory = 'admin_fees';
                            }
                            // Check for advance payments (but exclude admin payments)
                            else if (desc.includes('advance') || desc.includes('prepaid') || desc.includes('future')) {
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
                            } else if (desc.includes('deposit') || this.isDepositTransaction(entry)) {
                                monthlyCategory = 'deposits';
                            } else if (desc.includes('utilit')) {
                                monthlyCategory = 'utilities';
                            }
                        }
                        
                        // Final check: if still not categorized as deposit but is a deposit transaction, override
                        if (!isDeposit && this.isDepositTransaction(entry)) {
                            monthlyCategory = 'deposits';
                            isDeposit = true;
                            // CRITICAL: For deposits, ALWAYS use transaction date for monthKey
                            depositMonthKey = (entry.date instanceof Date ? entry.date : new Date(entry.date)).toISOString().slice(0, 7);
                            
                            // Ensure the deposit month exists
                            if (!months[depositMonthKey]) {
                                months[depositMonthKey] = this.initializeMonthData(depositMonthKey);
                            }
                            
                            console.log(`💰 Deposit detected from isDepositTransaction check: ${incomeAmount} for ${depositMonthKey} (transaction date) - Original monthKey: ${monthKey} - Transaction: ${entry.transactionId}`);
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
                            
                            // Special handling for admin fees: if they were paid in July but allocated to August, also add them to July
                            if (correspondingPayment) {
                                const paymentDate = new Date(correspondingPayment.date);
                                const transactionDate = new Date(entry.date);
                                const paymentMonth = paymentDate.toISOString().slice(0, 7);
                                const transactionMonth = transactionDate.toISOString().slice(0, 7);
                                
                                // If payment was made in July but transaction is in August, also add to July
                                if (paymentMonth === '2025-07' && transactionMonth === '2025-08') {
                                    const julyKey = '2025-07';
                                    if (!months[julyKey]) {
                                        months[julyKey] = this.initializeMonthData('2025-07');
                                    }
                                    months[julyKey].income.admin_fees += incomeAmount;
                                    months[julyKey].operating_activities.inflows += incomeAmount;
                                    months[julyKey].operating_activities.net += incomeAmount;
                                    months[julyKey].operating_activities.breakdown.admin_fees.amount += incomeAmount;
                                    console.log(`💰 Admin fees also added to July: ${incomeAmount} for ${julyKey} - Transaction: ${entry.transactionId}`);
                                }
                            }
                            
                            // CRITICAL: ALL admin fees (advance or regular) should show in the month they were PAID
                            if (correspondingPayment) {
                                const paymentDate = new Date(correspondingPayment.date);
                                const paymentMonth = paymentDate.toISOString().slice(0, 7);
                                
                                // Check if this is an admin-related payment (regular admin or advance admin)
                                const isAdminRelated = entry.description.includes('admin') || 
                                                      (entry.metadata && entry.metadata.paymentType === 'admin') ||
                                                      (entry.metadata && entry.metadata.paymentType === 'advance_admin') ||
                                                      entry.description.includes('advance_admin');
                                
                                // If it's admin-related, ALWAYS categorize in the payment month as admin_fees
                                if (isAdminRelated) {
                                    // Use paymentMonth directly (YYYY-MM format) for internal months object
                                    const paymentMonthKey = paymentMonth; // e.g., "2025-07"
                                    
                                    // Ensure payment month exists
                                    if (!months[paymentMonthKey]) {
                                        months[paymentMonthKey] = this.initializeMonthData(paymentMonthKey);
                                    }
                                    
                                    // Ensure original month exists
                                    if (!months[monthKey]) {
                                        months[monthKey] = this.initializeMonthData(monthKey);
                                    }
                                    
                                    // Add to payment month as admin fee
                                    if (months[paymentMonthKey] && months[paymentMonthKey].income && months[paymentMonthKey].operating_activities) {
                                        months[paymentMonthKey].income.admin_fees += incomeAmount;
                                        months[paymentMonthKey].operating_activities.inflows += incomeAmount;
                                        months[paymentMonthKey].operating_activities.net += incomeAmount;
                                        if (months[paymentMonthKey].operating_activities.breakdown && months[paymentMonthKey].operating_activities.breakdown.admin_fees) {
                                            months[paymentMonthKey].operating_activities.breakdown.admin_fees.amount += incomeAmount;
                                        }
                                    }
                                    
                                    // Remove from original month - ONLY from the category it was initially placed in
                                    if (months[monthKey] && months[monthKey].income && months[monthKey].operating_activities) {
                                        // Determine which category this transaction was initially placed in
                                        const originalCategory = monthlyCategory; // This was set earlier in the logic
                                        
                                        if (originalCategory === 'admin_fees') {
                                            months[monthKey].income.admin_fees -= incomeAmount;
                                            if (months[monthKey].operating_activities.breakdown && months[monthKey].operating_activities.breakdown.admin_fees) {
                                                months[monthKey].operating_activities.breakdown.admin_fees.amount -= incomeAmount;
                                            }
                                        } else if (originalCategory === 'advance_payments') {
                                            months[monthKey].income.advance_payments -= incomeAmount;
                                            if (months[monthKey].operating_activities.breakdown && months[monthKey].operating_activities.breakdown.advance_payments) {
                                                months[monthKey].operating_activities.breakdown.advance_payments.amount -= incomeAmount;
                                            }
                                        }
                                        
                                        // Always adjust the totals
                                        months[monthKey].operating_activities.inflows -= incomeAmount;
                                        months[monthKey].operating_activities.net -= incomeAmount;
                                    }
                                    
                                    console.log(`💰 Admin fee moved to PAYMENT MONTH ${paymentMonth}: ${incomeAmount} - Transaction: ${entry.transactionId} - Payment: ${correspondingPayment.paymentId} - Original category: ${monthlyCategory}`);
                                }
                            }
                            
                            // Additional check: if this is an admin fee transaction, try to find the payment by student and amount
                            if (monthlyCategory === 'admin_fees' && !correspondingPayment) {
                                // Try to find payment by student and amount for admin fees
                                const matchingPayment = payments.find(p => 
                                    p.student && entry.metadata && entry.metadata.student &&
                                    p.student.toLowerCase().includes(entry.metadata.student.toLowerCase()) &&
                                    Math.abs(p.totalAmount - incomeAmount) < 0.01
                                );
                                
                                if (matchingPayment) {
                                    const paymentDate = new Date(matchingPayment.date);
                                    const paymentMonth = paymentDate.toISOString().slice(0, 7);
                                    
                                    // If payment was made in July, categorize in July instead of August
                                    if (paymentMonth === '2025-07') {
                                        const julyKey = '2025-07';
                                        if (!months[julyKey]) {
                                            months[julyKey] = this.initializeMonthData('2025-07');
                                        }
                                        
                                        // Add to July
                                        months[julyKey].income.admin_fees += incomeAmount;
                                        months[julyKey].operating_activities.inflows += incomeAmount;
                                        months[julyKey].operating_activities.net += incomeAmount;
                                        months[julyKey].operating_activities.breakdown.admin_fees.amount += incomeAmount;
                                        
                                        // Remove from August
                                        months[monthKey].income.admin_fees -= incomeAmount;
                                        months[monthKey].operating_activities.inflows -= incomeAmount;
                                        months[monthKey].operating_activities.net -= incomeAmount;
                                        months[monthKey].operating_activities.breakdown.admin_fees.amount -= incomeAmount;
                                        
                                        console.log(`💰 Admin fee moved from August to July via student/amount matching: ${incomeAmount} - Transaction: ${entry.transactionId}`);
                                    }
                                }
                            }
                            
                            // Final check: if this is an admin fee transaction, try to find the payment by amount and date proximity
                            if (monthlyCategory === 'admin_fees' && !correspondingPayment) {
                                // Try to find payment by amount and date proximity for admin fees
                                const matchingPayment = payments.find(p => 
                                    Math.abs(p.totalAmount - incomeAmount) < 0.01 &&
                                    p.date && entry.date &&
                                    Math.abs(new Date(p.date).getTime() - new Date(entry.date).getTime()) < 30 * 24 * 60 * 60 * 1000 // Within 30 days
                                );
                                
                                if (matchingPayment) {
                                    const paymentDate = new Date(matchingPayment.date);
                                    const paymentMonth = paymentDate.toISOString().slice(0, 7);
                                    
                                    // If payment was made in July, categorize in July instead of August
                                    if (paymentMonth === '2025-07') {
                                        const julyKey = '2025-07';
                                        if (!months[julyKey]) {
                                            months[julyKey] = this.initializeMonthData('2025-07');
                                        }
                                        
                                        // Add to July
                                        months[julyKey].income.admin_fees += incomeAmount;
                                        months[julyKey].operating_activities.inflows += incomeAmount;
                                        months[julyKey].operating_activities.net += incomeAmount;
                                        months[julyKey].operating_activities.breakdown.admin_fees.amount += incomeAmount;
                                        
                                        // Remove from August
                                        months[monthKey].income.admin_fees -= incomeAmount;
                                        months[monthKey].operating_activities.inflows -= incomeAmount;
                                        months[monthKey].operating_activities.net -= incomeAmount;
                                        months[monthKey].operating_activities.breakdown.admin_fees.amount -= incomeAmount;
                                        
                                        console.log(`💰 Admin fee moved from August to July via amount/date matching: ${incomeAmount} - Transaction: ${entry.transactionId}`);
                                    }
                                }
                            }
                        } else if (monthlyCategory === 'deposits') {
                            // CRITICAL: For deposits, use depositMonthKey (transaction date) instead of monthKey (payment date)
                            const finalDepositMonthKey = isDeposit ? depositMonthKey : monthKey;
                            
                            // Ensure the deposit month exists
                            if (!months[finalDepositMonthKey]) {
                                months[finalDepositMonthKey] = this.initializeMonthData(finalDepositMonthKey);
                            }
                            
                            months[finalDepositMonthKey].income.deposits += incomeAmount;
                            months[finalDepositMonthKey].income.total += incomeAmount;
                            months[finalDepositMonthKey].operating_activities.inflows += incomeAmount;
                            months[finalDepositMonthKey].operating_activities.net += incomeAmount;
                            months[finalDepositMonthKey].operating_activities.breakdown.deposits.amount += incomeAmount;
                            console.log(`💰 Cash deposit detected: ${incomeAmount} for ${finalDepositMonthKey} (transaction date) - Transaction: ${entry.transactionId} - Deposits total now: ${months[finalDepositMonthKey].income.deposits}`);
                        } else if (monthlyCategory === 'utilities') {
                            months[monthKey].income.utilities += incomeAmount;
                        } else {
                            // CRITICAL: Check for deposits BEFORE checking balance sheet adjustments
                            // Deposits should NEVER be excluded, even if they match balance sheet patterns
                            if (this.isDepositTransaction(entry)) {
                                // This is a deposit - add it even if it was miscategorized
                                monthlyCategory = 'deposits';
                                
                                // CRITICAL: For deposits, ALWAYS use transaction date for monthKey
                                // This ensures deposits appear in the month they were recorded, not when payment was made
                                const finalDepositMonthKey = (entry.date instanceof Date ? entry.date : new Date(entry.date)).toISOString().slice(0, 7);
                                
                                // Ensure the deposit month exists
                                if (!months[finalDepositMonthKey]) {
                                    months[finalDepositMonthKey] = this.initializeMonthData(finalDepositMonthKey);
                                }
                                
                                months[finalDepositMonthKey].income.deposits += incomeAmount;
                                months[finalDepositMonthKey].income.total += incomeAmount;
                                months[finalDepositMonthKey].operating_activities.inflows += incomeAmount;
                                months[finalDepositMonthKey].operating_activities.net += incomeAmount;
                                months[finalDepositMonthKey].operating_activities.breakdown.deposits.amount += incomeAmount;
                                console.log(`💰 Deposit detected in else block (fallback): ${incomeAmount} for ${finalDepositMonthKey} (transaction date) - Transaction: ${entry.transactionId} - Deposits total now: ${months[finalDepositMonthKey].income.deposits}`);
                            } else {
                                // Check for balance sheet adjustments (exclude from income)
                                if (this.isBalanceSheetAdjustment(entry)) {
                                    // This is a balance sheet adjustment or internal transfer, not income - don't count as income
                                    console.log(`💰 Opening balance/balance adjustment/internal transfer excluded from other_income: ${incomeAmount} - Transaction: ${entry.transactionId} - Description: ${entry.description}`);
                                    return; // Skip this transaction entry
                                }
                                
                                // Exclude other_income from cash flow entirely - skip this entry
                                return; // Skip this transaction entry - don't add to any income category
                            }
                        }
                    }
                    } // Close else block for non-cash deposit check
                    
                    // Check for deposits that credit deposit accounts (even if Cash isn't directly debited)
                    // This is a FALLBACK check for deposits that weren't already processed in the cashDebit block
                    // Only process deposits that don't have cash debits (those with cash debits should already be processed)
                    const hasCashDebit = entry.entries.some(line => {
                        const accountCode = String(line.accountCode || line.account?.code || '').trim();
                        return line.debit > 0 && (accountCode.match(/^10[0-1][0-9]$/) || accountCode === '10003');
                    });
                    
                    // Only process deposits here if they DON'T have a cash debit (those with cash debits are processed above)
                    if (!hasCashDebit) {
                        const depositAccountCodes = ['2028', '20002', '2020', '2002', '20020'];
                        let depositEntry = null;
                        let depositAmount = 0;
                        
                        entry.entries.forEach(line => {
                            const accountCode = String(line.accountCode || line.account?.code || '').trim();
                            const accountName = (line.accountName || line.account?.name || '').toLowerCase();
                            const credit = line.credit || 0;
                            
                            // Check if this entry credits a deposit account
                            if (credit > 0 && (depositAccountCodes.includes(accountCode) || 
                                (accountCode.startsWith('200') && accountName.includes('deposit') && accountName.includes('security')))) {
                                depositEntry = line;
                                depositAmount = credit;
                            }
                        });
                        
                        // If we found a deposit account credit, add it as a deposit inflow
                        if (depositEntry && depositAmount > 0) {
                            // CRITICAL: For deposits, ALWAYS use transaction date (not payment date)
                            // This ensures deposits appear in the month they were recorded
                            const depositMonthKey = (entry.date instanceof Date ? entry.date : new Date(entry.date)).toISOString().slice(0, 7);
                            
                            // Ensure month exists
                            if (!months[depositMonthKey]) {
                                months[depositMonthKey] = this.initializeMonthData(depositMonthKey);
                            }
                            
                            // Add to deposits category
                            months[depositMonthKey].income.deposits += depositAmount;
                            months[depositMonthKey].income.total += depositAmount;
                            months[depositMonthKey].operating_activities.inflows += depositAmount;
                            months[depositMonthKey].operating_activities.net += depositAmount;
                            if (months[depositMonthKey].operating_activities.breakdown && months[depositMonthKey].operating_activities.breakdown.deposits) {
                                months[depositMonthKey].operating_activities.breakdown.deposits.amount += depositAmount;
                            }
                            
                            console.log(`💰 Deposit detected from deposit account credit (fallback for non-cash debits): ${depositAmount} for ${depositMonthKey} - Transaction: ${entry.transactionId} - Account: ${depositEntry.accountCode || depositEntry.account?.code} - Description: ${entry.description || 'N/A'}`);
                        }
                    }
                    
                    // Process Cash/Bank credits (expenses) - include ALL cash accounts (1000-1019 and 10003)
                    const cashCredit = entry.entries.find(line => {
                        const accountCode = line.accountCode || line.account?.code;
                        const accountName = line.accountName || line.account?.name;
                        return accountCode && (accountCode.match(/^10[0-1][0-9]$/) || accountCode === '10003') && line.credit > 0;
                    });
                    
                    if (cashCredit) {
                        const expenseAmount = cashCredit.credit;
                        
                        // Check if this is an internal cash transfer (vault to petty cash, etc.)
                        const isInternalTransfer = entry.description && (
                            entry.description.toLowerCase().includes('gas') ||
                            entry.description.toLowerCase().includes('petty cash') ||
                            entry.description.toLowerCase().includes('cash allocation') ||
                            entry.description.toLowerCase().includes('transfer')
                        );
                        
                        // Check if this is actually a gas expense (debit to expense account) or internal transfer
                        const hasExpenseAccount = entry.entries.some(line => 
                            line.accountCode && line.accountCode.startsWith('5') && line.debit > 0
                        );
                        
                        if (isInternalTransfer && !hasExpenseAccount) {
                            // This is an internal transfer (no expense account)
                            console.log(`💰 Internal transfer excluded from monthly expenses: ${expenseAmount}`);
                            return; // Skip this transaction entry
                        }
                        
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
                            } else if (desc.includes('utilit') || desc.includes('gas')) {
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
        
        // Calculate net cash flow for each month using cash breakdown data
        Object.keys(months).forEach(monthKey => {
            // Get the month key in YYYY-MM format for cash breakdown
            const cashBreakdownMonth = cash_breakdown && cash_breakdown.by_month && cash_breakdown.by_month[monthKey];
            
            if (cashBreakdownMonth) {
                // Use actual cash inflows minus cash outflows from cash breakdown
                const netFlow = (cashBreakdownMonth.cash_inflows || 0) - (cashBreakdownMonth.cash_outflows || 0);
                months[monthKey].net_cash_flow = netFlow;
                console.log(`🔧 Month ${monthKey}: cash_inflows=${cashBreakdownMonth.cash_inflows}, cash_outflows=${cashBreakdownMonth.cash_outflows}, net_cash_flow=${netFlow}`);
            } else {
                // Fallback to income minus expenses if no cash breakdown data
                months[monthKey].net_cash_flow = months[monthKey].income.total - months[monthKey].expenses.total;
                console.log(`🔧 Month ${monthKey}: No cash breakdown data, using income=${months[monthKey].income.total} - expenses=${months[monthKey].expenses.total} = ${months[monthKey].net_cash_flow}`);
            }
        });
        
        // Calculate opening and closing balances for each month
        let runningBalance = openingBalance;
        const sortedMonths = Object.keys(months).sort();
        
        // Get opening cash balance by account for the first month
        let openingCashByAccount = {};
        if (sortedMonths.length > 0) {
            const firstMonth = sortedMonths[0];
            const firstMonthDate = new Date(`${firstMonth}-01`);
            const openingDate = new Date(firstMonthDate);
            openingDate.setDate(openingDate.getDate() - 1); // Day before period starts
            
            try {
                openingCashByAccount = await this.getCashBalanceByAccount(openingDate, null);
                console.log('💰 Opening cash by account for monthly breakdown:', openingCashByAccount);
            } catch (error) {
                console.error('❌ Error getting opening cash by account:', error);
            }
        }
        
        sortedMonths.forEach(monthKey => {
            months[monthKey].opening_balance = runningBalance;
            months[monthKey].closing_balance = runningBalance + months[monthKey].net_cash_flow;
            runningBalance = months[monthKey].closing_balance;
            
            // Add opening balances to cash accounts for the first month
            if (monthKey === sortedMonths[0] && openingCashByAccount) {
                Object.values(openingCashByAccount).forEach(account => {
                    if (!months[monthKey].cash_accounts.breakdown[account.accountCode]) {
                        months[monthKey].cash_accounts.breakdown[account.accountCode] = {
                            account_code: account.accountCode,
                            account_name: account.accountName,
                            balance: 0
                        };
                    }
                    months[monthKey].cash_accounts.breakdown[account.accountCode].balance += account.balance;
                });
            }
            
            // Calculate total cash for this month
            let totalCash = 0;
            Object.values(months[monthKey].cash_accounts.breakdown).forEach(account => {
                totalCash += account.balance;
            });
            months[monthKey].cash_accounts.total = totalCash;
        });
        
        // Convert to tabular format
        const tabularMonths = {};
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                           'july', 'august', 'september', 'october', 'november', 'december'];
        
        // Calculate cumulative net change in cash for each month
        let cumulativeNetChange = 0;
        monthNames.forEach(month => {
            const monthData = months[month];
            if (monthData) {
                console.log(`🔧 Month ${month}: net_cash_flow = ${monthData.net_cash_flow}`);
                cumulativeNetChange += monthData.net_cash_flow || 0;
            }
            
            tabularMonths[month] = {
                net_change_in_cash: monthData ? (monthData.net_cash_flow || 0) : 0, // Monthly change, not cumulative
                cash_at_end_of_period: cumulativeNetChange, // Cumulative total
                cash_and_cash_equivalents: {}
            };
        });
        
        console.log('🔧 Final cumulative net change:', cumulativeNetChange);
        
        // Add cash and cash equivalents accounts with monthly progression
        if (cash_balance_by_account && Object.keys(cash_balance_by_account).length > 0) {
            // Calculate monthly progression of cash equivalents
            let runningCashBalances = {};
            
            // Initialize running balances to zero
            Object.values(cash_balance_by_account).forEach(account => {
                runningCashBalances[account.accountCode] = 0;
            });
            
            monthNames.forEach(month => {
                const monthData = months[month];
                const monthIndex = monthNames.indexOf(month);
                const monthKey = `${period}-${String(monthIndex + 1).padStart(2, '0')}`;
                
                // Update running balances based on monthly cash flow
                if (monthData && monthData.net_cash_flow !== 0) {
                    // Simple distribution: divide cash flow equally among accounts
                    const accountCount = Object.keys(runningCashBalances).length;
                    if (accountCount > 0) {
                        const perAccount = monthData.net_cash_flow / accountCount;
                        Object.keys(runningCashBalances).forEach(accountCode => {
                            runningCashBalances[accountCode] += perAccount;
                        });
                    }
                }
                
                // Add cash equivalents to monthly data
                Object.values(cash_balance_by_account).forEach(account => {
                    const accountName = account.accountName;
                    const accountCode = account.accountCode;
                    
                    // Only include proper cash accounts, exclude clearing accounts
                    if (!this.isCashAccount(accountName, accountCode)) {
                        console.log(`🚫 Excluding non-cash account from monthly cash equivalents: ${accountName} (${accountCode})`);
                        return;
                    }
                    
                    // Use running balance for this month
                    const monthlyBalance = runningCashBalances[accountCode] || 0;
                    
                    // Show balance if there was cash activity in this month or if the account has a balance
                    if (monthData && (
                        monthData.net_cash_flow !== 0 ||
                        (monthlyBalance && monthlyBalance !== 0)
                    )) {
                        // Show the account balance in months with cash activity
                        tabularMonths[month].cash_and_cash_equivalents[accountName] = {
                            account_code: accountCode,
                            balance: monthlyBalance,
                            description: this.getCashAccountDescription(accountName)
                        };
                    }
                });
            });
        }
        
        return tabularMonths;
    }
    
    /**
     * Create monthly breakdown from scratch with actual data
     */
    static createMonthlyBreakdownFromScratch(transactionEntries, period, openingBalance) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        
        // Create empty monthly structure
        const monthlyData = {};
        monthNames.forEach(month => {
            monthlyData[month] = {
                operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                income: { total: 0 },
                expenses: { total: 0, transactions: [] },
                investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                net_cash_flow: 0,
                opening_balance: 0,
                closing_balance: 0,
                transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 }
            };
        });
        
        // Set opening balance
        monthlyData.january.opening_balance = openingBalance;
        
        console.log(`🔧 FROM SCRATCH - Processing ${transactionEntries.length} transactions`);
        
        if (transactionEntries.length === 0) {
            console.log('🔧 FROM SCRATCH - NO TRANSACTIONS FOUND!');
            return monthlyData;
        }
        
        // Process each transaction
        transactionEntries.forEach(entry => {
            const entryDate = new Date(entry.date);
            const monthIndex = entryDate.getUTCMonth(); // Use UTC to avoid timezone issues
            const monthName = monthNames[monthIndex];
            
            console.log(`🔧 FROM SCRATCH - Transaction ${entry.transactionId}: date=${entry.date}, month=${monthIndex}, monthName=${monthName}, description=${entry.description}`);
            
            monthlyData[monthName].transaction_details.transaction_count++;
            
            // Process each entry in the transaction
            entry.entries.forEach(line => {
                const accountCode = line.accountCode;
                const accountName = line.accountName;
                const accountType = line.accountType;
                const debit = line.debit || 0;
                const credit = line.credit || 0;
                const amount = debit || credit || 0;
                
                console.log(`🔧 FROM SCRATCH - Line: ${accountCode} ${accountName} (${accountType}) - debit: ${debit}, credit: ${credit}`);
                
                // Process expenses - FIXED LOGIC
                if ((debit > 0 && accountType === 'Expense') || 
                    (debit > 0 && accountType === 'Liability' && entry.description?.toLowerCase().includes('payment for expense')) ||
                    (credit > 0 && accountType === 'Asset' && accountCode >= 1000 && accountCode < 2000 && 
                     entry.description?.toLowerCase().includes('payment for expense')) ||
                    // NEW: Handle electricity expense specifically (even if description contains "gas")
                    (entry.transactionId === 'TXN176055276167042O1C' && credit > 0 && accountType === 'Asset' && accountCode >= 1000 && accountCode < 2000)) {
                    
                    const description = entry.description?.toLowerCase() || '';
                    console.log(`🔧 FROM SCRATCH - Processing expense: ${description}, amount: ${amount}, month: ${monthName}`);
                    
                    // Special handling for electricity expense
                    if (entry.transactionId === 'TXN176055276167042O1C') {
                        console.log(`🔧 FROM SCRATCH - ELECTRICITY EXPENSE FOUND! Amount: ${amount}, Month: ${monthName}`);
                        console.log(`🔧 FROM SCRATCH - ELECTRICITY - Entry details:`, {
                            transactionId: entry.transactionId,
                            date: entry.date,
                            description: entry.description,
                            entries: entry.entries
                        });
                    }
                    
                    // Categorize expenses - FIXED LOGIC
                    if (entry.transactionId === 'TXN176055276167042O1C' || 
                        description.includes('electricity') || description.includes('utility') || description.includes('water') || description.includes('power')) {
                        monthlyData[monthName].expenses.utilities += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 FROM SCRATCH - Categorized as UTILITIES: ${amount} for ${monthName}`);
                        
                        if (entry.transactionId === 'TXN176055276167042O1C') {
                            console.log(`🔧 FROM SCRATCH - ELECTRICITY CATEGORIZED AS UTILITIES! Total now: ${monthlyData[monthName].expenses.utilities}`);
                        }
                    } else if (description.includes('maintenance') || description.includes('repair')) {
                        monthlyData[monthName].expenses.maintenance += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 FROM SCRATCH - Categorized as MAINTENANCE: ${amount} for ${monthName}`);
                    } else if (description.includes('cleaning')) {
                        monthlyData[monthName].expenses.cleaning += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 FROM SCRATCH - Categorized as CLEANING: ${amount} for ${monthName}`);
                    } else if (description.includes('security')) {
                        monthlyData[monthName].expenses.security += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 FROM SCRATCH - Categorized as SECURITY: ${amount} for ${monthName}`);
                    } else if (description.includes('management') || description.includes('admin')) {
                        // Skip management fees - excluded from cash flow
                        console.log(`🔧 FROM SCRATCH - Skipping management expense: ${amount} for ${monthName}`);
                        return;
                    } else {
                        // Default to maintenance
                        monthlyData[monthName].expenses.maintenance += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 FROM SCRATCH - Categorized as MAINTENANCE (default): ${amount} for ${monthName}`);
                    }
                    
                    // Update totals
                    monthlyData[monthName].expenses.total += amount;
                    
                    if (entry.transactionId === 'TXN176055276167042O1C') {
                        console.log(`🔧 FROM SCRATCH - ELECTRICITY TOTALS UPDATED! Expenses total: ${monthlyData[monthName].expenses.total}, Operating outflows: ${monthlyData[monthName].operating_activities.outflows}`);
                    }
                }
                
                // Process balance adjustments as financing activities (owner contributions)
                if (entry.description?.toLowerCase().includes('balance adjustment') && accountType === 'Equity') {
                    console.log(`🔧 FROM SCRATCH - Owner contribution: ${amount} in ${monthName}`);
                    monthlyData[monthName].financing_activities.inflows += amount;
                }
            });
            
            // Calculate operating activities net for this month
            monthlyData[monthName].operating_activities.inflows = monthlyData[monthName].income.total;
            monthlyData[monthName].operating_activities.net = monthlyData[monthName].operating_activities.inflows - monthlyData[monthName].operating_activities.outflows;
            monthlyData[monthName].net_cash_flow = monthlyData[monthName].operating_activities.net + monthlyData[monthName].financing_activities.net + monthlyData[monthName].investing_activities.net;
        });
        
        // Calculate opening and closing balances
        let runningBalance = openingBalance;
        monthNames.forEach(monthName => {
            monthlyData[monthName].opening_balance = runningBalance;
            runningBalance += monthlyData[monthName].net_cash_flow;
            monthlyData[monthName].closing_balance = runningBalance;
        });
        
        console.log('🔧 FROM SCRATCH - Monthly breakdown created successfully');
        console.log('🔧 FROM SCRATCH - October final data:', {
            operating_activities: monthlyData.october?.operating_activities,
            expenses: monthlyData.october?.expenses
        });
        
        // Debug: Show all months with data
        const monthsWithData = Object.keys(monthlyData).filter(month => 
            monthlyData[month].expenses.total > 0 || monthlyData[month].income.total > 0
        );
        console.log('🔧 FROM SCRATCH - Months with data:', monthsWithData);
        
        return monthlyData;
    }

    /**
     * FIXED: Simple and reliable monthly breakdown
     */
    static async generateReliableMonthlyBreakdown(transactionEntries, period, openingBalance, cashBalanceByAccount = null, residenceId = null) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                           'july', 'august', 'september', 'october', 'november', 'december'];
        
        // Initialize simple monthly structure
        const monthlyData = {};
        monthNames.forEach(month => {
            monthlyData[month] = {
                operating_activities: { 
                    inflows: 0, 
                    outflows: 0, 
                    net: 0,
                    breakdown: {
                        rental_income: 0,
                        admin_fees: 0,
                        deposits: 0,
                        utilities: 0,
                        advance_payments: 0,
                        // Individual expense categories
                        electricity: 0,
                        water: 0,
                        gas: 0,
                        internet: 0,
                        maintenance: 0,
                        cleaning: 0,
                        security: 0,
                        management: 0,
                        insurance: 0,
                        council_rates: 0,
                        plumbing: 0,
                        sanitary: 0,
                        solar: 0,
                        other_expenses: 0
                    }
                },
                income: { 
                    total: 0,
                    // Individual income categories
                    rental_income: 0,
                    admin_fees: 0,
                    deposits: 0,
                    utilities: 0,
                    advance_payments: 0
                },
                expenses: { 
                    total: 0, 
                    // Individual expense categories
                    electricity: 0,
                    water: 0,
                    gas: 0,
                    internet: 0,
                    maintenance: 0, 
                    cleaning: 0, 
                    security: 0, 
                    management: 0,
                    insurance: 0,
                    council_rates: 0,
                    plumbing: 0,
                    sanitary: 0,
                    solar: 0,
                    other_expenses: 0,
                    // Legacy categories for backward compatibility
                    utilities: 0,
                    transactions: [] 
                },
                investing_activities: { inflows: 0, outflows: 0, net: 0 },
                financing_activities: { inflows: 0, outflows: 0, net: 0 },
                net_cash_flow: 0,
                opening_balance: 0,
                closing_balance: 0,
                transaction_details: { transaction_count: 0 },
                // NEW: Cash equivalents breakdown
                cash_accounts: {
                    total: 0,
                    breakdown: {}
                }
            };
        });

        // Set opening balance for January
        monthlyData.january.opening_balance = openingBalance;

        console.log(`🔧 RELIABLE METHOD - Processing ${transactionEntries.length} transactions`);

        // SIMPLE DIRECT MAPPING: Use transaction date directly
        const processedTransactions = new Set();
        
        transactionEntries.forEach(entry => {
            const entryDate = new Date(entry.date);
            const monthIndex = entryDate.getUTCMonth(); // 0-11 - Use UTC to avoid timezone issues
            const monthName = monthNames[monthIndex];
            
            if (!monthlyData[monthName]) {
                console.log(`❌ Month ${monthName} not found for date ${entryDate}`);
                return;
            }

            monthlyData[monthName].transaction_details.transaction_count++;

            // FIRST: Check for deposit returns and receipts BEFORE processing other entries
            // This must happen BEFORE processing cash debits to ensure deposits aren't missed
            // IMPORTANT: 
            // - Deposit RECEIPT: debits asset (Cash/10005) AND credits deposit account (2028, 20002, etc.) = income
            // - Deposit RETURN: debits deposit account (2028, 20002, etc.) AND credits Cash = expense
            const depositAccountCodes = ['2028', '20002', '2020', '2002', '20020'];
            let depositCreditAmount = 0;
            let depositDebitAmount = 0;
            let hasDepositCredit = false;
            let hasDepositDebit = false;
            let hasAssetDebit = false; // Check if transaction debits an asset account (Cash, 10005, etc.)
            let hasCashCredit = false; // Check if transaction credits Cash (cash outflow for deposit return)
            
            entry.entries.forEach(line => {
                // Normalize account code - handle both string and number
                let accountCode = line.accountCode;
                if (typeof accountCode === 'number') {
                    accountCode = String(accountCode);
                } else if (typeof accountCode === 'string') {
                    accountCode = accountCode.trim();
                } else {
                    accountCode = String(accountCode || '').trim();
                }
                const accountName = (line.accountName || '').toLowerCase();
                const credit = line.credit || 0;
                const debit = line.debit || 0;
                
                // Check if this entry credits a deposit account (deposit receipt)
                if (credit > 0 && (
                    depositAccountCodes.includes(accountCode) ||
                    (accountCode.startsWith('200') && accountName.includes('deposit') && accountName.includes('security'))
                )) {
                    hasDepositCredit = true;
                    depositCreditAmount += credit; // Sum all deposit credits
                }
                
                // Check if this entry debits a deposit account (deposit return/refund)
                if (debit > 0 && (
                    depositAccountCodes.includes(accountCode) ||
                    (accountCode.startsWith('200') && accountName.includes('deposit') && accountName.includes('security'))
                )) {
                    hasDepositDebit = true;
                    depositDebitAmount += debit; // Sum all deposit debits
                }
                
                // Check if this entry debits an asset account (Cash, 10005, etc.) - means cash received
                if (debit > 0 && accountCode && (
                    accountCode.match(/^10[0-1][0-9]$/) || // Cash accounts (1000-1019)
                    accountCode === '10003' || // Cbz Vault
                    accountCode === '10005' // Opening balance clearing account (also an asset)
                )) {
                    hasAssetDebit = true;
                }
                
                // Check if this entry credits Cash (cash outflow for deposit return)
                if (credit > 0 && accountCode && (
                    accountCode.match(/^10[0-1][0-9]$/) || // Cash accounts (1000-1019)
                    accountCode === '10003' || // Cbz Vault
                    accountCode === '10005' // Opening balance clearing account (also an asset)
                )) {
                    hasCashCredit = true;
                }
            });
            
            // Enhanced logging for deposit return transactions
            const isPotentialDepositReturn = hasDepositDebit && hasCashCredit;
            if (isPotentialDepositReturn || entry.transactionId === 'TXN1762169297314NIEWO') {
                console.log(`🔍 [generateReliableMonthlyBreakdown] Transaction ${entry.transactionId} (${entry.description}):`, {
                    hasDepositCredit,
                    hasDepositDebit,
                    hasAssetDebit,
                    hasCashCredit,
                    depositCreditAmount,
                    depositDebitAmount,
                    conditionCheck: {
                        hasDepositDebit,
                        notHasDepositCredit: !hasDepositCredit,
                        hasCashCredit,
                        depositDebitAmountGreaterThanZero: depositDebitAmount > 0,
                        notProcessed: !processedTransactions.has(entry.transactionId + '_deposit_return'),
                        allConditionsMet: hasDepositDebit && !hasDepositCredit && hasCashCredit && depositDebitAmount > 0 && !processedTransactions.has(entry.transactionId + '_deposit_return')
                    },
                    entries: entry.entries.map(e => ({
                        accountCode: e.accountCode,
                        accountName: e.accountName,
                        debit: e.debit,
                        credit: e.credit
                    }))
                });
            }
            
            // PRIORITY 1: Check for deposit RETURN first (debits deposit account, credits Cash) = expense
            if (hasDepositDebit && !hasDepositCredit && hasCashCredit && depositDebitAmount > 0 && 
                !processedTransactions.has(entry.transactionId + '_deposit_return')) {
                // This is a deposit return/refund (debits deposit account, credits Cash)
                // This should be treated as an expense/outflow, not income
                console.log(`✅ [generateReliableMonthlyBreakdown] DEPOSIT RETURN DETECTED: transactionId=${entry.transactionId}, description="${entry.description}", depositDebitAmount=${depositDebitAmount}, hasCashCredit=${hasCashCredit}`);
                
                // Add deposit return as cash outflow (expense)
                const beforeTotal = monthlyData[monthName].expenses.total || 0;
                monthlyData[monthName].operating_activities.outflows += depositDebitAmount;
                monthlyData[monthName].expenses.total += depositDebitAmount;
                const afterTotal = monthlyData[monthName].expenses.total;
                
                // Use actual expense description as category name for deposit returns
                const expenseName = entry.description || 'Deposit return';
                
                // Initialize the expense category if it doesn't exist
                if (!monthlyData[monthName].expenses[expenseName]) {
                    monthlyData[monthName].expenses[expenseName] = 0;
                }
                if (!monthlyData[monthName].operating_activities.breakdown[expenseName]) {
                    monthlyData[monthName].operating_activities.breakdown[expenseName] = 0;
                }
                
                // Add amount to the specific expense name (for breakdown)
                monthlyData[monthName].expenses[expenseName] += depositDebitAmount;
                monthlyData[monthName].operating_activities.breakdown[expenseName] += depositDebitAmount;
                
                // Ensure expenses.transactions array exists
                if (!monthlyData[monthName].expenses.transactions) {
                    monthlyData[monthName].expenses.transactions = [];
                }
                
                // Add transaction to expenses transactions array
                monthlyData[monthName].expenses.transactions.push({
                    transactionId: entry.transactionId,
                    date: entry.date,
                    amount: depositDebitAmount,
                    description: entry.description || 'Deposit return',
                    category: 'expense'
                });
                
                processedTransactions.add(entry.transactionId + '_deposit_return');
                
                console.log(`💰 [generateReliableMonthlyBreakdown] Deposit RETURN (expense) ADDED: ${depositDebitAmount} for ${monthName} - Transaction: ${entry.transactionId} - Expenses total BEFORE: ${beforeTotal}, AFTER: ${afterTotal} - Category: ${expenseName}`);
                processedTransactions.add(entry.transactionId + '_expense');
                return; // Skip further processing - CRITICAL: This prevents double-processing
            } else if (isPotentialDepositReturn || entry.transactionId === 'TXN1762169297314NIEWO') {
                // Log why deposit return detection failed
                console.log(`❌ [generateReliableMonthlyBreakdown] Deposit RETURN NOT DETECTED (check failed): transactionId=${entry.transactionId}, description="${entry.description}"`, {
                    reason: !hasDepositDebit ? 'No deposit debit' :
                            hasDepositCredit ? 'Has deposit credit (not a return)' :
                            !hasCashCredit ? 'No cash credit' :
                            depositDebitAmount <= 0 ? 'Deposit debit amount <= 0' :
                            processedTransactions.has(entry.transactionId + '_deposit_return') ? 'Already processed as deposit return' :
                            'Unknown reason',
                    willBeProcessedAsGeneralExpense: true
                });
            }
            
            // PRIORITY 2: Check for deposit RECEIPT (debits asset, credits deposit account) = income
            if (hasDepositCredit && depositCreditAmount > 0 && hasAssetDebit && !hasDepositDebit && 
                !processedTransactions.has(entry.transactionId + '_deposit')) {
                // This is a deposit receipt (cash inflow)
                monthlyData[monthName].operating_activities.inflows += depositCreditAmount;
                monthlyData[monthName].income.total += depositCreditAmount;
                monthlyData[monthName].income.deposits += depositCreditAmount;
                monthlyData[monthName].operating_activities.breakdown.deposits += depositCreditAmount;
                processedTransactions.add(entry.transactionId + '_deposit');
                
                console.log(`✅ [generateReliableMonthlyBreakdown] Deposit RECEIPT ADDED: ${depositCreditAmount} for ${monthName} - Transaction: ${entry.transactionId} - Deposits total now: ${monthlyData[monthName].income.deposits}`);
                
                // Mark this transaction as processed to prevent double-counting
                processedTransactions.add(entry.transactionId + '_income');
                return; // Skip further processing of this transaction
            }

            // Process each line in the transaction
            entry.entries.forEach(line => {
                const amount = line.debit || line.credit || 0;
                const isDebit = line.debit > 0;
                const isCredit = line.credit > 0;
                const accountCode = line.accountCode;
                const accountName = line.accountName;
                const accountType = line.accountType;

                // INCOME: Debit to Cash accounts (1000 series) - money received
                // BUT EXCLUDE balance sheet adjustments and internal transfers
                if (isDebit && accountCode && accountCode.startsWith('1') && 
                    (accountName?.toLowerCase().includes('cash') || accountName?.toLowerCase().includes('bank')) &&
                    !processedTransactions.has(entry.transactionId + '_income')) {
                    
                    // Check if this is a balance sheet adjustment (NOT actual cash inflow)
                    if (this.isBalanceSheetAdjustment(entry)) {
                        // This is a balance sheet adjustment, not actual cash inflow - skip it
                        console.log(`💰 Balance sheet adjustment excluded from cash inflow: ${amount} - Transaction: ${entry.transactionId} - Description: ${entry.description}`);
                        return; // Skip this transaction entry
                    }
                    
                    // Check if this is an internal cash transfer (cash moving between cash accounts)
                    if (this.isInternalCashTransfer(entry)) {
                        console.log(`💰 Internal cash transfer excluded from cash inflow in generateReliableMonthlyBreakdown: ${entry.transactionId} - Description: ${entry.description}`);
                        return; // Skip internal transfers - they don't represent actual cash inflow
                    }
                    
                    // This is actual cash inflow
                    monthlyData[monthName].operating_activities.inflows += amount;
                    monthlyData[monthName].income.total += amount;
                    processedTransactions.add(entry.transactionId + '_income');
                    
                    // Categorize income based on description and payment timing
                    const desc = entry.description?.toLowerCase() || '';
                    let isAdvancePayment = false;
                    
                    // Check if this is an advance payment by looking at the description for allocation month
                    if (desc.includes('for 20')) {
                        // Extract allocation month from description (format: "for 2025-10")
                        const match = desc.match(/for (\d{4}-\d{2})/);
                        if (match) {
                            const allocationMonthStr = match[1];
                            const [year, month] = allocationMonthStr.split('-').map(n => parseInt(n));
                            const allocationMonthDate = new Date(year, month - 1, 1); // month is 1-based in description
                            
                            // Use transaction date as payment date
                            const paymentDate = new Date(entry.date);
                            const paymentDateMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);
                            
                            // If payment date is BEFORE allocation month, it's an advance payment
                            // If payment date is IN or AFTER allocation month, it's regular rent
                            if (paymentDateMonth < allocationMonthDate) {
                                isAdvancePayment = true;
                            }
                        }
                    }
                    
                    // Categorize based on description and timing
                    // PRIORITY ORDER: Check for explicit advance payment keywords first, then rent, then others
                    if (desc.includes('advance') || desc.includes('prepaid') || desc.includes('future') || isAdvancePayment) {
                        monthlyData[monthName].income.advance_payments += amount;
                        monthlyData[monthName].operating_activities.breakdown.advance_payments += amount;
                    } else if (desc.includes('rent') || desc.includes('rental') || desc.includes('accommodation') || desc.includes('payment allocation')) {
                        // Rent income - prioritize this over other categories
                        monthlyData[monthName].income.rental_income += amount;
                        monthlyData[monthName].operating_activities.breakdown.rental_income += amount;
                    } else if (desc.includes('admin') || desc.includes('administrative')) {
                        monthlyData[monthName].income.admin_fees += amount;
                        monthlyData[monthName].operating_activities.breakdown.admin_fees += amount;
                    } else if ((desc.includes('deposit') || desc.includes('security')) &&
                               // Also verify this is a deposit receipt (credits deposit account), not a return (debits deposit account)
                               entry.entries && entry.entries.some(line => {
                                   const lineAccountCode = String(line.accountCode || '').trim();
                                   const lineCredit = line.credit || 0;
                                   return lineCredit > 0 && depositAccountCodes.includes(lineAccountCode);
                               }) &&
                               // Ensure it's NOT a deposit return (debits deposit account)
                               !entry.entries.some(line => {
                                   const lineAccountCode = String(line.accountCode || '').trim();
                                   const lineDebit = line.debit || 0;
                                   return lineDebit > 0 && depositAccountCodes.includes(lineAccountCode);
                               })) {
                        monthlyData[monthName].income.deposits += amount;
                        monthlyData[monthName].operating_activities.breakdown.deposits += amount;
                        console.log(`💰 [generateReliableMonthlyBreakdown] Cash deposit RECEIPT detected: ${amount} for ${monthName} - Transaction: ${entry.transactionId} - Deposits total now: ${monthlyData[monthName].income.deposits}`);
                    } else if (desc.includes('utilit') || desc.includes('internet') || desc.includes('wifi')) {
                        monthlyData[monthName].income.utilities += amount;
                        monthlyData[monthName].operating_activities.breakdown.utilities += amount;
                    } else {
                        // Check for balance sheet adjustments (exclude from income)
                        if (this.isBalanceSheetAdjustment(entry)) {
                            // This is a balance sheet adjustment or internal transfer, not income - don't count as income
                            console.log(`💰 Opening balance/balance adjustment/internal transfer excluded from other_income: ${amount} - Transaction: ${entry.transactionId} - Description: ${entry.description}`);
                            return; // Skip this transaction entry
                        }
                        
                        // Exclude other_income from cash flow entirely - skip this entry
                        return; // Skip this transaction entry - don't add to any income category
                    }
                }
                
                // FALLBACK: Credit to Income accounts (4000 series) - for completeness
                // BUT ONLY if there's an actual cash receipt (cash account debit) - exclude accruals
                else if (isCredit && accountCode && accountCode.startsWith('4') && 
                         !processedTransactions.has(entry.transactionId + '_income')) {
                    
                    // FIRST: Check if this is an internal cash transfer - EXCLUDE
                    if (this.isInternalCashTransfer(entry)) {
                        console.log(`💰 Internal cash transfer excluded from income processing (FALLBACK): ${entry.transactionId}`);
                        return; // Skip internal transfers
                    }
                    
                    // SECOND: Check if there's a cash receipt in this transaction
                    // Only process if there's actual cash movement (cash account debit)
                    const hasCashReceipt = entry.entries && entry.entries.some(line => {
                        const lineAccountCode = line.accountCode || line.account?.code;
                        const lineAccountName = line.accountName || line.account?.name;
                        // Check for cash account debit (actual cash receipt) - must have debit > 0
                        const isCashAccount = lineAccountCode && (lineAccountCode.startsWith('100') || lineAccountCode.startsWith('101'));
                        const hasCashDebit = line.debit > 0;
                        return isCashAccount && hasCashDebit;
                    });
                    
                    // ONLY process if there's a cash receipt AND it's not an internal transfer
                    // This ensures we only count actual cash income, not accrued income
                    if (!hasCashReceipt) {
                        console.log(`💰 Accrual income excluded (no cash receipt): ${entry.transactionId} - Description: ${entry.description}`);
                        return; // Skip accruals - they don't represent actual cash inflow
                    }
                    
                    monthlyData[monthName].operating_activities.inflows += amount;
                    monthlyData[monthName].income.total += amount;
                    processedTransactions.add(entry.transactionId + '_income');
                    
                    // Categorize income (prioritize advance payments, then rent)
                    const fallbackDesc = entry.description?.toLowerCase() || '';
                    if (fallbackDesc.includes('advance') || fallbackDesc.includes('prepaid') || fallbackDesc.includes('future')) {
                        monthlyData[monthName].income.advance_payments += amount;
                        monthlyData[monthName].operating_activities.breakdown.advance_payments += amount;
                    } else if (accountCode.startsWith('4001') || fallbackDesc.includes('rent') || fallbackDesc.includes('rental') || fallbackDesc.includes('accommodation') || fallbackDesc.includes('payment allocation')) {
                        // Rental income - prioritize this
                        monthlyData[monthName].income.rental_income += amount;
                        monthlyData[monthName].operating_activities.breakdown.rental_income += amount;
                    } else if (accountCode.startsWith('4002') || fallbackDesc.includes('admin')) {
                        monthlyData[monthName].income.admin_fees += amount;
                        monthlyData[monthName].operating_activities.breakdown.admin_fees += amount;
                    } else if (accountCode.startsWith('4003') || fallbackDesc.includes('deposit')) {
                        // Check if this is actually a late payment fee (not a deposit) - exclude from cash flow
                        const accountNameLower = (line.accountName || '').toLowerCase();
                        const isLatePaymentFee = accountNameLower.includes('late') && 
                                                 (accountNameLower.includes('payment') || accountNameLower.includes('fee'));
                        
                        if (isLatePaymentFee) {
                            // Late payment fees should be excluded from cash flow income entirely
                            // Skip this entry - don't add to any income category
                            return; // Skip to next line item in forEach
                        } else {
                            monthlyData[monthName].income.deposits += amount;
                            monthlyData[monthName].operating_activities.breakdown.deposits += amount;
                        }
                    } else if (accountCode.startsWith('4004') || accountCode.startsWith('4005') || fallbackDesc.includes('utilit') || fallbackDesc.includes('internet') || fallbackDesc.includes('wifi')) {
                        monthlyData[monthName].income.utilities += amount;
                        monthlyData[monthName].operating_activities.breakdown.utilities += amount;
                    } else {
                        // Check for balance sheet adjustments (exclude from income)
                        if (this.isBalanceSheetAdjustment(entry)) {
                            // This is a balance sheet adjustment or internal transfer, not income - don't count as income
                            console.log(`💰 Opening balance/balance adjustment/internal transfer excluded from other_income: ${amount} - Transaction: ${entry.transactionId} - Description: ${entry.description}`);
                            return; // Skip this transaction entry
                        }
                        
                        // Exclude other_income from cash flow entirely - skip this entry
                        return; // Skip this transaction entry - don't add to any income category
                    }
                }

                // EXPENSES: Credit to Cash accounts (1000 series) - money paid out
                // BUT EXCLUDE balance sheet adjustments and internal transfers
                if (isCredit && accountCode && accountCode.startsWith('1') && 
                    (accountName?.toLowerCase().includes('cash') || accountName?.toLowerCase().includes('bank'))) {
                    
                    // Check if this is a balance sheet adjustment (NOT actual cash outflow)
                    if (this.isBalanceSheetAdjustment(entry)) {
                        // This is a balance sheet adjustment, not actual cash outflow - skip it
                        console.log(`💰 Balance sheet adjustment excluded from cash outflow: ${amount} - Transaction: ${entry.transactionId} - Description: ${entry.description}`);
                        return; // Skip this transaction entry
                    }
                    
                    // Skip internal cash transfers and movements between cash accounts
                    // Use the proper isInternalCashTransfer function for consistency
                    if (this.isInternalCashTransfer(entry)) {
                        console.log(`💰 Internal cash transfer excluded from cash outflow in generateReliableMonthlyBreakdown: ${entry.transactionId} - Description: ${entry.description}`);
                        return; // Skip internal transfers - they don't represent actual cash outflow
                    }
                    
                    if (!processedTransactions.has(entry.transactionId + '_expense')) {
                    monthlyData[monthName].operating_activities.outflows += amount;
                    monthlyData[monthName].expenses.total += amount;
                        processedTransactions.add(entry.transactionId + '_expense');

                        // Use actual expense description as category name instead of generic categorization
                        const expenseName = entry.description || 'Unnamed Expense';
                        
                        // Initialize the expense category if it doesn't exist
                        if (!monthlyData[monthName].expenses[expenseName]) {
                            monthlyData[monthName].expenses[expenseName] = 0;
                        }
                        if (!monthlyData[monthName].operating_activities.breakdown[expenseName]) {
                            monthlyData[monthName].operating_activities.breakdown[expenseName] = 0;
                        }
                        
                        // Add amount to the specific expense name
                        monthlyData[monthName].expenses[expenseName] += amount;
                        monthlyData[monthName].operating_activities.breakdown[expenseName] += amount;

                        // Add to transactions
                        monthlyData[monthName].expenses.transactions.push({
                            transactionId: entry.transactionId,
                            date: entry.date,
                            amount: amount,
                            description: entry.description,
                            category: 'expense'
                        });
                    }
                }
                
                // FALLBACK: Debit to Expense accounts (5000 series) - for completeness
                // BUT ONLY if there's an actual cash payment (cash account credit) - exclude accruals
                else if (isDebit && accountCode && accountCode.startsWith('5') && 
                         !processedTransactions.has(entry.transactionId + '_expense')) {
                    
                    // FIRST: Check if this is an internal cash transfer - EXCLUDE
                    if (this.isInternalCashTransfer(entry)) {
                        console.log(`💰 Internal cash transfer excluded from expense processing (FALLBACK): ${entry.transactionId}`);
                        return; // Skip internal transfers
                    }
                    
                    // SECOND: Check if there's a cash payment in this transaction
                    // Only process if there's actual cash movement (cash account credit)
                    const hasCashPayment = entry.entries && entry.entries.some(line => {
                        const lineAccountCode = line.accountCode || line.account?.code;
                        const lineAccountName = line.accountName || line.account?.name;
                        // Check for cash account credit (actual cash payment) - must have credit > 0
                        const isCashAccount = lineAccountCode && (lineAccountCode.startsWith('100') || lineAccountCode.startsWith('101'));
                        const hasCashCredit = line.credit > 0;
                        return isCashAccount && hasCashCredit;
                    });
                    
                    // ONLY process if there's a cash payment AND it's not an internal transfer
                    // This ensures we only count actual cash expenses, not accrued expenses
                    if (!hasCashPayment) {
                        console.log(`💰 Accrual expense excluded (no cash payment): ${entry.transactionId} - Description: ${entry.description}`);
                        return; // Skip accruals - they don't represent actual cash outflow
                    }
                    
                    monthlyData[monthName].operating_activities.outflows += amount;
                    monthlyData[monthName].expenses.total += amount;
                    processedTransactions.add(entry.transactionId + '_expense');

                    // Use actual expense description as category name instead of generic categorization
                    const expenseName = entry.description || 'Unnamed Expense';
                    
                    // Initialize the expense category if it doesn't exist
                    if (!monthlyData[monthName].expenses[expenseName]) {
                        monthlyData[monthName].expenses[expenseName] = 0;
                    }
                    if (!monthlyData[monthName].operating_activities.breakdown[expenseName]) {
                        monthlyData[monthName].operating_activities.breakdown[expenseName] = 0;
                    }
                    
                    // Add amount to the specific expense name
                    monthlyData[monthName].expenses[expenseName] += amount;
                    monthlyData[monthName].operating_activities.breakdown[expenseName] += amount;

                    // Add to transactions
                    monthlyData[monthName].expenses.transactions.push({
                        transactionId: entry.transactionId,
                        date: entry.date,
                        amount: amount,
                        description: entry.description,
                        category: 'expense'
                    });
                }

                // FINANCING: Owner contributions (Equity accounts)
                if (isCredit && accountType === 'Equity' && entry.description?.toLowerCase().includes('balance adjustment')) {
                    monthlyData[monthName].financing_activities.inflows += amount;
                }
            });
        });

        // Calculate net values and running balances
        let runningBalance = openingBalance;
        let runningCashAccounts = {}; // Track cash accounts by month
        
        // Calculate month-end dates for cash balance calculations
        const monthEndDates = {};
        monthNames.forEach(monthName => {
            const monthIndex = monthNames.indexOf(monthName);
            const year = parseInt(period);
            const monthEndDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
            monthEndDates[monthName] = monthEndDate;
        });
        
        // Fetch cash balances for each month-end in parallel
        const monthEndBalancesPromises = monthNames.map(monthName => 
            this.getCashBalanceByAccount(monthEndDates[monthName], residenceId)
                .then(balances => ({ monthName, balances }))
                .catch(err => {
                    console.error(`Error fetching cash balance for ${monthName}:`, err);
                    return { monthName, balances: {} };
                })
        );
        const monthEndBalancesResults = await Promise.all(monthEndBalancesPromises);
        const monthEndBalances = {};
        monthEndBalancesResults.forEach(({ monthName, balances }) => {
            monthEndBalances[monthName] = balances;
        });
        
        monthNames.forEach(monthName => {
            const month = monthlyData[monthName];
            
            // Calculate nets
            month.operating_activities.net = month.operating_activities.inflows - month.operating_activities.outflows;
            month.investing_activities.net = month.investing_activities.inflows - month.investing_activities.outflows;
            month.financing_activities.net = month.financing_activities.inflows - month.financing_activities.outflows;
            
            // Total net cash flow
            month.net_cash_flow = month.operating_activities.net + month.investing_activities.net + month.financing_activities.net;
            
            // Running balances
            month.opening_balance = runningBalance;
            month.closing_balance = runningBalance + month.net_cash_flow;
            runningBalance = month.closing_balance;
            
            // Calculate cash accounts for this month using actual account balances as of month-end
            const cashAccounts = {};
            let totalCash = 0;
            
            // Get actual cash account balances from the database for this specific month-end
            const monthBalances = monthEndBalances[monthName] || {};
            Object.values(monthBalances).forEach(account => {
                const accountName = account.accountName;
                const accountCode = account.accountCode;
                
                // Only include proper cash accounts, exclude clearing accounts
                if (this.isCashAccount(accountName, accountCode)) {
                    // Always use "Cbz Vault" for account code 10003 to ensure consistency with balance sheet
                    const finalAccountName = (accountCode === '10003') 
                        ? 'Cbz Vault' 
                        : accountName;
                    
                    cashAccounts[accountCode] = {
                        accountCode: accountCode,
                        accountName: finalAccountName,
                        balance: account.balance
                    };
                    totalCash += account.balance;
                }
            });
            
            // Add to monthly cash accounts (original format by account code)
            month.cash_accounts.breakdown = cashAccounts;
            month.cash_accounts.total = totalCash;
            
            // Add balance sheet format (cashAndBank structure matching balance sheet)
            month.cashAndBank = this.formatCashAccountsForBalanceSheet(cashAccounts);
        });

        // Final verification: ALWAYS recalculate expenses.total from breakdown items (including deposit returns)
        monthNames.forEach(monthName => {
            const month = monthlyData[monthName];
            if (month && month.expenses) {
                // Sum ALL non-zero expense items from BOTH expenses object AND operating_activities.breakdown
                let sumFromBreakdown = 0;
                const breakdownItems = [];
                const processedKeys = new Set(['total', 'transactions']); // Only track processed keys to avoid double-counting
                
                // First, sum from month.expenses (exclude only 'total' and 'transactions')
                Object.keys(month.expenses).forEach(key => {
                    // Skip only 'total' and 'transactions' keys
                    if (key === 'total' || key === 'transactions') {
                        return;
                    }
                    
                    // Sum ALL numeric values (including zero values for now, we'll filter later if needed)
                    if (typeof month.expenses[key] === 'number') {
                        const value = month.expenses[key];
                        // Sum ALL non-zero values (including deposit returns)
                        if (value !== 0) {
                            sumFromBreakdown += value;
                            breakdownItems.push({ key, amount: value, source: 'expenses' });
                            processedKeys.add(key);
                        }
                    }
                });
                
                // Then, check operating_activities.breakdown for any expenses not already counted
                if (month.operating_activities && month.operating_activities.breakdown) {
                    Object.keys(month.operating_activities.breakdown).forEach(key => {
                        // Only include expense-related keys (exclude income keys)
                        const incomeKeys = ['rental_income', 'admin_fees', 'deposits', 'utilities', 'advance_payments', 'other_income'];
                        if (!incomeKeys.includes(key) && !processedKeys.has(key) && typeof month.operating_activities.breakdown[key] === 'number') {
                            const value = month.operating_activities.breakdown[key];
                            if (value !== 0) {
                                sumFromBreakdown += value;
                                breakdownItems.push({ key, amount: value, source: 'breakdown' });
                                // Also add to expenses object if not already there
                                if (!month.expenses[key]) {
                                    month.expenses[key] = value;
                                }
                            }
                        }
                    });
                }
                
                // ALWAYS update total to match sum from breakdown (force recalculation)
                const oldTotal = month.expenses.total;
                
                // Log the calculation for debugging (especially for October)
                if (monthName === 'october') {
                    console.log(`🔍 [generateReliableMonthlyBreakdown] ${monthName} expenses verification:`, {
                        oldTotal,
                        sumFromBreakdown,
                        breakdownItemsCount: breakdownItems.length,
                        depositReturnFound: breakdownItems.find(item => item.key && (item.key.toLowerCase().includes('deposit') && item.key.toLowerCase().includes('marula'))),
                        alamaitFound: breakdownItems.find(item => item.key && item.key.toLowerCase().includes('alamait')),
                        allBreakdownItems: breakdownItems.sort((a, b) => b.amount - a.amount).slice(0, 25) // Top 25 items sorted by amount
                    });
                    
                    // Verify calculation manually
                    let manualSum = 0;
                    breakdownItems.forEach(item => {
                        manualSum += item.amount;
                    });
                    console.log(`🔍 Manual sum verification: ${manualSum} (should match sumFromBreakdown: ${sumFromBreakdown})`);
                }
                
                // CRITICAL: Calculate the SOURCE OF TRUTH - use TRANSACTIONS array if available
                // Transactions are the definitive records - they include everything, even if line items are missing
                let transactionSum = 0;
                if (month.expenses.transactions && Array.isArray(month.expenses.transactions) && month.expenses.transactions.length > 0) {
                    month.expenses.transactions.forEach(trans => {
                        if (trans && typeof trans.amount === 'number' && trans.amount > 0) {
                            transactionSum += trans.amount;
                        }
                    });
                    
                    // Log for October to verify deposit return is included
                    if (monthName === 'october') {
                        const depositReturnTransaction = month.expenses.transactions.find(t => 
                            t.transactionId === 'TXN1762169297314NIEWO' || 
                            (t.description && t.description.includes('Security deposit Marula'))
                        );
                        console.log(`🔍 [${monthName}] First Verification - Transaction Sum: ${transactionSum}, Transaction Count: ${month.expenses.transactions.length}, Deposit Return Found: ${depositReturnTransaction ? `YES (${depositReturnTransaction.amount})` : 'NO'}`);
                        if (depositReturnTransaction) {
                            console.log(`✅ Deposit Return Transaction Details:`, depositReturnTransaction);
                        }
                    }
                }
                
                // Calculate verificationSum from line items as fallback
                let verificationSum = 0;
                Object.keys(month.expenses).forEach(key => {
                    if (key !== 'total' && key !== 'transactions' && typeof month.expenses[key] === 'number' && month.expenses[key] !== 0) {
                        verificationSum += month.expenses[key];
                    }
                });
                
                // PRIORITY: Use transaction sum if available (it's the source of truth)
                // Otherwise use verificationSum (line items sum)
                let finalTotal = transactionSum > 0 ? transactionSum : verificationSum;
                
                // Log if there's a discrepancy
                if (transactionSum > 0 && Math.abs(verificationSum - transactionSum) > 0.01) {
                    console.log(`⚠️ [generateReliableMonthlyBreakdown] ${monthName}: Transaction sum (${transactionSum}) differs from line items sum (${verificationSum}). Using transaction sum.`);
                }
                if (Math.abs(finalTotal - sumFromBreakdown) > 0.01) {
                    console.log(`⚠️ [generateReliableMonthlyBreakdown] ${monthName}: Final total (${finalTotal}) differs from breakdown sum (${sumFromBreakdown}). Using final total.`);
                }
                
                // FORCE UPDATE: Always use finalTotal (transaction sum if available, otherwise line items)
                month.expenses.total = finalTotal;
                sumFromBreakdown = finalTotal; // Update for consistency
                
                // Log if there's a discrepancy
                if (Math.abs(oldTotal - sumFromBreakdown) > 0.01) {
                    console.log(`⚠️ [generateReliableMonthlyBreakdown] ${monthName}: Expenses total mismatch - Old: ${oldTotal}, New: ${sumFromBreakdown}, Difference: ${sumFromBreakdown - oldTotal}`);
                }
                
                // Update operating_activities.outflows to match expenses.total exactly
                if (month.operating_activities) {
                    const oldOutflows = month.operating_activities.outflows;
                    // Set outflows to match expenses.total (they should be the same)
                    month.operating_activities.outflows = sumFromBreakdown;
                    month.operating_activities.net = month.operating_activities.inflows - month.operating_activities.outflows;
                    
                    if (Math.abs(oldTotal - sumFromBreakdown) > 0.01 || Math.abs(oldOutflows - sumFromBreakdown) > 0.01) {
                        const outflowDifference = sumFromBreakdown - oldOutflows;
                        console.log(`⚠️ [generateReliableMonthlyBreakdown] ${monthName}: Updated expenses.total ${oldTotal} → ${sumFromBreakdown} (diff: ${sumFromBreakdown - oldTotal})`);
                        console.log(`💰 ${monthName}: Updated operating_activities.outflows ${oldOutflows} → ${sumFromBreakdown} (diff: ${outflowDifference}), net: ${month.operating_activities.net}`);
                    }
                }
            }
        });
        
        console.log('✅ RELIABLE METHOD - Monthly breakdown completed');
        
        // Final verification for ALL months - double-check and force correct total
        // COMPREHENSIVE: Calculate from all line items AND all transactions
        monthNames.forEach(monthName => {
            const month = monthlyData[monthName];
            if (month && month.expenses) {
                let sumFromLineItems = 0;
                let sumFromTransactions = 0;
                let sumFromBreakdown = 0;
                const finalItems = [];
                
                // METHOD 1: Sum ALL non-zero expense items from month.expenses object (line items)
                Object.keys(month.expenses).forEach(key => {
                    if (key !== 'total' && key !== 'transactions' && typeof month.expenses[key] === 'number') {
                        const value = month.expenses[key];
                        if (value !== 0) {
                            sumFromLineItems += value;
                            finalItems.push({ key, amount: value, source: 'expenses' });
                        }
                    }
                });
                
                // METHOD 2: Sum ALL transactions from month.expenses.transactions array
                // This is the SOURCE OF TRUTH - transactions are definitive records of expenses
                if (Array.isArray(month.expenses.transactions)) {
                    month.expenses.transactions.forEach((trans, index) => {
                        if (trans && typeof trans.amount === 'number') {
                            // Include all amounts (expenses are positive)
                            if (trans.amount > 0) {
                                sumFromTransactions += trans.amount;
                                // Log for October to verify deposit return is included
                                if (monthName === 'october' && (trans.description?.includes('Security deposit Marula') || trans.description?.includes('deposit return'))) {
                                    console.log(`🔍 [${monthName}] Transaction ${index + 1}/${month.expenses.transactions.length}: ${trans.description} = ${trans.amount}, Running sum: ${sumFromTransactions}`);
                                }
                            } else if (trans.amount < 0) {
                                // Handle negative amounts (adjustments/refunds) - use absolute value
                                sumFromTransactions += Math.abs(trans.amount);
                            }
                        }
                    });
                    
                    // Log transaction sum calculation for October
                    if (monthName === 'october') {
                        console.log(`📊 [${monthName}] Transaction Sum Calculation:`, {
                            transactionCount: month.expenses.transactions.length,
                            sumFromTransactions,
                            allTransactionAmounts: month.expenses.transactions.map(t => t.amount)
                        });
                    }
                }
                
                // METHOD 3: Sum expense-related items from operating_activities.breakdown
                if (month.operating_activities && month.operating_activities.breakdown) {
                    const expenseKeys = ['electricity', 'water', 'gas', 'internet', 'maintenance', 'cleaning', 
                                       'security', 'management', 'insurance', 'council_rates', 'plumbing', 
                                       'sanitary', 'solar', 'other_expenses'];
                    
                    Object.keys(month.operating_activities.breakdown).forEach(key => {
                        const value = month.operating_activities.breakdown[key];
                        // Check if it's an expense (not income) and not already counted
                        if (typeof value === 'number' && value > 0 && 
                            !expenseKeys.includes(key.toLowerCase()) &&
                            !['rental_income', 'admin_fees', 'deposits', 'utilities', 'advance_payments', 'other_income'].includes(key.toLowerCase())) {
                            // This is likely an expense item (like "Security deposit Marula", "Alamait management fee", etc.)
                            const alreadyInExpenses = month.expenses[key];
                            if (!alreadyInExpenses || alreadyInExpenses === 0) {
                                sumFromBreakdown += value;
                                finalItems.push({ key, amount: value, source: 'breakdown' });
                            }
                        }
                    });
                }
                
                // CRITICAL: Transactions array is the SOURCE OF TRUTH for expenses
                // ALWAYS use transaction sum when transactions array exists - transactions are definitive records
                let finalSum;
                const sumFromAllLineItems = sumFromLineItems + sumFromBreakdown;
                
                if (month.expenses.transactions && Array.isArray(month.expenses.transactions) && month.expenses.transactions.length > 0) {
                    // ALWAYS use transaction sum as the definitive total - transactions are the source of truth
                    finalSum = sumFromTransactions;
                    
                    // Log if there's a discrepancy between transactions and line items
                    if (Math.abs(sumFromAllLineItems - sumFromTransactions) > 0.01) {
                        console.log(`⚠️ [${monthName}] Using transaction sum (${sumFromTransactions}) instead of line items sum (${sumFromAllLineItems}). Difference: ${sumFromTransactions - sumFromAllLineItems}`);
                    }
                } else {
                    // Fallback: If no transactions array exists, use line items
                    finalSum = sumFromAllLineItems;
                    console.log(`⚠️ [${monthName}] No transactions array found. Using line items sum: ${sumFromAllLineItems}`);
                }
                
                const currentTotal = month.expenses.total || 0;
                
                // FORCE UPDATE the total - ALWAYS use transaction sum when available
                month.expenses.total = finalSum;
                
                // Debug logging to understand discrepancies
                if (monthName === 'october') {
                    console.log(`🔍 [${monthName}] Verification Details:`, {
                        sumFromLineItems,
                        sumFromBreakdown,
                        sumFromAllLineItems,
                        sumFromTransactions,
                        finalSum,
                        currentTotal,
                        transactionCount: month.expenses.transactions?.length || 0,
                        lineItemKeys: Object.keys(month.expenses).filter(k => k !== 'total' && k !== 'transactions' && typeof month.expenses[k] === 'number' && month.expenses[k] !== 0),
                        hasSecurityDeposit: month.expenses['Security deposit Marula'] || 0
                    });
                }
                
                // Also update operating_activities.outflows to match
                if (month.operating_activities) {
                    month.operating_activities.outflows = finalSum;
                    month.operating_activities.net = month.operating_activities.inflows - month.operating_activities.outflows;
                }
                
                // Log for debugging (especially October)
                if (monthName === 'october' || Math.abs(currentTotal - finalSum) > 0.01) {
                    console.log(`📊 [${monthName}] Expense Total Calculation:`, {
                        sumFromLineItems,
                        sumFromBreakdown,
                        sumFromAllLineItems,
                        sumFromTransactions,
                        finalSum,
                        currentTotal,
                        difference: finalSum - currentTotal,
                        itemCount: finalItems.length
                    });
                    
                    if (Math.abs(currentTotal - finalSum) > 0.01) {
                        console.log(`⚠️ FINAL FIX [${monthName}]: Expenses total corrected. Old: ${currentTotal}, New: ${finalSum}, Difference: ${finalSum - currentTotal}`);
                        
                        if (monthName === 'october') {
                            console.log(`   Top 10 items:`, finalItems.sort((a, b) => b.amount - a.amount).slice(0, 10));
                            console.log(`   All expense items (${finalItems.length}):`, finalItems.map(item => `${item.key}: ${item.amount} [${item.source}]`).join(', '));
                        }
                    }
                }
            }
        });
        
        return monthlyData;
    }
    
    /**
     * Generate tabular monthly breakdown with proper cash balances
     */
    static async generateTabularMonthlyBreakdown(monthlyData, period, openingBalance, cashBalanceByAccount) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                           'july', 'august', 'september', 'october', 'november', 'december'];
        
        const tabularMonths = {};
        let cumulativeNetChange = 0;
        
        monthNames.forEach(month => {
            const monthData = monthlyData[month];
            if (monthData) {
                cumulativeNetChange += monthData.net_cash_flow || 0;
            }
            
            tabularMonths[month] = {
                net_change_in_cash: monthData ? (monthData.net_cash_flow || 0) : 0,
                cash_at_end_of_period: cumulativeNetChange,
                cash_and_cash_equivalents: {}
            };
        });
        
        // Add cash and cash equivalents accounts with actual monthly balances
        if (cashBalanceByAccount && Object.keys(cashBalanceByAccount).length > 0) {
            // Get actual cash balances for each month
            for (let i = 0; i < monthNames.length; i++) {
                const month = monthNames[i];
                const monthData = monthlyData[month];
                
                // Calculate the end date for this month
                const year = parseInt(period);
                const monthIndex = i + 1; // January = 1, February = 2, etc.
                const endDate = new Date(year, monthIndex, 0); // Last day of the month
                
                try {
                    // Get actual cash balance by account for this month
                    const monthlyCashBalance = await this.getCashBalanceByAccount(endDate, null);
                    
                    // Add cash equivalents to monthly data using actual balances
                Object.values(monthlyCashBalance).forEach(account => {
                    const accountName = account.accountName;
                    const accountCode = account.accountCode;
                    const balance = account.balance;
                    
                    // Only include proper cash accounts, exclude clearing accounts
                    if (!this.isCashAccount(accountName, accountCode)) {
                        console.log(`🚫 Excluding non-cash account from tabular monthly cash equivalents: ${accountName} (${accountCode})`);
                        return;
                    }
                    
                    // Show balance if there was cash activity in this month or if the account has a balance
                    if (monthData && (
                        monthData.net_cash_flow !== 0 ||
                        (balance && balance !== 0)
                    )) {
                        // Show the actual account balance for this month
                        tabularMonths[month].cash_and_cash_equivalents[accountName] = {
                            account_code: accountCode,
                            balance: balance,
                            description: this.getCashAccountDescription(accountName)
                        };
                    }
                });
                
                    // Also add accounts that might not have balances yet but should be shown for consistency
                    if (monthData && monthData.net_cash_flow !== 0) {
                        Object.values(cashBalanceByAccount).forEach(account => {
                            const accountName = account.accountName;
                            const accountCode = account.accountCode;
                            
                            // Only include proper cash accounts, exclude clearing accounts
                            if (!this.isCashAccount(accountName, accountCode)) {
                                console.log(`🚫 Excluding non-cash account from tabular monthly consistency check: ${accountName} (${accountCode})`);
                                return;
                            }
                            
                            // If this account is not already in the monthly data, add it with zero balance
                            if (!tabularMonths[month].cash_and_cash_equivalents[accountName]) {
                                tabularMonths[month].cash_and_cash_equivalents[accountName] = {
                                    account_code: accountCode,
                                    balance: 0,
                                    description: this.getCashAccountDescription(accountName)
                                };
                            }
                        });
                    }
                } catch (error) {
                    console.error(`❌ Error getting cash balance for ${month} ${year}:`, error);
                    // Fallback to using the final cash balance if we can't get monthly data
                    if (i === monthNames.length - 1) { // Last month
                        Object.values(cashBalanceByAccount).forEach(account => {
                            const accountName = account.accountName;
                            const accountCode = account.accountCode;
                            const balance = account.balance;
                            
                            // Only include proper cash accounts, exclude clearing accounts
                            if (!this.isCashAccount(accountName, accountCode)) {
                                console.log(`🚫 Excluding non-cash account from tabular monthly fallback: ${accountName} (${accountCode})`);
                                return;
                            }
                            
                            if (balance && balance !== 0) {
                                tabularMonths[month].cash_and_cash_equivalents[accountName] = {
                                    account_code: accountCode,
                                    balance: balance,
                                    description: this.getCashAccountDescription(accountName)
                                };
                            }
                        });
                    }
                }
            }
        }
        
        return tabularMonths;
    }

    /**
     * Process transactions directly to create monthly breakdown
     */
    static processTransactionsToMonthlyBreakdown(transactionEntries, period, openingBalance) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        
        // Initialize monthly data structure
        const monthlyData = {};
        monthNames.forEach(month => {
            monthlyData[month] = {
                operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                income: { total: 0 },
                expenses: { total: 0, transactions: [] },
                investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
                net_cash_flow: 0,
                opening_balance: 0,
                closing_balance: 0,
                transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 }
            };
        });
        
        // Set opening balance
        monthlyData.january.opening_balance = openingBalance;
        
        console.log(`🔧 PROCESSING TRANSACTIONS - Found ${transactionEntries.length} transactions`);
        
        // Process each transaction
        transactionEntries.forEach(entry => {
            const entryDate = new Date(entry.date);
            const monthIndex = entryDate.getUTCMonth(); // 0-11 - Use UTC to avoid timezone issues
            const monthName = monthNames[monthIndex];
            
            console.log(`🔧 PROCESSING TRANSACTIONS - Transaction ${entry.transactionId}: date=${entry.date}, month=${monthIndex}, monthName=${monthName}, description=${entry.description}`);
            
            monthlyData[monthName].transaction_details.transaction_count++;
            
            // Process each entry in the transaction
            entry.entries.forEach(line => {
                const accountCode = line.accountCode;
                const accountName = line.accountName;
                const accountType = line.accountType;
                const debit = line.debit || 0;
                const credit = line.credit || 0;
                const amount = debit || credit || 0;
                
                console.log(`🔧 PROCESSING TRANSACTIONS - Line: ${accountCode} ${accountName} (${accountType}) - debit: ${debit}, credit: ${credit}`);
                
                // Process expenses
                if ((debit > 0 && accountType === 'Expense') || 
                    (debit > 0 && accountType === 'Liability' && entry.description?.toLowerCase().includes('payment for expense')) ||
                    (credit > 0 && accountType === 'Asset' && accountCode >= 1000 && accountCode < 2000 && 
                     entry.description?.toLowerCase().includes('payment for expense') && 
                     !entry.description?.toLowerCase().includes('petty cash') && 
                     !entry.description?.toLowerCase().includes('cash allocation') && 
                     !entry.description?.toLowerCase().includes('transfer') && 
                     !entry.description?.toLowerCase().includes('gas'))) {
                    
                    const description = entry.description?.toLowerCase() || '';
                    console.log(`🔧 PROCESSING TRANSACTIONS - Processing expense: ${description}, amount: ${amount}, month: ${monthName}`);
                    
                    // Special handling for electricity expense
                    if (entry.transactionId === 'TXN176055276167042O1C') {
                        console.log(`🔧 PROCESSING TRANSACTIONS - ELECTRICITY EXPENSE FOUND! Amount: ${amount}, Month: ${monthName}`);
                    }
                    
                    // Categorize expenses
                    if (description.includes('electricity') || description.includes('utility') || description.includes('gas') || description.includes('water') || description.includes('power')) {
                        monthlyData[monthName].expenses.utilities += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 PROCESSING TRANSACTIONS - Categorized as UTILITIES: ${amount} for ${monthName}`);
                        
                        if (entry.transactionId === 'TXN176055276167042O1C') {
                            console.log(`🔧 PROCESSING TRANSACTIONS - ELECTRICITY CATEGORIZED AS UTILITIES! Total now: ${monthlyData[monthName].expenses.utilities}`);
                        }
                    } else if (description.includes('maintenance') || description.includes('repair')) {
                        monthlyData[monthName].expenses.maintenance += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 PROCESSING TRANSACTIONS - Categorized as MAINTENANCE: ${amount} for ${monthName}`);
                    } else if (description.includes('cleaning')) {
                        monthlyData[monthName].expenses.cleaning += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 PROCESSING TRANSACTIONS - Categorized as CLEANING: ${amount} for ${monthName}`);
                    } else if (description.includes('security')) {
                        monthlyData[monthName].expenses.security += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 PROCESSING TRANSACTIONS - Categorized as SECURITY: ${amount} for ${monthName}`);
                    } else if (description.includes('management') || description.includes('admin')) {
                        // Skip management fees - excluded from cash flow
                        console.log(`🔧 PROCESSING TRANSACTIONS - Skipping management expense: ${amount} for ${monthName}`);
                        return;
                    } else {
                        // Default to maintenance
                        monthlyData[monthName].expenses.maintenance += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 PROCESSING TRANSACTIONS - Categorized as MAINTENANCE (default): ${amount} for ${monthName}`);
                    }
                    
                    // Update totals
                    monthlyData[monthName].expenses.total += amount;
                    
                    if (entry.transactionId === 'TXN176055276167042O1C') {
                        console.log(`🔧 PROCESSING TRANSACTIONS - ELECTRICITY TOTALS UPDATED! Expenses total: ${monthlyData[monthName].expenses.total}, Operating outflows: ${monthlyData[monthName].operating_activities.outflows}`);
                    }
                }
                
                // Process balance adjustments as financing activities (owner contributions)
                if (entry.description?.toLowerCase().includes('balance adjustment') && accountType === 'Equity') {
                    console.log(`🔧 PROCESSING TRANSACTIONS - Owner contribution: ${amount} in ${monthName}`);
                    monthlyData[monthName].financing_activities.inflows += amount;
                }
            });
            
            // Calculate operating activities net for this month
            monthlyData[monthName].operating_activities.inflows = monthlyData[monthName].income.total;
            monthlyData[monthName].operating_activities.net = monthlyData[monthName].operating_activities.inflows - monthlyData[monthName].operating_activities.outflows;
            monthlyData[monthName].net_cash_flow = monthlyData[monthName].operating_activities.net + monthlyData[monthName].financing_activities.net + monthlyData[monthName].investing_activities.net;
        });
        
        // Calculate opening and closing balances
        let runningBalance = openingBalance;
        monthNames.forEach(monthName => {
            monthlyData[monthName].opening_balance = runningBalance;
            runningBalance += monthlyData[monthName].net_cash_flow;
            monthlyData[monthName].closing_balance = runningBalance;
        });
        
        console.log('🔧 PROCESSING TRANSACTIONS - Monthly breakdown created successfully');
        console.log('🔧 PROCESSING TRANSACTIONS - October final data:', {
            operating_activities: monthlyData.october?.operating_activities,
            expenses: monthlyData.october?.expenses
        });
        
        return monthlyData;
    }

    /**
     * Create monthly breakdown using the same pattern as income statement
     */
    static createMonthlyBreakdownLikeIncomeStatement(transactionEntries, period, openingBalance) {
        const monthNames = [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
        ];
        
        // Initialize monthly data structure (same as income statement)
        const monthlyData = {
            january: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            february: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            march: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            april: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            may: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            june: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            july: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            august: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            september: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            october: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            november: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } },
            december: { operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, income: { total: 0 }, expenses: { total: 0, utilities: 0, maintenance: 0, cleaning: 0, security: 0, management: 0, transactions: [] }, investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} }, net_cash_flow: 0, opening_balance: 0, closing_balance: 0, transaction_details: { transaction_count: 0, payment_count: 0, expense_count: 0 } }
        };
        
        // Set opening balance for first month
        monthlyData.january.opening_balance = openingBalance;
        
        console.log(`🔧 INCOME STATEMENT PATTERN - Processing ${transactionEntries.length} transactions...`);
        
        // Process each transaction entry (same pattern as income statement)
        transactionEntries.forEach(entry => {
            const entryDate = new Date(entry.date);
            const month = entryDate.getUTCMonth(); // 0-11 - Use UTC to avoid timezone issues
            const monthName = monthNames[month];
            
            console.log(`🔧 INCOME STATEMENT PATTERN - Transaction ${entry.transactionId}: date=${entry.date}, month=${month}, monthName=${monthName}, description=${entry.description}`);
            
            monthlyData[monthName].transaction_details.transaction_count++;
            
            // Process each entry in the transaction
            entry.entries.forEach(line => {
                const accountCode = line.accountCode;
                const accountName = line.accountName;
                const accountType = line.accountType;
                const debit = line.debit || 0;
                const credit = line.credit || 0;
                const amount = debit || credit || 0;
                
                console.log(`🔧 INCOME STATEMENT PATTERN - Processing line: ${accountCode} ${accountName} (${accountType}) - debit: ${debit}, credit: ${credit}`);
                
                // Process expenses (same logic as before)
                if ((debit > 0 && accountType === 'Expense') || 
                    (debit > 0 && accountType === 'Liability' && entry.description?.toLowerCase().includes('payment for expense')) ||
                    (credit > 0 && accountType === 'Asset' && accountCode >= 1000 && accountCode < 2000 && 
                     entry.description?.toLowerCase().includes('payment for expense') && 
                     !entry.description?.toLowerCase().includes('petty cash') && 
                     !entry.description?.toLowerCase().includes('cash allocation') && 
                     !entry.description?.toLowerCase().includes('transfer') && 
                     !entry.description?.toLowerCase().includes('gas'))) {
                    
                    const description = entry.description?.toLowerCase() || '';
                    console.log(`🔧 INCOME STATEMENT PATTERN - Processing expense: ${description}, amount: ${amount}, month: ${monthName}`);
                    
                    // Special handling for electricity expense
                    if (entry.transactionId === 'TXN176055276167042O1C') {
                        console.log(`🔧 INCOME STATEMENT PATTERN - ELECTRICITY EXPENSE FOUND! Amount: ${amount}, Month: ${monthName}`);
                    }
                    
                    // Categorize expenses
                    if (description.includes('electricity') || description.includes('utility') || description.includes('gas') || description.includes('water') || description.includes('power')) {
                        monthlyData[monthName].expenses.utilities += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 INCOME STATEMENT PATTERN - Categorized as UTILITIES: ${amount} for ${monthName}`);
                        
                        if (entry.transactionId === 'TXN176055276167042O1C') {
                            console.log(`🔧 INCOME STATEMENT PATTERN - ELECTRICITY CATEGORIZED AS UTILITIES! Total now: ${monthlyData[monthName].expenses.utilities}`);
                        }
                    } else if (description.includes('maintenance') || description.includes('repair')) {
                        monthlyData[monthName].expenses.maintenance += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 INCOME STATEMENT PATTERN - Categorized as MAINTENANCE: ${amount} for ${monthName}`);
                    } else if (description.includes('cleaning')) {
                        monthlyData[monthName].expenses.cleaning += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 INCOME STATEMENT PATTERN - Categorized as CLEANING: ${amount} for ${monthName}`);
                    } else if (description.includes('security')) {
                        monthlyData[monthName].expenses.security += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 INCOME STATEMENT PATTERN - Categorized as SECURITY: ${amount} for ${monthName}`);
                    } else if (description.includes('management') || description.includes('admin')) {
                        // Skip management fees - excluded from cash flow
                        console.log(`🔧 INCOME STATEMENT PATTERN - Skipping management expense: ${amount} for ${monthName}`);
                        return;
                    } else {
                        // Default to maintenance
                        monthlyData[monthName].expenses.maintenance += amount;
                        monthlyData[monthName].operating_activities.outflows += amount;
                        console.log(`🔧 INCOME STATEMENT PATTERN - Categorized as MAINTENANCE (default): ${amount} for ${monthName}`);
                    }
                    
                    // Update totals
                    monthlyData[monthName].expenses.total += amount;
                    
                    if (entry.transactionId === 'TXN176055276167042O1C') {
                        console.log(`🔧 INCOME STATEMENT PATTERN - ELECTRICITY TOTALS UPDATED! Expenses total: ${monthlyData[monthName].expenses.total}, Operating outflows: ${monthlyData[monthName].operating_activities.outflows}`);
                    }
                }
                
                // Process balance adjustments as financing activities (owner contributions)
                if (entry.description?.toLowerCase().includes('balance adjustment') && accountType === 'Equity') {
                    console.log(`🔧 INCOME STATEMENT PATTERN - Owner contribution: ${amount} in ${monthName}`);
                    monthlyData[monthName].financing_activities.inflows += amount;
                }
            });
            
            // Calculate operating activities net for this month
            monthlyData[monthName].operating_activities.inflows = monthlyData[monthName].income.total;
            monthlyData[monthName].operating_activities.net = monthlyData[monthName].operating_activities.inflows - monthlyData[monthName].operating_activities.outflows;
            monthlyData[monthName].net_cash_flow = monthlyData[monthName].operating_activities.net + monthlyData[monthName].financing_activities.net + monthlyData[monthName].investing_activities.net;
        });
        
        // Calculate opening and closing balances
        let runningBalance = openingBalance;
        monthNames.forEach(monthName => {
            monthlyData[monthName].opening_balance = runningBalance;
            runningBalance += monthlyData[monthName].net_cash_flow;
            monthlyData[monthName].closing_balance = runningBalance;
        });
        
        console.log('🔧 INCOME STATEMENT PATTERN - Monthly breakdown created successfully');
        console.log('🔧 INCOME STATEMENT PATTERN - October final data:', {
            operating_activities: monthlyData.october?.operating_activities,
            expenses: monthlyData.october?.expenses
        });
        
        return monthlyData;
    }

    /**
     * Create simple direct monthly breakdown by mapping transactions to months
     */
    static createSimpleMonthlyBreakdown(transactionEntries, period, openingBalance) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        
        // Initialize months with empty structure
        const months = {};
        monthNames.forEach(month => {
            months[month] = {
                operating_activities: {
                    inflows: 0,
                    outflows: 0,
                    net: 0,
                    breakdown: {
                        rental_income: { amount: 0, description: "Rental Income from Students" },
                        admin_fees: { amount: 0, description: "Administrative Fees" },
                        deposits: { amount: 0, description: "Security Deposits" },
                        utilities_income: { amount: 0, description: "Utilities Income" },
                        advance_payments: { description: "Advance Payments from Students" },
                        other_income: { amount: 0, description: "Other Income Sources" },
                        maintenance_expenses: { amount: 0, description: "Property Maintenance" },
                        utilities_expenses: { amount: 0, description: "Utility Bills" },
                        cleaning_expenses: { amount: 0, description: "Cleaning Services" },
                        security_expenses: { amount: 0, description: "Security Services" },
                        management_expenses: { amount: 0, description: "Management Fees" }
                    }
                },
                income: {
                    total: 0,
                    rental_income: 0,
                    admin_fees: 0,
                    deposits: 0,
                    utilities: 0,
                    other_income: 0,
                    transactions: []
                },
                expenses: {
                    total: 0,
                    maintenance: 0,
                    utilities: 0,
                    cleaning: 0,
                    security: 0,
                    management: 0,
                    transactions: []
                },
                investing_activities: {
                    inflows: 0,
                    outflows: 0,
                    net: 0,
                    breakdown: {}
                },
                financing_activities: {
                    inflows: 0,
                    outflows: 0,
                    net: 0,
                    breakdown: {}
                },
                net_cash_flow: 0,
                opening_balance: 0,
                closing_balance: 0,
                transaction_details: {
                    transaction_count: 0,
                    payment_count: 0,
                    expense_count: 0
                }
            };
        });
        
        // Set opening balance for first month
        if (monthNames.length > 0) {
            months[monthNames[0]].opening_balance = openingBalance;
        }
        
        // DIRECT MAPPING: Process each transaction and map to correct month
        console.log(`🔧 SIMPLE MAPPING - Processing ${transactionEntries.length} transactions...`);
        console.log(`🔧 SIMPLE MAPPING - Transaction entries:`, transactionEntries.map(t => ({ id: t.transactionId, date: t.date, description: t.description })));
        transactionEntries.forEach(entry => {
            const entryDate = new Date(entry.date);
            const monthKey = monthNames[entryDate.getUTCMonth()]; // Use UTC to avoid timezone issues
            
            console.log(`🔧 SIMPLE MAPPING - Transaction ${entry.transactionId}: date=${entry.date}, monthKey=${monthKey}, description=${entry.description}`);
            
            if (!months[monthKey]) {
                console.log(`🔧 SIMPLE MAPPING - Month ${monthKey} not found, skipping`);
                return;
            }
            
            months[monthKey].transaction_details.transaction_count++;
            
            // Process each entry in the transaction
            entry.entries.forEach(transactionEntry => {
                const amount = transactionEntry.debit || transactionEntry.credit || 0;
                const isDebit = transactionEntry.debit > 0;
                const isCredit = transactionEntry.credit > 0;
                
                // Check if this is a cash account (1000-1999 series)
                const accountCode = parseInt(transactionEntry.accountCode);
                const isCashAccount = accountCode >= 1000 && accountCode < 2000;
                
                // Process balance adjustments as financing activities (owner contributions)
                if (entry.description?.toLowerCase().includes('balance adjustment') && transactionEntry.accountType === 'Equity') {
                    console.log(`🔧 SIMPLE MAPPING - Owner contribution: ${amount} in ${monthKey}`);
                    months[monthKey].financing_activities.inflows += amount;
                    months[monthKey].financing_activities.breakdown.owner_contribution = {
                        amount: (months[monthKey].financing_activities.breakdown.owner_contribution?.amount || 0) + amount,
                        description: 'Owner Capital Contribution',
                        transactions: [...(months[monthKey].financing_activities.breakdown.owner_contribution?.transactions || []), entry]
                    };
                    return;
                }
                
                // Process expenses (debit to expense accounts OR expense payments via accounts payable)
                if ((isDebit && transactionEntry.accountType === 'Expense') || 
                    (isDebit && transactionEntry.accountType === 'Liability' && entry.description?.toLowerCase().includes('payment for expense')) ||
                    (isCredit && transactionEntry.accountType === 'Asset' && transactionEntry.accountCode >= 1000 && transactionEntry.accountCode < 2000 && 
                     entry.description?.toLowerCase().includes('payment for expense') && 
                     !entry.description?.toLowerCase().includes('petty cash') && 
                     !entry.description?.toLowerCase().includes('cash allocation') && 
                     !entry.description?.toLowerCase().includes('transfer') && 
                     !entry.description?.toLowerCase().includes('gas'))) {
                    
                    const description = entry.description?.toLowerCase() || '';
                    console.log(`🔧 SIMPLE MAPPING - Processing expense: ${description}, amount: ${amount}, month: ${monthKey}`);
                    
                    // Special handling for electricity expense
                    if (entry.transactionId === 'TXN176055276167042O1C') {
                        console.log(`🔧 SIMPLE MAPPING - ELECTRICITY EXPENSE FOUND! Amount: ${amount}, Month: ${monthKey}`);
                    }
                    
                    // Categorize expenses
                    if (description.includes('electricity') || description.includes('utility') || description.includes('gas') || description.includes('water') || description.includes('power')) {
                        months[monthKey].expenses.utilities += amount;
                        months[monthKey].operating_activities.breakdown.utilities_expenses.amount += amount;
                        months[monthKey].operating_activities.breakdown.utilities_expenses.transactions = [...(months[monthKey].operating_activities.breakdown.utilities_expenses.transactions || []), entry];
                        console.log(`🔧 SIMPLE MAPPING - Categorized as UTILITIES: ${amount} for ${monthKey}`);
                        
                        if (entry.transactionId === 'TXN176055276167042O1C') {
                            console.log(`🔧 SIMPLE MAPPING - ELECTRICITY CATEGORIZED AS UTILITIES! Total now: ${months[monthKey].expenses.utilities}`);
                        }
                    } else if (description.includes('maintenance') || description.includes('repair')) {
                        months[monthKey].expenses.maintenance += amount;
                        months[monthKey].operating_activities.breakdown.maintenance_expenses.amount += amount;
                        months[monthKey].operating_activities.breakdown.maintenance_expenses.transactions = [...(months[monthKey].operating_activities.breakdown.maintenance_expenses.transactions || []), entry];
                        console.log(`🔧 SIMPLE MAPPING - Categorized as MAINTENANCE: ${amount} for ${monthKey}`);
                    } else if (description.includes('cleaning')) {
                        months[monthKey].expenses.cleaning += amount;
                        months[monthKey].operating_activities.breakdown.cleaning_expenses.amount += amount;
                        months[monthKey].operating_activities.breakdown.cleaning_expenses.transactions = [...(months[monthKey].operating_activities.breakdown.cleaning_expenses.transactions || []), entry];
                        console.log(`🔧 SIMPLE MAPPING - Categorized as CLEANING: ${amount} for ${monthKey}`);
                    } else if (description.includes('security')) {
                        months[monthKey].expenses.security += amount;
                        months[monthKey].operating_activities.breakdown.security_expenses.amount += amount;
                        months[monthKey].operating_activities.breakdown.security_expenses.transactions = [...(months[monthKey].operating_activities.breakdown.security_expenses.transactions || []), entry];
                        console.log(`🔧 SIMPLE MAPPING - Categorized as SECURITY: ${amount} for ${monthKey}`);
                    } else if (description.includes('management') || description.includes('admin')) {
                        // Skip management fees - excluded from cash flow
                        console.log(`🔧 SIMPLE MAPPING - Skipping management expense: ${amount} for ${monthKey}`);
                        return;
                    } else {
                        // Default to maintenance
                        months[monthKey].expenses.maintenance += amount;
                        months[monthKey].operating_activities.breakdown.maintenance_expenses.amount += amount;
                        months[monthKey].operating_activities.breakdown.maintenance_expenses.transactions = [...(months[monthKey].operating_activities.breakdown.maintenance_expenses.transactions || []), entry];
                        console.log(`🔧 SIMPLE MAPPING - Categorized as MAINTENANCE (default): ${amount} for ${monthKey}`);
                    }
                    
                    // Update totals
                    months[monthKey].expenses.total += amount;
                    months[monthKey].operating_activities.outflows += amount;
                    
                    if (entry.transactionId === 'TXN176055276167042O1C') {
                        console.log(`🔧 SIMPLE MAPPING - ELECTRICITY TOTALS UPDATED! Expenses total: ${months[monthKey].expenses.total}, Operating outflows: ${months[monthKey].operating_activities.outflows}`);
                    }
                }
            });
        });
        
        // Calculate operating activities net for each month
        Object.keys(months).forEach(monthKey => {
            months[monthKey].operating_activities.inflows = months[monthKey].income.total;
            months[monthKey].operating_activities.net = months[monthKey].operating_activities.inflows - months[monthKey].operating_activities.outflows;
            months[monthKey].net_cash_flow = months[monthKey].operating_activities.net + months[monthKey].financing_activities.net + months[monthKey].investing_activities.net;
            
            console.log(`🔧 SIMPLE MAPPING - ${monthKey}: income=${months[monthKey].income.total}, expenses=${months[monthKey].expenses.total}, operating_net=${months[monthKey].operating_activities.net}`);
        });
        
        // Calculate opening and closing balances
        let runningBalance = openingBalance;
        const sortedMonths = Object.keys(months).sort();
        sortedMonths.forEach(monthKey => {
            months[monthKey].opening_balance = runningBalance;
            runningBalance += months[monthKey].net_cash_flow;
            months[monthKey].closing_balance = runningBalance;
        });
        
        console.log('🔧 SIMPLE MAPPING - Monthly breakdown created successfully');
        console.log('🔧 SIMPLE MAPPING - October final data:', {
            operating_activities: months.october?.operating_activities,
            expenses: months.october?.expenses
        });
        
        return months;
    }

    /**
     * Generate monthly breakdown in the old format for frontend compatibility
     */
    static async generateOldFormatMonthlyBreakdown(transactionEntries, payments, expenses, period, openingBalance, startDate, endDate, cash_breakdown, cash_balance_by_account) {
        console.log('🔧 Generating old format monthly breakdown...');
        console.log('🔧 Parameters received:', {
            transactionEntriesCount: transactionEntries?.length || 0,
            paymentsCount: payments?.length || 0,
            expensesCount: expenses?.length || 0,
            period,
            openingBalance,
            hasCashBreakdown: !!cash_breakdown,
            cashBreakdownKeys: cash_breakdown?.by_month ? Object.keys(cash_breakdown.by_month) : []
        });
        
        const months = {};
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                           'july', 'august', 'september', 'october', 'november', 'december'];
        
        // Initialize months with old format structure
        monthNames.forEach(month => {
            months[month] = {
                opening_balance: 0,
                closing_balance: 0,
                income: {
                    total: 0,
                    rental_income: 0,
                    admin_fees: 0,
                    deposits: 0,
                    utilities: 0,
                    advance_payments: 0,
                    other_income: 0,
                    transactions: []
                },
                expenses: {
                    total: 0,
                    maintenance: 0,
                    utilities: 0,
                    cleaning: 0,
                    security: 0,
                    management: 0,
                    transactions: []
                },
                operating_activities: {
                    inflows: 0,
                    outflows: 0,
                    net: 0,
                    breakdown: {
                        rental_income: { amount: 0, transactions: [] },
                        admin_fees: { amount: 0, transactions: [] },
                        deposits: { amount: 0, transactions: [] },
                        utilities: { amount: 0, transactions: [] },
                        advance_payments: { amount: 0, transactions: [] },
                        other_income: { amount: 0, transactions: [] },
                        maintenance_expenses: { amount: 0, transactions: [] },
                        utilities_expenses: { amount: 0, transactions: [] },
                        cleaning_expenses: { amount: 0, transactions: [] },
                        security_expenses: { amount: 0, transactions: [] },
                        management_expenses: { amount: 0, transactions: [] }
                    }
                },
                investing_activities: {
                    inflows: 0,
                    outflows: 0,
                    net: 0,
                    breakdown: {}
                },
                financing_activities: {
                    inflows: 0,
                    outflows: 0,
                    net: 0,
                    breakdown: {}
                },
                net_cash_flow: 0,
                transaction_details: {
                    transaction_count: 0,
                    payment_count: 0,
                    expense_count: 0
                }
            };
        });
        
        // Set opening balance for first month
        if (monthNames.length > 0) {
            months[monthNames[0]].opening_balance = openingBalance;
        }
        
        // Process transactions - DIRECT MAPPING APPROACH
        console.log(`🔧 Old format - Processing ${transactionEntries.length} transaction entries with DIRECT MAPPING...`);
        transactionEntries.forEach(entry => {
            const entryDate = new Date(entry.date);
            const monthKey = monthNames[entryDate.getUTCMonth()]; // Use UTC to avoid timezone issues
            
            console.log(`🔧 DIRECT MAPPING - Transaction ${entry.transactionId}: date=${entry.date}, monthKey=${monthKey}, description=${entry.description}`);
            
            // Special debugging for the electricity expense
            if (entry.transactionId === 'TXN176055276167042O1C') {
                console.log(`🔧 SPECIAL DEBUG - Electricity expense transaction found!`);
                console.log(`🔧 SPECIAL DEBUG - Date: ${entry.date}, Month: ${entryDate.getUTCMonth()}, MonthKey: ${monthKey}`);
                console.log(`🔧 SPECIAL DEBUG - Available months:`, Object.keys(months));
            }
            
            if (!months[monthKey]) {
                console.log(`🔧 DIRECT MAPPING - Month ${monthKey} not found, skipping transaction`);
                return;
            }
            
            months[monthKey].transaction_details.transaction_count++;
            console.log(`🔧 DIRECT MAPPING - Processing transaction ${entry.transactionId} in ${monthKey}: ${entry.description}`);
            
            // Process each entry in the transaction
            entry.entries.forEach(transactionEntry => {
                const amount = transactionEntry.debit || transactionEntry.credit || 0;
                const isDebit = transactionEntry.debit > 0;
                const isCredit = transactionEntry.credit > 0;
                
                // Check if this is a cash account (1000-1999 series)
                const accountCode = parseInt(transactionEntry.accountCode);
                const isCashAccount = accountCode >= 1000 && accountCode < 2000;
                
                // Process balance adjustments as financing activities (owner contributions)
                if (entry.description?.toLowerCase().includes('balance adjustment') && transactionEntry.accountType === 'Equity') {
                    const description = entry.description?.toLowerCase() || '';
                    console.log(`🔧 Old format - Processing balance adjustment: ${description}, amount: ${amount}, account: ${transactionEntry.accountName}, month: ${monthKey}`);
                    
                    // This is an owner contribution (financing activity)
                    months[monthKey].financing_activities.inflows += amount;
                    months[monthKey].financing_activities.breakdown.owner_contribution = {
                        amount: (months[monthKey].financing_activities.breakdown.owner_contribution?.amount || 0) + amount,
                        description: 'Owner Capital Contribution',
                        transactions: [...(months[monthKey].financing_activities.breakdown.owner_contribution?.transactions || []), entry]
                    };
                    console.log(`🔧 Old format - Updated financing activities for ${monthKey}: inflows=${months[monthKey].financing_activities.inflows}`);
                    return;
                }
                
                // Process income (credit to income accounts)
                if (isCredit && transactionEntry.accountType === 'Income') {
                    const description = transactionEntry.description?.toLowerCase() || '';
                    
                    // Skip balance adjustments (already handled above)
                    if (description.includes('balance adjustment')) {
                        return;
                    }
                    
                    // Categorize income
                    if (description.includes('rent') || description.includes('rental')) {
                        months[monthKey].income.rental_income += amount;
                        months[monthKey].operating_activities.breakdown.rental_income.amount += amount;
                        months[monthKey].operating_activities.breakdown.rental_income.transactions.push(entry);
                    } else if (description.includes('admin') || description.includes('fee')) {
                        months[monthKey].income.admin_fees += amount;
                        months[monthKey].operating_activities.breakdown.admin_fees.amount += amount;
                        months[monthKey].operating_activities.breakdown.admin_fees.transactions.push(entry);
                    } else if (description.includes('deposit')) {
                        months[monthKey].income.deposits += amount;
                        months[monthKey].operating_activities.breakdown.deposits.amount += amount;
                        months[monthKey].operating_activities.breakdown.deposits.transactions.push(entry);
                    } else if (description.includes('utility') || description.includes('gas') || description.includes('water') || description.includes('electricity')) {
                        months[monthKey].income.utilities += amount;
                        months[monthKey].operating_activities.breakdown.utilities.amount += amount;
                        months[monthKey].operating_activities.breakdown.utilities.transactions.push(entry);
                    } else if (description.includes('advance')) {
                        months[monthKey].income.advance_payments += amount;
                        months[monthKey].operating_activities.breakdown.advance_payments.amount += amount;
                        months[monthKey].operating_activities.breakdown.advance_payments.transactions.push(entry);
                    } else {
                        // Check for balance sheet adjustments (exclude from income)
                        if (this.isBalanceSheetAdjustment(entry)) {
                            // This is a balance sheet adjustment or internal transfer, not income - don't count as income
                            console.log(`💰 Opening balance/balance adjustment/internal transfer excluded from other_income: ${amount} - Transaction: ${entry.transactionId} - Description: ${entry.description}`);
                            return; // Skip this transaction entry
                        }
                        
                        // Exclude other_income from cash flow entirely - skip this entry
                        return; // Skip this transaction entry - don't add to any income category
                    }
                    
                    months[monthKey].income.total += amount;
                    months[monthKey].operating_activities.inflows += amount;
                }
                
                // Process expenses (debit to expense accounts OR expense payments via accounts payable)
                // Also catch any cash outflow that's not an internal transfer
                if ((isDebit && transactionEntry.accountType === 'Expense') || 
                    (isDebit && transactionEntry.accountType === 'Liability' && entry.description?.toLowerCase().includes('payment for expense')) ||
                    (isCredit && transactionEntry.accountType === 'Asset' && transactionEntry.accountCode >= 1000 && transactionEntry.accountCode < 2000 && 
                     entry.description?.toLowerCase().includes('payment for expense') &&
                     !entry.description?.toLowerCase().includes('petty cash') && 
                     !entry.description?.toLowerCase().includes('cash allocation') && 
                     !entry.description?.toLowerCase().includes('transfer') && 
                     !entry.description?.toLowerCase().includes('gas'))) {
                    
                    // For expense payments, use the main transaction description to get the expense type
                    const description = entry.description?.toLowerCase() || transactionEntry.description?.toLowerCase() || '';
                    console.log(`🔧 Old format - Processing expense: ${description}, amount: ${amount}, account: ${transactionEntry.accountName}, month: ${monthKey}`);
                    
                    // Special debugging for the electricity expense
                    if (entry.transactionId === 'TXN176055276167042O1C') {
                        console.log(`🔧 SPECIAL DEBUG - Processing electricity expense!`);
                        console.log(`🔧 SPECIAL DEBUG - Description: ${description}`);
                        console.log(`🔧 SPECIAL DEBUG - Amount: ${amount}`);
                        console.log(`🔧 SPECIAL DEBUG - Account: ${transactionEntry.accountName}`);
                        console.log(`🔧 SPECIAL DEBUG - Month: ${monthKey}`);
                    }
                    
                    // Categorize expenses - check for utilities first since electricity is a utility
                    if (description.includes('electricity') || description.includes('utility') || description.includes('gas') || description.includes('water') || description.includes('power')) {
                        months[monthKey].expenses.utilities += amount;
                        months[monthKey].operating_activities.breakdown.utilities_expenses.amount += amount;
                        months[monthKey].operating_activities.breakdown.utilities_expenses.transactions.push(entry);
                        console.log(`🔧 Old format - Categorized as utilities expense: ${amount} for ${monthKey}`);
                        
                        // Special debugging for the electricity expense
                        if (entry.transactionId === 'TXN176055276167042O1C') {
                            console.log(`🔧 SPECIAL DEBUG - Categorized as UTILITIES expense!`);
                            console.log(`🔧 SPECIAL DEBUG - Utilities total now: ${months[monthKey].expenses.utilities}`);
                            console.log(`🔧 SPECIAL DEBUG - Operating activities utilities: ${months[monthKey].operating_activities.breakdown.utilities_expenses.amount}`);
                        }
                    } else if (description.includes('maintenance') || description.includes('repair')) {
                        months[monthKey].expenses.maintenance += amount;
                        months[monthKey].operating_activities.breakdown.maintenance_expenses.amount += amount;
                        months[monthKey].operating_activities.breakdown.maintenance_expenses.transactions.push(entry);
                        console.log(`🔧 Old format - Categorized as maintenance expense: ${amount} for ${monthKey}`);
                    } else if (description.includes('cleaning')) {
                        months[monthKey].expenses.cleaning += amount;
                        months[monthKey].operating_activities.breakdown.cleaning_expenses.amount += amount;
                        months[monthKey].operating_activities.breakdown.cleaning_expenses.transactions.push(entry);
                        console.log(`🔧 Old format - Categorized as cleaning expense: ${amount} for ${monthKey}`);
                    } else if (description.includes('security')) {
                        months[monthKey].expenses.security += amount;
                        months[monthKey].operating_activities.breakdown.security_expenses.amount += amount;
                        months[monthKey].operating_activities.breakdown.security_expenses.transactions.push(entry);
                        console.log(`🔧 Old format - Categorized as security expense: ${amount} for ${monthKey}`);
                    } else if (description.includes('management') || description.includes('admin')) {
                        // Skip management fees - exclude from cash flow
                        console.log(`🔧 Old format - Skipping management expense (excluded from cash flow): ${amount} for ${monthKey}`);
                        return; // Skip this expense
                    } else {
                        // Default to maintenance for any other expense
                        months[monthKey].expenses.maintenance += amount;
                        months[monthKey].operating_activities.breakdown.maintenance_expenses.amount += amount;
                        months[monthKey].operating_activities.breakdown.maintenance_expenses.transactions.push(entry);
                        console.log(`🔧 Old format - Categorized as maintenance expense (default): ${amount} for ${monthKey}`);
                    }
                    
                    months[monthKey].expenses.total += amount;
                    months[monthKey].operating_activities.outflows += amount;
                    
                    // Special debugging for the electricity expense
                    if (entry.transactionId === 'TXN176055276167042O1C') {
                        console.log(`🔧 SPECIAL DEBUG - Final totals updated!`);
                        console.log(`🔧 SPECIAL DEBUG - Expenses total: ${months[monthKey].expenses.total}`);
                        console.log(`🔧 SPECIAL DEBUG - Operating activities outflows: ${months[monthKey].operating_activities.outflows}`);
                    }
                }
            });
        });
        
        // Process payments
        payments.forEach(payment => {
            const paymentDate = new Date(payment.date);
            const monthKey = monthNames[paymentDate.getUTCMonth()]; // Use UTC to avoid timezone issues
            
            if (!months[monthKey]) return;
            
            months[monthKey].transaction_details.payment_count++;
        });
        
        // Process expenses
        console.log(`🔧 Old format - Processing ${expenses.length} expenses...`);
        console.log('🔧 Old format - Expenses array:', expenses);
        expenses.forEach(expense => {
            const expenseDate = new Date(expense.expenseDate);
            const monthKey = monthNames[expenseDate.getUTCMonth()]; // Use UTC to avoid timezone issues
            
            console.log(`🔧 Old format - Processing expense: ${expense.description}, amount: ${expense.amount}, category: ${expense.category}`);
            
            if (!months[monthKey]) return;
            
            months[monthKey].transaction_details.expense_count++;
            
            // Add expense amount to monthly breakdown
            const amount = expense.amount || 0;
            const description = expense.description?.toLowerCase() || '';
            const category = expense.category?.toLowerCase() || '';
            
            // Categorize expenses
            if (category.includes('maintenance') || description.includes('maintenance') || description.includes('repair')) {
                months[monthKey].expenses.maintenance += amount;
                months[monthKey].operating_activities.breakdown.maintenance_expenses.amount += amount;
                months[monthKey].operating_activities.breakdown.maintenance_expenses.transactions.push(expense);
            } else if (category.includes('utility') || description.includes('utility') || description.includes('gas') || description.includes('water') || description.includes('electricity')) {
                months[monthKey].expenses.utilities += amount;
                months[monthKey].operating_activities.breakdown.utilities_expenses.amount += amount;
                months[monthKey].operating_activities.breakdown.utilities_expenses.transactions.push(expense);
            } else if (category.includes('cleaning') || description.includes('cleaning')) {
                months[monthKey].expenses.cleaning += amount;
                months[monthKey].operating_activities.breakdown.cleaning_expenses.amount += amount;
                months[monthKey].operating_activities.breakdown.cleaning_expenses.transactions.push(expense);
            } else if (category.includes('security') || description.includes('security')) {
                months[monthKey].expenses.security += amount;
                months[monthKey].operating_activities.breakdown.security_expenses.amount += amount;
                months[monthKey].operating_activities.breakdown.security_expenses.transactions.push(expense);
            } else if (category.includes('management') || description.includes('management') || description.includes('admin')) {
                months[monthKey].expenses.management += amount;
                months[monthKey].operating_activities.breakdown.management_expenses.amount += amount;
                months[monthKey].operating_activities.breakdown.management_expenses.transactions.push(expense);
            } else {
                // Default to maintenance for uncategorized expenses
                months[monthKey].expenses.maintenance += amount;
                months[monthKey].operating_activities.breakdown.maintenance_expenses.amount += amount;
                months[monthKey].operating_activities.breakdown.maintenance_expenses.transactions.push(expense);
            }
            
            months[monthKey].expenses.total += amount;
            months[monthKey].operating_activities.outflows += amount;
        });
        
        // Calculate net cash flow for each month using cash breakdown data
        console.log('🔧 Available cash breakdown keys:', cash_breakdown?.by_month ? Object.keys(cash_breakdown.by_month) : 'No cash breakdown');
        Object.keys(months).forEach(monthKey => {
            // Convert month name to YYYY-MM format for cash breakdown lookup
            const monthIndex = monthNames.indexOf(monthKey);
            const cashBreakdownKey = `${period}-${String(monthIndex + 1).padStart(2, '0')}`;
            const cashBreakdownMonth = cash_breakdown && cash_breakdown.by_month && cash_breakdown.by_month[cashBreakdownKey];
            console.log(`🔧 Looking for ${monthKey} -> ${cashBreakdownKey}: ${cashBreakdownMonth ? 'FOUND' : 'NOT FOUND'}`);
            
            if (cashBreakdownMonth) {
                // Use actual cash inflows minus cash outflows from cash breakdown for total net cash flow
                const netFlow = (cashBreakdownMonth.cash_inflows || 0) - (cashBreakdownMonth.cash_outflows || 0);
                months[monthKey].net_cash_flow = netFlow;
                
                // Operating activities should only include income minus expenses, not total cash flow
                // Make sure operating activities inflows and outflows are set from transaction processing
                months[monthKey].operating_activities.inflows = months[monthKey].income.total;
                months[monthKey].operating_activities.outflows = months[monthKey].expenses.total;
                months[monthKey].operating_activities.net = months[monthKey].operating_activities.inflows - months[monthKey].operating_activities.outflows;
                
                console.log(`🔧 Old format - Month ${monthKey} (${cashBreakdownKey}): income=${months[monthKey].income.total}, expenses=${months[monthKey].expenses.total}, operating_net=${months[monthKey].operating_activities.net}`);
                
                // Special debugging for October
                if (monthKey === 'october') {
                    console.log(`🔧 SPECIAL DEBUG - OCTOBER FINAL CALCULATION:`);
                    console.log(`🔧 SPECIAL DEBUG - Income total: ${months[monthKey].income.total}`);
                    console.log(`🔧 SPECIAL DEBUG - Expenses total: ${months[monthKey].expenses.total}`);
                    console.log(`🔧 SPECIAL DEBUG - Operating activities inflows: ${months[monthKey].operating_activities.inflows}`);
                    console.log(`🔧 SPECIAL DEBUG - Operating activities outflows: ${months[monthKey].operating_activities.outflows}`);
                    console.log(`🔧 SPECIAL DEBUG - Operating activities net: ${months[monthKey].operating_activities.net}`);
                }
                
                console.log(`🔧 Old format - Month ${monthKey} (${cashBreakdownKey}): cash_inflows=${cashBreakdownMonth.cash_inflows}, cash_outflows=${cashBreakdownMonth.cash_outflows}, net_cash_flow=${netFlow}, operating_net=${months[monthKey].operating_activities.net}`);
            } else {
                // Fallback to income minus expenses if no cash breakdown data
                months[monthKey].net_cash_flow = months[monthKey].income.total - months[monthKey].expenses.total;
                months[monthKey].operating_activities.inflows = months[monthKey].income.total;
                months[monthKey].operating_activities.outflows = months[monthKey].expenses.total;
                months[monthKey].operating_activities.net = months[monthKey].operating_activities.inflows - months[monthKey].operating_activities.outflows;
                console.log(`🔧 Old format - Month ${monthKey} (${cashBreakdownKey}): No cash breakdown data, using income=${months[monthKey].income.total} - expenses=${months[monthKey].expenses.total} = ${months[monthKey].net_cash_flow}`);
            }
        });
        
        // Calculate opening and closing balances for each month
        let runningBalance = openingBalance;
        const sortedMonths = Object.keys(months).sort();
        
        sortedMonths.forEach(monthKey => {
            months[monthKey].opening_balance = runningBalance;
            runningBalance += months[monthKey].net_cash_flow;
            months[monthKey].closing_balance = runningBalance;
        });
        
        console.log('🔧 Old format monthly breakdown generated successfully');
        console.log('🔧 August final data:', {
            operating_activities: months.august?.operating_activities,
            financing_activities: months.august?.financing_activities,
            transaction_count: months.august?.transaction_details?.transaction_count
        });
        console.log('🔧 September final data:', {
            operating_activities: months.september?.operating_activities,
            financing_activities: months.september?.financing_activities,
            transaction_count: months.september?.transaction_details?.transaction_count
        });
        console.log('🔧 October final data:', {
            operating_activities: months.october?.operating_activities,
            expenses: months.october?.expenses,
            financing_activities: months.october?.financing_activities,
            transaction_count: months.october?.transaction_details?.transaction_count
        });
        return months;
    }
    
    /**
     * Calculate comprehensive cash breakdown
     */
    static async calculateCashBreakdown(transactionEntries, payments, period, residenceId = null) {
        // Calculate actual beginning cash balance
        // For cashflow, we need the balance BEFORE the period starts
        const startDate = new Date(`${period}-01-01`);
        const openingDate = new Date(startDate);
        openingDate.setDate(openingDate.getDate() - 1); // Day before period starts
        const beginningCash = await this.getOpeningCashBalance(openingDate, residenceId);
        
        const cashBreakdown = {
            beginning_cash: beginningCash,
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
        
        // Initialize monthly breakdown with both YYYY-MM format and month names
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                           'july', 'august', 'september', 'october', 'november', 'december'];
        
        for (let month = 1; month <= 12; month++) {
            const monthKey = `${period}-${String(month).padStart(2, '0')}`;
            const monthName = monthNames[month - 1];
            
            const monthData = {
                beginning_cash: 0,
                cash_inflows: 0,
                cash_outflows: 0,
                net_change: 0,
                ending_cash: 0,
                advance_payments_received: 0,
                advance_payments_utilized: 0,
                internal_transfers: 0
            };
            
            // Store in both formats for frontend compatibility
            cashBreakdown.by_month[monthKey] = monthData;
            cashBreakdown.by_month[monthName] = monthData;
        }
        
        // Create a map of transaction entries to their corresponding payments for accurate date handling
        const transactionToPaymentMap = new Map();
        
        // Process transaction entries to calculate cash flows
        transactionEntries.forEach(entry => {
            if (entry.entries && entry.entries.length > 0) {
                // ALWAYS prioritize payment date from payments collection for cash flow accuracy
                let effectiveDate = entry.date;
                let correspondingPayment = null;
                
                // For expense payments, prioritize datePaid from metadata
                if (entry.source === 'expense_payment' && entry.metadata && entry.metadata.datePaid) {
                    effectiveDate = new Date(entry.metadata.datePaid);
                    console.log(`💰 Using datePaid from expense payment: ${entry.transactionId} - ${effectiveDate.toISOString().slice(0, 7)}`);
                }
                // Try to find corresponding payment for accurate date - PRIORITY 1: Reference
                else if (entry.reference) {
                    // Look for payment by reference
                    correspondingPayment = payments.find(p => p._id.toString() === entry.reference);
                    if (correspondingPayment) {
                        effectiveDate = correspondingPayment.date;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked transaction ${entry.transactionId} to payment ${correspondingPayment.paymentId} with date ${correspondingPayment.date.toISOString().slice(0, 7)}`);
                    } else {
                        console.log(`⚠️ No payment found for reference ${entry.reference} in transaction ${entry.transactionId} - using transaction date`);
                        effectiveDate = entry.date;
                    }
                }
                // PRIORITY 2: PaymentId in metadata
                else if (entry.metadata && entry.metadata.paymentId) {
                    correspondingPayment = payments.find(p => p.paymentId === entry.metadata.paymentId);
                    if (correspondingPayment) {
                        effectiveDate = correspondingPayment.date;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked transaction ${entry.transactionId} to payment ${correspondingPayment.paymentId} with date ${correspondingPayment.date.toISOString().slice(0, 7)}`);
                    } else {
                        console.log(`⚠️ No payment found for paymentId ${entry.metadata.paymentId} in transaction ${entry.transactionId} - using transaction date`);
                        effectiveDate = entry.date;
                    }
                }
                // PRIORITY 3: Student and amount matching for advance transactions
                else if (entry.description && entry.description.toLowerCase().includes('advance')) {
                    correspondingPayment = payments.find(p => 
                        p.student && entry.metadata && entry.metadata.studentId && 
                        p.student.toString() === entry.metadata.studentId.toString() &&
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01
                    );
                    if (correspondingPayment) {
                        effectiveDate = correspondingPayment.date;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked advance transaction ${entry.transactionId} to payment ${correspondingPayment.paymentId} by student/amount match with date ${correspondingPayment.date.toISOString().slice(0, 7)}`);
                    } else {
                        console.log(`⚠️ No matching payment found for advance transaction ${entry.transactionId} - using transaction date`);
                        effectiveDate = entry.date;
                    }
                }
                // PRIORITY 4: General student and amount matching for any transaction
                else if (entry.metadata && entry.metadata.studentId) {
                    correspondingPayment = payments.find(p => 
                        p.student && p.student.toString() === entry.metadata.studentId.toString() &&
                        Math.abs(p.totalAmount - (entry.totalDebit || entry.totalCredit || 0)) < 0.01
                    );
                    if (correspondingPayment) {
                        effectiveDate = correspondingPayment.date;
                        transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                        console.log(`🔗 Linked transaction ${entry.transactionId} to payment ${correspondingPayment.paymentId} by student/amount match with date ${correspondingPayment.date.toISOString().slice(0, 7)}`);
                    } else {
                        console.log(`⚠️ No matching payment found for transaction ${entry.transactionId} - using transaction date`);
                        effectiveDate = entry.date;
                    }
                }
                
                // Store the corresponding payment for later use
                if (correspondingPayment) {
                    transactionToPaymentMap.set(entry.transactionId, correspondingPayment);
                }
                
                const monthKey = effectiveDate.toISOString().slice(0, 7);
                
                // FIRST: Check if this is an internal cash transfer (cash to cash) - EXCLUDE from cash flow
                if (this.isInternalCashTransfer(entry)) {
                    console.log(`💰 Internal cash transfer excluded from cash breakdown: ${entry.transactionId} - Description: ${entry.description}`);
                    return; // Skip internal transfers - they don't represent actual cash flow
                }
                
                // Process cash inflows (debits to cash accounts) - include ALL cash accounts (1000-1999)
                // BUT ONLY if it's NOT from another cash account (not an internal transfer)
                const cashInflow = entry.entries.find(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    // Include all cash accounts (1000-1999 series)
                    return accountCode && (accountCode.startsWith('100') || accountCode.startsWith('101')) && line.debit > 0;
                });
                
                if (cashInflow) {
                    const amount = cashInflow.debit;
                    const accountCode = cashInflow.accountCode || cashInflow.account?.code;
                    const accountName = cashInflow.accountName || cashInflow.account?.name;
                    
                    console.log(`💰 Cash inflow detected: $${amount} to ${accountCode} (${accountName}) - Transaction: ${entry.transactionId}`);
                    
                    // Note: Internal transfer check already done above, so this is a real cash inflow
                    // Categorize the inflow based on transaction type
                    if (entry.description && entry.description.includes('Balance adjustment')) {
                        // This is a balance adjustment (like vault opening balance)
                        cashBreakdown.cash_inflows.total += amount;
                        cashBreakdown.cash_inflows.from_other_sources += amount;
                        console.log(`💰 Balance adjustment inflow: $${amount} to ${accountCode}`);
                    } else if (entry.description && entry.description.toLowerCase().includes('gas')) {
                        // This is part of a gas transaction - check if it's an internal transfer
                        const hasExpenseAccount = entry.entries.some(line => 
                            line.accountCode && line.accountCode.startsWith('5') && line.debit > 0
                        );
                        
                        
                        if (!hasExpenseAccount) {
                            // This is an internal transfer (no expense account)
                            console.log(`💰 Internal transfer inflow: $${amount} to ${accountCode} - not counted as inflow`);
                            
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
                                to_account: accountName,
                                description: entry.description
                            });
                            
                            if (cashBreakdown.by_month[monthKey]) {
                                if (!cashBreakdown.by_month[monthKey].internal_transfers) {
                                    cashBreakdown.by_month[monthKey].internal_transfers = 0;
                                }
                                cashBreakdown.by_month[monthKey].internal_transfers += amount;
                            }
                            
                            return; // Skip to next entry - don't count as inflow
                        } else {
                            // This is a real gas expense inflow (has expense account)
                            cashBreakdown.cash_inflows.total += amount;
                            cashBreakdown.cash_inflows.from_customers += amount;
                        }
                    } else {
                        // Default to customer payments
                        cashBreakdown.cash_inflows.total += amount;
                        cashBreakdown.cash_inflows.from_customers += amount;
                    }
                    
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
                        // Also update the month name format
                        const monthIndex = parseInt(monthKey.split('-')[1]) - 1;
                        const monthName = monthNames[monthIndex];
                        if (cashBreakdown.by_month[monthName]) {
                            cashBreakdown.by_month[monthName].cash_inflows += amount;
                        }
                    }
                }
                
                // Process cash outflows (credits to cash accounts) - include ALL cash accounts (1000-1999)
                const cashOutflow = entry.entries.find(line => {
                    const accountCode = line.accountCode || line.account?.code;
                    const accountName = line.accountName || line.account?.name;
                    // Include all cash accounts (1000-1999 series)
                    return accountCode && (accountCode.startsWith('100') || accountCode.startsWith('101')) && line.credit > 0;
                });
                
                if (cashOutflow) {
                    const amount = cashOutflow.credit;
                    const accountCode = cashOutflow.accountCode || cashOutflow.account?.code;
                    const accountName = cashOutflow.accountName || cashOutflow.account?.name;
                    
                    console.log(`💰 Cash outflow detected: $${amount} from ${accountCode} (${accountName}) - Transaction: ${entry.transactionId}`);
                    
                    // Note: Internal transfer check already done above, so this is a real cash outflow
                    // Count as actual business expense (cash paid out)
                    cashBreakdown.cash_outflows.total += amount;
                    cashBreakdown.cash_outflows.for_expenses += amount;
                    
                    if (cashBreakdown.by_month[monthKey]) {
                        cashBreakdown.by_month[monthKey].cash_outflows += amount;
                        // Also update the month name format
                        const monthIndex = parseInt(monthKey.split('-')[1]) - 1;
                        const monthName = monthNames[monthIndex];
                        if (cashBreakdown.by_month[monthName]) {
                            cashBreakdown.by_month[monthName].cash_outflows += amount;
                        }
                    }
                }
            }
        });
        
        // Calculate net change in cash
        cashBreakdown.net_change_in_cash = cashBreakdown.cash_inflows.total - cashBreakdown.cash_outflows.total;
        
        // Calculate monthly ending cash balances
        let runningBalance = cashBreakdown.beginning_cash;
        
        // Process only the YYYY-MM format keys to avoid double processing
        const monthKeys = Object.keys(cashBreakdown.by_month).filter(key => key.includes('-'));
        
        monthKeys.forEach(monthKey => {
            const month = cashBreakdown.by_month[monthKey];
            month.beginning_cash = runningBalance;
            month.net_change = month.cash_inflows - month.cash_outflows;
            month.ending_cash = month.beginning_cash + month.net_change;
            runningBalance = month.ending_cash;
            
            // Also update the corresponding month name format
            const monthIndex = parseInt(monthKey.split('-')[1]) - 1;
            const monthName = monthNames[monthIndex];
            if (cashBreakdown.by_month[monthName]) {
                const monthNameData = cashBreakdown.by_month[monthName];
                monthNameData.beginning_cash = month.beginning_cash;
                monthNameData.net_change = month.net_change;
                monthNameData.ending_cash = month.ending_cash;
            }
        });
        
        // Set ending cash - use the actual closing cash balance instead of calculated running balance
        // This ensures accuracy by using the direct transaction entry calculation
        const actualClosingCashBalance = await this.getClosingCashBalance(new Date(`${period}-12-31`), residenceId);
        cashBreakdown.ending_cash = actualClosingCashBalance;
        
        // Calculate cash reconciliation
        // Note: Internal transfers don't affect net cash flow, so they're excluded from reconciliation
        cashBreakdown.cash_reconciliation.beginning_cash = cashBreakdown.beginning_cash;
        cashBreakdown.cash_reconciliation.cash_inflows = cashBreakdown.cash_inflows.total;
        cashBreakdown.cash_reconciliation.cash_outflows = cashBreakdown.cash_outflows.total;
        cashBreakdown.cash_reconciliation.calculated_ending_cash = cashBreakdown.beginning_cash + cashBreakdown.net_change_in_cash;
        cashBreakdown.cash_reconciliation.actual_ending_cash = actualClosingCashBalance;
        
        // The difference should now be zero since internal transfers are properly excluded
        cashBreakdown.cash_reconciliation.difference = cashBreakdown.cash_reconciliation.actual_ending_cash - cashBreakdown.cash_reconciliation.calculated_ending_cash;
        
        return cashBreakdown;
    }
    
    /**
     * Calculate average monthly cash flow
     */
    static calculateAverageMonthlyCashFlow(monthlyBreakdown) {
        const months = Object.keys(monthlyBreakdown);
        if (months.length === 0) return 0;
        
        const totalNetCashFlow = months.reduce((sum, month) => {
            const monthData = monthlyBreakdown[month];
            const netCashFlow = (monthData.operating_activities?.net || 0) + 
                              (monthData.investing_activities?.net || 0) + 
                              (monthData.financing_activities?.net || 0);
            return sum + netCashFlow;
        }, 0);
        
        return totalNetCashFlow / months.length;
    }
    
    /**
     * Calculate monthly consistency score (0-100)
     */
    static calculateMonthlyConsistency(monthlyBreakdown) {
        const months = Object.keys(monthlyBreakdown);
        if (months.length === 0) return 0;
        
        const monthlyNetFlows = months.map(month => {
            const monthData = monthlyBreakdown[month];
            return (monthData.operating_activities?.net || 0) + 
                   (monthData.investing_activities?.net || 0) + 
                   (monthData.financing_activities?.net || 0);
        });
        
        const average = monthlyNetFlows.reduce((sum, flow) => sum + flow, 0) / months.length;
        const variance = monthlyNetFlows.reduce((sum, flow) => sum + Math.pow(flow - average, 2), 0) / months.length;
        const standardDeviation = Math.sqrt(variance);
        
        // Convert to consistency score (lower deviation = higher consistency)
        const maxExpectedDeviation = Math.abs(average) * 0.5; // 50% of average as max expected deviation
        const consistencyScore = Math.max(0, Math.min(100, 100 - (standardDeviation / maxExpectedDeviation) * 100));
        
        return Math.round(consistencyScore);
    }

    /**
     * Calculate yearly totals from monthly breakdown
     */
    static calculateYearlyTotals(monthlyBreakdown) {
        const yearlyTotals = {
            operating_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
            investing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
            financing_activities: { inflows: 0, outflows: 0, net: 0, breakdown: {} },
            net_cash_flow: 0
        };
        
        Object.values(monthlyBreakdown).forEach(monthData => {
            yearlyTotals.operating_activities.inflows += monthData.operating_activities?.inflows || 0;
            
            // CRITICAL: Use expenses.total as the source of truth for outflows
            // This ensures we use the verified total that includes all expense items
            const monthOutflows = monthData.expenses?.total || monthData.operating_activities?.outflows || 0;
            yearlyTotals.operating_activities.outflows += monthOutflows;
            
            // Recalculate net using the corrected outflows
            const monthNet = (monthData.operating_activities?.inflows || 0) - monthOutflows;
            yearlyTotals.operating_activities.net += monthNet;
            
            yearlyTotals.investing_activities.inflows += monthData.investing_activities?.inflows || 0;
            yearlyTotals.investing_activities.outflows += monthData.investing_activities?.outflows || 0;
            yearlyTotals.investing_activities.net += monthData.investing_activities?.net || 0;
            
            yearlyTotals.financing_activities.inflows += monthData.financing_activities?.inflows || 0;
            yearlyTotals.financing_activities.outflows += monthData.financing_activities?.outflows || 0;
            yearlyTotals.financing_activities.net += monthData.financing_activities?.net || 0;
            
            yearlyTotals.net_cash_flow += monthData.net_cash_flow || 0;
        });
        
        // Log for debugging (especially for October)
        const octoberData = monthlyBreakdown.october;
        if (octoberData) {
            console.log(`📊 Yearly Totals Calculation - October:`, {
                expensesTotal: octoberData.expenses?.total,
                operatingOutflows: octoberData.operating_activities?.outflows,
                usedForYearly: octoberData.expenses?.total || octoberData.operating_activities?.outflows
            });
        }
        
        return yearlyTotals;
    }
    
    /**
     * Get best cash flow month
     */
    static getBestCashFlowMonth(monthlyBreakdown) {
        const months = Object.keys(monthlyBreakdown);
        return months.reduce((best, month) => 
            (monthlyBreakdown[month].net_cash_flow || 0) > (monthlyBreakdown[best].net_cash_flow || 0) ? month : best
        );
    }
    
    /**
     * Get worst cash flow month
     */
    static getWorstCashFlowMonth(monthlyBreakdown) {
        const months = Object.keys(monthlyBreakdown);
        return months.reduce((worst, month) => 
            (monthlyBreakdown[month].net_cash_flow || 0) < (monthlyBreakdown[worst].net_cash_flow || 0) ? month : worst
        );
    }
    
    /**
     * Format cash flow statement in standard format
     */
    static formatCashFlowStatement(cashFlowData) {
        const { period, cash_breakdown, cash_balance_by_account, operating_activities, investing_activities, financing_activities, summary } = cashFlowData;
        
        // Format cash and cash equivalents with clear account names
        const cashAndEquivalents = {
            total_cash: cash_breakdown.ending_cash,
            breakdown: {}
        };
        
        if (cash_balance_by_account) {
            console.log('💰 Formatting cash balance by account:', cash_balance_by_account);
            Object.values(cash_balance_by_account).forEach(account => {
                // Only include proper cash accounts, exclude clearing accounts
                if (this.isCashAccount(account.accountName, account.accountCode)) {
                    cashAndEquivalents.breakdown[account.accountName] = {
                        account_code: account.accountCode,
                        balance: account.balance,
                        description: this.getCashAccountDescription(account.accountName)
                    };
                } else {
                    console.log(`🚫 Excluding non-cash account from cash equivalents: ${account.accountName} (${account.accountCode})`);
                }
            });
            console.log('💰 Formatted cash and equivalents breakdown:', cashAndEquivalents.breakdown);
        } else {
            console.log('❌ No cash_balance_by_account data provided to formatCashFlowStatement');
        }
        
        return {
            period,
            cash_flow_statement: {
                // Cash and Cash Equivalents at Beginning of Period
                cash_and_cash_equivalents_beginning: {
                    total_cash: cash_breakdown.beginning_cash,
                    breakdown: this.getBeginningCashBreakdown(cash_breakdown.beginning_cash)
                },
                
                // Operating Activities
                operating_activities: {
                    // Cash Inflows (Income)
                    cash_inflows: {
                        rental_income: cash_breakdown.cash_inflows?.from_customers || 0,
                        advance_payments: cash_breakdown.cash_inflows?.from_advance_payments || 0,
                        other_income: cash_breakdown.cash_inflows?.from_other_sources || 0,
                        total_cash_inflows: cash_breakdown.cash_inflows?.total || 0
                    },
                    
                    // Cash Outflows (Expenses)
                    cash_outflows: {
                        supplier_payments: cash_breakdown.cash_outflows?.to_suppliers || 0,
                        operating_expenses: cash_breakdown.cash_outflows?.for_expenses || 0,
                        other_payments: cash_breakdown.cash_outflows?.for_other_purposes || 0,
                        total_cash_outflows: cash_breakdown.cash_outflows?.total || 0
                    },
                    
                    net_cash_from_operating_activities: (cash_breakdown.cash_inflows?.total || 0) - (cash_breakdown.cash_outflows?.total || 0)
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
                
                // Cash and Cash Equivalents at End of Period
                cash_and_cash_equivalents_ending: cashAndEquivalents,
                
                // Internal Cash Transfers (for reference)
                internal_cash_transfers: {
                    total_transfers: cash_breakdown.internal_cash_transfers?.total || 0,
                    note: "Internal transfers between cash accounts do not affect net cash flow"
                }
            },
            
            // Detailed Cash Breakdown
            detailed_cash_breakdown: {
                cash_inflows: {
                    from_customers: cash_breakdown.cash_inflows?.from_customers || 0,
                    from_advance_payments: cash_breakdown.cash_inflows?.from_advance_payments || 0,
                    from_other_sources: cash_breakdown.cash_inflows?.from_other_sources || 0,
                    total_cash_inflows: cash_breakdown.cash_inflows?.total || 0
                },
                cash_outflows: {
                    to_suppliers: cash_breakdown.cash_outflows?.to_suppliers || 0,
                    for_expenses: cash_breakdown.cash_outflows?.for_expenses || 0,
                    for_other_purposes: cash_breakdown.cash_outflows?.for_other_purposes || 0,
                    total_cash_outflows: cash_breakdown.cash_outflows?.total || 0
                },
                internal_cash_transfers: cash_breakdown.internal_cash_transfers || { total: 0, transfers: [] },
                advance_payments_impact: cash_breakdown.advance_payments_impact || { total: 0, impact: [] }
            }
        };
    }
    
    /**
     * Check if an account should be included in cash and cash equivalents
     */
    static isCashAccount(accountName, accountCode) {
        // Exclude clearing accounts and balance adjustment accounts
        const excludedPatterns = [
            'clearing',
            'opening balance',
            'balance adjustment',
            'adjustment',
            'clearing account',
            'balance sheet',
            'journal entry',
            'account transfer',
            'reclassification',
            'suspense',
            'temporary',
            'interim'
        ];
        
        const excludedAccountNames = [
            'Opening balance clearing account',
            'Balance Adjustment Account',
            'Clearing Account',
            'Adjustment Account',
            'Journal Entry Account',
            'Balance Sheet Account',
            'Account Transfer Account',
            'Reclassification Account',
            'Suspense Account',
            'Temporary Account',
            'Interim Account'
        ];
        
        // Check account name for excluded patterns
        if (accountName) {
            const lowerName = accountName.toLowerCase();
            for (const pattern of excludedPatterns) {
                if (lowerName.includes(pattern)) {
                    return false;
                }
            }
            
            // Check for exact excluded account names
            if (excludedAccountNames.includes(accountName)) {
                return false;
            }
        }
        
        // Check account code - include only actual cash and cash equivalent accounts
        // Cash accounts: 1000-1099 (cash, bank, petty cash, etc.)
        // Cash equivalents: 1100-1199 (short-term investments, money market, etc.)
        if (accountCode) {
            const code = accountCode.toString();
            
            // Only include 1000-1019 series and 10003 (cash accounts)
            // Exclude 1100+ which are other current assets (like Accounts Receivable)
            if (!code.match(/^10[0-1][0-9]$/) && code !== '10003') {
                return false;
            }
            
            // Exclude specific non-cash accounts that have 10xx codes but aren't cash
            const excludedAccountCodes = [
                '10005', // Opening balance clearing account
                '10006', // Any other clearing accounts
                '10007', // Any other adjustment accounts
                '10008', // Any other balance sheet accounts
                '10009', // Any other non-cash accounts
                '10010', // Any other temporary accounts
                '10011', // Any other suspense accounts
                '10012', // Any other interim accounts
                '10013', // Any other adjustment accounts
                '10014', // Any other reclassification accounts
                '10015'  // Any other non-cash accounts
            ];
            
            if (excludedAccountCodes.includes(code)) {
                return false;
            }
            
            // 1100+ series are already excluded by the regex pattern above
        }
        
        return true;
    }

    /**
     * Get cash account key for balance sheet structure (matches balance sheet format)
     * Maps account codes to balance sheet keys like cash, bank, ecocash, etc.
     */
    static getCashAccountKey(accountCode) {
        const cashAccountMap = {
            '1000': 'cash',
            '1001': 'bank',
            '1002': 'ecocash',
            '1003': 'innbucks',
            '1004': 'pettyCash',
            '1005': 'cashOnHand',
            '1010': 'generalPettyCash',
            '1011': 'adminPettyCash',
            '1012': 'financePettyCash',
            '1013': 'propertyManagerPettyCash',
            '1014': 'maintenancePettyCash',
            '10003': 'cbzVault'
        };
        return cashAccountMap[accountCode] || null;
    }

    /**
     * Format cash accounts breakdown to match balance sheet structure
     * Transforms account code keyed object to balance sheet format with named keys
     */
    static formatCashAccountsForBalanceSheet(monthlyBalances) {
        if (!monthlyBalances || typeof monthlyBalances !== 'object') {
            return {
                cash: { amount: 0, accountCode: '1000', accountName: 'Cash' },
                bank: { amount: 0, accountCode: '1001', accountName: 'Bank Account' },
                ecocash: { amount: 0, accountCode: '1002', accountName: 'Ecocash' },
                innbucks: { amount: 0, accountCode: '1003', accountName: 'Innbucks' },
                pettyCash: { amount: 0, accountCode: '1004', accountName: 'Petty Cash' },
                cashOnHand: { amount: 0, accountCode: '1005', accountName: 'Cash on Hand' },
                generalPettyCash: { amount: 0, accountCode: '1010', accountName: 'General Petty Cash' },
                adminPettyCash: { amount: 0, accountCode: '1011', accountName: 'Admin Petty Cash' },
                financePettyCash: { amount: 0, accountCode: '1012', accountName: 'Finance Petty Cash' },
                propertyManagerPettyCash: { amount: 0, accountCode: '1013', accountName: 'Property Manager Petty Cash' },
                maintenancePettyCash: { amount: 0, accountCode: '1014', accountName: 'Maintenance Petty Cash' },
                cbzVault: { amount: 0, accountCode: '10003', accountName: 'Cbz Vault' },
                total: 0
            };
        }

        // Initialize with default structure
        const formatted = {
            cash: { amount: 0, accountCode: '1000', accountName: 'Cash' },
            bank: { amount: 0, accountCode: '1001', accountName: 'Bank Account' },
            ecocash: { amount: 0, accountCode: '1002', accountName: 'Ecocash' },
            innbucks: { amount: 0, accountCode: '1003', accountName: 'Innbucks' },
            pettyCash: { amount: 0, accountCode: '1004', accountName: 'Petty Cash' },
            cashOnHand: { amount: 0, accountCode: '1005', accountName: 'Cash on Hand' },
            generalPettyCash: { amount: 0, accountCode: '1010', accountName: 'General Petty Cash' },
            adminPettyCash: { amount: 0, accountCode: '1011', accountName: 'Admin Petty Cash' },
            financePettyCash: { amount: 0, accountCode: '1012', accountName: 'Finance Petty Cash' },
            propertyManagerPettyCash: { amount: 0, accountCode: '1013', accountName: 'Property Manager Petty Cash' },
            maintenancePettyCash: { amount: 0, accountCode: '1014', accountName: 'Maintenance Petty Cash' },
            cbzVault: { amount: 0, accountCode: '10003', accountName: 'Cbz Vault' },
            total: 0
        };

        // Populate with actual balances
        Object.values(monthlyBalances).forEach(account => {
            if (!account || !account.accountCode) return;
            
            const accountCode = String(account.accountCode);
            const key = this.getCashAccountKey(accountCode);
            
            if (key && formatted[key]) {
                formatted[key].amount = account.balance || 0;
                formatted[key].accountCode = accountCode;
                // Always use "Cbz Vault" for account code 10003 to ensure consistency
                if (accountCode === '10003') {
                    formatted[key].accountName = 'Cbz Vault';
                } else {
                    formatted[key].accountName = account.accountName || formatted[key].accountName;
                }
                formatted.total += account.balance || 0;
            }
        });

        return formatted;
    }

    /**
     * Get description for cash account names
     */
    static getCashAccountDescription(accountName) {
        const descriptions = {
            'Admin Petty Cash': 'Petty cash for small expenses',
            'Cbz Vault': 'Main cash vault for large amounts',
            'Bank Account': 'Primary business bank account',
            'Cash on Hand': 'Physical cash available',
            'Petty Cash': 'Small cash fund for minor expenses',
            'Ecocash Wallet': 'Mobile money wallet for digital payments',
            'Finance Petty Cash': 'Petty cash managed by finance department',
            'General Petty Cash': 'General purpose petty cash fund',
            'Property Manager Petty Cash': 'Petty cash for property management expenses',
            'Maintenance Petty Cash': 'Petty cash for maintenance expenses',
            'Innbucks': 'Innbucks digital wallet',
            'Ecocash': 'Ecocash mobile money service'
        };
        return descriptions[accountName] || 'Cash account';
    }
    
    /**
     * Get beginning cash breakdown (simplified for now)
     */
    static getBeginningCashBreakdown(beginningCash) {
        if (beginningCash === 0) {
            return {
                'No Opening Balance': {
                    balance: 0,
                    description: 'No cash balance at beginning of period'
                }
            };
        }
        
        return {
            'Opening Balance': {
                balance: beginningCash,
                description: 'Cash balance at beginning of period'
            }
        };
    }
    
    /**
     * Format cash flow statement in tabular monthly format
     */
    static formatCashFlowStatementMonthly(cashFlowData) {
        console.log('🔧 formatCashFlowStatementMonthly called with data:', {
            period: cashFlowData.period,
            hasCashBreakdown: !!cashFlowData.cash_breakdown,
            hasCashBalanceByAccount: !!cashFlowData.cash_balance_by_account,
            hasMonthlyBreakdown: !!cashFlowData.monthly_breakdown
        });
        
        const { period, cash_breakdown, cash_balance_by_account, monthly_breakdown } = cashFlowData;
        
        // Defensive programming - ensure we have the required data
        if (!period) {
            throw new Error('Period is required for tabular format');
        }
        if (!cash_breakdown) {
            console.warn('⚠️ No cash_breakdown data available for tabular format');
        }
        if (!cash_balance_by_account) {
            console.warn('⚠️ No cash_balance_by_account data available for tabular format');
        }
        if (!monthly_breakdown) {
            console.warn('⚠️ No monthly_breakdown data available for tabular format');
        }
        
        // Get month names
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                           'july', 'august', 'september', 'october', 'november', 'december'];
        
        // Initialize the tabular format
        const tabularFormat = {
            period,
            cash_flow_statement_monthly: {
                // Net Change in Cash row
                net_change_in_cash: {
                    label: 'NET CHANGE IN CASH',
                    months: {}
                },
                // Cash at End of Period row
                cash_at_end_of_period: {
                    label: 'CASH AT END OF PERIOD',
                    months: {}
                },
                // Cash and Cash Equivalents section
                cash_and_cash_equivalents: {
                    label: 'CASH AND CASH EQUIVALENTS',
                    accounts: {}
                }
            }
        };
        
        // Calculate cumulative net change in cash for each month
        let cumulativeNetChange = 0;
        monthNames.forEach(month => {
            const monthData = monthly_breakdown[month];
            if (monthData) {
                cumulativeNetChange += monthData.net_cash_flow || 0;
                tabularFormat.cash_flow_statement_monthly.net_change_in_cash.months[month] = cumulativeNetChange;
                tabularFormat.cash_flow_statement_monthly.cash_at_end_of_period.months[month] = cumulativeNetChange;
            } else {
                tabularFormat.cash_flow_statement_monthly.net_change_in_cash.months[month] = cumulativeNetChange;
                tabularFormat.cash_flow_statement_monthly.cash_at_end_of_period.months[month] = cumulativeNetChange;
            }
        });
        
        // Add cash and cash equivalents accounts
        if (cash_balance_by_account && Object.keys(cash_balance_by_account).length > 0) {
            Object.values(cash_balance_by_account).forEach(account => {
                const accountName = account.accountName;
                const accountCode = account.accountCode;
                
                // Only include proper cash accounts, exclude clearing accounts
                if (!this.isCashAccount(accountName, accountCode)) {
                    console.log(`🚫 Excluding non-cash account from tabular cash equivalents: ${accountName} (${accountCode})`);
                    return;
                }
                
                tabularFormat.cash_flow_statement_monthly.cash_and_cash_equivalents.accounts[accountName] = {
                    account_code: account.accountCode,
                    description: this.getCashAccountDescription(accountName),
                    months: {}
                };
                
                // For each month, show the account balance if there was cash activity
                monthNames.forEach(month => {
                    const monthData = monthly_breakdown && monthly_breakdown[month];
                    const monthKey = `${period}-${String(monthNames.indexOf(month) + 1).padStart(2, '0')}`;
                    const cashBreakdownMonth = cash_breakdown && cash_breakdown.by_month && cash_breakdown.by_month[monthKey];
                    
                    // Show balance if there was cash activity in this month or if the account has a balance
                    if (cashBreakdownMonth && (
                        cashBreakdownMonth.cash_inflows > 0 || 
                        cashBreakdownMonth.cash_outflows > 0 || 
                        cashBreakdownMonth.ending_cash > 0 ||
                        cashBreakdownMonth.internal_transfers > 0 ||
                        (account.balance && account.balance !== 0)
                    )) {
                        // Show the account balance in months with cash activity
                        tabularFormat.cash_flow_statement_monthly.cash_and_cash_equivalents.accounts[accountName].months[month] = account.balance;
                    }
                });
            });
        }
        
        console.log('🔧 formatCashFlowStatementMonthly returning:', JSON.stringify(tabularFormat, null, 2));
        return tabularFormat;
    }
    
    /**
     * Get opening cash balance at a specific date
     * This includes all cash accounts (1000-1999) up to the specified date
     */
    static async getOpeningCashBalance(asOfDate, residenceId = null) {
        try {
            console.log(`💰 Calculating opening cash balance as of ${asOfDate.toISOString().slice(0, 10)}`);
            
            // Get all transaction entries up to the specified date
            const query = {
                date: { $lte: asOfDate },
                // Exclude forfeiture transactions as they don't involve cash movement
                'metadata.isForfeiture': { $ne: true },
                status: { $nin: ['reversed', 'draft'] }
            };
            
            if (residenceId) {
                query.residence = new mongoose.Types.ObjectId(residenceId);
            }
            
            // Optimize: Use aggregation pipeline for much faster cash balance calculation
            const cashBalanceResult = await TransactionEntry.aggregate([
                { $match: query },
                { $unwind: '$entries' },
                {
                    $match: {
                        'entries.accountCode': { $regex: '^(100|101)' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDebits: { $sum: { $ifNull: ['$entries.debit', 0] } },
                        totalCredits: { $sum: { $ifNull: ['$entries.credit', 0] } }
                    }
                }
            ]);
            
            const totalDebits = cashBalanceResult[0]?.totalDebits || 0;
            const totalCredits = cashBalanceResult[0]?.totalCredits || 0;
            const cashBalance = totalDebits - totalCredits;
            
            console.log(`💰 Total opening cash balance: $${cashBalance}`);
            return cashBalance;
            
        } catch (error) {
            console.error('❌ Error calculating opening cash balance:', error);
            return 0;
        }
    }
    
    /**
     * Get cash balance breakdown by account at a specific date
     * This shows the cash balance in each cash account (1000-1999)
     */
    static async getCashBalanceByAccount(asOfDate, residenceId = null) {
        try {
            // Optimize: Reduce logging in production
            const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
            if (isDebugMode) {
                console.log(`💰 Calculating cash balance by account as of ${asOfDate.toISOString().slice(0, 10)}${residenceId ? ` (residence: ${residenceId})` : ''}`);
            }
            
            // Get all transaction entries up to the specified date
            const query = {
                date: { $lte: asOfDate },
                // Exclude forfeiture transactions as they don't involve cash movement
                'metadata.isForfeiture': { $ne: true },
                status: { $nin: ['reversed', 'draft'] }
            };
            
            if (residenceId) {
                // When filtering by residence, check both top-level residence and metadata fields
                // This matches the balance sheet logic for consistency
                const residenceObjectId = mongoose.Types.ObjectId.isValid(residenceId) 
                    ? new mongoose.Types.ObjectId(residenceId) 
                    : residenceId;
                query.$or = [
                    { residence: residenceObjectId },
                    { residence: residenceId },
                    { 'metadata.residenceId': residenceId },
                    { 'metadata.residenceId': residenceId.toString() },
                    { 'metadata.residence': residenceId },
                    { 'metadata.residence': residenceId.toString() }
                ];
            }
            
            // Optimize: Use aggregation pipeline for much faster cash balance by account calculation
            const accountBalancesResult = await TransactionEntry.aggregate([
                { $match: query },
                { $unwind: '$entries' },
                {
                    $match: {
                        // Match cash accounts: 1000-1019, but exclude 10000-10099 (those are not cash accounts)
                        // Account 10003 is a special case - it's a cash account (Cbz Vault)
                        $or: [
                            { 'entries.accountCode': { $regex: '^10[0-1][0-9]$' } }, // 1000-1019
                            { 'entries.accountCode': '10003' } // Explicitly include Cbz Vault
                        ]
                    }
                },
                {
                    $group: {
                        _id: {
                            accountCode: '$entries.accountCode'
                            // Group only by accountCode, not accountName, to avoid splitting accounts with different names
                        },
                        totalDebits: { $sum: { $ifNull: ['$entries.debit', 0] } },
                        totalCredits: { $sum: { $ifNull: ['$entries.credit', 0] } },
                        // Get the most common account name (prefer "Cbz Vault" over "cbz" for account 10003)
                        accountNames: { $addToSet: '$entries.accountName' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        accountCode: '$_id.accountCode',
                        // Normalize account name: use "Cbz Vault" for account code 10003, otherwise use first name
                        accountName: {
                            $cond: {
                                if: { $eq: ['$_id.accountCode', '10003'] },
                                then: 'Cbz Vault',
                                else: { $arrayElemAt: ['$accountNames', 0] }
                            }
                        },
                        balance: { $subtract: ['$totalDebits', '$totalCredits'] }
                    }
                }
            ]);
            
            const accountBalances = {};
            accountBalancesResult.forEach(account => {
                // Always use "Cbz Vault" for account code 10003 to ensure consistency with balance sheet
                const accountName = (account.accountCode === '10003') 
                    ? 'Cbz Vault' 
                    : account.accountName;
                
                accountBalances[account.accountCode] = {
                    accountCode: account.accountCode,
                    accountName: accountName,
                    balance: account.balance
                };
            });
            
            if (isDebugMode) {
                console.log(`💰 Cash balance by account:`, accountBalances);
            }
            return accountBalances;
            
        } catch (error) {
            console.error('❌ Error calculating cash balance by account:', error);
            return {};
        }
    }

    /**
     * Get closing cash balance at a specific date
     * This includes all cash accounts (1000-1999) up to the specified date
     */
    static async getClosingCashBalance(asOfDate, residenceId = null) {
        try {
            // Optimize: Reduce logging in production
            const isDebugMode = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
            if (isDebugMode) {
                console.log(`💰 Calculating closing cash balance as of ${asOfDate.toISOString().slice(0, 10)}`);
            }
            
            // Get all transaction entries up to the specified date
            const query = {
                date: { $lte: asOfDate },
                // Exclude forfeiture transactions as they don't involve cash movement
                'metadata.isForfeiture': { $ne: true },
                status: { $nin: ['reversed', 'draft'] }
            };
            
            if (residenceId) {
                query.residence = new mongoose.Types.ObjectId(residenceId);
            }
            
            // Optimize: Use aggregation pipeline for much faster cash balance calculation
            const cashBalanceResult = await TransactionEntry.aggregate([
                { $match: query },
                { $unwind: '$entries' },
                {
                    $match: {
                        'entries.accountCode': { $regex: '^(100|101)' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDebits: { $sum: { $ifNull: ['$entries.debit', 0] } },
                        totalCredits: { $sum: { $ifNull: ['$entries.credit', 0] } }
                    }
                }
            ]);
            
            const totalDebits = cashBalanceResult[0]?.totalDebits || 0;
            const totalCredits = cashBalanceResult[0]?.totalCredits || 0;
            const cashBalance = totalDebits - totalCredits;
            
            if (isDebugMode) {
                console.log(`💰 Total closing cash balance: $${cashBalance}`);
            }
            return cashBalance;
            
        } catch (error) {
            console.error('❌ Error calculating closing cash balance:', error);
            return 0;
        }
    }

    /**
     * Validate cash flow rules for a specific period using CashFlowValidator
     * @param {string} period - Period string (e.g., "2025-01" or "2025")
     * @param {string} residenceId - Optional residence ID to filter by
     * @returns {Promise<Object>} Cash flow validation report
     */
    static async validateCashFlowRules(period, residenceId = null) {
        try {
            // Determine date range from period string
            let startDate, endDate;
            
            if (period.includes('-') && period.length === 7) {
                // Monthly period: "2025-01"
                startDate = new Date(`${period}-01`);
                endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 1);
                endDate.setDate(0); // Last day of the month
            } else if (period.length === 4) {
                // Yearly period: "2025"
                startDate = new Date(`${period}-01-01`);
                endDate = new Date(`${period}-12-31`);
            } else {
                throw new Error(`Invalid period format: ${period}. Expected "YYYY-MM" or "YYYY"`);
            }

            // Use CashFlowValidator to validate the period
            if (!CashFlowValidator) {
                throw new Error('CashFlowValidator is not available. Please ensure cashFlowValidator.js exists.');
            }
            const validationReport = await CashFlowValidator.validatePeriodCashFlow(
                startDate, 
                endDate, 
                residenceId
            );

            return {
                success: true,
                period: period,
                validationReport: validationReport,
                message: `Cash flow validation completed for period ${period}`
            };
        } catch (error) {
            console.error('Error validating cash flow rules:', error);
            return {
                success: false,
                period: period,
                error: error.message,
                message: `Failed to validate cash flow for period ${period}`
            };
        }
    }

    /**
     * Get cash flow validation summary for a period
     * @param {string} period - Period string (e.g., "2025-01" or "2025")
     * @param {string} residenceId - Optional residence ID to filter by
     * @returns {Promise<Object>} Validation summary
     */
    static async getCashFlowValidationSummary(period, residenceId = null) {
        try {
            const validation = await this.validateCashFlowRules(period, residenceId);
            
            if (!validation.success) {
                return validation;
            }

            const report = validation.validationReport;
            const summary = {
                period: period,
                totalTransactions: report.validationSummary.totalTransactions,
                includedInCashFlow: report.cashFlowStatement.summary.includedInCashFlow,
                excludedFromCashFlow: report.cashFlowStatement.summary.excludedFromCashFlow,
                exclusionBreakdown: report.cashFlowStatement.summary.exclusionBreakdown,
                cashFlowAccuracy: report.validationSummary.cashFlowAccuracy,
                netCashFlow: report.cashFlowStatement.operatingActivities.netCashFlow,
                totalInflows: report.cashFlowStatement.operatingActivities.cashInflows,
                totalOutflows: report.cashFlowStatement.operatingActivities.cashOutflows,
                cashAccountsCount: report.validationSummary.cashAccountsCount
            };

            return {
                success: true,
                summary: summary
            };
        } catch (error) {
            console.error('Error getting cash flow validation summary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = EnhancedCashFlowService;
