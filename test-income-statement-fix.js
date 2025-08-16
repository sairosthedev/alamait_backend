const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function testIncomeStatementFix() {
    try {
        await mongoose.connect('mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');

        // Test the fixed income statement logic for August 2025
        console.log('\n🧪 TESTING FIXED INCOME STATEMENT LOGIC...');
        
        const august2025Start = new Date(2025, 7, 1);
        const august2025End = new Date(2025, 7, 31);
        
        const augustTransactions = await TransactionEntry.find({
            date: { $gte: august2025Start, $lte: august2025End }
        });
        
        console.log(`August 2025 transactions found: ${augustTransactions.length}`);
        
        let totalRevenue = 0;
        let totalExpenses = 0;
        
        augustTransactions.forEach(entry => {
            if (entry.entries && entry.entries.length > 0) {
                entry.entries.forEach(line => {
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    if (accountType === 'Income' || accountType === 'income') {
                        // FIXED LOGIC: Use debit for income (not credit - debit)
                        const revenueAmount = debit;
                        totalRevenue += revenueAmount;
                        console.log(`  ✅ Income: ${line.accountCode} - ${line.accountName}: $${revenueAmount} (debit amount)`);
                    } else if (accountType === 'Expense' || accountType === 'expense') {
                        const expenseAmount = debit - credit;
                        totalExpenses += expenseAmount;
                        console.log(`  💸 Expense: ${line.accountCode} - ${line.accountName}: $${expenseAmount}`);
                    }
                });
            }
        });
        
        console.log(`\n📊 RESULTS AFTER FIX:`);
        console.log(`  Total Revenue: $${totalRevenue}`);
        console.log(`  Total Expenses: $${totalExpenses}`);
        console.log(`  Net Income: $${totalRevenue - totalExpenses}`);
        
        if (totalRevenue > 0) {
            console.log(`\n🎉 SUCCESS! Revenue is now showing correctly: $${totalRevenue}`);
        } else {
            console.log(`\n❌ Still no revenue found. Need to investigate further.`);
        }

        // Test the OLD (broken) logic for comparison
        console.log('\n🔍 TESTING OLD (BROKEN) LOGIC FOR COMPARISON...');
        let oldTotalRevenue = 0;
        
        augustTransactions.forEach(entry => {
            if (entry.entries && entry.entries.length > 0) {
                entry.entries.forEach(line => {
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    if (accountType === 'Income' || accountType === 'income') {
                        // OLD BROKEN LOGIC: credit - debit
                        const oldRevenueAmount = credit - debit;
                        oldTotalRevenue += oldRevenueAmount;
                        console.log(`  ❌ OLD LOGIC Income: ${line.accountCode} - ${line.accountName}: $${oldRevenueAmount} (credit - debit)`);
                    }
                });
            }
        });
        
        console.log(`\n📊 OLD LOGIC RESULTS:`);
        console.log(`  Total Revenue (OLD): $${oldTotalRevenue}`);
        console.log(`  Difference: $${totalRevenue - oldTotalRevenue}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed');
    }
}

testIncomeStatementFix(); 