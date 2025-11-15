const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');

/**
 * Cash Flow Validator Service
 * 
 * Enforces proper cash flow accounting rules:
 * - Identifies cash accounts by code patterns (1000-1099)
 * - Validates cash inflows (debits to cash accounts)
 * - Validates cash outflows (credits to cash accounts)
 * - Excludes non-cash transactions (accruals, internal transfers, adjustments)
 * - Ensures double-entry accounting principles for cash flow
 */
class CashFlowValidator {
    
    /**
     * Cash account identification patterns
     */
    static get CASH_ACCOUNT_PATTERNS() {
        return {
            // Primary cash accounts (1000-1099 series)
            CASH_ACCOUNTS: /^(100|101)\d*$/,
            
            // Specific cash account codes
            SPECIFIC_ACCOUNTS: {
                '1000': 'Cash / Bank Account',
                '1001': 'Bank Account', 
                '1002': 'Ecocash',
                '1003': 'Innbucks',
                '1004': 'Petty Cash',
                '1005': 'Cash on Hand',
                '1010': 'Admin Petty Cash',
                '1011': 'Finance Petty Cash',
                '1012': 'Property Manager Petty Cash',
                '1013': 'Maintenance Petty Cash',
                '1014': 'General Petty Cash'
            },
            
            // Excluded accounts (not cash flow)
            EXCLUDED_ACCOUNTS: {
                // Accounts Receivable (1100+ series)
                ACCOUNTS_RECEIVABLE: /^11\d{2,}$/,
                // Income accounts (4000 series) - only count when cash received
                INCOME_ACCOUNTS: /^4\d{3,}$/,
                // Expense accounts (5000 series) - only count when cash paid
                EXPENSE_ACCOUNTS: /^5\d{3,}$/,
                // Clearing/Adjustment accounts
                CLEARING_ACCOUNTS: /^(10005|10006|10007|10008|10009|10010|10011|10012|10013|10014|10015)$/,
                // Liability accounts (2000 series) - deposits, etc.
                LIABILITY_ACCOUNTS: /^2\d{3,}$/
            }
        };
    }

    /**
     * Check if an account is a cash account
     * @param {string|number} accountCode - The account code to check
     * @param {string} accountName - The account name (optional)
     * @returns {boolean} True if it's a cash account
     */
    static isCashAccount(accountCode, accountName = '') {
        if (!accountCode) return false;
        
        const code = accountCode.toString().trim();
        const name = accountName.toString().toLowerCase();
        
        // Check specific cash account codes first
        if (this.CASH_ACCOUNT_PATTERNS.SPECIFIC_ACCOUNTS[code]) {
            return true;
        }
        
        // Check cash account pattern (1000-1099)
        if (this.CASH_ACCOUNT_PATTERNS.CASH_ACCOUNTS.test(code)) {
            // Double-check it's not an excluded clearing account
            if (!this.CASH_ACCOUNT_PATTERNS.EXCLUDED_ACCOUNTS.CLEARING_ACCOUNTS.test(code)) {
                return true;
            }
        }
        
        // Check by account name as fallback
        const cashKeywords = ['cash', 'bank', 'petty cash', 'ecocash', 'innbucks', 'wallet'];
        if (cashKeywords.some(keyword => name.includes(keyword))) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if a transaction is a cash inflow
     * @param {Object} transaction - Transaction entry object
     * @returns {Object} {isCashInflow: boolean, amount: number, cashAccount: string}
     */
    static identifyCashInflow(transaction) {
        if (!transaction.entries || !Array.isArray(transaction.entries)) {
            return { isCashInflow: false, amount: 0, cashAccount: null };
        }

        let cashInflowAmount = 0;
        let cashAccount = null;
        
        // Cash inflow: Debit to cash account (money coming in)
        for (const entry of transaction.entries) {
            const accountCode = entry.accountCode || entry.account?.code;
            const accountName = entry.accountName || entry.account?.name;
            
            if (this.isCashAccount(accountCode, accountName) && entry.debit > 0) {
                cashInflowAmount += entry.debit;
                cashAccount = accountCode;
                
                console.log(`💰 Cash inflow detected: $${entry.debit} to ${accountCode} (${accountName})`);
            }
        }

        return {
            isCashInflow: cashInflowAmount > 0,
            amount: cashInflowAmount,
            cashAccount: cashAccount,
            description: transaction.description || 'Cash Receipt'
        };
    }

    /**
     * Check if a transaction is a cash outflow
     * @param {Object} transaction - Transaction entry object
     * @returns {Object} {isCashOutflow: boolean, amount: number, cashAccount: string}
     */
    static identifyCashOutflow(transaction) {
        if (!transaction.entries || !Array.isArray(transaction.entries)) {
            return { isCashOutflow: false, amount: 0, cashAccount: null };
        }

        let cashOutflowAmount = 0;
        let cashAccount = null;
        
        // Cash outflow: Credit to cash account (money going out)
        for (const entry of transaction.entries) {
            const accountCode = entry.accountCode || entry.account?.code;
            const accountName = entry.accountName || entry.account?.name;
            
            if (this.isCashAccount(accountCode, accountName) && entry.credit > 0) {
                cashOutflowAmount += entry.credit;
                cashAccount = accountCode;
                
                console.log(`💰 Cash outflow detected: $${entry.credit} from ${accountCode} (${accountName})`);
            }
        }

        return {
            isCashOutflow: cashOutflowAmount > 0,
            amount: cashOutflowAmount,
            cashAccount: cashAccount,
            description: transaction.description || 'Cash Payment'
        };
    }

    /**
     * Check if transaction should be excluded from cash flow
     * @param {Object} transaction - Transaction entry object
     * @returns {Object} {isExcluded: boolean, reason: string, details: Object}
     */
    static shouldExcludeFromCashFlow(transaction) {
        // Check for balance sheet adjustments
        if (this.isBalanceSheetAdjustment(transaction)) {
            return {
                isExcluded: true,
                reason: 'Balance sheet adjustment',
                details: { type: 'adjustment', transactionId: transaction.transactionId }
            };
        }

        // Check for internal transfers between cash accounts
        if (this.isInternalCashTransfer(transaction)) {
            return {
                isExcluded: true,
                reason: 'Internal cash transfer',
                details: { type: 'internal_transfer', transactionId: transaction.transactionId }
            };
        }

        // Check for accruals without cash movement
        if (this.isAccrualWithoutCash(transaction)) {
            return {
                isExcluded: true,
                reason: 'Accrual without cash movement',
                details: { type: 'accrual', transactionId: transaction.transactionId }
            };
        }

        // Check for late payment fees
        if (this.isLatePaymentFee(transaction)) {
            return {
                isExcluded: true,
                reason: 'Late payment fee (non-cash adjustment)',
                details: { type: 'late_fee', transactionId: transaction.transactionId }
            };
        }

        return {
            isExcluded: false,
            reason: null,
            details: null
        };
    }

    /**
     * Check if transaction is a balance sheet adjustment
     * @param {Object} transaction - Transaction entry object
     * @returns {boolean} True if it's a balance sheet adjustment
     */
    static isBalanceSheetAdjustment(transaction) {
        if (!transaction.description) return false;
        
        const desc = transaction.description.toLowerCase();
        const adjustmentPatterns = [
            'opening balance',
            'balance adjustment', 
            'clearing account',
            'journal entry',
            'internal transfer',
            'reclassification',
            'take on balances'
        ];

        return adjustmentPatterns.some(pattern => desc.includes(pattern));
    }

    /**
     * Check if transaction is an internal cash transfer
     * @param {Object} transaction - Transaction entry object
     * @returns {boolean} True if it's an internal cash transfer
     */
    static isInternalCashTransfer(transaction) {
        // First check description for transfer keywords
        if (transaction.description) {
            const desc = transaction.description.toLowerCase();
            const transferKeywords = [
                'petty cash',
                'cash allocation',
                'funds to',
                'cash to',
                'vault',
                'transfer to',
                'move to',
                'internal transfer',
                'transfer'
            ];
            
            if (transferKeywords.some(keyword => desc.includes(keyword))) {
                // If description suggests transfer, check if it's between cash accounts
                if (transaction.entries && transaction.entries.length >= 2) {
                    let hasCashDebit = false;
                    let hasCashCredit = false;
                    
                    for (const entry of transaction.entries) {
                        const accountCode = entry.accountCode || entry.account?.code;
                        const accountName = entry.accountName || entry.account?.name;
                        
                        if (this.isCashAccount(accountCode, accountName)) {
                            if (entry.debit > 0) hasCashDebit = true;
                            if (entry.credit > 0) hasCashCredit = true;
                        }
                    }
                    
                    // If both cash debit and credit exist, it's an internal transfer
                    if (hasCashDebit && hasCashCredit) {
                        return true;
                    }
                }
            }
        }

        // Also check by transaction structure: Both cash debit and credit exist, no non-cash entries
        if (!transaction.entries || transaction.entries.length < 2) return false;

        let cashDebitCount = 0;
        let cashCreditCount = 0;
        let nonCashEntries = 0;

        for (const entry of transaction.entries) {
            const accountCode = entry.accountCode || entry.account?.code;
            const accountName = entry.accountName || entry.account?.name;
            
            if (this.isCashAccount(accountCode, accountName)) {
                if (entry.debit > 0) cashDebitCount++;
                if (entry.credit > 0) cashCreditCount++;
            } else {
                // Check if it's an expense account (which would make it a real expense, not a transfer)
                const accountType = entry.accountType || entry.account?.type;
                if (accountType === 'Expense' || accountType === 'expense') {
                    // Has expense account, so it's a real expense payment, not a transfer
                    return false;
                }
                nonCashEntries++;
            }
        }

        // Internal transfer: Both cash debit and credit exist, no expense accounts
        return cashDebitCount > 0 && cashCreditCount > 0 && nonCashEntries === 0;
    }

    /**
     * Check if transaction is an accrual without cash movement
     * @param {Object} transaction - Transaction entry object
     * @returns {boolean} True if it's an accrual without cash
     */
    static isAccrualWithoutCash(transaction) {
        if (!transaction.entries) return false;

        let hasIncomeOrExpense = false;
        let hasCashMovement = false;

        for (const entry of transaction.entries) {
            const accountCode = entry.accountCode || entry.account?.code;
            const accountName = entry.accountName || entry.account?.name;
            
            // Check for income/expense accounts
            if (this.CASH_ACCOUNT_PATTERNS.EXCLUDED_ACCOUNTS.INCOME_ACCOUNTS.test(accountCode) || 
                this.CASH_ACCOUNT_PATTERNS.EXCLUDED_ACCOUNTS.EXPENSE_ACCOUNTS.test(accountCode)) {
                hasIncomeOrExpense = true;
            }
            
            // Check for cash movement
            if (this.isCashAccount(accountCode, accountName) && (entry.debit > 0 || entry.credit > 0)) {
                hasCashMovement = true;
            }
        }

        // Accrual: Has income/expense but no cash movement
        return hasIncomeOrExpense && !hasCashMovement;
    }

    /**
     * Check if transaction is a late payment fee
     * @param {Object} transaction - Transaction entry object
     * @returns {boolean} True if it's a late payment fee
     */
    static isLatePaymentFee(transaction) {
        if (!transaction.description) return false;
        
        const desc = transaction.description.toLowerCase();
        const hasLateFeeKeywords = desc.includes('late') && 
                                 (desc.includes('fee') || desc.includes('payment'));
        
        if (!hasLateFeeKeywords) return false;

        // Also check account entries for late fee accounts
        if (transaction.entries && Array.isArray(transaction.entries)) {
            for (const entry of transaction.entries) {
                const accountName = (entry.accountName || entry.account?.name || '').toLowerCase();
                if (accountName.includes('late') && 
                    (accountName.includes('payment') || accountName.includes('fee'))) {
                    return true;
                }
            }
        }

        return hasLateFeeKeywords;
    }

    /**
     * Validate transaction for proper cash flow treatment
     * @param {Object} transaction - Transaction entry object
     * @returns {Object} Validation result
     */
    static validateTransaction(transaction) {
        const exclusionCheck = this.shouldExcludeFromCashFlow(transaction);
        if (exclusionCheck.isExcluded) {
            return {
                isValid: false,
                shouldIncludeInCashFlow: false,
                exclusionReason: exclusionCheck.reason,
                details: exclusionCheck.details,
                cashInflow: { isCashInflow: false, amount: 0 },
                cashOutflow: { isCashOutflow: false, amount: 0 }
            };
        }

        const cashInflow = this.identifyCashInflow(transaction);
        const cashOutflow = this.identifyCashOutflow(transaction);

        // Validate double-entry accounting
        const validationErrors = [];
        
        if (cashInflow.isCashInflow && cashOutflow.isCashOutflow) {
            validationErrors.push('Transaction has both cash inflow and outflow - may be internal transfer');
        }

        if (!cashInflow.isCashInflow && !cashOutflow.isCashOutflow) {
            validationErrors.push('No cash movement detected in transaction');
        }

        return {
            isValid: validationErrors.length === 0,
            shouldIncludeInCashFlow: cashInflow.isCashInflow || cashOutflow.isCashOutflow,
            exclusionReason: null,
            validationErrors,
            cashInflow,
            cashOutflow,
            transactionId: transaction.transactionId,
            date: transaction.date,
            description: transaction.description
        };
    }

    /**
     * Analyze cash flow from a set of transactions
     * @param {Array} transactions - Array of transaction entries
     * @returns {Object} Cash flow analysis
     */
    static analyzeCashFlow(transactions) {
        const analysis = {
            totalTransactions: transactions.length,
            includedTransactions: 0,
            excludedTransactions: 0,
            totalCashInflows: 0,
            totalCashOutflows: 0,
            netCashFlow: 0,
            cashInflowsByAccount: {},
            cashOutflowsByAccount: {},
            excludedTransactionsByReason: {},
            validationResults: []
        };

        transactions.forEach(transaction => {
            const validation = this.validateTransaction(transaction);
            analysis.validationResults.push(validation);

            if (validation.shouldIncludeInCashFlow) {
                analysis.includedTransactions++;
                
                if (validation.cashInflow.isCashInflow) {
                    analysis.totalCashInflows += validation.cashInflow.amount;
                    
                    // Track by account
                    const account = validation.cashInflow.cashAccount;
                    if (!analysis.cashInflowsByAccount[account]) {
                        analysis.cashInflowsByAccount[account] = 0;
                    }
                    analysis.cashInflowsByAccount[account] += validation.cashInflow.amount;
                }

                if (validation.cashOutflow.isCashOutflow) {
                    analysis.totalCashOutflows += validation.cashOutflow.amount;
                    
                    // Track by account
                    const account = validation.cashOutflow.cashAccount;
                    if (!analysis.cashOutflowsByAccount[account]) {
                        analysis.cashOutflowsByAccount[account] = 0;
                    }
                    analysis.cashOutflowsByAccount[account] += validation.cashOutflow.amount;
                }
            } else {
                analysis.excludedTransactions++;
                
                // Track exclusion reasons
                const reason = validation.exclusionReason || 'No cash movement';
                if (!analysis.excludedTransactionsByReason[reason]) {
                    analysis.excludedTransactionsByReason[reason] = 0;
                }
                analysis.excludedTransactionsByReason[reason]++;
            }
        });

        analysis.netCashFlow = analysis.totalCashInflows - analysis.totalCashOutflows;

        return analysis;
    }

    /**
     * Generate cash flow statement from validated transactions
     * @param {Array} transactions - Array of transaction entries
     * @param {Date} startDate - Period start date
     * @param {Date} endDate - Period end date
     * @returns {Object} Cash flow statement
     */
    static generateCashFlowStatement(transactions, startDate, endDate) {
        const analysis = this.analyzeCashFlow(transactions);
        
        const cashFlowStatement = {
            period: {
                startDate,
                endDate
            },
            operatingActivities: {
                cashInflows: analysis.totalCashInflows,
                cashOutflows: analysis.totalCashOutflows,
                netCashFlow: analysis.netCashFlow
            },
            cashAccounts: {
                inflowsByAccount: analysis.cashInflowsByAccount,
                outflowsByAccount: analysis.cashOutflowsByAccount
            },
            summary: {
                totalTransactions: analysis.totalTransactions,
                includedInCashFlow: analysis.includedTransactions,
                excludedFromCashFlow: analysis.excludedTransactions,
                exclusionBreakdown: analysis.excludedTransactionsByReason
            },
            transactions: analysis.validationResults.filter(result => result.shouldIncludeInCashFlow)
        };

        return cashFlowStatement;
    }

    /**
     * Get all cash accounts from the database
     * @returns {Promise<Array>} Array of cash accounts
     */
    static async getCashAccounts() {
        try {
            const accounts = await Account.find({
                $or: [
                    { code: { $regex: '^(100|101)' } },
                    { name: { $regex: /cash|bank|petty/i } }
                ]
            }).select('code name type description').lean();

            return accounts.filter(account => 
                this.isCashAccount(account.code, account.name)
            );
        } catch (error) {
            console.error('Error fetching cash accounts:', error);
            return [];
        }
    }

    /**
     * Validate cash flow rules for a specific period
     * @param {Date} startDate - Period start date
     * @param {Date} endDate - Period end date
     * @param {string} residenceId - Optional residence filter
     * @returns {Promise<Object>} Cash flow validation report
     */
    static async validatePeriodCashFlow(startDate, endDate, residenceId = null) {
        try {
            const query = {
                date: { $gte: startDate, $lte: endDate },
                status: { $nin: ['reversed', 'draft'] }
            };

            if (residenceId) {
                query.residence = residenceId;
            }

            const transactions = await TransactionEntry.find(query)
                .populate('entries')
                .select('transactionId date description entries status residence')
                .lean();

            const cashAccounts = await this.getCashAccounts();
            const cashFlowStatement = this.generateCashFlowStatement(transactions, startDate, endDate);

            return {
                period: { startDate, endDate },
                cashAccounts,
                cashFlowStatement,
                validationSummary: {
                    totalTransactions: transactions.length,
                    cashAccountsCount: cashAccounts.length,
                    cashFlowAccuracy: transactions.length > 0 
                        ? ((cashFlowStatement.summary.includedInCashFlow / transactions.length) * 100).toFixed(2) + '%'
                        : '0%'
                }
            };

        } catch (error) {
            console.error('Error validating period cash flow:', error);
            throw error;
        }
    }
}

module.exports = CashFlowValidator;

