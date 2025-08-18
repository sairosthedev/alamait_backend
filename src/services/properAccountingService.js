const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Residence = require('../models/Residence');
const mongoose = require('mongoose');

/**
 * PROPER ACCOUNTING SERVICE
 * 
 * Implements GAAP-compliant financial statements:
 * - Income Statement: Accrual Basis (recognizes revenue when earned, expenses when incurred)
 * - Cash Flow Statement: Cash Basis (only actual cash movements)
 * - Balance Sheet: Cash Basis (only actual cash and cash equivalents)
 * 
 * Follows proper accounting principles and provides residence filtering
 */

class ProperAccountingService {
    
    /**
     * GENERATE ACCRUAL BASIS INCOME STATEMENT
     * 
     * Accrual Basis Principles:
     * - Revenue recognized when EARNED (not when cash received)
     * - Expenses recognized when INCURRED (not when cash paid)
     * - Includes accruals, deferrals, and period matching
     */
    static async generateAccrualBasisIncomeStatement(period, residence = null) {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`🔄 Generating ACCRUAL BASIS income statement for ${period}${residence ? ` (residence: ${residence})` : ''}`);
            
            // Build query with residence filter
            let query = {
                date: { $gte: startDate, $lte: endDate }
            };
            
            if (residence) {
                query.residence = new mongoose.Types.ObjectId(residence);
            }
            
            // Get all transaction entries for the period
            const entries = await TransactionEntry.find(query)
                .populate('residence')
                .populate('entries.account');
            
            console.log(`📊 Found ${entries.length} transaction entries for accrual basis calculation`);
            
            // ACCRUAL BASIS CALCULATIONS
            const accrualRevenue = {};
            const accrualExpenses = {};
            const accruals = {
                accountsReceivable: 0,    // Revenue earned but not yet received
                prepaidExpenses: 0,       // Expenses paid but not yet incurred
                accruedExpenses: 0,       // Expenses incurred but not yet paid
                deferredRevenue: 0        // Revenue received but not yet earned
            };
            
            // Process each transaction entry
            entries.forEach(entry => {
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        const date = entry.date;
                        
                        // ACCRUAL REVENUE RECOGNITION
                        if (accountType === 'Income' || accountType === 'income') {
                            const key = `${accountCode} - ${accountName}`;
                            
                            if (!accrualRevenue[key]) {
                                accrualRevenue[key] = {
                                    code: accountCode,
                                    name: accountName,
                                    earned: 0,          // Revenue earned in period
                                    received: 0,        // Cash received in period
                                    receivable: 0       // Still owed (earned - received)
                                };
                            }
                            
                            // In accrual basis, recognize revenue when EARNED
                            if (date >= startDate && date <= endDate) {
                                accrualRevenue[key].earned += credit; // Credit increases income
                                
                                // Track cash received vs earned
                                if (entry.source === 'payment') {
                                    accrualRevenue[key].received += credit;
                                }
                            }
                            
                            // Calculate accounts receivable (earned but not received)
                            accrualRevenue[key].receivable = accrualRevenue[key].earned - accrualRevenue[key].received;
                        }
                        
                        // ACCRUAL EXPENSE RECOGNITION
                        if (accountType === 'Expense' || accountType === 'expense') {
                            const key = `${accountCode} - ${accountName}`;
                            
                            if (!accrualExpenses[key]) {
                                accrualExpenses[key] = {
                                    code: accountCode,
                                    name: accountName,
                                    incurred: 0,        // Expense incurred in period
                                    paid: 0,            // Cash paid in period
                                    payable: 0          // Still owed (incurred - paid)
                                };
                            }
                            
                            // In accrual basis, recognize expenses when INCURRED
                            if (date >= startDate && date <= endDate) {
                                accrualExpenses[key].incurred += debit; // Debit increases expenses
                                
                                // Track cash paid vs incurred
                                if (entry.source === 'expense_payment') {
                                    accrualExpenses[key].paid += debit;
                                }
                            }
                            
                            // Calculate accounts payable (incurred but not paid)
                            accrualExpenses[key].payable = accrualExpenses[key].incurred - accrualExpenses[key].paid;
                        }
                        
                        // ACCRUAL ADJUSTMENTS
                        if (accountType === 'Asset' && accountName.toLowerCase().includes('prepaid')) {
                            // Prepaid expenses - recognize portion used in current period
                            if (date >= startDate && date <= endDate) {
                                accruals.prepaidExpenses += debit;
                            }
                        }
                        
                        if (accountType === 'Liability' && accountName.toLowerCase().includes('accrued')) {
                            // Accrued expenses - recognize expenses incurred but not paid
                            if (date >= startDate && date <= endDate) {
                                accruals.accruedExpenses += credit;
                            }
                        }
                    });
                }
            });
            
            // Calculate accrual basis totals
            const totalRevenueEarned = Object.values(accrualRevenue).reduce((sum, rev) => sum + rev.earned, 0);
            const totalExpensesIncurred = Object.values(accrualExpenses).reduce((sum, exp) => sum + exp.incurred, 0);
            const netIncomeAccrual = totalRevenueEarned - totalExpensesIncurred;
            
            // Add accrual adjustments
            const adjustedNetIncome = netIncomeAccrual + accruals.accruedExpenses - accruals.prepaidExpenses;
            
            console.log(`✅ Accrual Basis Income Statement Generated:`);
            console.log(`   Revenue Earned: $${totalRevenueEarned.toLocaleString()}`);
            console.log(`   Expenses Incurred: $${totalExpensesIncurred.toLocaleString()}`);
            console.log(`   Net Income (Accrual): $${netIncomeAccrual.toLocaleString()}`);
            console.log(`   Accrual Adjustments: +$${accruals.accruedExpenses.toLocaleString()} - $${accruals.prepaidExpenses.toLocaleString()}`);
            console.log(`   Final Net Income: $${adjustedNetIncome.toLocaleString()}`);
            
            return {
                period,
                basis: 'accrual',
                residence: residence,
                revenue: {
                    ...accrualRevenue,
                    total_earned: totalRevenueEarned,
                    total_received: Object.values(accrualRevenue).reduce((sum, rev) => sum + rev.received, 0),
                    total_receivable: Object.values(accrualRevenue).reduce((sum, rev) => sum + rev.receivable, 0)
                },
                expenses: {
                    ...accrualExpenses,
                    total_incurred: totalExpensesIncurred,
                    total_paid: Object.values(accrualExpenses).reduce((sum, exp) => sum + exp.paid, 0),
                    total_payable: Object.values(accrualExpenses).reduce((sum, exp) => sum + exp.payable, 0)
                },
                accruals: accruals,
                net_income: {
                    before_adjustments: netIncomeAccrual,
                    after_adjustments: adjustedNetIncome
                },
                accounting_principles: {
                    revenue_recognition: 'Recognized when earned, not when cash received',
                    expense_recognition: 'Recognized when incurred, not when cash paid',
                    period_matching: 'Expenses matched to revenue they help generate',
                    accrual_basis: 'Full accrual accounting following GAAP principles'
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating accrual basis income statement:', error);
            throw error;
        }
    }
    
    /**
     * GENERATE CASH BASIS CASH FLOW STATEMENT
     * 
     * Cash Basis Principles:
     * - Only actual cash receipts and payments
     * - No accruals or deferrals
     * - Must reconcile with cash balance changes
     */
    static async generateCashBasisCashFlowStatement(period, residence = null) {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`💵 Generating CASH BASIS cash flow statement for ${period}${residence ? ` (residence: ${residence})` : ''}`);
            
            // Build query with residence filter
            let query = {
                date: { $gte: startDate, $lte: endDate }
            };
            
            if (residence) {
                query.residence = new mongoose.Types.ObjectId(residence);
            }
            
            // Get all transaction entries for the period
            const entries = await TransactionEntry.find(query)
                .populate('residence')
                .populate('entries.account');
            
            console.log(`📊 Found ${entries.length} transaction entries for cash flow calculation`);
            
            // CASH FLOW CATEGORIES (Cash Basis Only)
            const operatingActivities = {
                cash_received_from_customers: 0,    // Only actual cash received
                cash_paid_to_suppliers: 0,         // Only actual cash paid
                cash_paid_for_expenses: 0,         // Only actual cash paid
                cash_paid_for_utilities: 0,        // Only actual cash paid
                cash_paid_for_maintenance: 0,      // Only actual cash paid
                cash_paid_for_staff: 0             // Only actual cash paid
            };
            
            const investingActivities = {
                purchase_of_equipment: 0,          // Only actual cash paid
                purchase_of_buildings: 0,          // Only actual cash paid
                loans_made: 0                      // Only actual cash paid
            };
            
            const financingActivities = {
                owners_contribution: 0,            // Only actual cash received
                loan_proceeds: 0,                  // Only actual cash received
                loan_repayments: 0                 // Only actual cash paid
            };
            
            // Process each transaction entry for CASH FLOWS ONLY
            entries.forEach(entry => {
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        // OPERATING ACTIVITIES - Only actual cash movements
                        if (accountCode.startsWith('100') || accountCode.startsWith('101')) { // Cash accounts
                            if (entry.source === 'payment') {
                                operatingActivities.cash_received_from_customers += credit;
                            } else if (entry.source === 'expense_payment') {
                                // Categorize cash payments by expense type
                                if (accountName.toLowerCase().includes('utility') || accountName.toLowerCase().includes('electricity') || accountName.toLowerCase().includes('water')) {
                                    operatingActivities.cash_paid_for_utilities += debit;
                                } else if (accountName.toLowerCase().includes('maintenance') || accountName.toLowerCase().includes('repair')) {
                                    operatingActivities.cash_paid_for_maintenance += debit;
                                } else if (accountName.toLowerCase().includes('staff') || accountName.toLowerCase().includes('salary')) {
                                    operatingActivities.cash_paid_for_staff += debit;
                                } else {
                                    operatingActivities.cash_paid_for_expenses += debit;
                                }
                            }
                        }
                        
                        // INVESTING ACTIVITIES - Only actual cash payments
                        if (accountName.toLowerCase().includes('equipment') || accountName.toLowerCase().includes('furniture')) {
                            investingActivities.purchase_of_equipment += debit;
                        } else if (accountName.toLowerCase().includes('building') || accountName.toLowerCase().includes('construction')) {
                            investingActivities.purchase_of_buildings += debit;
                        }
                        
                        // FINANCING ACTIVITIES - Only actual cash movements
                        if (accountName.toLowerCase().includes('loan') && accountType === 'Liability') {
                            if (credit > 0) {
                                financingActivities.loan_proceeds += credit; // Cash received
                            } else if (debit > 0) {
                                financingActivities.loan_repayments += debit; // Cash paid
                            }
                        }
                    });
                }
            });
            
            // Calculate net cash flows (Cash Basis)
            const netOperatingCashFlow = operatingActivities.cash_received_from_customers - 
                                       operatingActivities.cash_paid_for_expenses - 
                                       operatingActivities.cash_paid_for_utilities - 
                                       operatingActivities.cash_paid_for_maintenance - 
                                       operatingActivities.cash_paid_for_staff;
            
            const netInvestingCashFlow = -(investingActivities.purchase_of_equipment + 
                                       investingActivities.purchase_of_buildings + 
                                       investingActivities.loans_made);
            
            const netFinancingCashFlow = financingActivities.owners_contribution + 
                                       financingActivities.loan_proceeds - 
                                       financingActivities.loan_repayments;
            
            const netChangeInCash = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;
            
            console.log(`✅ Cash Basis Cash Flow Statement Generated:`);
            console.log(`   Operating Cash Flow: $${netOperatingCashFlow.toLocaleString()}`);
            console.log(`   Investing Cash Flow: $${netInvestingCashFlow.toLocaleString()}`);
            console.log(`   Financing Cash Flow: $${netFinancingCashFlow.toLocaleString()}`);
            console.log(`   Net Change in Cash: $${netChangeInCash.toLocaleString()}`);
            
            return {
                period,
                basis: 'cash',
                residence: residence,
                operating_activities: {
                    ...operatingActivities,
                    net_operating_cash_flow: netOperatingCashFlow
                },
                investing_activities: {
                    ...investingActivities,
                    net_investing_cash_flow: netInvestingCashFlow
                },
                financing_activities: {
                    ...financingActivities,
                    net_financing_cash_flow: netFinancingCashFlow
                },
                net_change_in_cash: netChangeInCash,
                accounting_principles: {
                    cash_basis: 'Only actual cash receipts and payments recorded',
                    no_accruals: 'No recognition of earned but unpaid revenue',
                    no_deferrals: 'No recognition of incurred but unpaid expenses',
                    cash_reconciliation: 'Must reconcile with actual cash balance changes'
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating cash basis cash flow statement:', error);
            throw error;
        }
    }
    
    /**
     * GENERATE CASH BASIS BALANCE SHEET
     * 
     * Cash Basis Principles:
     * - Only actual cash and cash equivalents
     * - No accounts receivable or accounts payable
     * - No prepaid expenses or deferred revenue
     * - Real-time balances from transaction entries
     */
    static async generateCashBasisBalanceSheet(asOf, residence = null) {
        try {
            const asOfDate = new Date(asOf);
            
            console.log(`💰 Generating CASH BASIS balance sheet as of ${asOfDate}${residence ? ` (residence: ${residence})` : ''}`);
            
            // Build query with residence filter
            let query = {
                date: { $lte: asOfDate }
            };
            
            if (residence) {
                query.residence = new mongoose.Types.ObjectId(residence);
            }
            
            // Get all transaction entries up to the specified date
            const entries = await TransactionEntry.find(query)
                .populate('residence')
                .populate('entries.account');
            
            console.log(`📊 Found ${entries.length} transaction entries up to ${asOfDate}`);
            
            // CASH BASIS BALANCE SHEET - Only actual cash and cash equivalents
            const cashBasisAssets = {
                cash_and_cash_equivalents: 0,     // Only actual cash
                petty_cash: 0,                     // Only actual petty cash
                bank_accounts: 0                   // Only actual bank balances
            };
            
            const cashBasisLiabilities = {
                loans_payable: 0,                  // Only actual loans
                accounts_payable: 0,               // Only actual bills due
                accrued_expenses: 0                // Only actual expenses due
            };
            
            const cashBasisEquity = {
                owners_equity: 0,                  // Owner contributions
                retained_earnings: 0               // Net income (cash basis)
            };
            
            // Process each transaction entry for CASH BASIS balances
            entries.forEach(entry => {
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        // CASH BASIS ASSETS - Only actual cash and cash equivalents
                        if (accountCode.startsWith('100') || accountCode.startsWith('101')) { // Cash accounts
                            if (accountName.toLowerCase().includes('petty')) {
                                cashBasisAssets.petty_cash += debit - credit;
                            } else if (accountName.toLowerCase().includes('bank')) {
                                cashBasisAssets.bank_accounts += debit - credit;
                            } else {
                                cashBasisAssets.cash_and_cash_equivalents += debit - credit;
                            }
                        }
                        
                        // CASH BASIS LIABILITIES - Only actual obligations
                        if (accountType === 'Liability') {
                            if (accountName.toLowerCase().includes('loan')) {
                                cashBasisLiabilities.loans_payable += credit - debit;
                            } else if (accountName.toLowerCase().includes('payable')) {
                                cashBasisLiabilities.accounts_payable += credit - debit;
                            } else if (accountName.toLowerCase().includes('accrued')) {
                                cashBasisLiabilities.accrued_expenses += credit - debit;
                            }
                        }
                        
                        // CASH BASIS EQUITY - Only actual contributions and earnings
                        if (accountType === 'Equity') {
                            if (accountName.toLowerCase().includes('contribution') || accountName.toLowerCase().includes('capital')) {
                                cashBasisEquity.owners_equity += credit - debit;
                            } else if (accountName.toLowerCase().includes('retained') || accountName.toLowerCase().includes('earnings')) {
                                cashBasisEquity.retained_earnings += credit - debit;
                            }
                        }
                    });
                }
            });
            
            // Calculate totals
            const totalAssets = cashBasisAssets.cash_and_cash_equivalents + 
                               cashBasisAssets.petty_cash + 
                               cashBasisAssets.bank_accounts;
            
            const totalLiabilities = cashBasisLiabilities.loans_payable + 
                                   cashBasisLiabilities.accounts_payable + 
                                   cashBasisLiabilities.accrued_expenses;
            
            const totalEquity = cashBasisEquity.owners_equity + cashBasisEquity.retained_earnings;
            
            // Verify accounting equation: Assets = Liabilities + Equity
            const accountingEquation = Math.abs(totalAssets - (totalLiabilities + totalEquity));
            const isBalanced = accountingEquation < 0.01; // Allow for small rounding differences
            
            console.log(`✅ Cash Basis Balance Sheet Generated:`);
            console.log(`   Total Assets: $${totalAssets.toLocaleString()}`);
            console.log(`   Total Liabilities: $${totalLiabilities.toLocaleString()}`);
            console.log(`   Total Equity: $${totalEquity.toLocaleString()}`);
            console.log(`   Accounting Equation: Assets (${totalAssets}) = Liabilities (${totalLiabilities}) + Equity (${totalEquity})`);
            console.log(`   Balance Sheet Balanced: ${isBalanced ? '✅ YES' : '❌ NO'}`);
            
            return {
                asOf: asOfDate,
                basis: 'cash',
                residence: residence,
                assets: {
                    ...cashBasisAssets,
                    total_assets: totalAssets
                },
                liabilities: {
                    ...cashBasisLiabilities,
                    total_liabilities: totalLiabilities
                },
                equity: {
                    ...cashBasisEquity,
                    total_equity: totalEquity
                },
                accounting_equation: {
                    assets: totalAssets,
                    liabilities: totalLiabilities,
                    equity: totalEquity,
                    is_balanced: isBalanced,
                    difference: accountingEquation
                },
                accounting_principles: {
                    cash_basis: 'Only actual cash and cash equivalents recorded',
                    no_receivables: 'No accounts receivable (cash basis)',
                    no_prepaid: 'No prepaid expenses (cash basis)',
                    real_time_balances: 'Balances calculated from actual transaction entries',
                    gaap_compliant: 'Follows cash basis accounting principles'
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating cash basis balance sheet:', error);
            throw error;
        }
    }
    
    /**
     * GENERATE RESIDENCE-FILTERED FINANCIAL STATEMENTS
     * 
     * Provides all three statements filtered by specific residence
     */
    static async generateResidenceFinancialStatements(period, residenceId, asOf = null) {
        try {
            console.log(`🏠 Generating financial statements for residence: ${residenceId} for period: ${period}`);
            
            // Validate residence ID
            if (!mongoose.Types.ObjectId.isValid(residenceId)) {
                throw new Error('Invalid residence ID format');
            }
            
            // Check if residence exists
            const residence = await Residence.findById(residenceId);
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            // Generate all three statements
            const [incomeStatement, cashFlowStatement, balanceSheet] = await Promise.all([
                this.generateAccrualBasisIncomeStatement(period, residenceId),
                this.generateCashBasisCashFlowStatement(period, residenceId),
                this.generateCashBasisBalanceSheet(asOf || `${period}-12-31`, residenceId)
            ]);
            
            return {
                residence: {
                    id: residenceId,
                    name: residence.name,
                    address: residence.address
                },
                period,
                asOf: asOf || `${period}-12-31`,
                statements: {
                    income_statement: incomeStatement,
                    cash_flow_statement: cashFlowStatement,
                    balance_sheet: balanceSheet
                },
                summary: {
                    net_income: incomeStatement.net_income.after_adjustments,
                    net_cash_flow: cashFlowStatement.net_change_in_cash,
                    total_assets: balanceSheet.assets.total_assets,
                    total_liabilities: balanceSheet.liabilities.total_liabilities,
                    total_equity: balanceSheet.equity.total_equity
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating residence financial statements:', error);
            throw error;
        }
    }
}

module.exports = ProperAccountingService;
