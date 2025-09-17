const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function debugForfeitureIncome() {
    try {
        console.log('🔍 Debugging forfeiture transactions in income statement...\n');
        
        await mongoose.connect('mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
        
        // Check September 2025 date range
        const startDate = new Date('2025-09-01');
        const endDate = new Date('2025-09-30');
        
        console.log('📅 Date range:', startDate.toISOString(), 'to', endDate.toISOString());
        
        // 1. Check all forfeiture transactions
        const forfeitures = await TransactionEntry.find({
            'metadata.isForfeiture': true,
            date: { $gte: startDate, $lte: endDate }
        }).select('transactionId description date source status metadata entries');
        
        console.log('\n🔄 Forfeiture transactions found:', forfeitures.length);
        forfeitures.forEach(f => {
            console.log(`  - ${f.transactionId}: ${f.description} (${f.date.toISOString()})`);
            console.log(`    Source: ${f.source}, Status: ${f.status}`);
            if (f.entries) {
                f.entries.forEach(entry => {
                    if (entry.accountType === 'Income') {
                        console.log(`    Income Entry: ${entry.accountName} - Debit: ${entry.debit}, Credit: ${entry.credit}`);
                    }
                });
            }
        });
        
        // 2. Check the exact query used by income statement
        const accrualEntries = await TransactionEntry.find({
            date: { $gte: startDate, $lte: endDate },
            source: { $in: ['rental_accrual', 'manual', 'payment'] },
            status: 'posted'
        }).select('transactionId description date source status metadata entries');
        
        console.log('\n📊 Accrual entries found by income statement query:', accrualEntries.length);
        
        // 3. Check if forfeiture transactions are included in accrual entries
        const forfeitureInAccruals = accrualEntries.filter(entry => 
            entry.metadata && entry.metadata.isForfeiture
        );
        
        console.log('🔄 Forfeiture transactions in accrual entries:', forfeitureInAccruals.length);
        
        // 4. Calculate revenue manually
        let totalRevenue = 0;
        const revenueByAccount = {};
        
        accrualEntries.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(lineItem => {
                    if (lineItem.accountType === 'Income') {
                        const amount = (lineItem.credit || 0) - (lineItem.debit || 0);
                        totalRevenue += amount;
                        
                        const key = `${lineItem.accountCode} - ${lineItem.accountName}`;
                        revenueByAccount[key] = (revenueByAccount[key] || 0) + amount;
                        
                        if (entry.metadata && entry.metadata.isForfeiture) {
                            console.log(`🔄 Forfeiture: ${entry.transactionId}, Amount: ${amount}, Account: ${lineItem.accountName}`);
                        }
                    }
                });
            }
        });
        
        console.log('\n💰 Manual Revenue Calculation:');
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

debugForfeitureIncome();


