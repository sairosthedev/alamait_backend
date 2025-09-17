const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function debugIncomeStatementQuery() {
    try {
        console.log('🔍 Debugging income statement query...\n');
        
        await mongoose.connect('mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
        
        // Check September 2025 date range
        const startDate = new Date('2025-09-01');
        const endDate = new Date('2025-09-30');
        
        console.log('📅 Date range:', startDate.toISOString(), 'to', endDate.toISOString());
        
        // 1. Check the exact query used by income statement
        const accrualEntries = await TransactionEntry.find({
            date: { $gte: startDate, $lte: endDate },
            source: { $in: ['rental_accrual', 'manual', 'payment', 'rental_accrual_reversal'] },
            status: 'posted'
        }).select('transactionId description date source status metadata entries');
        
        console.log('\n📊 Accrual entries found by income statement query:', accrualEntries.length);
        
        // 2. Check specifically for reversal transactions
        const reversalEntries = accrualEntries.filter(entry => 
            entry.source === 'rental_accrual_reversal'
        );
        
        console.log('🔄 Reversal transactions found:', reversalEntries.length);
        reversalEntries.forEach(entry => {
            console.log(`  - ${entry.transactionId}: ${entry.description}`);
            console.log(`    Date: ${entry.date.toISOString()}, Source: ${entry.source}`);
            if (entry.entries) {
                entry.entries.forEach(lineItem => {
                    if (lineItem.accountType === 'Income') {
                        console.log(`    Income Entry: ${lineItem.accountName} - Debit: ${lineItem.debit}, Credit: ${lineItem.credit}`);
                    }
                });
            }
        });
        
        // 3. Calculate revenue manually with detailed logging
        let totalRevenue = 0;
        const revenueByAccount = {};
        
        console.log('\n💰 Manual Revenue Calculation:');
        accrualEntries.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(lineItem => {
                    if (lineItem.accountType === 'Income') {
                        const amount = (lineItem.credit || 0) - (lineItem.debit || 0);
                        totalRevenue += amount;
                        
                        const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                        revenueByAccount[key] = (revenueByAccount[key] || 0) + amount;
                        
                        // Log all income entries
                        console.log(`  ${entry.transactionId}: ${lineItem.accountName} - Credit: ${lineItem.credit}, Debit: ${lineItem.debit}, Net: ${amount}`);
                        
                        if (entry.source === 'rental_accrual_reversal') {
                            console.log(`    🔄 REVERSAL TRANSACTION DETECTED!`);
                        }
                    }
                });
            }
        });
        
        console.log('\n📊 Final Results:');
        console.log('Total Revenue:', totalRevenue);
        console.log('Revenue by Account:');
        Object.entries(revenueByAccount).forEach(([account, amount]) => {
            console.log(`  ${account}: $${amount}`);
        });
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

debugIncomeStatementQuery();


