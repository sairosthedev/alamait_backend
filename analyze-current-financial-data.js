process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const Payment = require('./src/models/Payment');
const Expense = require('./src/models/finance/Expense');

async function analyzeCurrentFinancialData() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n📊 ANALYZING CURRENT FINANCIAL DATA...\n');

        // Get all accounts
        const accounts = await Account.find();
        console.log('📋 ACCOUNTS:');
        console.log('=' .repeat(50));
        accounts.forEach(account => {
            console.log(`${account.code} - ${account.name} (${account.type})`);
        });

        // Get all transaction entries
        const entries = await TransactionEntry.find().populate('entries');
        console.log(`\n💰 TRANSACTION ENTRIES (${entries.length} total):`);
        console.log('=' .repeat(50));
        
        let totalDebits = 0;
        let totalCredits = 0;
        
        entries.forEach(entry => {
            console.log(`\n📝 Entry: ${entry.transactionId}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Date: ${entry.date}`);
            console.log(`   Source: ${entry.source}`);
            console.log(`   Total Debit: $${entry.totalDebit}`);
            console.log(`   Total Credit: $${entry.totalCredit}`);
            
            totalDebits += entry.totalDebit;
            totalCredits += entry.totalCredit;
            
            entry.entries.forEach(line => {
                console.log(`     ${line.accountCode} - ${line.accountName}: Debit $${line.debit}, Credit $${line.credit}`);
            });
        });

        console.log(`\n📊 TOTALS:`);
        console.log(`   Total Debits: $${totalDebits.toFixed(2)}`);
        console.log(`   Total Credits: $${totalCredits.toFixed(2)}`);
        console.log(`   Balance: $${(totalDebits - totalCredits).toFixed(2)}`);

        // Get all payments
        const payments = await Payment.find();
        console.log(`\n💳 PAYMENTS (${payments.length} total):`);
        console.log('=' .repeat(50));
        let totalPayments = 0;
        payments.forEach(payment => {
            console.log(`${payment.paymentId}: $${payment.totalAmount} (${payment.method}) - ${payment.paymentMonth}`);
            totalPayments += payment.totalAmount;
        });
        console.log(`Total Payments: $${totalPayments.toFixed(2)}`);

        // Get all expenses
        const expenses = await Expense.find();
        console.log(`\n💸 EXPENSES (${expenses.length} total):`);
        console.log('=' .repeat(50));
        let totalExpenses = 0;
        expenses.forEach(expense => {
            console.log(`${expense._id}: $${expense.amount} - ${expense.description}`);
            totalExpenses += expense.amount;
        });
        console.log(`Total Expenses: $${totalExpenses.toFixed(2)}`);

        // Calculate what should be in reports
        console.log('\n📈 WHAT SHOULD BE IN YOUR REPORTS:');
        console.log('=' .repeat(50));
        
        // Income Statement
        console.log('\n💰 INCOME STATEMENT (2025):');
        console.log('   Revenue:');
        console.log(`     Rent Income: $${totalPayments.toFixed(2)}`);
        console.log(`     Total Revenue: $${totalPayments.toFixed(2)}`);
        console.log('   Expenses:');
        console.log(`     Total Expenses: $${totalExpenses.toFixed(2)}`);
        console.log(`   Net Income: $${(totalPayments - totalExpenses).toFixed(2)}`);

        // Balance Sheet
        console.log('\n📋 BALANCE SHEET (as of 2025-12-31):');
        console.log('   Assets:');
        console.log(`     Cash/Bank: $${totalPayments.toFixed(2)} (from payments)`);
        console.log(`     Total Assets: $${totalPayments.toFixed(2)}`);
        console.log('   Liabilities:');
        console.log(`     Total Liabilities: $0.00`);
        console.log('   Equity:');
        console.log(`     Retained Earnings: $${(totalPayments - totalExpenses).toFixed(2)}`);
        console.log(`     Total Equity: $${(totalPayments - totalExpenses).toFixed(2)}`);

        // Cash Flow
        console.log('\n💸 CASH FLOW STATEMENT (2025):');
        console.log('   Operating Activities:');
        console.log(`     Cash received from customers: $${totalPayments.toFixed(2)}`);
        console.log(`     Cash paid for expenses: $${totalExpenses.toFixed(2)}`);
        console.log(`     Net operating cash flow: $${(totalPayments - totalExpenses).toFixed(2)}`);
        console.log('   Net change in cash: $' + (totalPayments - totalExpenses).toFixed(2));

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

analyzeCurrentFinancialData(); 