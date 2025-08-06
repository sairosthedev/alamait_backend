process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function debugIncomeStatement() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n🔍 DEBUGGING INCOME STATEMENT...\n');

        const startDate = new Date('2025-01-01');
        const endDate = new Date('2025-12-31');
        
        console.log(`Looking for entries from ${startDate} to ${endDate}`);
        
        // Get all transaction entries for the period
        const entries = await TransactionEntry.find({
            date: { $gte: startDate, $lte: endDate }
        });
        
        console.log(`Found ${entries.length} transaction entries for the period`);
        
        // Check each entry for income accounts
        let incomeEntries = [];
        let expenseEntries = [];
        
        entries.forEach(entry => {
            console.log(`\n📋 Entry: ${entry.description}`);
            console.log(`   Source: ${entry.source}`);
            console.log(`   Date: ${entry.date}`);
            
            entry.entries.forEach(line => {
                console.log(`   Line: ${line.accountCode} - ${line.accountName} (${line.accountType})`);
                console.log(`   Debit: ${line.debit}, Credit: ${line.credit}`);
                
                if (line.accountType === 'Income' || line.accountType === 'income') {
                    incomeEntries.push({
                        entry: entry.description,
                        accountCode: line.accountCode,
                        accountName: line.accountName,
                        accountType: line.accountType,
                        debit: line.debit,
                        credit: line.credit,
                        net: line.credit - line.debit
                    });
                    console.log(`   ✅ INCOME DETECTED: ${line.credit - line.debit}`);
                } else if (line.accountType === 'Expense' || line.accountType === 'expense') {
                    expenseEntries.push({
                        entry: entry.description,
                        accountCode: line.accountCode,
                        accountName: line.accountName,
                        accountType: line.accountType,
                        debit: line.debit,
                        credit: line.credit,
                        net: line.debit - line.credit
                    });
                    console.log(`   💸 EXPENSE DETECTED: ${line.debit - line.credit}`);
                }
            });
        });

        console.log('\n📊 INCOME ENTRIES SUMMARY:');
        console.log('=' .repeat(50));
        if (incomeEntries.length === 0) {
            console.log('❌ No income entries found!');
        } else {
            incomeEntries.forEach(entry => {
                console.log(`${entry.accountCode} - ${entry.accountName}: $${entry.net}`);
            });
        }

        console.log('\n📊 EXPENSE ENTRIES SUMMARY:');
        console.log('=' .repeat(50));
        if (expenseEntries.length === 0) {
            console.log('❌ No expense entries found!');
        } else {
            expenseEntries.forEach(entry => {
                console.log(`${entry.accountCode} - ${entry.accountName}: $${entry.net}`);
            });
        }

        // Calculate totals
        const totalIncome = incomeEntries.reduce((sum, entry) => sum + entry.net, 0);
        const totalExpenses = expenseEntries.reduce((sum, entry) => sum + entry.net, 0);
        const netIncome = totalIncome - totalExpenses;

        console.log('\n💰 CALCULATED TOTALS:');
        console.log('=' .repeat(50));
        console.log(`Total Income: $${totalIncome}`);
        console.log(`Total Expenses: $${totalExpenses}`);
        console.log(`Net Income: $${netIncome}`);

        console.log('\n✅ DEBUG COMPLETED!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

debugIncomeStatement(); 