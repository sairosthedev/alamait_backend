const TransactionEntry = require('../models/TransactionEntry');

/**
 * Monthly Financial Service
 * 
 * Provides monthly breakdowns for all financial activities:
 * - Monthly Income Statement
 * - Monthly Expenses
 * - Monthly Cash Flow
 * - Monthly Balance Sheet
 * - Monthly Trial Balance
 */

class MonthlyFinancialService {
    
    static monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];

    /**
     * Generate Monthly Income Statement
     */
    static async generateMonthlyIncomeStatement(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            // Initialize monthly data structure
            const monthlyData = {};
            this.monthNames.forEach(month => {
                monthlyData[month] = {
                    revenue: {}, expenses: {}, 
                    total_revenue: 0, total_expenses: 0, net_income: 0
                };
            });
            
            // Process each transaction entry
            entries.forEach(entry => {
                const month = entry.date.getMonth();
                const monthName = this.monthNames[month];
                
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    if (accountType === 'Income' || accountType === 'income') {
                        const key = `${accountCode} - ${accountName}`;
                        if (!monthlyData[monthName].revenue[key]) {
                            monthlyData[monthName].revenue[key] = 0;
                        }
                        monthlyData[monthName].revenue[key] += debit; // Income increases with debit in this system
                        monthlyData[monthName].total_revenue += debit; // Income increases with debit in this system
                    } else if (accountType === 'Expense' || accountType === 'expense') {
                        const key = `${accountCode} - ${accountName}`;
                        if (!monthlyData[monthName].expenses[key]) {
                            monthlyData[monthName].expenses[key] = 0;
                        }
                        monthlyData[monthName].expenses[key] += debit - credit;
                        monthlyData[monthName].total_expenses += debit - credit;
                    }
                });
                
                // Calculate net income for this month
                monthlyData[monthName].net_income = 
                    monthlyData[monthName].total_revenue - monthlyData[monthName].total_expenses;
            });
            
            // Calculate yearly totals
            const yearlyTotals = {
                revenue: {}, expenses: {},
                total_revenue: 0, total_expenses: 0, net_income: 0
            };
            
            this.monthNames.forEach(monthName => {
                const monthData = monthlyData[monthName];
                
                Object.keys(monthData.revenue).forEach(account => {
                    if (!yearlyTotals.revenue[account]) yearlyTotals.revenue[account] = 0;
                    yearlyTotals.revenue[account] += monthData.revenue[account];
                });
                
                Object.keys(monthData.expenses).forEach(account => {
                    if (!yearlyTotals.expenses[account]) yearlyTotals.expenses[account] = 0;
                    yearlyTotals.expenses[account] += monthData.expenses[account];
                });
                
                yearlyTotals.total_revenue += monthData.total_revenue;
                yearlyTotals.total_expenses += monthData.total_expenses;
            });
            
            yearlyTotals.net_income = yearlyTotals.total_revenue - yearlyTotals.total_expenses;
            
            return {
                period, basis,
                monthly_breakdown: monthlyData,
                yearly_totals: {
                    ...yearlyTotals,
                    gross_profit: yearlyTotals.total_revenue,
                    operating_income: yearlyTotals.net_income
                },
                summary: {
                    total_months_with_data: this.monthNames.filter(month => 
                        monthlyData[month].total_revenue > 0 || monthlyData[month].total_expenses > 0
                    ).length,
                    best_month: this.monthNames.reduce((best, month) => 
                        monthlyData[month].net_income > monthlyData[best].net_income ? month : best
                    ),
                    worst_month: this.monthNames.reduce((worst, month) => 
                        monthlyData[month].net_income < monthlyData[worst].net_income ? month : worst
                    ),
                    average_monthly_revenue: yearlyTotals.total_revenue / 12,
                    average_monthly_expenses: yearlyTotals.total_expenses / 12,
                    average_monthly_net_income: yearlyTotals.net_income / 12
                }
            };
            
        } catch (error) {
            console.error('Error generating monthly income statement:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Expenses
     */
    static async generateMonthlyExpenses(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            // Initialize monthly expense structure
            const monthlyExpenses = {};
            this.monthNames.forEach(month => {
                monthlyExpenses[month] = {
                    expenses: {}, total_expenses: 0, expense_count: 0, categories: {}
                };
            });
            
            // Process expenses by month
            entries.forEach(entry => {
                const month = entry.date.getMonth();
                const monthName = this.monthNames[month];
                
                entry.entries.forEach(line => {
                    if (line.accountType === 'Expense' || line.accountType === 'expense') {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const amount = line.debit - line.credit;
                        
                        const key = `${accountCode} - ${accountName}`;
                        
                        if (!monthlyExpenses[monthName].expenses[key]) {
                            monthlyExpenses[monthName].expenses[key] = 0;
                        }
                        
                        monthlyExpenses[monthName].expenses[key] += amount;
                        monthlyExpenses[monthName].total_expenses += amount;
                        monthlyExpenses[monthName].expense_count += 1;
                        
                        // Categorize by expense type
                        const category = this.getExpenseCategory(accountCode);
                        if (!monthlyExpenses[monthName].categories[category]) {
                            monthlyExpenses[monthName].categories[category] = 0;
                        }
                        monthlyExpenses[monthName].categories[category] += amount;
                    }
                });
            });
            
            // Calculate yearly totals
            const yearlyTotals = {
                expenses: {}, categories: {},
                total_expenses: 0, total_transactions: 0
            };
            
            this.monthNames.forEach(monthName => {
                const monthData = monthlyExpenses[monthName];
                
                Object.keys(monthData.expenses).forEach(expense => {
                    if (!yearlyTotals.expenses[expense]) yearlyTotals.expenses[expense] = 0;
                    yearlyTotals.expenses[expense] += monthData.expenses[expense];
                });
                
                Object.keys(monthData.categories).forEach(category => {
                    if (!yearlyTotals.categories[category]) yearlyTotals.categories[category] = 0;
                    yearlyTotals.categories[category] += monthData.categories[category];
                });
                
                yearlyTotals.total_expenses += monthData.total_expenses;
                yearlyTotals.total_transactions += monthData.expense_count;
            });
            
            return {
                period, basis,
                monthly_breakdown: monthlyExpenses,
                yearly_totals: yearlyTotals,
                summary: {
                    average_monthly_expenses: yearlyTotals.total_expenses / 12,
                    highest_expense_month: this.monthNames.reduce((highest, month) => 
                        monthlyExpenses[month].total_expenses > monthlyExpenses[highest].total_expenses ? month : highest
                    ),
                    lowest_expense_month: this.monthNames.reduce((lowest, month) => 
                        monthlyExpenses[month].total_expenses < monthlyExpenses[lowest].total_expenses ? month : lowest
                    ),
                    top_expense_category: Object.entries(yearlyTotals.categories)
                        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'
                }
            };
            
        } catch (error) {
            console.error('Error generating monthly expenses:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Cash Flow
     */
    static async generateMonthlyCashFlow(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            // Initialize monthly cash flow structure
            const monthlyCashFlow = {};
            this.monthNames.forEach(month => {
                monthlyCashFlow[month] = {
                    operating_activities: { inflows: 0, outflows: 0, net: 0 },
                    investing_activities: { inflows: 0, outflows: 0, net: 0 },
                    financing_activities: { inflows: 0, outflows: 0, net: 0 },
                    net_cash_flow: 0,
                    opening_balance: 0,
                    closing_balance: 0
                };
            });
            
            // Process cash flows by month
            entries.forEach(entry => {
                const month = entry.date.getMonth();
                const monthName = this.monthNames[month];
                
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    // Determine activity type and cash flow
                    const activityType = this.getCashFlowActivityType(accountCode, accountType);
                    const cashFlow = this.calculateCashFlow(accountType, debit, credit);
                    
                    if (activityType === 'operating') {
                        if (cashFlow > 0) {
                            monthlyCashFlow[monthName].operating_activities.inflows += cashFlow;
                        } else {
                            monthlyCashFlow[monthName].operating_activities.outflows += Math.abs(cashFlow);
                        }
                        monthlyCashFlow[monthName].operating_activities.net += cashFlow;
                    } else if (activityType === 'investing') {
                        if (cashFlow > 0) {
                            monthlyCashFlow[monthName].investing_activities.inflows += cashFlow;
                        } else {
                            monthlyCashFlow[monthName].investing_activities.outflows += Math.abs(cashFlow);
                        }
                        monthlyCashFlow[monthName].investing_activities.net += cashFlow;
                    } else if (activityType === 'financing') {
                        if (cashFlow > 0) {
                            monthlyCashFlow[monthName].financing_activities.inflows += cashFlow;
                        } else {
                            monthlyCashFlow[monthName].financing_activities.outflows += Math.abs(cashFlow);
                        }
                        monthlyCashFlow[monthName].financing_activities.net += cashFlow;
                    }
                });
                
                // Calculate net cash flow for the month
                const monthData = monthlyCashFlow[monthName];
                monthData.net_cash_flow = 
                    monthData.operating_activities.net + 
                    monthData.investing_activities.net + 
                    monthData.financing_activities.net;
            });
            
            // Calculate running balances
            let runningBalance = 0;
            this.monthNames.forEach(monthName => {
                monthlyCashFlow[monthName].opening_balance = runningBalance;
                runningBalance += monthlyCashFlow[monthName].net_cash_flow;
                monthlyCashFlow[monthName].closing_balance = runningBalance;
            });
            
            // Calculate yearly totals
            const yearlyTotals = {
                operating_activities: { inflows: 0, outflows: 0, net: 0 },
                investing_activities: { inflows: 0, outflows: 0, net: 0 },
                financing_activities: { inflows: 0, outflows: 0, net: 0 },
                net_cash_flow: 0
            };
            
            this.monthNames.forEach(monthName => {
                const monthData = monthlyCashFlow[monthName];
                
                yearlyTotals.operating_activities.inflows += monthData.operating_activities.inflows;
                yearlyTotals.operating_activities.outflows += monthData.operating_activities.outflows;
                yearlyTotals.operating_activities.net += monthData.operating_activities.net;
                
                yearlyTotals.investing_activities.inflows += monthData.investing_activities.inflows;
                yearlyTotals.investing_activities.outflows += monthData.investing_activities.outflows;
                yearlyTotals.investing_activities.net += monthData.investing_activities.net;
                
                yearlyTotals.financing_activities.inflows += monthData.financing_activities.inflows;
                yearlyTotals.financing_activities.outflows += monthData.financing_activities.outflows;
                yearlyTotals.financing_activities.net += monthData.financing_activities.net;
                
                yearlyTotals.net_cash_flow += monthData.net_cash_flow;
            });
            
            return {
                period, basis,
                monthly_breakdown: monthlyCashFlow,
                yearly_totals: yearlyTotals,
                summary: {
                    best_cash_flow_month: this.monthNames.reduce((best, month) => 
                        monthlyCashFlow[month].net_cash_flow > monthlyCashFlow[best].net_cash_flow ? month : best
                    ),
                    worst_cash_flow_month: this.monthNames.reduce((worst, month) => 
                        monthlyCashFlow[month].net_cash_flow < monthlyCashFlow[worst].net_cash_flow ? month : worst
                    ),
                    average_monthly_cash_flow: yearlyTotals.net_cash_flow / 12,
                    ending_cash_balance: runningBalance
                }
            };
            
        } catch (error) {
            console.error('Error generating monthly cash flow:', error);
            throw error;
        }
    }

    // Helper methods
    static getExpenseCategory(accountCode) {
        if (accountCode.startsWith('5001')) return 'Maintenance';
        if (accountCode.startsWith('5002')) return 'Utilities';
        if (accountCode.startsWith('5003')) return 'Insurance';
        if (accountCode.startsWith('5004')) return 'Property Management';
        if (accountCode.startsWith('5005')) return 'Administrative';
        return 'Other';
    }

    static getCashFlowActivityType(accountCode, accountType) {
        if (accountType === 'Income' || accountType === 'Expense') return 'operating';
        if (accountCode.startsWith('1') && accountCode !== '1001' && accountCode !== '1002') return 'investing';
        if (accountCode.startsWith('2') || accountCode.startsWith('3')) return 'financing';
        return 'operating';
    }

    static calculateCashFlow(accountType, debit, credit) {
        if (accountType === 'Asset' || accountType === 'asset') {
            return credit - debit;
        } else if (accountType === 'Liability' || accountType === 'liability') {
            return debit - credit;
        } else if (accountType === 'Income' || accountType === 'income') {
            return credit - debit;
        } else if (accountType === 'Expense' || accountType === 'expense') {
            return debit - credit;
        }
        return 0;
    }
}

module.exports = MonthlyFinancialService; 