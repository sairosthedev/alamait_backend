const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const mongoose = require('mongoose');

/**
 * Financial Reporting Service
 * 
 * Generates comprehensive financial statements including:
 * - Income Statement (Profit & Loss)
 * - Balance Sheet
 * - Cash Flow Statement
 * - Trial Balance
 * - General Ledger
 * 
 * Supports both cash and accrual basis accounting
 */

class FinancialReportingService {
    
    /**
     * Generate Income Statement (Profit & Loss)
     */
    static async generateIncomeStatement(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            // Get all transaction entries for the period
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                'metadata.accountingBasis': basis
            }).populate('entries');
            
            // Calculate revenue (Income accounts)
            const revenue = await this.calculateAccountTypeTotal('Income', startDate, endDate, basis);
            
            // Calculate expenses (Expense accounts)
            const expenses = await this.calculateAccountTypeTotal('Expense', startDate, endDate, basis);
            
            // Calculate net income
            const totalRevenue = Object.values(revenue).reduce((sum, amount) => sum + amount, 0);
            const totalExpenses = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
            const netIncome = totalRevenue - totalExpenses;
            
            return {
                period,
                basis,
                revenue: {
                    ...revenue,
                    total_revenue: totalRevenue
                },
                expenses: {
                    ...expenses,
                    total_expenses: totalExpenses
                },
                net_income: netIncome,
                gross_profit: totalRevenue,
                operating_income: netIncome
            };
            
        } catch (error) {
            console.error('Error generating income statement:', error);
            throw error;
        }
    }
    
    /**
     * Generate Balance Sheet
     */
    static async generateBalanceSheet(asOf, basis = 'cash') {
        try {
            const asOfDate = new Date(asOf);
            
            // Get account balances as of the specified date
            const assets = await this.getAccountBalancesByType('Asset', asOfDate, basis);
            const liabilities = await this.getAccountBalancesByType('Liability', asOfDate, basis);
            const equity = await this.getAccountBalancesByType('Equity', asOfDate, basis);
            
            // Calculate totals
            const totalAssets = Object.values(assets).reduce((sum, amount) => sum + amount, 0);
            const totalLiabilities = Object.values(liabilities).reduce((sum, amount) => sum + amount, 0);
            const totalEquity = Object.values(equity).reduce((sum, amount) => sum + amount, 0);
            
            // Group assets into current and non-current
            const currentAssets = {};
            const nonCurrentAssets = {};
            
            Object.keys(assets).forEach(account => {
                if (this.isCurrentAsset(account)) {
                    currentAssets[account] = assets[account];
                } else {
                    nonCurrentAssets[account] = assets[account];
                }
            });
            
            // Group liabilities into current and non-current
            const currentLiabilities = {};
            const nonCurrentLiabilities = {};
            
            Object.keys(liabilities).forEach(account => {
                if (this.isCurrentLiability(account)) {
                    currentLiabilities[account] = liabilities[account];
                } else {
                    nonCurrentLiabilities[account] = liabilities[account];
                }
            });
            
            return {
                asOf,
                basis,
                assets: {
                    current_assets: {
                        ...currentAssets,
                        total_current_assets: Object.values(currentAssets).reduce((sum, amount) => sum + amount, 0)
                    },
                    non_current_assets: {
                        ...nonCurrentAssets,
                        total_non_current_assets: Object.values(nonCurrentAssets).reduce((sum, amount) => sum + amount, 0)
                    },
                    total_assets: totalAssets
                },
                liabilities: {
                    current_liabilities: {
                        ...currentLiabilities,
                        total_current_liabilities: Object.values(currentLiabilities).reduce((sum, amount) => sum + amount, 0)
                    },
                    non_current_liabilities: {
                        ...nonCurrentLiabilities,
                        total_non_current_liabilities: Object.values(nonCurrentLiabilities).reduce((sum, amount) => sum + amount, 0)
                    },
                    total_liabilities: totalLiabilities
                },
                equity: {
                    ...equity,
                    total_equity: totalEquity
                },
                // Verify accounting equation
                accounting_equation: {
                    assets: totalAssets,
                    liabilities: totalLiabilities,
                    equity: totalEquity,
                    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
                }
            };
            
        } catch (error) {
            console.error('Error generating balance sheet:', error);
            throw error;
        }
    }
    
    /**
     * Generate Cash Flow Statement
     */
    static async generateCashFlowStatement(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            // Operating Activities
            const operatingActivities = await this.calculateOperatingCashFlows(startDate, endDate, basis);
            
            // Investing Activities
            const investingActivities = await this.calculateInvestingCashFlows(startDate, endDate, basis);
            
            // Financing Activities
            const financingActivities = await this.calculateFinancingCashFlows(startDate, endDate, basis);
            
            // Calculate net change in cash
            const netOperatingCash = operatingActivities.net_cash_from_operating;
            const netInvestingCash = investingActivities.net_cash_from_investing;
            const netFinancingCash = financingActivities.net_cash_from_financing;
            const netChangeInCash = netOperatingCash + netInvestingCash + netFinancingCash;
            
            // Get cash balances
            const cashAtBeginning = await this.getCashBalanceAtDate(startDate, basis);
            const cashAtEnd = await this.getCashBalanceAtDate(endDate, basis);
            
            return {
                period,
                basis,
                operating_activities: {
                    ...operatingActivities,
                    net_cash_from_operating: netOperatingCash
                },
                investing_activities: {
                    ...investingActivities,
                    net_cash_from_investing: netInvestingCash
                },
                financing_activities: {
                    ...financingActivities,
                    net_cash_from_financing: netFinancingCash
                },
                net_change_in_cash: netChangeInCash,
                cash_at_beginning: cashAtBeginning,
                cash_at_end: cashAtEnd
            };
            
        } catch (error) {
            console.error('Error generating cash flow statement:', error);
            throw error;
        }
    }
    
    /**
     * Generate Trial Balance
     */
    static async generateTrialBalance(asOf, basis = 'cash') {
        try {
            const asOfDate = new Date(asOf);
            
            // Get all accounts with balances
            const accounts = await Account.find({ isActive: true });
            const trialBalance = [];
            
            for (const account of accounts) {
                const balance = await this.getAccountBalance(account.code, asOfDate, basis);
                
                if (balance !== 0) {
                    trialBalance.push({
                        accountCode: account.code,
                        accountName: account.name,
                        accountType: account.type,
                        debit: balance > 0 ? balance : 0,
                        credit: balance < 0 ? Math.abs(balance) : 0,
                        balance: balance
                    });
                }
            }
            
            // Calculate totals
            const totalDebits = trialBalance.reduce((sum, item) => sum + item.debit, 0);
            const totalCredits = trialBalance.reduce((sum, item) => sum + item.credit, 0);
            
            return {
                asOf,
                basis,
                trial_balance: trialBalance,
                totals: {
                    total_debits: totalDebits,
                    total_credits: totalCredits,
                    balanced: Math.abs(totalDebits - totalCredits) < 0.01
                }
            };
            
        } catch (error) {
            console.error('Error generating trial balance:', error);
            throw error;
        }
    }
    
    /**
     * Generate General Ledger for specific account
     */
    static async generateGeneralLedger(accountCode, period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            // Get account details
            const account = await Account.findOne({ code: accountCode });
            if (!account) {
                throw new Error(`Account with code ${accountCode} not found`);
            }
            
            // Get opening balance
            const openingBalance = await this.getAccountBalance(accountCode, startDate, basis);
            
            // Get all transactions for this account
            const transactions = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                'metadata.accountingBasis': basis,
                'entries.accountCode': accountCode
            }).sort({ date: 1 });
            
            // Build ledger entries
            const ledgerEntries = [];
            let runningBalance = openingBalance;
            
            for (const transaction of transactions) {
                const entry = transaction.entries.find(e => e.accountCode === accountCode);
                if (entry) {
                    const debit = entry.debit || 0;
                    const credit = entry.credit || 0;
                    
                    // Update running balance based on account type
                    if (['Asset', 'Expense'].includes(account.type)) {
                        runningBalance += debit - credit;
                    } else {
                        runningBalance += credit - debit;
                    }
                    
                    ledgerEntries.push({
                        date: transaction.date,
                        description: transaction.description,
                        reference: transaction.reference,
                        debit: debit,
                        credit: credit,
                        balance: runningBalance
                    });
                }
            }
            
            return {
                accountCode,
                accountName: account.name,
                accountType: account.type,
                period,
                basis,
                opening_balance: openingBalance,
                ledger_entries: ledgerEntries,
                closing_balance: runningBalance
            };
            
        } catch (error) {
            console.error('Error generating general ledger:', error);
            throw error;
        }
    }
    
    /**
     * Get account balances by type
     */
    static async getAccountBalancesByType(accountType, asOfDate, basis) {
        const accounts = await Account.find({ type: accountType, isActive: true });
        const balances = {};
        
        for (const account of accounts) {
            const balance = await this.getAccountBalance(account.code, asOfDate, basis);
            if (balance !== 0) {
                balances[account.name.toLowerCase().replace(/\s+/g, '_')] = balance;
            }
        }
        
        return balances;
    }
    
    /**
     * Calculate total for account type in period
     */
    static async calculateAccountTypeTotal(accountType, startDate, endDate, basis) {
        const accounts = await Account.find({ type: accountType, isActive: true });
        const totals = {};
        
        for (const account of accounts) {
            const total = await this.calculateAccountTotal(account.code, startDate, endDate, basis);
            if (total !== 0) {
                totals[account.name.toLowerCase().replace(/\s+/g, '_')] = total;
            }
        }
        
        return totals;
    }
    
    /**
     * Get account balance at specific date
     */
    static async getAccountBalance(accountCode, asOfDate, basis) {
        const account = await Account.findOne({ code: accountCode });
        if (!account) return 0;
        
        // Get all transactions up to the date
        const transactions = await TransactionEntry.find({
            date: { $lte: asOfDate },
            'metadata.accountingBasis': basis,
            'entries.accountCode': accountCode
        });
        
        let balance = 0;
        
        for (const transaction of transactions) {
            const entry = transaction.entries.find(e => e.accountCode === accountCode);
            if (entry) {
                const debit = entry.debit || 0;
                const credit = entry.credit || 0;
                
                // Update balance based on account type
                if (['Asset', 'Expense'].includes(account.type)) {
                    balance += debit - credit;
                } else {
                    balance += credit - debit;
                }
            }
        }
        
        return balance;
    }
    
    /**
     * Calculate account total for period
     */
    static async calculateAccountTotal(accountCode, startDate, endDate, basis) {
        const account = await Account.findOne({ code: accountCode });
        if (!account) return 0;
        
        // Get transactions in the period
        const transactions = await TransactionEntry.find({
            date: { $gte: startDate, $lte: endDate },
            'metadata.accountingBasis': basis,
            'entries.accountCode': accountCode
        });
        
        let total = 0;
        
        for (const transaction of transactions) {
            const entry = transaction.entries.find(e => e.accountCode === accountCode);
            if (entry) {
                const debit = entry.debit || 0;
                const credit = entry.credit || 0;
                
                // For income/expense accounts, sum the credits/debits
                if (account.type === 'Income') {
                    total += credit;
                } else if (account.type === 'Expense') {
                    total += debit;
                }
            }
        }
        
        return total;
    }
    
    /**
     * Calculate operating cash flows
     */
    static async calculateOperatingCashFlows(startDate, endDate, basis) {
        // Cash received from customers (Rent Income)
        const cashFromCustomers = await this.calculateAccountTotal('4001', startDate, endDate, basis);
        
        // Cash paid to suppliers (Accounts Payable payments)
        const cashToSuppliers = await this.calculatePayablePayments(startDate, endDate, basis);
        
        // Cash paid for expenses
        const cashForExpenses = await this.calculateDirectExpensePayments(startDate, endDate, basis);
        
        return {
            cash_received_from_customers: cashFromCustomers,
            cash_paid_to_suppliers: -cashToSuppliers,
            cash_paid_for_expenses: -cashForExpenses
        };
    }
    
    /**
     * Calculate investing cash flows
     */
    static async calculateInvestingCashFlows(startDate, endDate, basis) {
        // Purchase of equipment, buildings, etc.
        const purchaseOfEquipment = await this.calculateAccountTotal('1400', startDate, endDate, basis);
        const purchaseOfBuildings = await this.calculateAccountTotal('1500', startDate, endDate, basis);
        
        return {
            purchase_of_equipment: -purchaseOfEquipment,
            purchase_of_buildings: -purchaseOfBuildings
        };
    }
    
    /**
     * Calculate financing cash flows
     */
    static async calculateFinancingCashFlows(startDate, endDate, basis) {
        // Owner's contributions
        const ownersContribution = await this.calculateAccountTotal('3000', startDate, endDate, basis);
        
        // Loan proceeds
        const loanProceeds = await this.calculateAccountTotal('2100', startDate, endDate, basis);
        
        return {
            owners_contribution: ownersContribution,
            loan_proceeds: loanProceeds
        };
    }
    
    /**
     * Get cash balance at specific date
     */
    static async getCashBalanceAtDate(date, basis) {
        const cashAccounts = ['1001', '1002', '1003', '1004', '1008']; // Bank, Cash, Ecocash, Innbucks, Petty Cash
        let totalCash = 0;
        
        for (const accountCode of cashAccounts) {
            totalCash += await this.getAccountBalance(accountCode, date, basis);
        }
        
        return totalCash;
    }
    
    /**
     * Calculate payable payments
     */
    static async calculatePayablePayments(startDate, endDate, basis) {
        const transactions = await TransactionEntry.find({
            date: { $gte: startDate, $lte: endDate },
            'metadata.accountingBasis': basis,
            'entries.accountCode': { $regex: /^200/ } // Accounts Payable accounts
        });
        
        let totalPayments = 0;
        
        for (const transaction of transactions) {
            const payableEntry = transaction.entries.find(e => e.accountCode.match(/^200/));
            if (payableEntry && payableEntry.debit > 0) {
                totalPayments += payableEntry.debit;
            }
        }
        
        return totalPayments;
    }
    
    /**
     * Calculate direct expense payments
     */
    static async calculateDirectExpensePayments(startDate, endDate, basis) {
        const transactions = await TransactionEntry.find({
            date: { $gte: startDate, $lte: endDate },
            'metadata.accountingBasis': basis,
            'entries.accountCode': { $regex: /^500/ } // Expense accounts
        });
        
        let totalExpenses = 0;
        
        for (const transaction of transactions) {
            const expenseEntry = transaction.entries.find(e => e.accountCode.match(/^500/));
            if (expenseEntry && expenseEntry.debit > 0) {
                totalExpenses += expenseEntry.debit;
            }
        }
        
        return totalExpenses;
    }
    
    /**
     * Check if account is current asset
     */
    static isCurrentAsset(accountName) {
        const currentAssetKeywords = ['cash', 'bank', 'ecocash', 'innbucks', 'petty', 'receivable', 'inventory'];
        return currentAssetKeywords.some(keyword => accountName.toLowerCase().includes(keyword));
    }
    
    /**
     * Check if account is current liability
     */
    static isCurrentLiability(accountName) {
        const currentLiabilityKeywords = ['payable', 'advance', 'deposit'];
        return currentLiabilityKeywords.some(keyword => accountName.toLowerCase().includes(keyword));
    }
}

module.exports = FinancialReportingService; 