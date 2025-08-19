const TransactionEntry = require('../models/TransactionEntry');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Maintenance = require('../models/Maintenance');
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
     * 
     * ACCRUAL BASIS: Shows income/expenses when earned/incurred
     * CASH BASIS: Shows income/expenses when cash is received/paid
     */
    static async generateIncomeStatement(period, basis = 'accrual') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating income statement for ${period} using ${basis.toUpperCase()} basis`);
            
            if (basis === 'accrual') {
                console.log('🔵 ACCRUAL BASIS: Including income when earned, expenses when incurred');
                
                // For accrual basis, look at transaction entries with rental_accrual source for income
                const accrualEntries = await TransactionEntry.find({
                    date: { $gte: startDate, $lte: endDate },
                    source: 'rental_accrual',
                    status: 'posted'
                });
                
                // For accrual basis, look at expenses when they are incurred (expense accruals)
                const expenseEntries = await TransactionEntry.find({
                    date: { $gte: startDate, $lte: endDate },
                    source: 'expense_accrual',
                    status: 'posted'
                });
                
                console.log(`Found ${accrualEntries.length} rental accrual entries and ${expenseEntries.length} expense entries for accrual basis`);
                
                let totalRevenue = 0;
                const revenueByAccount = {};
            const residences = new Set();
            
                // Process rental accruals (income when earned)
                accrualEntries.forEach(entry => {
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Income') {
                                const amount = lineItem.credit || 0;
                                totalRevenue += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                revenueByAccount[key] = (revenueByAccount[key] || 0) + amount;
                            }
                        });
                    }
                    
                    if (entry.residence) {
                        residences.add(entry.residence.toString());
                    }
                });
                
                // Process expenses when incurred (accrual basis)
                let totalExpenses = 0;
                const expensesByAccount = {};
                
                expenseEntries.forEach(entry => {
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Expense') {
                                const amount = lineItem.debit || 0;
                                totalExpenses += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                expensesByAccount[key] = (expensesByAccount[key] || 0) + amount;
                        }
                    });
                }
                    
                    if (entry.residence) {
                        residences.add(entry.residence.toString());
                    }
            });
            
            const netIncome = totalRevenue - totalExpenses;
            
                // Create monthly breakdown for revenue
                const monthlyRevenue = {};
                accrualEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthKey = entryDate.getMonth() + 1; // 1-12
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Income') {
                                const amount = lineItem.credit || 0;
                                if (!monthlyRevenue[monthKey]) {
                                    monthlyRevenue[monthKey] = {};
                                }
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyRevenue[monthKey][key] = (monthlyRevenue[monthKey][key] || 0) + amount;
                            }
                        });
                    }
                });
                
                // Create monthly breakdown for expenses
                const monthlyExpenses = {};
                expenseEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthKey = entryDate.getMonth() + 1; // 1-12
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Expense') {
                                const amount = lineItem.debit || 0;
                                if (!monthlyExpenses[monthKey]) {
                                    monthlyExpenses[monthKey] = {};
                                }
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyExpenses[monthKey][key] = (monthlyExpenses[monthKey][key] || 0) + amount;
                            }
                        });
                    }
                });
            
            return {
                period,
                basis,
                revenue: {
                        ...revenueByAccount,
                        monthly: monthlyRevenue,
                    total_revenue: totalRevenue
                },
                expenses: {
                        ...expensesByAccount,
                        monthly: monthlyExpenses,
                        total_expenses: totalExpenses
                    },
                    net_income: netIncome,
                    gross_profit: totalRevenue - totalExpenses,
                    operating_income: totalRevenue - totalExpenses,
                    residences_included: residences.size > 0,
                    residences_processed: Array.from(residences),
                    transaction_count: accrualEntries.length + expenseEntries.length,
                    accounting_notes: {
                        accrual_basis: "Income/expenses shown when earned/incurred",
                        includes_rental_accruals: true,
                        includes_expenses_incurred: true,
                        includes_cash_payments: false,
                        source_filter: "Includes rental accruals and manual expense entries",
                        note: "Based on rental accrual entries and manual expense entries from transactionentries collection"
                    }
                };
                
            } else {
                console.log('🟢 CASH BASIS: Including only actual cash receipts and payments');
                
                // For cash basis, use the transaction entries with payment source
                const paymentEntries = await TransactionEntry.find({
                    date: { $gte: startDate, $lte: endDate },
                    source: 'payment',
                    status: 'posted'
                });
                
                const expenseEntries = await TransactionEntry.find({
                    date: { $gte: startDate, $lte: endDate },
                    source: { $in: ['expense_payment', 'manual'] },
                    status: 'posted'
                });
                
                console.log(`Found ${paymentEntries.length} payment entries and ${expenseEntries.length} expense entries for cash basis`);
                
                // Process payment entries
                let totalRevenue = 0;
                const revenueByAccount = {};
                const residences = new Set();
                
                paymentEntries.forEach(entry => {
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Income') {
                                const amount = lineItem.credit || 0; // For cash basis, income increases with credit
                                totalRevenue += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                revenueByAccount[key] = (revenueByAccount[key] || 0) + amount;
                            }
                        });
                    }
                    
                    if (entry.residence) {
                        residences.add(entry.residence.toString());
                    }
                });
                
                // Process expense entries
                let totalExpenses = 0;
                const expensesByAccount = {};
                
                expenseEntries.forEach(entry => {
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Expense') {
                                const amount = lineItem.debit || 0;
                                totalExpenses += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                expensesByAccount[key] = (expensesByAccount[key] || 0) + amount;
                            }
                        });
                    }
                });
                
                // Create monthly breakdown for revenue
                const monthlyRevenue = {};
                paymentEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthKey = entryDate.getMonth() + 1; // 1-12
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Income') {
                                const amount = lineItem.credit || 0;
                                if (!monthlyRevenue[monthKey]) {
                                    monthlyRevenue[monthKey] = {};
                                }
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyRevenue[monthKey][key] = (monthlyRevenue[monthKey][key] || 0) + amount;
                            }
                        });
                    }
                });
                
                // Create monthly breakdown for expenses
                const monthlyExpenses = {};
                expenseEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthKey = entryDate.getMonth() + 1; // 1-12
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Expense') {
                                const amount = lineItem.debit || 0;
                                if (!monthlyExpenses[monthKey]) {
                                    monthlyExpenses[monthKey] = {};
                                }
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyExpenses[monthKey][key] = (monthlyExpenses[monthKey][key] || 0) + amount;
                            }
                        });
                    }
                });
                
                const netIncome = totalRevenue - totalExpenses;
                
                return {
                    period,
                    basis,
                    revenue: {
                        ...revenueByAccount,
                        monthly: monthlyRevenue,
                        total_revenue: totalRevenue
                    },
                    expenses: {
                        ...expensesByAccount,
                        monthly: monthlyExpenses,
                    total_expenses: totalExpenses
                },
                net_income: netIncome,
                gross_profit: totalRevenue,
                operating_income: netIncome,
                    residences_included: residences.size > 0,
                residences_processed: Array.from(residences),
                    transaction_count: paymentEntries.length + expenseEntries.length,
                    accounting_notes: {
                        accrual_basis: "Income/expenses shown when cash received/paid",
                        includes_rental_accruals: false,
                        includes_cash_payments: true,
                        source_filter: "Only cash movements",
                        note: "Based on payment and expense entries from transactionentries collection"
                    }
                };
            }
            
        } catch (error) {
            console.error('Error generating income statement:', error);
            throw error;
        }
    }

    /**
     * Generate Comprehensive Monthly Income Statement (Profit & Loss by Month)
     * 
     * ACCRUAL BASIS: Shows income/expenses when earned/incurred by month
     * CASH BASIS: Shows income/expenses when cash is received/paid by month
     */
    static async generateComprehensiveMonthlyIncomeStatement(period, basis = 'accrual', residence = null) {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating comprehensive monthly income statement for ${period} using ${basis.toUpperCase()} basis`);
            
            if (basis === 'accrual') {
                console.log('🔵 ACCRUAL BASIS: Including income when earned, expenses when incurred by month');
                
                // For accrual basis, group rental accruals by month
                const accrualQuery = {
                    date: { $gte: startDate, $lte: endDate },
                    source: 'rental_accrual',
                    status: 'posted'
                };
                
                // Add residence filter if specified
                if (residence) {
                    accrualQuery.residence = residence;
                    console.log(`🔍 Filtering accrual entries by residence: ${residence}`);
                }
                
                const accrualEntries = await TransactionEntry.find(accrualQuery);
                
                // For accrual basis, also get expense entries
                const expenseQuery = {
                    date: { $gte: startDate, $lte: endDate },
                    source: 'expense_accrual',
                    status: 'posted'
                };
                
                // Add residence filter if specified
                if (residence) {
                    expenseQuery.residence = residence;
                }
                
                const expenseEntries = await TransactionEntry.find(expenseQuery);
                
                console.log(`Found ${accrualEntries.length} accrual entries and ${expenseEntries.length} expense entries for accrual basis`);
                
                // Initialize monthly breakdown
                const monthlyBreakdown = {};
                const monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ];
                
                monthNames.forEach((month, index) => {
                    monthlyBreakdown[index] = {
                        month,
                        monthNumber: index + 1,
                    revenue: {},
                    expenses: {},
                    total_revenue: 0,
                    total_expenses: 0,
                    net_income: 0,
                        residences: [],
                    transaction_count: 0
                };
                });
                
                // Process accrual entries by month
                accrualEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthIndex = entryDate.getMonth();
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Income') {
                                const amount = lineItem.credit || 0;
                                monthlyBreakdown[monthIndex].total_revenue += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyBreakdown[monthIndex].revenue[key] = 
                                    (monthlyBreakdown[monthIndex].revenue[key] || 0) + amount;
                            }
                        });
                    }
                    
                    if (entry.residence) {
                        monthlyBreakdown[monthIndex].residences.push(entry.residence.toString());
                    }
                    
                    monthlyBreakdown[monthIndex].transaction_count++;
                });
                
                // Process expense entries by month
                expenseEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthIndex = entryDate.getMonth();
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Expense') {
                                const amount = lineItem.debit || 0;
                                monthlyBreakdown[monthIndex].total_expenses += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyBreakdown[monthIndex].expenses[key] = 
                                    (monthlyBreakdown[monthIndex].expenses[key] || 0) + amount;
                        }
                    });
                }
                    
                    if (entry.residence) {
                        monthlyBreakdown[monthIndex].residences.push(entry.residence.toString());
                    }
                    
                    monthlyBreakdown[monthIndex].transaction_count++;
            });
            
            // Calculate net income for each month
                monthNames.forEach((month, index) => {
                    monthlyBreakdown[index].net_income = monthlyBreakdown[index].total_revenue - monthlyBreakdown[index].total_expenses;
            });
            
            // Calculate year totals
            const yearTotals = {
                    total_revenue: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_revenue, 0),
                    total_expenses: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_expenses, 0),
                    net_income: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].net_income, 0),
                    total_transactions: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].transaction_count, 0)
                };
                
                return {
                    period,
                    basis,
                    monthly_breakdown: monthlyBreakdown,
                    year_totals: yearTotals,
                    month_names: monthNames,
                    residences_included: true,
                    data_sources: ['TransactionEntry'],
                    accounting_notes: {
                        accrual_basis: "Income/expenses shown when earned/incurred by month",
                        includes_rental_accruals: true,
                        includes_cash_payments: false,
                        source_filter: "Excludes cash receipts (payments)",
                        note: "Based on rental accrual entries from transactionentries collection"
                    }
                };
                
            } else {
                console.log('🟢 CASH BASIS: Including income/expenses when cash received/paid by month');
                
                // For cash basis, group payments and expenses by month
                const paymentQuery = {
                    date: { $gte: startDate, $lte: endDate },
                    source: 'payment',
                    status: 'posted'
                };
                
                const expenseQuery = {
                    date: { $gte: startDate, $lte: endDate },
                    source: { $in: ['expense_payment', 'manual'] },
                    status: 'posted'
                };
                
                // Add residence filter if specified
                if (residence) {
                    paymentQuery.residence = residence;
                    expenseQuery.residence = residence;
                    console.log(`🔍 Filtering cash basis entries by residence: ${residence}`);
                }
                
                const paymentEntries = await TransactionEntry.find(paymentQuery);
                const expenseEntries = await TransactionEntry.find(expenseQuery);
                
                // Initialize monthly breakdown
                const monthlyBreakdown = {};
                const monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ];
                
                monthNames.forEach((month, index) => {
                    monthlyBreakdown[index] = {
                        month,
                        monthNumber: index + 1,
                        revenue: {},
                        expenses: {},
                total_revenue: 0,
                total_expenses: 0,
                net_income: 0,
                        residences: [],
                        transaction_count: 0
                    };
                });
                
                // Process payment entries by month
                paymentEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthIndex = entryDate.getMonth();
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Income') {
                                const amount = lineItem.credit || 0;
                                monthlyBreakdown[monthIndex].total_revenue += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyBreakdown[monthIndex].revenue[key] = 
                                    (monthlyBreakdown[monthIndex].revenue[key] || 0) + amount;
                            }
                        });
                    }
                    
                    if (entry.residence) {
                        monthlyBreakdown[monthIndex].residences.push(entry.residence.toString());
                    }
                    
                    monthlyBreakdown[monthIndex].transaction_count++;
                });
                
                // Process expense entries by month
                expenseEntries.forEach(entry => {
                    const entryDate = new Date(entry.date);
                    const monthIndex = entryDate.getMonth();
                    
                    if (entry.entries && Array.isArray(entry.entries)) {
                        entry.entries.forEach(lineItem => {
                            if (lineItem.accountType === 'Expense') {
                                const amount = lineItem.debit || 0;
                                monthlyBreakdown[monthIndex].total_expenses += amount;
                                
                                const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                                monthlyBreakdown[monthIndex].expenses[key] = 
                                    (monthlyBreakdown[monthIndex].expenses[key] || 0) + amount;
                            }
                        });
                    }
                    
                    monthlyBreakdown[monthIndex].transaction_count++;
                });
                
                // Calculate net income for each month
                monthNames.forEach((month, index) => {
                    monthlyBreakdown[index].net_income = 
                        monthlyBreakdown[index].total_revenue - monthlyBreakdown[index].total_expenses;
                });
                
                // Calculate year totals
                const yearTotals = {
                    total_revenue: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_revenue, 0),
                    total_expenses: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].total_expenses, 0),
                    net_income: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].net_income, 0),
                    total_transactions: monthNames.reduce((sum, month, index) => sum + monthlyBreakdown[index].transaction_count, 0)
                };
            
            return {
                period,
                basis,
                    monthly_breakdown: monthlyBreakdown,
                year_totals: yearTotals,
                month_names: monthNames,
                residences_included: true,
                    data_sources: ['TransactionEntry'],
                    accounting_notes: {
                        accrual_basis: "Income/expenses shown when cash received/paid by month",
                        includes_rental_accruals: false,
                        includes_cash_payments: true,
                        source_filter: "Only cash movements",
                        note: "Based on payment and expense entries from transactionentries collection"
                    }
                };
            }
            
        } catch (error) {
            console.error('Error generating comprehensive monthly income statement:', error);
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
     * Generate Monthly Income Statement (Profit & Loss by Month) with Residence Filtering
     */
    static async generateResidenceFilteredMonthlyIncomeStatement(period, residenceId, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating residence-filtered monthly income statement for ${period}, residence: ${residenceId}`);
            
            // Get all transaction entries for the period, filtered by residence
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                residence: residenceId // Direct residence filtering
            }).populate('entries');
            
            console.log(`Found ${entries.length} transaction entries for the period and residence ${residenceId}`);
            
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
            
            // Get residence info
            const residenceInfo = await Residence.findById(residenceId).select('name address').lean();
            
            console.log(`Residence: ${residenceInfo?.name}, Yearly Revenue: $${yearlyTotals.total_revenue}, Expenses: $${yearlyTotals.total_expenses}, Net Income: $${yearlyTotals.net_income}`);
            
            return {
                period,
                residence: residenceInfo,
                basis,
                monthly_breakdown: monthlyData,
                yearly_totals: {
                    ...yearlyTotals,
                    gross_profit: yearlyTotals.total_revenue,
                    operating_income: yearlyTotals.net_income
                }
            };
            
        } catch (error) {
            console.error('Error generating residence-filtered monthly income statement:', error);
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
            
            // For cash basis, only include actual cash transactions
            let query = {
                date: { $gte: startDate, $lte: endDate }
            };
            
            if (basis === 'cash') {
                // Cash basis: only include transactions that represent actual cash flow
                query.source = {
                    $in: [
                        'rental_payment',      // When rent is actually received
                        'expense_payment',     // When expenses are actually paid
                        'manual',              // Manual cash transactions
                        'payment_collection',  // Cash payments
                        'bank_transfer',       // Bank transfers
                        'payment'              // Cash payments (rent, deposits, etc.)
                    ]
                };
                console.log('🔵 CASH BASIS: Only including actual cash transactions');
            } else {
                // Accrual basis: include all transactions
                console.log('🔵 ACCRUAL BASIS: Including all transactions');
            }
            
            const entries = await TransactionEntry.find(query).populate('entries');
            
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            // Initialize monthly cash flow structure with account breakdowns
            const monthlyCashFlow = {};
            monthNames.forEach(month => {
                monthlyCashFlow[month] = {
                    operating_activities: { 
                        inflows: 0, 
                        outflows: 0, 
                        net: 0,
                        breakdown: {} // Account-level breakdown
                    },
                    investing_activities: { 
                        inflows: 0, 
                        outflows: 0, 
                        net: 0,
                        breakdown: {} // Account-level breakdown
                    },
                    financing_activities: { 
                        inflows: 0, 
                        outflows: 0, 
                        net: 0,
                        breakdown: {} // Account-level breakdown
                    },
                    net_cash_flow: 0,
                    opening_balance: 0,
                    closing_balance: 0
                };
            });
            
            // Process cash flows by month
            entries.forEach(entry => {
                const month = entry.date.getMonth();
                const monthName = monthNames[month];
                
                // Skip if no entries or entries is not an array
                if (!entry.entries || !Array.isArray(entry.entries)) {
                    console.log(`⚠️  Skipping transaction ${entry._id}: no valid entries`);
                    return;
                }
                
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    // For cash basis, only include accounts that represent actual cash movements
                    if (basis === 'cash') {
                        // Skip AR/AP accounts unless they represent actual cash collection/payment
                        if (accountCode.startsWith('110') || accountCode.startsWith('200')) {
                            // Only include if this represents actual cash collection/payment
                            // Skip if it's just accrual entries or balance adjustments
                            if (!['manual', 'expense_payment', 'payment', 'rental_payment'].includes(entry.source)) {
                                // Skip non-cash AR/AP entries
                                return;
                            }
                        }
                    }
                    
                    // Determine activity type and cash flow
                    const activityType = this.getCashFlowActivityType(accountCode, accountType);
                    const cashFlow = this.calculateCashFlow(accountType, debit, credit);
                    
                    if (activityType === 'operating') {
                        if (cashFlow > 0) {
                            monthlyCashFlow[monthName].operating_activities.inflows += cashFlow;
                            // Track account breakdown for inflows
                            const key = `${accountCode} - ${accountName}`;
                            if (!monthlyCashFlow[monthName].operating_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].operating_activities.breakdown[key] = { inflows: 0, outflows: 0 };
                            }
                            monthlyCashFlow[monthName].operating_activities.breakdown[key].inflows += cashFlow;
                        } else {
                            monthlyCashFlow[monthName].operating_activities.outflows += Math.abs(cashFlow);
                            // Track account breakdown for outflows
                            const key = `${accountCode} - ${accountName}`;
                            if (!monthlyCashFlow[monthName].operating_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].operating_activities.breakdown[key] = { inflows: 0, outflows: 0 };
                            }
                            monthlyCashFlow[monthName].operating_activities.breakdown[key].outflows += Math.abs(cashFlow);
                        }
                        monthlyCashFlow[monthName].operating_activities.net += cashFlow;
                    } else if (activityType === 'investing') {
                        if (cashFlow > 0) {
                            monthlyCashFlow[monthName].investing_activities.inflows += cashFlow;
                            // Track account breakdown for inflows
                            const key = `${accountCode} - ${accountName}`;
                            if (!monthlyCashFlow[monthName].investing_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].investing_activities.breakdown[key] = { inflows: 0, outflows: 0 };
                            }
                            monthlyCashFlow[monthName].investing_activities.breakdown[key].inflows += cashFlow;
                        } else {
                            monthlyCashFlow[monthName].investing_activities.outflows += Math.abs(cashFlow);
                            // Track account breakdown for outflows
                            const key = `${accountCode} - ${accountName}`;
                            if (!monthlyCashFlow[monthName].investing_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].investing_activities.breakdown[key] = { inflows: 0, outflows: 0 };
                            }
                            monthlyCashFlow[monthName].investing_activities.breakdown[key].outflows += Math.abs(cashFlow);
                        }
                        monthlyCashFlow[monthName].investing_activities.net += cashFlow;
                    } else if (activityType === 'financing') {
                        if (cashFlow > 0) {
                            monthlyCashFlow[monthName].financing_activities.inflows += cashFlow;
                            // Track account breakdown for inflows
                            const key = `${accountCode} - ${accountName}`;
                            if (!monthlyCashFlow[monthName].financing_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].financing_activities.breakdown[key] = { inflows: 0, outflows: 0 };
                            }
                            monthlyCashFlow[monthName].financing_activities.breakdown[key].inflows += cashFlow;
                        } else {
                            monthlyCashFlow[monthName].financing_activities.outflows += Math.abs(cashFlow);
                            // Track account breakdown for outflows
                            const key = `${accountCode} - ${accountName}`;
                            if (!monthlyCashFlow[monthName].financing_activities.breakdown[key]) {
                                monthlyCashFlow[monthName].financing_activities.breakdown[key] = { inflows: 0, outflows: 0 };
                            }
                            monthlyCashFlow[monthName].financing_activities.breakdown[key].outflows += Math.abs(cashFlow);
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
            
            // Calculate yearly totals with account breakdowns
            const yearlyTotals = {
                operating_activities: { 
                    inflows: 0, 
                    outflows: 0, 
                    net: 0,
                    breakdown: {} // Account-level breakdown
                },
                investing_activities: { 
                    inflows: 0, 
                    outflows: 0, 
                    net: 0,
                    breakdown: {} // Account-level breakdown
                },
                financing_activities: { 
                    inflows: 0, 
                    outflows: 0, 
                    net: 0,
                    breakdown: {} // Account-level breakdown
                },
                net_cash_flow: 0
            };
            
            monthNames.forEach(monthName => {
                const monthData = monthlyCashFlow[monthName];
                
                // Aggregate operating activities
                yearlyTotals.operating_activities.inflows += monthData.operating_activities.inflows;
                yearlyTotals.operating_activities.outflows += monthData.operating_activities.outflows;
                yearlyTotals.operating_activities.net += monthData.operating_activities.net;
                
                // Aggregate operating account breakdowns
                Object.entries(monthData.operating_activities.breakdown).forEach(([account, amounts]) => {
                    if (!yearlyTotals.operating_activities.breakdown[account]) {
                        yearlyTotals.operating_activities.breakdown[account] = { inflows: 0, outflows: 0 };
                    }
                    yearlyTotals.operating_activities.breakdown[account].inflows += amounts.inflows;
                    yearlyTotals.operating_activities.breakdown[account].outflows += amounts.outflows;
                });
                
                // Aggregate investing activities
                yearlyTotals.investing_activities.inflows += monthData.investing_activities.inflows;
                yearlyTotals.investing_activities.outflows += monthData.investing_activities.outflows;
                yearlyTotals.investing_activities.net += monthData.investing_activities.net;
                
                // Aggregate investing account breakdowns
                Object.entries(monthData.investing_activities.breakdown).forEach(([account, amounts]) => {
                    if (!yearlyTotals.investing_activities.breakdown[account]) {
                        yearlyTotals.investing_activities.breakdown[account] = { inflows: 0, outflows: 0 };
                    }
                    yearlyTotals.investing_activities.breakdown[account].inflows += amounts.inflows;
                    yearlyTotals.investing_activities.breakdown[account].outflows += amounts.outflows;
                });
                
                // Aggregate financing activities
                yearlyTotals.financing_activities.inflows += monthData.financing_activities.inflows;
                yearlyTotals.financing_activities.outflows += monthData.financing_activities.outflows;
                yearlyTotals.financing_activities.net += monthData.financing_activities.net;
                
                // Aggregate financing account breakdowns
                Object.entries(monthData.financing_activities.breakdown).forEach(([account, amounts]) => {
                    if (!yearlyTotals.financing_activities.breakdown[account]) {
                        yearlyTotals.financing_activities.breakdown[account] = { inflows: 0, outflows: 0 };
                    }
                    yearlyTotals.financing_activities.breakdown[account].inflows += amounts.inflows;
                    yearlyTotals.financing_activities.breakdown[account].outflows += amounts.outflows;
                });
                
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
                                code: accountCode,
                                name: accountName,
                                type: accountType,
                                balance: 0,
                                debit_total: 0,
                                credit_total: 0
                            };
                        }
                        
                        // Track totals
                        accountBalances[key].debit_total += debit;
                        accountBalances[key].credit_total += credit;
                        
                        // Calculate balance based on account type
                        if (accountType === 'Asset' || accountType === 'Expense') {
                            accountBalances[key].balance += debit - credit;
                        } else {
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
            
            // Get all transaction entries up to the specified date with residence info
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate }
            }).populate('residence');
            
            console.log(`Found ${entries.length} transaction entries up to ${asOfDate}`);
            
            // Calculate account balances
            const accountBalances = {};
            const residences = new Set();
            
            entries.forEach(entry => {
                const residence = entry.residence;
                const residenceName = residence ? (residence.name || residence.residenceName || 'Unknown Residence') : 'Unknown Residence';
                residences.add(residenceName);
                
                console.log(`Processing transaction: ${entry.source} - $${entry.totalDebit} at ${residenceName}`);
                
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        console.log(`  Entry: ${accountCode} - ${accountName} (${accountType}): Dr. $${debit} Cr. $${credit}`);
                        
                        const key = `${accountCode} - ${accountName}`;
                        if (!accountBalances[key]) {
                            accountBalances[key] = {
                                code: accountCode,
                                name: accountName,
                                type: accountType,
                                balance: 0,
                                debit_total: 0,
                                credit_total: 0
                            };
                        }
                        
                        // Track totals
                        accountBalances[key].debit_total += debit;
                        accountBalances[key].credit_total += credit;
                        
                        // Calculate balance based on account type
                        if (accountType === 'Asset' || accountType === 'Expense') {
                            accountBalances[key].balance += debit - credit;
                        } else {
                            accountBalances[key].balance += credit - debit;
                        }
                    });
                }
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
                        assets[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Liability':
                        liabilities[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Equity':
                        equity[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Income':
                        income[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Expense':
                        expenses[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                }
            });
            
            // Calculate totals
            const totalAssets = Object.values(assets).reduce((sum, account) => sum + account.balance, 0);
            const totalLiabilities = Object.values(liabilities).reduce((sum, account) => sum + account.balance, 0);
            const totalEquity = Object.values(equity).reduce((sum, account) => sum + account.balance, 0);
            const totalIncome = Object.values(income).reduce((sum, account) => sum + account.balance, 0);
            const totalExpenses = Object.values(expenses).reduce((sum, account) => sum + account.balance, 0);
            
            // Calculate retained earnings
            const retainedEarnings = totalIncome - totalExpenses;
            
            console.log(`Balance Sheet Summary as of ${asOfDate}:`);
            console.log(`  Total Assets: $${totalAssets}`);
            console.log(`  Total Liabilities: $${totalLiabilities}`);
            console.log(`  Total Equity: $${totalEquity + retainedEarnings}`);
            console.log(`  Residences included: ${Array.from(residences).join(', ')}`);
            
            // Show detailed account breakdown
            console.log('\n📊 Detailed Account Breakdown:');
            console.log('ASSETS:');
            Object.entries(assets).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total})`);
            });
            
            console.log('LIABILITIES:');
            Object.entries(liabilities).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total})`);
            });
            
            console.log('EQUITY:');
            Object.entries(equity).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total})`);
            });
            
            console.log('INCOME:');
            Object.entries(income).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total})`);
            });
            
            console.log('EXPENSES:');
            Object.entries(expenses).forEach(([key, account]) => {
                console.log(`  ${key}: $${account.balance} (Dr: $${account.debit_total}, Cr: $${account.credit_total})`);
            });
            
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
                income: {
                    ...income,
                    total_income: totalIncome
                },
                expenses: {
                    ...expenses,
                    total_expenses: totalExpenses
                },
                accounting_equation: {
                    assets: totalAssets,
                    liabilities: totalLiabilities,
                    equity: totalEquity + retainedEarnings,
                    balanced: Math.abs((totalAssets - (totalLiabilities + totalEquity + retainedEarnings))) < 0.01
                },
                residences_included: true,
                residences_processed: Array.from(residences),
                transaction_count: entries.length,
                account_details: accountBalances
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
            
            console.log(`Found ${entries.length} transaction entries for ${period}`);
            
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
                const residence = entry.residence;
                const residenceName = residence ? (residence.name || residence.residenceName || 'Unknown Residence') : 'Unknown Residence';
                
                console.log(`Processing transaction: ${entry.source} - $${entry.totalDebit} at ${residenceName}`);
                
                // Process each entry line
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        console.log(`  Entry: ${accountCode} - ${accountName} (${accountType}): Dr. $${debit} Cr. $${credit}`);
                        
                        // Operating activities - cash accounts and income/expense
                        if (accountCode.startsWith('100') || accountCode.startsWith('101')) { // Cash accounts
                            if (entry.source === 'payment') {
                                operatingActivities.cash_received_from_customers += credit;
                            } else if (entry.source === 'expense_payment' || accountName.toLowerCase().includes('expense')) {
                                operatingActivities.cash_paid_for_expenses += debit;
                            }
                        }
                        
                        // Income accounts (credit increases income)
                        if (accountType === 'Income' || accountType === 'income') {
                            operatingActivities.cash_received_from_customers += credit;
                        }
                        
                        // Expense accounts (debit increases expenses)
                        if (accountType === 'Expense' || accountType === 'expense') {
                            operatingActivities.cash_paid_for_expenses += debit;
                        }
                        
                        // Investing activities
                        if (accountName.toLowerCase().includes('equipment') || accountName.toLowerCase().includes('furniture')) {
                            investingActivities.purchase_of_equipment += debit;
                        } else if (accountName.toLowerCase().includes('building') || accountName.toLowerCase().includes('construction')) {
                            investingActivities.purchase_of_buildings += debit;
                        }
                    });
                }
            });
            
            const netOperatingCashFlow = operatingActivities.cash_received_from_customers - 
                                       operatingActivities.cash_paid_to_suppliers - 
                                       operatingActivities.cash_paid_for_expenses;
            
            const netInvestingCashFlow = -(investingActivities.purchase_of_equipment + 
                                       investingActivities.purchase_of_buildings);
            
            const netFinancingCashFlow = financingActivities.owners_contribution + 
                                       financingActivities.loan_proceeds;
            
            const netChangeInCash = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;
            
            console.log(`Cash Flow Summary for ${period}:`);
            console.log(`  Operating: $${netOperatingCashFlow}`);
            console.log(`  Investing: $${netInvestingCashFlow}`);
            console.log(`  Financing: $${netFinancingCashFlow}`);
            console.log(`  Net Change: $${netChangeInCash}`);
            
            return {
                period,
                basis,
                operating_activities: operatingActivities,
                investing_activities: investingActivities,
                financing_activities: financingActivities,
                net_change_in_cash: netChangeInCash,
                cash_at_beginning: 0, // Would need to calculate from previous period
                cash_at_end: netChangeInCash,
                residences_included: true,
                data_sources: ['TransactionEntry'],
                transaction_count: entries.length,
                residences_processed: entries.filter(e => e.residence).length
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
        // Convert to string if it's a number
        accountCode = String(accountCode);
        
        // Special case: Security deposits are always financing
        if (accountCode.startsWith('2020')) {
            return 'financing';
        }
        
        // Operating Activities (Cash, Bank, AR, Revenue, Expenses, AP)
        if (/^(100|101|110|111|40|50|60|20)/.test(accountCode)) {
            return 'operating';
        }
        // Investing Activities (Long-Term Assets, Equipment, Property)
        else if (/^[2][0-9]/.test(accountCode) && !/^(20)/.test(accountCode)) {
            return 'investing';
        }
        // Financing Activities (Liabilities, Equity, Loans)
        else if (/^[3-4]/.test(accountCode)) {
            return 'financing';
        }
        // Default to Operating if no match
        return 'operating';
    }

    // Enhanced helper method for better account classification
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

            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                              'july', 'august', 'september', 'october', 'november', 'december'];

            // Check if cash flows balance
            monthNames.forEach(month => {
                const monthData = cashFlow.monthly_breakdown[month];
                if (monthData) {
                    const calculatedNet = monthData.operating_activities.net + monthData.investing_activities.net + monthData.financing_activities.net;
                    
                    if (Math.abs(calculatedNet - monthData.net_cash_flow) > 0.01) {
                        validation.isBalanced = false;
                        validation.issues.push(`${month}: Net cash flow mismatch - calculated: ${calculatedNet}, recorded: ${monthData.net_cash_flow}`);
                    }
                }
            });

            // Check for unusual patterns
            if (cashFlow.yearly_totals.operating_activities.outflows > cashFlow.yearly_totals.operating_activities.inflows * 2) {
                validation.warnings.push('Operating outflows significantly exceed inflows - check for unusual expenses');
            }

            if (cashFlow.yearly_totals.financing_activities.net > cashFlow.yearly_totals.operating_activities.net * 3) {
                validation.warnings.push('Financing activities dominate cash flow - review business model');
            }

            return validation;

        } catch (error) {
            console.error('Error validating cash flow:', error);
            throw error;
        }
    }

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
            
            // Get transaction entries for the specific residence
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                residence: residenceId
            }).populate('residence');
            
            console.log(`Found ${entries.length} transaction entries for residence ${residenceId}`);
            
            // Calculate revenue and expenses
            const revenue = {};
            const expenses = {};
            
            entries.forEach(entry => {
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        if (accountType === 'Income' || accountType === 'income') {
                            const key = `${accountCode} - ${accountName}`;
                            if (!revenue[key]) revenue[key] = 0;
                            revenue[key] += debit; // Income increases with debit in this system
                        } else if (accountType === 'Expense' || accountType === 'expense') {
                            const key = `${accountCode} - ${accountName}`;
                            if (!expenses[key]) expenses[key] = 0;
                            expenses[key] += debit - credit;
                        }
                    });
                }
            });
            
            const totalRevenue = Object.values(revenue).reduce((sum, amount) => sum + amount, 0);
            const totalExpenses = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
            const netIncome = totalRevenue - totalExpenses;
            
            return {
                period,
                basis,
                residence: residenceId,
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
                operating_income: netIncome,
                transaction_count: entries.length
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
            
            console.log(`Generating residence-filtered balance sheet as of ${asOfDate}, residence: ${residenceId}`);
            
            // Get transaction entries for the specific residence up to the date
            const entries = await TransactionEntry.find({
                date: { $lte: asOfDate },
                residence: residenceId
            }).populate('residence');
            
            console.log(`Found ${entries.length} transaction entries for residence ${residenceId}`);
            
            // Calculate account balances (same logic as regular balance sheet)
            const accountBalances = {};
            
            entries.forEach(entry => {
                if (entry.entries && entry.entries.length > 0) {
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
                                balance: 0,
                                debit_total: 0,
                                credit_total: 0
                            };
                        }
                        
                        accountBalances[key].debit_total += debit;
                        accountBalances[key].credit_total += credit;
                        
                        if (accountType === 'Asset' || accountType === 'Expense') {
                            accountBalances[key].balance += debit - credit;
                        } else {
                            accountBalances[key].balance += credit - debit;
                        }
                    });
                }
            });
            
            // Group by account type and calculate totals
            const assets = {};
            const liabilities = {};
            const equity = {};
            const income = {};
            const expenses = {};
            
            Object.values(accountBalances).forEach(account => {
                const key = `${account.code} - ${account.name}`;
                switch (account.type) {
                    case 'Asset':
                        assets[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Liability':
                        liabilities[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Equity':
                        equity[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Income':
                        income[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                    case 'Expense':
                        expenses[key] = {
                            balance: account.balance,
                            debit_total: account.debit_total,
                            credit_total: account.credit_total,
                            code: account.code,
                            name: account.name
                        };
                        break;
                }
            });
            
            const totalAssets = Object.values(assets).reduce((sum, account) => sum + account.balance, 0);
            const totalLiabilities = Object.values(liabilities).reduce((sum, account) => sum + account.balance, 0);
            const totalEquity = Object.values(equity).reduce((sum, account) => sum + account.balance, 0);
            const totalIncome = Object.values(income).reduce((sum, account) => sum + account.balance, 0);
            const totalExpenses = Object.values(expenses).reduce((sum, account) => sum + account.balance, 0);
            const retainedEarnings = totalIncome - totalExpenses;
            
            return {
                asOf,
                basis,
                residence: residenceId,
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
                income: {
                    ...income,
                    total_income: totalIncome
                },
                expenses: {
                    ...expenses,
                    total_expenses: totalExpenses
                },
                accounting_equation: {
                    assets: totalAssets,
                    liabilities: totalLiabilities,
                    equity: totalEquity + retainedEarnings,
                    balanced: Math.abs((totalAssets - (totalLiabilities + totalEquity + retainedEarnings))) < 0.01
                },
                transaction_count: entries.length
            };
            
        } catch (error) {
            console.error('Error generating residence-filtered balance sheet:', error);
            throw error;
        }
    }

    /**
     * Generate Residence-Filtered Cash Flow Statement
     */
    static async generateResidenceFilteredCashFlowStatement(period, residenceId, basis = 'cash') {
        try {
            const startDate = new Date(`${period}-01-01`);
            const endDate = new Date(`${period}-12-31`);
            
            console.log(`Generating residence-filtered cash flow statement for ${period}, residence: ${residenceId}`);
            
            // Get transaction entries for the specific residence
            const entries = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                residence: residenceId
            }).populate('residence');
            
            console.log(`Found ${entries.length} transaction entries for residence ${residenceId}`);
            
            // Calculate cash flows
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
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        // Operating activities
                        if (accountCode.startsWith('100') || accountCode.startsWith('101')) { // Cash accounts
                            if (entry.source === 'payment') {
                                operatingActivities.cash_received_from_customers += credit;
                            } else if (entry.source === 'expense_payment' || accountName.toLowerCase().includes('expense')) {
                                operatingActivities.cash_paid_for_expenses += debit;
                            }
                        }
                        
                        if (accountType === 'Income' || accountType === 'income') {
                            operatingActivities.cash_received_from_customers += credit;
                        }
                        
                        if (accountType === 'Expense' || accountType === 'expense') {
                            operatingActivities.cash_paid_for_expenses += debit;
                        }
                        
                        // Investing activities
                        if (accountName.toLowerCase().includes('equipment') || accountName.toLowerCase().includes('furniture')) {
                            investingActivities.purchase_of_equipment += debit;
                        } else if (accountName.toLowerCase().includes('building') || accountName.toLowerCase().includes('construction')) {
                            investingActivities.purchase_of_buildings += debit;
                        }
                    });
                }
            });
            
            const netOperating = operatingActivities.cash_received_from_customers - 
                               operatingActivities.cash_paid_to_suppliers - 
                               operatingActivities.cash_paid_for_expenses;
            
            const netInvesting = -(investingActivities.purchase_of_equipment + 
                                 investingActivities.purchase_of_buildings);
            
            const netFinancing = financingActivities.owners_contribution + 
                               financingActivities.loan_proceeds;
            
            const netChangeInCash = netOperating + netInvesting + netFinancing;
            
            return {
                period,
                basis,
                residence: residenceId,
                operating_activities: operatingActivities,
                investing_activities: investingActivities,
                financing_activities: financingActivities,
                net_change_in_cash: netChangeInCash,
                transaction_count: entries.length
            };
            
        } catch (error) {
            console.error('Error generating residence-filtered cash flow statement:', error);
            throw error;
        }
    }
}

module.exports = FinancialReportingService; 