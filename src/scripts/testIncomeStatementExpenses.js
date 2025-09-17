const mongoose = require('mongoose');
const FinancialReportingService = require('../services/financialReportingService');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function testIncomeStatementExpenses() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        console.log('🔍 Testing Income Statement Accrual Basis for 2025...');
        
        const incomeStatement = await FinancialReportingService.generateIncomeStatement('2025', 'accrual');
        
        console.log('\n📊 Income Statement Results:');
        console.log(`Period: ${incomeStatement.period}`);
        console.log(`Basis: ${incomeStatement.basis}`);
        
        console.log('\n💰 REVENUE:');
        console.log(`Total Revenue: $${incomeStatement.revenue.total_revenue}`);
        
        // Show revenue breakdown
        Object.keys(incomeStatement.revenue).forEach(key => {
            if (key !== 'total_revenue' && key !== 'monthly') {
                console.log(`  ${key}: $${incomeStatement.revenue[key]}`);
            }
        });
        
        console.log('\n💸 EXPENSES:');
        console.log(`Total Expenses: $${incomeStatement.expenses.total_expenses}`);
        
        // Show expense breakdown
        let expenseCount = 0;
        Object.keys(incomeStatement.expenses).forEach(key => {
            if (key !== 'total_expenses' && key !== 'monthly') {
                console.log(`  ${key}: $${incomeStatement.expenses[key]}`);
                expenseCount++;
            }
        });
        
        console.log(`\n📈 Number of expense categories shown: ${expenseCount}`);
        
        console.log('\n📋 SUMMARY:');
        console.log(`Net Income: $${incomeStatement.net_income}`);
        console.log(`Transaction Count: ${incomeStatement.transaction_count}`);
        
        // Check monthly expenses breakdown
        if (incomeStatement.expenses.monthly) {
            console.log('\n📅 MONTHLY EXPENSES BREAKDOWN:');
            Object.keys(incomeStatement.expenses.monthly).forEach(month => {
                console.log(`\nMonth ${month}:`);
                Object.keys(incomeStatement.expenses.monthly[month]).forEach(expenseAccount => {
                    console.log(`  ${expenseAccount}: $${incomeStatement.expenses.monthly[month][expenseAccount]}`);
                });
            });
        }

        // Compare with what we know exists in the database
        console.log('\n🔍 Let me verify this matches actual expense transactions...');
        const TransactionEntry = require('../models/TransactionEntry');
        
        const expenseEntries = await TransactionEntry.find({
            date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
            source: { $in: ['expense_accrual', 'expense_payment', 'vendor_payment', 'manual'] },
            status: 'posted'
        });
        
        console.log(`\nFound ${expenseEntries.length} expense transactions in database`);
        
        let dbTotalExpenses = 0;
        const dbExpensesByAccount = {};
        
        expenseEntries.forEach(entry => {
            console.log(`\n${entry.transactionId} - ${entry.source} - ${entry.date.toISOString().split('T')[0]}`);
            console.log(`  Description: ${entry.description}`);
            
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(lineItem => {
                    if (lineItem.accountType === 'Expense') {
                        const amount = lineItem.debit || 0;
                        dbTotalExpenses += amount;
                        
                        const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                        dbExpensesByAccount[key] = (dbExpensesByAccount[key] || 0) + amount;
                        
                        console.log(`    ${lineItem.accountCode} - ${lineItem.accountName}: $${amount}`);
                    }
                });
            }
        });
        
        console.log(`\n📊 Database vs Income Statement Comparison:`);
        console.log(`Database Total Expenses: $${dbTotalExpenses}`);
        console.log(`Income Statement Total Expenses: $${incomeStatement.expenses.total_expenses}`);
        console.log(`Match: ${dbTotalExpenses === incomeStatement.expenses.total_expenses ? '✅' : '❌'}`);
        
        console.log(`\nDatabase Expense Categories: ${Object.keys(dbExpensesByAccount).length}`);
        console.log(`Income Statement Expense Categories: ${expenseCount}`);
        
        console.log('\nDatabase expense breakdown:');
        Object.keys(dbExpensesByAccount).forEach(key => {
            console.log(`  ${key}: $${dbExpensesByAccount[key]}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testIncomeStatementExpenses();