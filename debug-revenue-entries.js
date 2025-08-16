const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function debugRevenueEntries() {
    try {
        await mongoose.connect('mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');

        // 1. Check the August 2025 transaction
        console.log('\n🔍 1. AUGUST 2025 TRANSACTION DETAILS...');
        const august2025Start = new Date(2025, 7, 1);
        const august2025End = new Date(2025, 7, 31);
        
        const augustTransactions = await TransactionEntry.find({
            date: { $gte: august2025Start, $lte: august2025End }
        });
        
        console.log(`August 2025 transactions: ${augustTransactions.length}`);
        
        if (augustTransactions.length > 0) {
            console.log('August transaction details:');
            augustTransactions.forEach((txn, index) => {
                console.log(`\nTransaction ${index + 1}:`);
                console.log(`  Date: ${txn.date}`);
                console.log(`  Source: ${txn.source}`);
                console.log(`  Status: ${txn.status}`);
                console.log(`  Entries count: ${txn.entries?.length || 0}`);
                
                if (txn.entries && txn.entries.length > 0) {
                    txn.entries.forEach((entry, eIndex) => {
                        console.log(`    Entry ${eIndex + 1}:`);
                        console.log(`      Account Code: ${entry.accountCode}`);
                        console.log(`      Account Name: ${entry.accountName}`);
                        console.log(`      Account Type: ${entry.accountType}`);
                        console.log(`      Debit: ${entry.debit}`);
                        console.log(`      Credit: ${entry.credit}`);
                    });
                }
            });
        }

        // 2. Check all revenue entries to see their structure
        console.log('\n🔍 2. ALL REVENUE ENTRIES STRUCTURE...');
        const revenueEntries = await TransactionEntry.find({
            'entries.accountType': 'Income'
        });
        
        console.log(`Total revenue entries: ${revenueEntries.length}`);
        
        if (revenueEntries.length > 0) {
            console.log('\nSample revenue entries:');
            revenueEntries.slice(0, 3).forEach((entry, index) => {
                console.log(`\nRevenue Entry ${index + 1}:`);
                console.log(`  Date: ${entry.date}`);
                console.log(`  Source: ${entry.source}`);
                console.log(`  Status: ${entry.status}`);
                console.log(`  Entries: ${entry.entries?.length || 0}`);
                
                if (entry.entries && entry.entries.length > 0) {
                    entry.entries.forEach((subEntry, sIndex) => {
                        if (subEntry.accountType === 'Income') {
                            console.log(`    Income Entry ${sIndex + 1}:`);
                            console.log(`      Account Code: ${subEntry.accountCode}`);
                            console.log(`      Account Name: ${subEntry.accountName}`);
                            console.log(`      Account Type: ${subEntry.accountType}`);
                            console.log(`      Debit: ${subEntry.debit}`);
                            console.log(`      Credit: ${subEntry.credit}`);
                        }
                    });
                }
            });
        }

        // 3. Check what the income statement generation is actually looking for
        console.log('\n🔍 3. INCOME STATEMENT GENERATION LOGIC...');
        console.log('The income statement generation is looking for:');
        console.log('- Transaction entries with date in August 2025');
        console.log('- Sub-entries with accountType: "Income"');
        console.log('- Credit amounts for revenue calculation');
        
        // 4. Test the exact query that income statement uses
        console.log('\n🔍 4. TESTING INCOME STATEMENT QUERY...');
        const testQuery = await TransactionEntry.find({
            date: { $gte: august2025Start, $lte: august2025End }
        });
        
        console.log(`Query result count: ${testQuery.length}`);
        
        let totalRevenue = 0;
        let totalExpenses = 0;
        
        testQuery.forEach(entry => {
            if (entry.entries && entry.entries.length > 0) {
                entry.entries.forEach(line => {
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    if (accountType === 'Income' || accountType === 'income') {
                        totalRevenue += credit - debit;
                        console.log(`  Income: ${line.accountCode} - ${line.accountName}: $${credit - debit}`);
                    } else if (accountType === 'Expense' || accountType === 'expense') {
                        totalExpenses += debit - credit;
                        console.log(`  Expense: ${line.accountCode} - ${line.accountName}: $${debit - credit}`);
                    }
                });
            }
        });
        
        console.log(`\nCalculated totals:`);
        console.log(`  Total Revenue: $${totalRevenue}`);
        console.log(`  Total Expenses: $${totalExpenses}`);
        console.log(`  Net Income: $${totalRevenue - totalExpenses}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed');
    }
}

debugRevenueEntries();
