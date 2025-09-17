const mongoose = require('mongoose');
const FinancialReportingService = require('../services/financialReportingService');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function testComprehensiveIncomeStatement() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        console.log('🔍 Testing Comprehensive Monthly Income Statement Accrual Basis for 2025...');
        
        const incomeStatement = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement('2025', 'accrual');
        
        console.log('\n📊 Comprehensive Income Statement Results:');
        console.log(`Period: ${incomeStatement.period}`);
        console.log(`Basis: ${incomeStatement.basis}`);
        
        // Check July (month 6, 0-indexed) expenses
        const julyData = incomeStatement.monthlyBreakdown ? incomeStatement.monthlyBreakdown[6] : null; // July is index 6
        
        console.log('\n📅 JULY 2025 DATA:');
        console.log(`Month: ${julyData.month}`);
        console.log(`Total Revenue: $${julyData.total_revenue}`);
        console.log(`Total Expenses: $${julyData.total_expenses}`);
        console.log(`Net Income: $${julyData.net_income}`);
        console.log(`Transaction Count: ${julyData.transaction_count}`);
        
        console.log('\n💸 JULY EXPENSES BREAKDOWN:');
        const expenseCount = Object.keys(julyData.expenses).length;
        console.log(`Number of expense categories: ${expenseCount}`);
        
        Object.keys(julyData.expenses).forEach(expenseAccount => {
            console.log(`  ${expenseAccount}: $${julyData.expenses[expenseAccount]}`);
        });
        
        console.log('\n💰 JULY REVENUE BREAKDOWN:');
        Object.keys(julyData.revenue).forEach(revenueAccount => {
            console.log(`  ${revenueAccount}: $${julyData.revenue[revenueAccount]}`);
        });
        
        // Check total expenses across all months
        let totalExpensesAllMonths = 0;
        let totalExpenseCategories = new Set();
        
        console.log('\n📊 ALL MONTHS EXPENSE SUMMARY:');
        incomeStatement.monthlyBreakdown.forEach((monthData, index) => {
            if (monthData.total_expenses > 0) {
                console.log(`${monthData.month}: $${monthData.total_expenses}`);
                totalExpensesAllMonths += monthData.total_expenses;
                
                Object.keys(monthData.expenses).forEach(expenseAccount => {
                    totalExpenseCategories.add(expenseAccount);
                });
            }
        });
        
        console.log(`\n📈 SUMMARY:`);
        console.log(`Total Expenses (All Months): $${totalExpensesAllMonths}`);
        console.log(`Unique Expense Categories: ${totalExpenseCategories.size}`);
        console.log(`Categories: ${Array.from(totalExpenseCategories).join(', ')}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testComprehensiveIncomeStatement();
