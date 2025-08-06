const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Residence = require('../models/Residence');
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
            
            console.log(`Generating income statement for ${period} from ${startDate} to ${endDate}`);
            
            // Get all transaction entries for the period (without metadata filter)
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            console.log(`Found ${entries.length} transaction entries for the period`);
            
            // Calculate revenue and expenses from transaction entries
            const revenue = {};
            const expenses = {};
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    if (accountType === 'Income' || accountType === 'income') {
                        const key = `${accountCode} - ${accountName}`;
                        if (!revenue[key]) revenue[key] = 0;
                        revenue[key] += credit - debit; // Income increases with credit
                    } else if (accountType === 'Expense' || accountType === 'expense') {
                        const key = `${accountCode} - ${accountName}`;
                        if (!expenses[key]) expenses[key] = 0;
                        expenses[key] += debit - credit; // Expenses increase with debit
                    }
                });
            });
            
            // Calculate totals
            const totalRevenue = Object.values(revenue).reduce((sum, amount) => sum + amount, 0);
            const totalExpenses = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
            const netIncome = totalRevenue - totalExpenses;
            
            console.log(`Revenue: $${totalRevenue}, Expenses: $${totalExpenses}, Net Income: $${netIncome}`);
            
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
     * Generate Monthly Income Statement (Profit & Loss by Month)
     */
    static async generateMonthlyIncomeStatement(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating monthly income statement for ${period} from ${startDate} to ${endDate}`);
            
            // Get all transaction entries for the period
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            console.log(`Found ${entries.length} transaction entries for the period`);
            
            // Initialize monthly data structure
            const monthlyData = {
                january: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                february: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                march: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                april: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                may: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                june: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                july: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                august: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                september: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                october: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                november: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 },
                december: { revenue: {}, expenses: {}, total_revenue: 0, total_expenses: 0, net_income: 0 }
            };
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Process each transaction entry
            entries.forEach(entry => {
                const month = entry.date.getMonth(); // 0-11
                const monthName = monthNames[month];
                
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
                        monthlyData[monthName].revenue[key] += credit - debit;
                        monthlyData[monthName].total_revenue += credit - debit;
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
                revenue: {},
                expenses: {},
                total_revenue: 0,
                total_expenses: 0,
                net_income: 0
            };
            
            // Aggregate all months
            monthNames.forEach(monthName => {
                const monthData = monthlyData[monthName];
                
                // Aggregate revenue accounts
                Object.keys(monthData.revenue).forEach(account => {
                    if (!yearlyTotals.revenue[account]) yearlyTotals.revenue[account] = 0;
                    yearlyTotals.revenue[account] += monthData.revenue[account];
                });
                
                // Aggregate expense accounts
                Object.keys(monthData.expenses).forEach(account => {
                    if (!yearlyTotals.expenses[account]) yearlyTotals.expenses[account] = 0;
                    yearlyTotals.expenses[account] += monthData.expenses[account];
                });
                
                yearlyTotals.total_revenue += monthData.total_revenue;
                yearlyTotals.total_expenses += monthData.total_expenses;
            });
            
            yearlyTotals.net_income = yearlyTotals.total_revenue - yearlyTotals.total_expenses;
            
            return {
                period,
                basis,
                monthly_breakdown: monthlyData,
                yearly_totals: {
                    ...yearlyTotals,
                    gross_profit: yearlyTotals.total_revenue,
                    operating_income: yearlyTotals.net_income
                },
                summary: {
                    total_months_with_data: monthNames.filter(month => 
                        monthlyData[month].total_revenue > 0 || monthlyData[month].total_expenses > 0
                    ).length,
                    best_month: monthNames.reduce((best, month) => 
                        monthlyData[month].net_income > monthlyData[best].net_income ? month : best
                    ),
                    worst_month: monthNames.reduce((worst, month) => 
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
     * Generate Monthly Expenses Breakdown
     */
    static async generateMonthlyExpenses(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating monthly expenses for ${period} from ${startDate} to ${endDate}`);
            
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Initialize monthly expense structure
            const monthlyExpenses = {};
            monthNames.forEach(month => {
                monthlyExpenses[month] = {
                    expenses: {},
                    total_expenses: 0,
                    expense_count: 0,
                    categories: {}
                };
            });
            
            // Process expenses by month
            entries.forEach(entry => {
                const month = entry.date.getMonth();
                const monthName = monthNames[month];
                
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
                expenses: {},
                categories: {},
                total_expenses: 0,
                total_transactions: 0
            };
            
            monthNames.forEach(monthName => {
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
                period,
                basis,
                monthly_breakdown: monthlyExpenses,
                yearly_totals: yearlyTotals,
                summary: {
                    average_monthly_expenses: yearlyTotals.total_expenses / 12,
                    highest_expense_month: monthNames.reduce((highest, month) => 
                        monthlyExpenses[month].total_expenses > monthlyExpenses[highest].total_expenses ? month : highest
                    ),
                    lowest_expense_month: monthNames.reduce((lowest, month) => 
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
            
            console.log(`Generating monthly cash flow for ${period} from ${startDate} to ${endDate}`);
            
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Initialize monthly cash flow structure
            const monthlyCashFlow = {};
            monthNames.forEach(month => {
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
                const monthName = monthNames[month];
                
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
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
            monthNames.forEach(monthName => {
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
            
            monthNames.forEach(monthName => {
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
                period,
                basis,
                monthly_breakdown: monthlyCashFlow,
                yearly_totals: yearlyTotals,
                summary: {
                    best_cash_flow_month: monthNames.reduce((best, month) => 
                        monthlyCashFlow[month].net_cash_flow > monthlyCashFlow[best].net_cash_flow ? month : best
                    ),
                    worst_cash_flow_month: monthNames.reduce((worst, month) => 
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

    /**
     * Generate Monthly Balance Sheet
     */
    static async generateMonthlyBalanceSheet(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating monthly balance sheet for ${period} from ${startDate} to ${endDate}`);
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Initialize monthly balance sheet structure
            const monthlyBalanceSheet = {};
            monthNames.forEach(month => {
                monthlyBalanceSheet[month] = {
                    assets: { current: {}, non_current: {}, total: 0 },
                    liabilities: { current: {}, non_current: {}, total: 0 },
                    equity: { total: 0 },
                    total_assets: 0,
                    total_liabilities: 0,
                    net_worth: 0
                };
            });
            
            // Calculate balance sheet for each month end
            for (let i = 0; i < monthNames.length; i++) {
                const monthName = monthNames[i];
                const monthEndDate = new Date(`${period}-${String(i + 1).padStart(2, '0')}-${new Date(period, i + 1, 0).getDate()}`);
                
                // Get all transactions up to month end
                const entries = await TransactionEntry.find({
                    date: { $lte: monthEndDate }
                }).populate('entries');
                
                // Calculate account balances
                const accountBalances = {};
                
                entries.forEach(entry => {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        const key = `${accountCode} - ${accountName}`;
                        if (!accountBalances[key]) {
                            accountBalances[key] = {
                                accountCode,
                                accountName,
                                accountType,
                                balance: 0
                            };
                        }
                        
                        // Calculate balance based on account type
                        if (accountType === 'Asset' || accountType === 'asset') {
                            accountBalances[key].balance += debit - credit;
                        } else if (accountType === 'Liability' || accountType === 'liability') {
                            accountBalances[key].balance += credit - debit;
                        } else if (accountType === 'Equity' || accountType === 'equity') {
                            accountBalances[key].balance += credit - debit;
                        }
                    });
                });
                
                // Organize by balance sheet sections
                Object.values(accountBalances).forEach(account => {
                    if (account.accountType === 'Asset' || account.accountType === 'asset') {
                        const isCurrent = this.isCurrentAsset(account.accountName);
                        const section = isCurrent ? 'current' : 'non_current';
                        
                        if (!monthlyBalanceSheet[monthName].assets[section][account.accountName]) {
                            monthlyBalanceSheet[monthName].assets[section][account.accountName] = 0;
                        }
                        monthlyBalanceSheet[monthName].assets[section][account.accountName] = account.balance;
                        monthlyBalanceSheet[monthName].assets.total += account.balance;
                    } else if (account.accountType === 'Liability' || account.accountType === 'liability') {
                        const isCurrent = this.isCurrentLiability(account.accountName);
                        const section = isCurrent ? 'current' : 'non_current';
                        
                        if (!monthlyBalanceSheet[monthName].liabilities[section][account.accountName]) {
                            monthlyBalanceSheet[monthName].liabilities[section][account.accountName] = 0;
                        }
                        monthlyBalanceSheet[monthName].liabilities[section][account.accountName] = account.balance;
                        monthlyBalanceSheet[monthName].liabilities.total += account.balance;
                    } else if (account.accountType === 'Equity' || account.accountType === 'equity') {
                        monthlyBalanceSheet[monthName].equity[account.accountName] = account.balance;
                        monthlyBalanceSheet[monthName].equity.total += account.balance;
                    }
                });
                
                // Calculate net worth
                monthlyBalanceSheet[monthName].total_assets = monthlyBalanceSheet[monthName].assets.total;
                monthlyBalanceSheet[monthName].total_liabilities = monthlyBalanceSheet[monthName].liabilities.total;
                monthlyBalanceSheet[monthName].net_worth = 
                    monthlyBalanceSheet[monthName].total_assets - monthlyBalanceSheet[monthName].total_liabilities;
            }
            
            // Calculate yearly summary
            const yearlySummary = {
                average_total_assets: 0,
                average_total_liabilities: 0,
                average_net_worth: 0,
                highest_net_worth_month: '',
                lowest_net_worth_month: '',
                net_worth_growth: 0
            };
            
            let totalAssets = 0, totalLiabilities = 0, totalNetWorth = 0;
            let highestNetWorth = -Infinity, lowestNetWorth = Infinity;
            
            monthNames.forEach(monthName => {
                const monthData = monthlyBalanceSheet[monthName];
                
                totalAssets += monthData.total_assets;
                totalLiabilities += monthData.total_liabilities;
                totalNetWorth += monthData.net_worth;
                
                if (monthData.net_worth > highestNetWorth) {
                    highestNetWorth = monthData.net_worth;
                    yearlySummary.highest_net_worth_month = monthName;
                }
                
                if (monthData.net_worth < lowestNetWorth) {
                    lowestNetWorth = monthData.net_worth;
                    yearlySummary.lowest_net_worth_month = monthName;
                }
            });
            
            yearlySummary.average_total_assets = totalAssets / 12;
            yearlySummary.average_total_liabilities = totalLiabilities / 12;
            yearlySummary.average_net_worth = totalNetWorth / 12;
            
            // Calculate net worth growth (first month to last month)
            const firstMonth = monthlyBalanceSheet[monthNames[0]];
            const lastMonth = monthlyBalanceSheet[monthNames[monthNames.length - 1]];
            yearlySummary.net_worth_growth = lastMonth.net_worth - firstMonth.net_worth;
            
            return {
                period,
                basis,
                monthly_breakdown: monthlyBalanceSheet,
                yearly_summary: yearlySummary
            };
            
        } catch (error) {
            console.error('Error generating monthly balance sheet:', error);
            throw error;
        }
    }

    /**
     * Generate Monthly Trial Balance
     */
    static async generateMonthlyTrialBalance(period, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating monthly trial balance for ${period} from ${startDate} to ${endDate}`);
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Initialize monthly trial balance structure
            const monthlyTrialBalance = {};
            monthNames.forEach(month => {
                monthlyTrialBalance[month] = {
                    accounts: {},
                    total_debits: 0,
                    total_credits: 0,
                    balance: 0
                };
            });
            
            // Calculate trial balance for each month end
            for (let i = 0; i < monthNames.length; i++) {
                const monthName = monthNames[i];
                const monthEndDate = new Date(`${period}-${String(i + 1).padStart(2, '0')}-${new Date(period, i + 1, 0).getDate()}`);
                
                // Get all transactions up to month end
                const entries = await TransactionEntry.find({
                    date: { $lte: monthEndDate }
                }).populate('entries');
                
                // Calculate account balances
                const accountBalances = {};
                
                entries.forEach(entry => {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        const key = `${accountCode} - ${accountName}`;
                        if (!accountBalances[key]) {
                            accountBalances[key] = {
                                accountCode,
                                accountName,
                                accountType,
                                debit: 0,
                                credit: 0,
                                balance: 0
                            };
                        }
                        
                        accountBalances[key].debit += debit;
                        accountBalances[key].credit += credit;
                        
                        // Calculate balance based on account type
                        if (accountType === 'Asset' || accountType === 'asset') {
                            accountBalances[key].balance += debit - credit;
                        } else if (accountType === 'Liability' || accountType === 'liability') {
                            accountBalances[key].balance += credit - debit;
                        } else if (accountType === 'Equity' || accountType === 'equity') {
                            accountBalances[key].balance += credit - debit;
                        } else if (accountType === 'Income' || accountType === 'income') {
                            accountBalances[key].balance += credit - debit;
                        } else if (accountType === 'Expense' || accountType === 'expense') {
                            accountBalances[key].balance += debit - credit;
                        }
                    });
                });
                
                // Add accounts to monthly trial balance
                Object.values(accountBalances).forEach(account => {
                    monthlyTrialBalance[monthName].accounts[account.accountName] = {
                        accountCode: account.accountCode,
                        accountType: account.accountType,
                        debit: account.debit,
                        credit: account.credit,
                        balance: account.balance
                    };
                    
                    monthlyTrialBalance[monthName].total_debits += account.debit;
                    monthlyTrialBalance[monthName].total_credits += account.credit;
                });
                
                // Calculate balance (should be 0 if balanced)
                monthlyTrialBalance[monthName].balance = 
                    monthlyTrialBalance[monthName].total_debits - monthlyTrialBalance[monthName].total_credits;
            }
            
            // Calculate yearly summary
            const yearlySummary = {
                average_total_debits: 0,
                average_total_credits: 0,
                average_balance: 0,
                balanced_months: 0,
                unbalanced_months: 0
            };
            
            let totalDebits = 0, totalCredits = 0, totalBalance = 0;
            let balancedMonths = 0;
            
            monthNames.forEach(monthName => {
                const monthData = monthlyTrialBalance[monthName];
                
                totalDebits += monthData.total_debits;
                totalCredits += monthData.total_credits;
                totalBalance += Math.abs(monthData.balance);
                
                if (Math.abs(monthData.balance) < 0.01) { // Consider balanced if difference is less than 1 cent
                    balancedMonths += 1;
                }
            });
            
            yearlySummary.average_total_debits = totalDebits / 12;
            yearlySummary.average_total_credits = totalCredits / 12;
            yearlySummary.average_balance = totalBalance / 12;
            yearlySummary.balanced_months = balancedMonths;
            yearlySummary.unbalanced_months = 12 - balancedMonths;
            
            return {
                period,
                basis,
                monthly_breakdown: monthlyTrialBalance,
                yearly_summary: yearlySummary
            };
            
        } catch (error) {
            console.error('Error generating monthly trial balance:', error);
            throw error;
        }
    }
    
    /**
     * Generate Balance Sheet
     */
    static async generateBalanceSheet(asOf, basis = 'cash') {
        try {
            const asOfDate = new Date(asOf);
            
            console.log(`Generating balance sheet as of ${asOfDate}`);
            
            // Get all transaction entries up to the specified date
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate }
            }).populate('entries');
            
            console.log(`Found ${entries.length} transaction entries up to ${asOfDate}`);
            
            // Calculate account balances
            const accountBalances = {};
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    const key = `${accountCode} - ${accountName}`;
                    if (!accountBalances[key]) {
                        accountBalances[key] = {
                            code: accountCode,
                            name: accountName,
                            type: accountType,
                            balance: 0
                        };
                    }
                    
                    // Calculate balance based on account type
                    if (accountType === 'Asset' || accountType === 'Expense') {
                        accountBalances[key].balance += debit - credit;
                    } else {
                        accountBalances[key].balance += credit - debit;
                    }
                });
            });
            
            // Group by account type
            const assets = {};
            const liabilities = {};
            const equity = {};
            const income = {};
            const expenses = {};
            
            Object.values(accountBalances).forEach(account => {
                const key = `${account.code} - ${account.name}`;
                switch (account.type) {
                    case 'Asset':
                        assets[key] = account.balance;
                        break;
                    case 'Liability':
                        liabilities[key] = account.balance;
                        break;
                    case 'Equity':
                        equity[key] = account.balance;
                        break;
                    case 'Income':
                        income[key] = account.balance;
                        break;
                    case 'Expense':
                        expenses[key] = account.balance;
                        break;
                }
            });
            
            // Calculate totals
            const totalAssets = Object.values(assets).reduce((sum, amount) => sum + amount, 0);
            const totalLiabilities = Object.values(liabilities).reduce((sum, amount) => sum + amount, 0);
            const totalEquity = Object.values(equity).reduce((sum, amount) => sum + amount, 0);
            const totalIncome = Object.values(income).reduce((sum, amount) => sum + amount, 0);
            const totalExpenses = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
            
            // Calculate retained earnings
            const retainedEarnings = totalIncome - totalExpenses;
            
            return {
                asOf,
                basis,
                assets: {
                    ...assets,
                    total_assets: totalAssets
                },
                liabilities: {
                    ...liabilities,
                    total_liabilities: totalLiabilities
                },
                equity: {
                    ...equity,
                    retained_earnings: retainedEarnings,
                    total_equity: totalEquity + retainedEarnings
                },
                accounting_equation: {
                    assets: totalAssets,
                    liabilities: totalLiabilities,
                    equity: totalEquity + retainedEarnings,
                    balanced: Math.abs((totalAssets - (totalLiabilities + totalEquity + retainedEarnings))) < 0.01
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
            
            console.log(`Generating cash flow statement for ${period}`);
            
            // Get all transaction entries for the period
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            // Calculate cash flows by source
            const operatingActivities = {
                cash_received_from_customers: 0,
                cash_paid_to_suppliers: 0,
                cash_paid_for_expenses: 0
            };
            
            const investingActivities = {
                purchase_of_equipment: 0,
                purchase_of_buildings: 0
            };
            
            const financingActivities = {
                owners_contribution: 0,
                loan_proceeds: 0
            };
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    // Operating activities - cash accounts and income/expense
                    if (accountCode.startsWith('100') || accountCode.startsWith('101')) { // Cash accounts
                        if (entry.source === 'payment') {
                            operatingActivities.cash_received_from_customers += credit;
                        } else if (entry.source === 'expense_payment') {
                            operatingActivities.cash_paid_for_expenses += debit;
                        }
                    }
                });
            });
            
            const netOperatingCashFlow = operatingActivities.cash_received_from_customers - 
                                       operatingActivities.cash_paid_to_suppliers - 
                                       operatingActivities.cash_paid_for_expenses;
            
            const netInvestingCashFlow = investingActivities.purchase_of_equipment + 
                                       investingActivities.purchase_of_buildings;
            
            const netFinancingCashFlow = financingActivities.owners_contribution + 
                                       financingActivities.loan_proceeds;
            
            const netChangeInCash = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;
            
            return {
                period,
                basis,
                operating_activities: operatingActivities,
                investing_activities: investingActivities,
                financing_activities: financingActivities,
                net_change_in_cash: netChangeInCash,
                cash_at_beginning: 0, // Would need to calculate from previous period
                cash_at_end: netChangeInCash
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
            
            console.log(`Generating trial balance as of ${asOfDate}`);
            
            // Get all transaction entries up to the specified date
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate }
            }).populate('entries');
            
            // Calculate account balances
            const accountBalances = {};
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    const key = `${accountCode} - ${accountName}`;
                    if (!accountBalances[key]) {
                        accountBalances[key] = {
                            code: accountCode,
                            name: accountName,
                            type: accountType,
                            debit: 0,
                            credit: 0
                        };
                    }
                    
                    accountBalances[key].debit += debit;
                    accountBalances[key].credit += credit;
                });
            });
            
            // Calculate net balances
            const trialBalance = Object.values(accountBalances).map(account => ({
                accountCode: account.code,
                accountName: account.name,
                accountType: account.type,
                debit: account.debit,
                credit: account.credit,
                balance: account.debit - account.credit
            }));
            
            const totalDebits = trialBalance.reduce((sum, account) => sum + account.debit, 0);
            const totalCredits = trialBalance.reduce((sum, account) => sum + account.credit, 0);
            
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
        try {
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate }
            }).populate('entries');
            
            const balances = {};
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountType === accountType) {
                        const key = `${line.accountCode} - ${line.accountName}`;
                        if (!balances[key]) balances[key] = 0;
                        
                        if (accountType === 'Asset' || accountType === 'Expense') {
                            balances[key] += (line.debit || 0) - (line.credit || 0);
                        } else {
                            balances[key] += (line.credit || 0) - (line.debit || 0);
                        }
                    }
                });
            });
            
            return balances;
        } catch (error) {
            console.error('Error getting account balances by type:', error);
            throw error;
        }
    }
    
    /**
     * Calculate account type total for a period
     */
    static async calculateAccountTypeTotal(accountType, startDate, endDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            const totals = {};
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountType === accountType) {
                        const key = `${line.accountCode} - ${line.accountName}`;
                        if (!totals[key]) totals[key] = 0;
                        
                        if (accountType === 'Income') {
                            totals[key] += (line.credit || 0) - (line.debit || 0);
                        } else if (accountType === 'Expense') {
                            totals[key] += (line.debit || 0) - (line.credit || 0);
                        }
                    }
                });
            });
            
            return totals;
        } catch (error) {
            console.error('Error calculating account type total:', error);
            throw error;
        }
    }
    
    /**
     * Get account balance for a specific account
     */
    static async getAccountBalance(accountCode, asOfDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate }
            }).populate('entries');
            
            let balance = 0;
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountCode === accountCode) {
                        if (line.accountType === 'Asset' || line.accountType === 'Expense') {
                            balance += (line.debit || 0) - (line.credit || 0);
                        } else {
                            balance += (line.credit || 0) - (line.debit || 0);
                        }
                    }
                });
            });
            
            return balance;
        } catch (error) {
            console.error('Error getting account balance:', error);
            throw error;
        }
    }
    
    /**
     * Calculate account total for a period
     */
    static async calculateAccountTotal(accountCode, startDate, endDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            }).populate('entries');
            
            let total = 0;
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountCode === accountCode) {
                        if (line.accountType === 'Income') {
                            total += (line.credit || 0) - (line.debit || 0);
                        } else if (line.accountType === 'Expense') {
                            total += (line.debit || 0) - (line.credit || 0);
                        }
                    }
                });
            });
            
            return total;
        } catch (error) {
            console.error('Error calculating account total:', error);
            throw error;
        }
    }
    
    /**
     * Calculate operating cash flows
     */
    static async calculateOperatingCashFlows(startDate, endDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                source: { $in: ['payment', 'expense_payment'] }
            }).populate('entries');
            
            let cashReceived = 0;
            let cashPaid = 0;
            
            entries.forEach(entry => {
                if (entry.source === 'payment') {
                    cashReceived += entry.totalCredit;
                } else if (entry.source === 'expense_payment') {
                    cashPaid += entry.totalDebit;
                }
            });
            
            return {
                cash_received: cashReceived,
                cash_paid: cashPaid,
                net_operating_cash_flow: cashReceived - cashPaid
            };
        } catch (error) {
            console.error('Error calculating operating cash flows:', error);
            throw error;
        }
    }
    
    /**
     * Calculate investing cash flows
     */
    static async calculateInvestingCashFlows(startDate, endDate, basis) {
        // Placeholder - would need specific logic for investing activities
        return {
            purchase_of_equipment: 0,
            purchase_of_buildings: 0,
            net_investing_cash_flow: 0
        };
    }
    
    /**
     * Calculate financing cash flows
     */
    static async calculateFinancingCashFlows(startDate, endDate, basis) {
        // Placeholder - would need specific logic for financing activities
        return {
            owners_contribution: 0,
            loan_proceeds: 0,
            net_financing_cash_flow: 0
        };
    }
    
    /**
     * Get cash balance at a specific date
     */
    static async getCashBalanceAtDate(date, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $lte: date }
            }).populate('entries');
            
            let cashBalance = 0;
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountCode.startsWith('100') || line.accountCode.startsWith('101')) {
                        cashBalance += (line.debit || 0) - (line.credit || 0);
                    }
                });
            });
            
            return cashBalance;
        } catch (error) {
            console.error('Error getting cash balance at date:', error);
            throw error;
        }
    }
    
    /**
     * Calculate payable payments
     */
    static async calculatePayablePayments(startDate, endDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                source: 'expense_payment'
            }).populate('entries');
            
            let totalPayments = 0;
            
            entries.forEach(entry => {
                totalPayments += entry.totalDebit;
            });
            
            return totalPayments;
        } catch (error) {
            console.error('Error calculating payable payments:', error);
            throw error;
        }
    }
    
    /**
     * Calculate direct expense payments
     */
    static async calculateDirectExpensePayments(startDate, endDate, basis) {
        try {
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                source: 'expense_payment'
            }).populate('entries');
            
            let totalExpenses = 0;
            
            entries.forEach(entry => {
                entry.entries.forEach(line => {
                    if (line.accountType === 'Expense') {
                        totalExpenses += line.debit || 0;
                    }
                });
            });
            
            return totalExpenses;
        } catch (error) {
            console.error('Error calculating direct expense payments:', error);
            throw error;
        }
    }
    
    /**
     * Check if account is current asset
     */
    static isCurrentAsset(accountName) {
        const currentAssetKeywords = ['cash', 'bank', 'receivable', 'inventory', 'prepaid'];
        return currentAssetKeywords.some(keyword => 
            accountName.toLowerCase().includes(keyword)
        );
    }
    
    /**
     * Check if account is current liability
     */
    static isCurrentLiability(accountName) {
        const currentLiabilityKeywords = ['payable', 'accrued', 'short-term'];
        return currentLiabilityKeywords.some(keyword => 
            accountName.toLowerCase().includes(keyword)
        );
    }

    // Helper methods for categorization
    static getExpenseCategory(accountCode) {
        if (accountCode.startsWith('5001')) return 'Maintenance';
        if (accountCode.startsWith('5002')) return 'Utilities';
        if (accountCode.startsWith('5003')) return 'Insurance';
        if (accountCode.startsWith('5004')) return 'Property Management';
        if (accountCode.startsWith('5005')) return 'Administrative';
        return 'Other';
    }

    static getCashFlowActivityType(accountCode, accountType) {
        // Operating activities
        if (accountType === 'Income' || accountType === 'Expense') return 'operating';
        
        // Investing activities (asset purchases/sales)
        if (accountCode.startsWith('1') && accountCode !== '1001' && accountCode !== '1002') return 'investing';
        
        // Financing activities (loans, equity)
        if (accountCode.startsWith('2') || accountCode.startsWith('3')) return 'financing';
        
        return 'operating'; // Default
    }

    static calculateCashFlow(accountType, debit, credit) {
        if (accountType === 'Asset' || accountType === 'asset') {
            return credit - debit; // Asset decrease = cash inflow
        } else if (accountType === 'Liability' || accountType === 'liability') {
            return debit - credit; // Liability increase = cash inflow
        } else if (accountType === 'Income' || accountType === 'income') {
            return credit - debit; // Income increase = cash inflow
        } else if (accountType === 'Expense' || accountType === 'expense') {
            return debit - credit; // Expense increase = cash outflow
        }
        return 0;
    }

    /**
     * RESIDENCE-FILTERED FINANCIAL REPORTS
     */

    /**
     * Generate Residence-Filtered Income Statement
     */
    static async generateResidenceFilteredIncomeStatement(period, residenceId, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating residence-filtered income statement for ${period}, residence: ${residenceId}`);
            
            // Get all transaction entries for the period with populated source documents
            const transactionEntries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            })
            .populate({
                path: 'sourceId',
                select: 'residence student amount date',
                populate: {
                    path: 'residence',
                    select: 'name address'
                }
            })
            .lean();
            
            console.log(`Found ${transactionEntries.length} transaction entries for the period`);
            
            // Filter by residence if specified
            let filteredEntries = transactionEntries;
            if (residenceId) {
                filteredEntries = transactionEntries.filter(entry => {
                    return entry.sourceId && 
                           entry.sourceId.residence && 
                           entry.sourceId.residence._id.toString() === residenceId;
                });
                console.log(`Filtered to ${filteredEntries.length} entries for residence ${residenceId}`);
            }
            
            // Calculate revenue and expenses
            const revenue = {};
            const expenses = {};
            
            filteredEntries.forEach(entry => {
                entry.entries.forEach(accountEntry => {
                    if (accountEntry.accountType === 'Income' || accountEntry.accountType === 'income') {
                        const month = new Date(entry.date).toLocaleString('default', { month: 'long' }).toLowerCase();
                        if (!revenue[month]) revenue[month] = 0;
                        revenue[month] += accountEntry.credit || 0;
                    } else if (accountEntry.accountType === 'Expense' || accountEntry.accountType === 'expense') {
                        const month = new Date(entry.date).toLocaleString('default', { month: 'long' }).toLowerCase();
                        if (!expenses[month]) expenses[month] = 0;
                        expenses[month] += accountEntry.debit || 0;
                    }
                });
            });
            
            // Calculate totals
            const totalRevenue = Object.values(revenue).reduce((sum, amount) => sum + amount, 0);
            const totalExpenses = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
            const netIncome = totalRevenue - totalExpenses;
            
            // Get residence info if specified
            let residenceInfo = null;
            if (residenceId) {
                residenceInfo = await Residence.findById(residenceId).select('name address').lean();
            }
            
            return {
                period,
                residence: residenceInfo,
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
            console.error('Error generating residence-filtered income statement:', error);
            throw error;
        }
    }

    /**
     * Generate Residence-Filtered Balance Sheet
     */
    static async generateResidenceFilteredBalanceSheet(asOf, residenceId, basis = 'cash') {
        try {
            const asOfDate = new Date(asOf);
            
            console.log(`Generating residence-filtered balance sheet as of ${asOf}, residence: ${residenceId}`);
            
            // Get all transaction entries up to the asOf date with populated source documents
            const transactionEntries = await TransactionEntry.find({
                date: { $lte: asOfDate }
            })
            .populate({
                path: 'sourceId',
                select: 'residence student amount date',
                populate: {
                    path: 'residence',
                    select: 'name address'
                }
            })
            .lean();
            
            // Filter by residence if specified
            let filteredEntries = transactionEntries;
            if (residenceId) {
                filteredEntries = transactionEntries.filter(entry => {
                    return entry.sourceId && 
                           entry.sourceId.residence && 
                           entry.sourceId.residence._id.toString() === residenceId;
                });
            }
            
            // Calculate account balances
            const assets = {};
            const liabilities = {};
            const equity = {};
            
            filteredEntries.forEach(entry => {
                entry.entries.forEach(accountEntry => {
                    const accountCode = accountEntry.accountCode;
                    const accountName = accountEntry.accountName;
                    const accountType = accountEntry.accountType;
                    const debit = accountEntry.debit || 0;
                    const credit = accountEntry.credit || 0;
                    
                    const key = `${accountCode} - ${accountName}`;
                    
                    if (accountType === 'Asset' || accountType === 'asset') {
                        if (!assets[key]) assets[key] = 0;
                        assets[key] += debit - credit; // Assets increase with debit
                    } else if (accountType === 'Liability' || accountType === 'liability') {
                        if (!liabilities[key]) liabilities[key] = 0;
                        liabilities[key] += credit - debit; // Liabilities increase with credit
                    } else if (accountType === 'Equity' || accountType === 'equity') {
                        if (!equity[key]) equity[key] = 0;
                        equity[key] += credit - debit; // Equity increases with credit
                    }
                });
            });
            
            // Calculate totals
            const totalAssets = Object.values(assets).reduce((sum, amount) => sum + amount, 0);
            const totalLiabilities = Object.values(liabilities).reduce((sum, amount) => sum + amount, 0);
            const totalEquity = Object.values(equity).reduce((sum, amount) => sum + amount, 0);
            
            // Get residence info if specified
            let residenceInfo = null;
            if (residenceId) {
                residenceInfo = await Residence.findById(residenceId).select('name address').lean();
            }
            
            return {
                asOf,
                residence: residenceInfo,
                basis,
                assets: {
                    ...assets,
                    total_assets: totalAssets
                },
                liabilities: {
                    ...liabilities,
                    total_liabilities: totalLiabilities
                },
                equity: {
                    ...equity,
                    total_equity: totalEquity
                },
                total_liabilities_and_equity: totalLiabilities + totalEquity
            };
            
        } catch (error) {
            console.error('Error generating residence-filtered balance sheet:', error);
            throw error;
        }
    }

    /**
     * Generate Residence-Filtered Cash Flow Statement
     */
    static async generateResidenceFilteredCashFlow(period, residenceId, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating residence-filtered cash flow for ${period}, residence: ${residenceId}`);
            
            // Get all transaction entries for the period with populated source documents
            const transactionEntries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate }
            })
            .populate({
                path: 'sourceId',
                select: 'residence student amount date',
                populate: {
                    path: 'residence',
                    select: 'name address'
                }
            })
            .lean();
            
            // Filter by residence if specified
            let filteredEntries = transactionEntries;
            if (residenceId) {
                filteredEntries = transactionEntries.filter(entry => {
                    return entry.sourceId && 
                           entry.sourceId.residence && 
                           entry.sourceId.residence._id.toString() === residenceId;
                });
            }
            
            // Calculate cash flows by activity type
            const operating = {};
            const investing = {};
            const financing = {};
            
            filteredEntries.forEach(entry => {
                entry.entries.forEach(accountEntry => {
                    const accountCode = accountEntry.accountCode;
                    const accountType = accountEntry.accountType;
                    const debit = accountEntry.debit || 0;
                    const credit = accountEntry.credit || 0;
                    
                    const month = new Date(entry.date).toLocaleString('default', { month: 'long' }).toLowerCase();
                    const cashFlow = this.calculateCashFlow(accountType, debit, credit);
                    const activityType = this.getCashFlowActivityType(accountCode, accountType);
                    
                    if (activityType === 'operating') {
                        if (!operating[month]) operating[month] = 0;
                        operating[month] += cashFlow;
                    } else if (activityType === 'investing') {
                        if (!investing[month]) investing[month] = 0;
                        investing[month] += cashFlow;
                    } else if (activityType === 'financing') {
                        if (!financing[month]) financing[month] = 0;
                        financing[month] += cashFlow;
                    }
                });
            });
            
            // Calculate totals
            const totalOperating = Object.values(operating).reduce((sum, amount) => sum + amount, 0);
            const totalInvesting = Object.values(investing).reduce((sum, amount) => sum + amount, 0);
            const totalFinancing = Object.values(financing).reduce((sum, amount) => sum + amount, 0);
            const netCashFlow = totalOperating + totalInvesting + totalFinancing;
            
            // Get residence info if specified
            let residenceInfo = null;
            if (residenceId) {
                residenceInfo = await Residence.findById(residenceId).select('name address').lean();
            }
            
            return {
                period,
                residence: residenceInfo,
                basis,
                operating_activities: {
                    ...operating,
                    total: totalOperating
                },
                investing_activities: {
                    ...investing,
                    total: totalInvesting
                },
                financing_activities: {
                    ...financing,
                    total: totalFinancing
                },
                net_cash_flow: netCashFlow
            };
            
        } catch (error) {
            console.error('Error generating residence-filtered cash flow:', error);
            throw error;
        }
    }
}

module.exports = FinancialReportingService; 