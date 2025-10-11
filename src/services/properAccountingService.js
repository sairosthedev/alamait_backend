const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const { Residence } = require('../models/Residence');
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
     * GENERATE CASH BASIS CASH FLOW STATEMENT WITH CASH & CASH EQUIVALENTS
     * 
     * Cash Basis Principles:
     * - Only actual cash receipts and payments
     * - No accruals or deferrals
     * - Must reconcile with cash balance changes
     * - Includes cash and cash equivalents as per IFRS 7
     */
    static async generateCashBasisCashFlowStatement(period, residence = null) {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`💵 Generating CASH BASIS cash flow statement with cash & cash equivalents for ${period}${residence ? ` (residence: ${residence})` : ''}`);
            
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
                cash_received_from_tenants: 0,     // Rent collections
                cash_received_from_admin_fees: 0,  // Admin fees
                cash_paid_for_maintenance: 0,      // Maintenance and repairs
                cash_paid_for_utilities: 0,        // Utilities (electricity, water)
                cash_paid_for_staff: 0,            // Staff and caretakers
                cash_paid_for_office_expenses: 0,  // Office expenses
                cash_paid_to_suppliers: 0          // Other supplier payments
            };
            
            const investingActivities = {
                purchase_of_property_improvements: 0, // Property improvements (paint, plumbing)
                purchase_of_equipment: 0,             // Equipment (computers, tools)
                sale_of_equipment: 0,                 // Sale of old equipment
                purchase_of_buildings: 0,             // Building purchases
                loans_made: 0                         // Loans made to others
            };
            
            const financingActivities = {
                loan_proceeds: 0,                     // Bank loans received
                loan_repayments: 0,                   // Loan repayments
                owners_contribution: 0,               // Owner contributions
                owner_drawings: 0                     // Owner drawings
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
                                // Categorize cash receipts
                                if (accountName.toLowerCase().includes('rent') || entry.description?.toLowerCase().includes('rent')) {
                                    operatingActivities.cash_received_from_tenants += credit;
                                } else if (accountName.toLowerCase().includes('admin') || entry.description?.toLowerCase().includes('admin')) {
                                    operatingActivities.cash_received_from_admin_fees += credit;
                                } else {
                                    operatingActivities.cash_received_from_tenants += credit; // Default to rent
                                }
                            } else if (entry.source === 'expense_payment') {
                                // Categorize cash payments by expense type
                                if (accountName.toLowerCase().includes('utility') || accountName.toLowerCase().includes('electricity') || accountName.toLowerCase().includes('water')) {
                                    operatingActivities.cash_paid_for_utilities += debit;
                                } else if (accountName.toLowerCase().includes('maintenance') || accountName.toLowerCase().includes('repair')) {
                                    operatingActivities.cash_paid_for_maintenance += debit;
                                } else if (accountName.toLowerCase().includes('staff') || accountName.toLowerCase().includes('salary')) {
                                    operatingActivities.cash_paid_for_staff += debit;
                                } else if (accountName.toLowerCase().includes('office') || accountName.toLowerCase().includes('admin')) {
                                    operatingActivities.cash_paid_for_office_expenses += debit;
                                } else {
                                    operatingActivities.cash_paid_to_suppliers += debit;
                                }
                            }
                        }
                        
                        // INVESTING ACTIVITIES - Only actual cash payments
                        if (accountName.toLowerCase().includes('equipment') || accountName.toLowerCase().includes('furniture') || accountName.toLowerCase().includes('computer')) {
                            if (debit > 0) {
                                investingActivities.purchase_of_equipment += debit;
                            } else if (credit > 0) {
                                investingActivities.sale_of_equipment += credit;
                            }
                        } else if (accountName.toLowerCase().includes('building') || accountName.toLowerCase().includes('construction') || accountName.toLowerCase().includes('property')) {
                            investingActivities.purchase_of_buildings += debit;
                        } else if (accountName.toLowerCase().includes('improvement') || accountName.toLowerCase().includes('renovation')) {
                            investingActivities.purchase_of_property_improvements += debit;
                        }
                        
                        // FINANCING ACTIVITIES - Only actual cash movements
                        if (accountName.toLowerCase().includes('loan') && accountType === 'Liability') {
                            if (credit > 0) {
                                financingActivities.loan_proceeds += credit; // Cash received
                            } else if (debit > 0) {
                                financingActivities.loan_repayments += debit; // Cash paid
                            }
                        } else if (accountName.toLowerCase().includes('contribution') || accountName.toLowerCase().includes('capital')) {
                            financingActivities.owners_contribution += credit;
                        } else if (accountName.toLowerCase().includes('drawing') || accountName.toLowerCase().includes('withdrawal')) {
                            financingActivities.owner_drawings += debit;
                        }
                    });
                }
            });
            
            // Calculate net cash flows (Cash Basis)
            const netOperatingCashFlow = operatingActivities.cash_received_from_tenants + 
                                       operatingActivities.cash_received_from_admin_fees - 
                                       operatingActivities.cash_paid_for_maintenance - 
                                       operatingActivities.cash_paid_for_utilities - 
                                       operatingActivities.cash_paid_for_staff - 
                                       operatingActivities.cash_paid_for_office_expenses - 
                                       operatingActivities.cash_paid_to_suppliers;
            
            const netInvestingCashFlow = investingActivities.sale_of_equipment - 
                                       investingActivities.purchase_of_property_improvements - 
                                       investingActivities.purchase_of_equipment - 
                                       investingActivities.purchase_of_buildings - 
                                       investingActivities.loans_made;
            
            const netFinancingCashFlow = financingActivities.loan_proceeds + 
                                       financingActivities.owners_contribution - 
                                       financingActivities.loan_repayments - 
                                       financingActivities.owner_drawings;
            
            const netChangeInCashAndCashEquivalents = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;
            
            // Calculate opening and closing cash and cash equivalents
            const openingCashAndCashEquivalents = await this.getOpeningCashAndCashEquivalents(startDate, residence);
            const closingCashAndCashEquivalents = openingCashAndCashEquivalents + netChangeInCashAndCashEquivalents;
            
            // Get detailed breakdown of cash and cash equivalents
            const cashAndCashEquivalentsBreakdown = await this.getCashAndCashEquivalentsBreakdown(endDate, residence);
            
            console.log(`✅ Cash Basis Cash Flow Statement with Cash & Cash Equivalents Generated:`);
            console.log(`   Operating Cash Flow: $${netOperatingCashFlow.toLocaleString()}`);
            console.log(`   Investing Cash Flow: $${netInvestingCashFlow.toLocaleString()}`);
            console.log(`   Financing Cash Flow: $${netFinancingCashFlow.toLocaleString()}`);
            console.log(`   Net Change in Cash & Cash Equivalents: $${netChangeInCashAndCashEquivalents.toLocaleString()}`);
            console.log(`   Opening Cash & Cash Equivalents: $${openingCashAndCashEquivalents.toLocaleString()}`);
            console.log(`   Closing Cash & Cash Equivalents: $${closingCashAndCashEquivalents.toLocaleString()}`);
            
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
                net_change_in_cash_and_cash_equivalents: netChangeInCashAndCashEquivalents,
                cash_and_cash_equivalents: {
                    opening_balance: openingCashAndCashEquivalents,
                    closing_balance: closingCashAndCashEquivalents,
                    breakdown: cashAndCashEquivalentsBreakdown
                },
                accounting_principles: {
                    cash_basis: 'Only actual cash receipts and payments recorded',
                    no_accruals: 'No recognition of earned but unpaid revenue',
                    no_deferrals: 'No recognition of incurred but unpaid expenses',
                    cash_reconciliation: 'Must reconcile with actual cash balance changes',
                    ifrs_compliance: 'Cash and cash equivalents defined per IFRS 7 standards'
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating cash basis cash flow statement:', error);
            throw error;
        }
    }
    
    /**
     * Get opening cash and cash equivalents balance
     */
    static async getOpeningCashAndCashEquivalents(asOfDate, residence = null) {
        try {
            // Build query with residence filter
            let query = {
                date: { $lt: asOfDate }
            };
            
            if (residence) {
                query.residence = new mongoose.Types.ObjectId(residence);
            }
            
            // Get all transaction entries up to the specified date
            const entries = await TransactionEntry.find(query)
                .populate('residence')
                .populate('entries.account');
            
            let openingBalance = 0;
            
            // Process each transaction entry to calculate opening balance
            entries.forEach(entry => {
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        // Only include cash and cash equivalents accounts
                        if (accountCode.startsWith('100') || accountCode.startsWith('101')) {
                            openingBalance += (debit - credit);
                        }
                    });
                }
            });
            
            return openingBalance;
            
        } catch (error) {
            console.error('❌ Error calculating opening cash and cash equivalents:', error);
            return 0;
        }
    }
    
    /**
     * Get detailed breakdown of cash and cash equivalents
     */
    static async getCashAndCashEquivalentsBreakdown(asOfDate, residence = null) {
        try {
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
            
            const breakdown = {
                cash_on_hand: 0,
                cash_at_bank: 0,
                short_term_deposits: 0,
                mobile_wallets: 0,
                petty_cash: 0
            };
            
            // Process each transaction entry to calculate breakdown
            entries.forEach(entry => {
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        const netAmount = debit - credit;
                        
                        // Categorize cash and cash equivalents
                        if (accountCode.startsWith('100') || accountCode.startsWith('101')) {
                            if (accountName.toLowerCase().includes('petty')) {
                                breakdown.petty_cash += netAmount;
                            } else if (accountName.toLowerCase().includes('bank')) {
                                breakdown.cash_at_bank += netAmount;
                            } else if (accountName.toLowerCase().includes('ecocash') || 
                                      accountName.toLowerCase().includes('innbucks') || 
                                      accountName.toLowerCase().includes('mobile')) {
                                breakdown.mobile_wallets += netAmount;
                            } else if (accountName.toLowerCase().includes('deposit') || 
                                      accountName.toLowerCase().includes('investment')) {
                                breakdown.short_term_deposits += netAmount;
                            } else {
                                breakdown.cash_on_hand += netAmount;
                            }
                        }
                    });
                }
            });
            
            return breakdown;
            
        } catch (error) {
            console.error('❌ Error calculating cash and cash equivalents breakdown:', error);
            return {
                cash_on_hand: 0,
                cash_at_bank: 0,
                short_term_deposits: 0,
                mobile_wallets: 0,
                petty_cash: 0
            };
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
            
            // CASH BASIS BALANCE SHEET - Only actual cash and cash equivalents (IFRS 7 compliant)
            const cashBasisAssets = {
                cash_and_cash_equivalents: 0,     // Total cash and cash equivalents
                cash_on_hand: 0,                  // Physical cash
                cash_at_bank: 0,                  // Bank account balances
                short_term_deposits: 0,           // Deposits maturing ≤ 3 months
                mobile_wallets: 0,                // EcoCash, InnBucks, etc.
                petty_cash: 0                     // Petty cash funds
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
                        
                        // CASH BASIS ASSETS - Only actual cash and cash equivalents (IFRS 7 compliant)
                        if (accountCode.startsWith('100') || accountCode.startsWith('101')) { // Cash accounts
                            const netAmount = debit - credit;
                            
                            if (accountName.toLowerCase().includes('petty')) {
                                cashBasisAssets.petty_cash += netAmount;
                            } else if (accountName.toLowerCase().includes('bank')) {
                                cashBasisAssets.cash_at_bank += netAmount;
                            } else if (accountName.toLowerCase().includes('ecocash') || 
                                      accountName.toLowerCase().includes('innbucks') || 
                                      accountName.toLowerCase().includes('mobile')) {
                                cashBasisAssets.mobile_wallets += netAmount;
                            } else if (accountName.toLowerCase().includes('deposit') || 
                                      accountName.toLowerCase().includes('investment')) {
                                cashBasisAssets.short_term_deposits += netAmount;
                            } else {
                                cashBasisAssets.cash_on_hand += netAmount;
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
            
            // Calculate total cash and cash equivalents
            cashBasisAssets.cash_and_cash_equivalents = cashBasisAssets.cash_on_hand + 
                                                       cashBasisAssets.cash_at_bank + 
                                                       cashBasisAssets.short_term_deposits + 
                                                       cashBasisAssets.mobile_wallets + 
                                                       cashBasisAssets.petty_cash;
            
            // Calculate totals
            const totalAssets = cashBasisAssets.cash_and_cash_equivalents;
            
            const totalLiabilities = cashBasisLiabilities.loans_payable + 
                                   cashBasisLiabilities.accounts_payable + 
                                   cashBasisLiabilities.accrued_expenses;
            
            const totalEquity = cashBasisEquity.owners_equity + cashBasisEquity.retained_earnings;
            
            // Verify accounting equation: Assets = Liabilities + Equity
            const accountingEquation = Math.abs(totalAssets - (totalLiabilities + totalEquity));
            const isBalanced = accountingEquation < 0.01; // Allow for small rounding differences
            
            console.log(`✅ Cash Basis Balance Sheet with Cash & Cash Equivalents Generated:`);
            console.log(`   Cash on Hand: $${cashBasisAssets.cash_on_hand.toLocaleString()}`);
            console.log(`   Cash at Bank: $${cashBasisAssets.cash_at_bank.toLocaleString()}`);
            console.log(`   Short-term Deposits: $${cashBasisAssets.short_term_deposits.toLocaleString()}`);
            console.log(`   Mobile Wallets: $${cashBasisAssets.mobile_wallets.toLocaleString()}`);
            console.log(`   Petty Cash: $${cashBasisAssets.petty_cash.toLocaleString()}`);
            console.log(`   Total Cash & Cash Equivalents: $${cashBasisAssets.cash_and_cash_equivalents.toLocaleString()}`);
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
                cash_and_cash_equivalents_breakdown: {
                    cash_on_hand: cashBasisAssets.cash_on_hand,
                    cash_at_bank: cashBasisAssets.cash_at_bank,
                    short_term_deposits: cashBasisAssets.short_term_deposits,
                    mobile_wallets: cashBasisAssets.mobile_wallets,
                    petty_cash: cashBasisAssets.petty_cash,
                    total: cashBasisAssets.cash_and_cash_equivalents
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
                    gaap_compliant: 'Follows cash basis accounting principles',
                    ifrs_compliance: 'Cash and cash equivalents defined per IFRS 7 standards',
                    cash_equivalents_definition: 'Short-term, highly liquid investments readily convertible to known amounts of cash'
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating cash basis balance sheet:', error);
            throw error;
        }
    }
    
    /**
     * Validate cash flow statement reconciliation with cash and cash equivalents
     */
    static async validateCashFlowReconciliation(period, residence = null) {
        try {
            console.log(`🔍 Validating cash flow reconciliation for ${period}${residence ? ` (residence: ${residence})` : ''}`);
            
            // Generate cash flow statement
            const cashFlowStatement = await this.generateCashBasisCashFlowStatement(period, residence);
            
            // Get actual cash and cash equivalents balances
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            const openingBalance = await this.getOpeningCashAndCashEquivalents(startDate, residence);
            const closingBalance = await this.getCashAndCashEquivalentsBreakdown(endDate, residence);
            
            // Calculate expected closing balance from cash flow
            const expectedClosingBalance = openingBalance + cashFlowStatement.net_change_in_cash_and_cash_equivalents;
            const actualClosingBalance = closingBalance.cash_on_hand + 
                                       closingBalance.cash_at_bank + 
                                       closingBalance.short_term_deposits + 
                                       closingBalance.mobile_wallets + 
                                       closingBalance.petty_cash;
            
            // Calculate difference
            const difference = Math.abs(expectedClosingBalance - actualClosingBalance);
            const isReconciled = difference < 0.01; // Allow for small rounding differences
            
            console.log(`📊 Cash Flow Reconciliation Validation:`);
            console.log(`   Opening Balance: $${openingBalance.toLocaleString()}`);
            console.log(`   Net Change: $${cashFlowStatement.net_change_in_cash_and_cash_equivalents.toLocaleString()}`);
            console.log(`   Expected Closing: $${expectedClosingBalance.toLocaleString()}`);
            console.log(`   Actual Closing: $${actualClosingBalance.toLocaleString()}`);
            console.log(`   Difference: $${difference.toLocaleString()}`);
            console.log(`   Reconciled: ${isReconciled ? '✅ YES' : '❌ NO'}`);
            
            return {
                period,
                residence,
                opening_balance: openingBalance,
                net_change: cashFlowStatement.net_change_in_cash_and_cash_equivalents,
                expected_closing_balance: expectedClosingBalance,
                actual_closing_balance: actualClosingBalance,
                difference: difference,
                is_reconciled: isReconciled,
                cash_flow_statement: cashFlowStatement,
                validation_timestamp: new Date()
            };
            
        } catch (error) {
            console.error('❌ Error validating cash flow reconciliation:', error);
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
