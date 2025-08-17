/**
 * 🔍 Check Expense Data in Database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkExpenses() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔍 Checking All Expense Entries...');

        const allEntries = await TransactionEntry.find({});
        let totalExpenses = 0;
        const expensesByAccount = {};

        console.log('\n📊 Checking ALL entries for expenses...');
        
        allEntries.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(subEntry => {
                    // Check if this is an expense account (debit > 0)
                    if (subEntry.debit > 0) {
                        const accountCode = subEntry.accountCode;
                        const amount = subEntry.debit;
                        
                        if (!expensesByAccount[accountCode]) {
                            expensesByAccount[accountCode] = 0;
                        }
                        expensesByAccount[accountCode] += amount;
                        totalExpenses += amount;
                        
                        console.log(`  Found expense: Account ${accountCode} - $${amount} (${entry.description})`);
                    }
                });
            }
        });

        console.log('\n📊 Expenses by Account Code:');
        Object.entries(expensesByAccount)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([code, amount]) => {
                console.log(`  Account ${code}: $${amount.toLocaleString()}`);
            });

        console.log(`\n💰 TOTAL EXPENSES FOUND: $${totalExpenses.toLocaleString()}`);

        // Check what the getRetainedEarnings method would calculate for expenses
        console.log('\n🔍 What getRetainedEarnings method calculates for expenses:');
        
        const expenseEntries = await TransactionEntry.find({
            'entries.accountCode': { $regex: /^5/ },
            status: 'posted'
        });
        
        let calculatedExpenses = 0;
        expenseEntries.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(subEntry => {
                    if (subEntry.accountCode && subEntry.accountCode.startsWith('5')) {
                        calculatedExpenses += subEntry.debit || 0;
                    }
                });
            }
        });
        
        console.log(`  Expenses from getRetainedEarnings: $${calculatedExpenses.toLocaleString()}`);
        console.log(`  Difference: $${(totalExpenses - calculatedExpenses).toLocaleString()}`);

        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

checkExpenses();
