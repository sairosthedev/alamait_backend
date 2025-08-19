const mongoose = require('mongoose');
require('dotenv').config();

// Mock TransactionEntry for testing
const TransactionEntry = {
    find: async (query) => {
        // This would be replaced with actual database calls
        return [];
    }
};

class EnhancedFinancialReportingService {
    
    static calculateCashFlow(accountType, debit, credit) {
        if (accountType === 'Asset' || accountType === 'asset') {
            return credit - debit; // Asset decrease = cash inflow (+), Asset increase = cash outflow (-)
        } else if (accountType === 'Liability' || accountType === 'liability') {
            return debit - credit; // Liability increase = cash inflow (+), Liability decrease = cash outflow (-)
        } else if (accountType === 'Income' || accountType === 'income') {
            return credit; // Income = cash inflow (+) - when you receive money
        } else if (accountType === 'Expense' || accountType === 'expense') {
            return -(debit - credit); // Expense = cash outflow (-) - when you pay money
        }
        return 0;
    }

    static async generateMonthlyCashFlow(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating enhanced cash flow statement for ${period} (${basis} basis)`);

            // Get all relevant transactions
            const query = {
                date: { $gte: startDate, $lte: endDate }
            };

            if (basis === 'cash') {
                query.source = {
                    $in: ['rental_payment', 'expense_payment', 'manual', 'payment_collection', 'bank_transfer', 'payment']
                };
                console.log('🔵 CASH BASIS: Only including actual cash transactions');
            } else {
                console.log('🔵 ACCRUAL BASIS: Including all transactions');
            }

            const entries = await TransactionEntry.find(query).populate('entries');

            // Initialize monthly structure with detailed breakdowns
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                              'july', 'august', 'september', 'october', 'november', 'december'];
            
            const monthlyCashFlow = {};
            monthNames.forEach(month => {
                monthlyCashFlow[month] = {
                    operating: { 
                        inflows: 0, 
                        outflows: 0, 
                        net: 0,
                        breakdown: {
                            rental_income: 0,
                            other_income: 0,
                            maintenance: 0,
                            utilities: 0,
                            management_fees: 0,
                            other_expenses: 0
                        }
                    },
                    investing: { 
                        inflows: 0, 
                        outflows: 0, 
                        net: 0,
                        breakdown: {
                            property_purchases: 0,
                            capital_improvements: 0,
                            equipment: 0
                        }
                    },
                    financing: { 
                        inflows: 0, 
                        outflows: 0, 
                        net: 0,
                        breakdown: {
                            loans_received: 0,
                            loan_repayments: 0,
                            owner_contributions: 0,
                            owner_distributions: 0,
                            security_deposits: 0
                        }
                    },
                    net_cash_flow: 0,
                    opening_balance: 0,
                    closing_balance: 0
                };
            });

            // Process each transaction
            entries.forEach(entry => {
                if (!entry.entries || !Array.isArray(entry.entries)) {
                    console.log('⚠️ Skipping transaction with no valid entries:', entry._id);
                    return;
                }

                const month = entry.date.getMonth();
                const monthName = monthNames[month];
                
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    const amount = this.calculateCashFlow(accountType, debit, credit);

                    // Skip cash accounts as they're the result, not the activity
                    if (accountCode.startsWith('100') || accountCode.startsWith('101')) {
                        return;
                    }

                    // Categorize based on account code and type with detailed breakdowns
                    if (accountCode.startsWith('400')) { // Rental Income
                        monthlyCashFlow[monthName].operating.inflows += amount;
                        monthlyCashFlow[monthName].operating.breakdown.rental_income += amount;
                    }
                    else if (accountCode.startsWith('500')) { // Expenses
                        monthlyCashFlow[monthName].operating.outflows += Math.abs(amount);
                        
                        if (accountCode.startsWith('5001')) { // Maintenance
                            monthlyCashFlow[monthName].operating.breakdown.maintenance += Math.abs(amount);
                        } 
                        else if (accountCode.startsWith('5002')) { // Utilities
                            monthlyCashFlow[monthName].operating.breakdown.utilities += Math.abs(amount);
                        }
                        else {
                            monthlyCashFlow[monthName].operating.breakdown.other_expenses += Math.abs(amount);
                        }
                    }
                    else if (accountCode.startsWith('200')) { // Liabilities
                        if (accountName.toLowerCase().includes('deposit')) {
                            // Security deposits - financing activity
                            if (amount > 0) {
                                monthlyCashFlow[monthName].financing.inflows += amount;
                                monthlyCashFlow[monthName].financing.breakdown.security_deposits += amount;
                            } else {
                                monthlyCashFlow[monthName].financing.outflows += Math.abs(amount);
                                monthlyCashFlow[monthName].financing.breakdown.security_deposits -= Math.abs(amount);
                            }
                        } else if (accountName.toLowerCase().includes('loan')) {
                            // Loan activities
                            if (amount > 0) {
                                monthlyCashFlow[monthName].financing.inflows += amount;
                                monthlyCashFlow[monthName].financing.breakdown.loans_received += amount;
                            } else {
                                monthlyCashFlow[monthName].financing.outflows += Math.abs(amount);
                                monthlyCashFlow[monthName].financing.breakdown.loan_repayments += Math.abs(amount);
                            }
                        } else {
                            // Other payables - operating activity
                            if (amount > 0) {
                                monthlyCashFlow[monthName].operating.inflows += amount;
                            } else {
                                monthlyCashFlow[monthName].operating.outflows += Math.abs(amount);
                            }
                        }
                    }
                    else if (accountCode.startsWith('300')) { // Equity
                        if (amount > 0) {
                            monthlyCashFlow[monthName].financing.inflows += amount;
                            monthlyCashFlow[monthName].financing.breakdown.owner_contributions += amount;
                        } else {
                            monthlyCashFlow[monthName].financing.outflows += Math.abs(amount);
                            monthlyCashFlow[monthName].financing.breakdown.owner_distributions += Math.abs(amount);
                        }
                    }
                    else if (accountCode.startsWith('600')) { // Fixed Assets
                        monthlyCashFlow[monthName].investing.outflows += Math.abs(amount);
                        
                        if (accountName.toLowerCase().includes('property') || 
                            accountName.toLowerCase().includes('building')) {
                            monthlyCashFlow[monthName].investing.breakdown.property_purchases += Math.abs(amount);
                        } 
                        else if (accountName.toLowerCase().includes('improvement')) {
                            monthlyCashFlow[monthName].investing.breakdown.capital_improvements += Math.abs(amount);
                        }
                        else {
                            monthlyCashFlow[monthName].investing.breakdown.equipment += Math.abs(amount);
                        }
                    }
                    else if (accountCode.startsWith('110')) { // Accounts Receivable
                        // AR collections are operating activities
                        if (amount > 0) {
                            monthlyCashFlow[monthName].operating.inflows += amount;
                            monthlyCashFlow[monthName].operating.breakdown.other_income += amount;
                        }
                    }
                    else if (accountCode.startsWith('410')) { // Other Income
                        monthlyCashFlow[monthName].operating.inflows += amount;
                        monthlyCashFlow[monthName].operating.breakdown.other_income += amount;
                    }
                    else {
                        // Default to operating for any unclassified accounts
                        if (amount > 0) {
                            monthlyCashFlow[monthName].operating.inflows += amount;
                        } else {
                            monthlyCashFlow[monthName].operating.outflows += Math.abs(amount);
                        }
                    }
                });
            });

            // Calculate net cash flows and running balances
            let openingBalance = 0; // Would ideally come from previous period
            monthNames.forEach(month => {
                const monthData = monthlyCashFlow[month];
                
                // Calculate nets
                monthData.operating.net = monthData.operating.inflows - monthData.operating.outflows;
                monthData.investing.net = monthData.investing.inflows - monthData.investing.outflows;
                monthData.financing.net = monthData.financing.inflows - monthData.financing.outflows;
                
                // Set opening balance
                monthData.opening_balance = openingBalance;
                
                // Calculate net cash flow
                monthData.net_cash_flow = 
                    monthData.operating.net + 
                    monthData.investing.net + 
                    monthData.financing.net;
                    
                // Calculate closing balance
                monthData.closing_balance = openingBalance + monthData.net_cash_flow;
                openingBalance = monthData.closing_balance;
            });

            // Calculate yearly totals
            const yearlyTotals = {
                operating: { inflows: 0, outflows: 0, net: 0 },
                investing: { inflows: 0, outflows: 0, net: 0 },
                financing: { inflows: 0, outflows: 0, net: 0 },
                net_cash_flow: 0
            };

            monthNames.forEach(month => {
                const monthData = monthlyCashFlow[month];
                
                yearlyTotals.operating.inflows += monthData.operating.inflows;
                yearlyTotals.operating.outflows += monthData.operating.outflows;
                yearlyTotals.operating.net += monthData.operating.net;
                
                yearlyTotals.investing.inflows += monthData.investing.inflows;
                yearlyTotals.investing.outflows += monthData.investing.outflows;
                yearlyTotals.investing.net += monthData.investing.net;
                
                yearlyTotals.financing.inflows += monthData.financing.inflows;
                yearlyTotals.financing.outflows += monthData.financing.outflows;
                yearlyTotals.financing.net += monthData.financing.net;
                
                yearlyTotals.net_cash_flow += monthData.net_cash_flow;
            });

            return {
                period,
                basis,
                monthly_breakdown: monthlyCashFlow,
                yearly_totals: yearlyTotals,
                summary: {
                    ending_cash_balance: monthlyCashFlow['december'].closing_balance,
                    net_cash_from_operations: yearlyTotals.operating.net,
                    net_cash_used_in_investing: yearlyTotals.investing.net,
                    net_cash_from_financing: yearlyTotals.financing.net
                }
            };

        } catch (error) {
            console.error('Error generating enhanced cash flow statement:', error);
            throw error;
        }
    }

    // Add validation method
    static async validateCashFlow(period) {
        try {
            const cashFlow = await this.generateMonthlyCashFlow(period);
            
            // Basic validation checks
            const validation = {
                isBalanced: true,
                issues: [],
                warnings: []
            };

            // Check if cash flows balance
            monthNames.forEach(month => {
                const monthData = cashFlow.monthly_breakdown[month];
                const calculatedNet = monthData.operating.net + monthData.investing.net + monthData.financing.net;
                
                if (Math.abs(calculatedNet - monthData.net_cash_flow) > 0.01) {
                    validation.isBalanced = false;
                    validation.issues.push(`${month}: Net cash flow mismatch - calculated: ${calculatedNet}, recorded: ${monthData.net_cash_flow}`);
                }
            });

            // Check for unusual patterns
            if (cashFlow.yearly_totals.operating.outflows > cashFlow.yearly_totals.operating.inflows * 2) {
                validation.warnings.push('Operating outflows significantly exceed inflows - check for unusual expenses');
            }

            if (cashFlow.yearly_totals.financing.net > cashFlow.yearly_totals.operating.net * 3) {
                validation.warnings.push('Financing activities dominate cash flow - review business model');
            }

            return validation;

        } catch (error) {
            console.error('Error validating cash flow:', error);
            throw error;
        }
    }

    // Helper method for better account classification
    static classifyCashFlowActivity(accountCode, accountName) {
        if (/^[45]/.test(accountCode)) return 'operating';
        if (/^[6]/.test(accountCode)) return 'investing';
        if (/^[23]/.test(accountCode)) return 'financing';
        if (accountName.toLowerCase().includes('deposit')) return 'financing';
        return 'operating'; // default
    }

    // Security deposit tracking
    static trackSecurityDeposits(entries) {
        const deposits = {
            received: 0,
            refunded: 0,
            forfeited: 0,
            current_liability: 0
        };
        
        entries.forEach(entry => {
            entry.entries.forEach(line => {
                if (line.accountName.toLowerCase().includes('deposit')) {
                    if (line.accountType === 'Liability') {
                        if (line.credit > 0) deposits.received += line.credit;
                        if (line.debit > 0) deposits.refunded += line.debit;
                        deposits.current_liability += (line.credit - line.debit);
                    } else if (line.accountType === 'Income' && line.credit > 0) {
                        deposits.forfeited += line.credit;
                    }
                }
            });
        });
        
        return deposits;
    }
}

module.exports = EnhancedFinancialReportingService;
