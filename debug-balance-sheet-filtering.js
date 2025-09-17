const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debugBalanceSheetFiltering() {
    try {
        console.log('🔌 Connecting to database...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to database');

        // Test August 2025 balance sheet filtering
        const asOfDate = '2025-08-31';
        const asOf = new Date(asOfDate);
        const asOfMonth = asOf.getMonth() + 1;
        const asOfYear = asOf.getFullYear();
        
        console.log(`\n📊 Testing balance sheet filtering for ${asOfDate}`);
        console.log(`Month: ${asOfMonth}, Year: ${asOfYear}`);

        // Test 1: Current (incorrect) strict monthly filtering
        const isMonthlyBalanceSheet = asOfDate.toString().includes('31');
        console.log(`\n📅 Is monthly balance sheet: ${isMonthlyBalanceSheet}`);
        
        let dateFilter;
        if (isMonthlyBalanceSheet) {
            // Current (incorrect) logic
            const monthStart = new Date(Date.UTC(asOfYear, asOfMonth - 1, 1, 0, 0, 0, 0));
            const monthEnd = new Date(Date.UTC(asOfYear, asOfMonth, 0, 23, 59, 59, 999));
            dateFilter = { $gte: monthStart, $lte: monthEnd };
            console.log(`❌ Current strict monthly filter: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);
        } else {
            dateFilter = { $lte: asOf };
        }

        // Test 2: Correct cumulative filtering (should be used for balance sheets)
        const correctDateFilter = { $lte: asOf };
        console.log(`✅ Correct cumulative filter: up to ${asOf.toISOString()}`);

        // Get transactions with both filters
        const accrualQuery = {
            source: { $in: ['rental_accrual', 'expense_accrual'] },
            date: dateFilter,
            status: 'posted',
            voided: { $ne: true }
        };

        const correctAccrualQuery = {
            source: { $in: ['rental_accrual', 'expense_accrual'] },
            date: correctDateFilter,
            status: 'posted',
            voided: { $ne: true }
        };

        const [currentEntries, correctEntries] = await Promise.all([
            TransactionEntry.find(accrualQuery),
            TransactionEntry.find(correctAccrualQuery)
        ]);

        console.log(`\n📈 Results:`);
        console.log(`Current filtering (strict monthly): ${currentEntries.length} accrual transactions`);
        console.log(`Correct filtering (cumulative): ${correctEntries.length} accrual transactions`);
        
        // Calculate totals for AR (account 1100)
        const currentARTotal = currentEntries
            .filter(t => t.entries.some(e => e.accountCode === '1100'))
            .reduce((sum, t) => {
                const arEntries = t.entries.filter(e => e.accountCode === '1100');
                return sum + arEntries.reduce((entrySum, e) => entrySum + (e.debit - e.credit), 0);
            }, 0);

        const correctARTotal = correctEntries
            .filter(t => t.entries.some(e => e.accountCode === '1100'))
            .reduce((sum, t) => {
                const arEntries = t.entries.filter(e => e.accountCode === '1100');
                return sum + arEntries.reduce((entrySum, e) => entrySum + (e.debit - e.credit), 0);
            }, 0);

        console.log(`\n💰 AR Balance Comparison:`);
        console.log(`Current filtering AR balance: $${currentARTotal.toFixed(2)}`);
        console.log(`Correct filtering AR balance: $${correctARTotal.toFixed(2)}`);
        console.log(`Difference: $${(correctARTotal - currentARTotal).toFixed(2)}`);

        // Check for transactions that are being excluded
        const excludedTransactions = correctEntries.filter(correct => 
            !currentEntries.some(current => current._id.toString() === correct._id.toString())
        );

        console.log(`\n🚫 Excluded transactions: ${excludedTransactions.length}`);
        if (excludedTransactions.length > 0) {
            console.log('Sample excluded transactions:');
            excludedTransactions.slice(0, 5).forEach(t => {
                console.log(`  - ${t.date.toISOString().split('T')[0]} | ${t.source} | ${t.description}`);
            });
        }

        // Test with payment queries too
        const paymentQuery = {
            source: { $in: ['payment', 'vendor_payment', 'expense_payment'] },
            date: dateFilter,
            status: 'posted',
            voided: { $ne: true }
        };

        const correctPaymentQuery = {
            source: { $in: ['payment', 'vendor_payment', 'expense_payment'] },
            date: correctDateFilter,
            status: 'posted',
            voided: { $ne: true }
        };

        const [currentPayments, correctPayments] = await Promise.all([
            TransactionEntry.find(paymentQuery),
            TransactionEntry.find(correctPaymentQuery)
        ]);

        console.log(`\n💳 Payment Results:`);
        console.log(`Current filtering: ${currentPayments.length} payment transactions`);
        console.log(`Correct filtering: ${correctPayments.length} payment transactions`);

        // Calculate payment totals for AR
        const currentPaymentTotal = currentPayments
            .filter(t => t.entries.some(e => e.accountCode === '1100'))
            .reduce((sum, t) => {
                const arEntries = t.entries.filter(e => e.accountCode === '1100');
                return sum + arEntries.reduce((entrySum, e) => entrySum + (e.debit - e.credit), 0);
            }, 0);

        const correctPaymentTotal = correctPayments
            .filter(t => t.entries.some(e => e.accountCode === '1100'))
            .reduce((sum, t) => {
                const arEntries = t.entries.filter(e => e.accountCode === '1100');
                return sum + arEntries.reduce((entrySum, e) => entrySum + (e.debit - e.credit), 0);
            }, 0);

        console.log(`\n💰 AR Payment Comparison:`);
        console.log(`Current filtering AR payments: $${currentPaymentTotal.toFixed(2)}`);
        console.log(`Correct filtering AR payments: $${correctPaymentTotal.toFixed(2)}`);
        console.log(`Difference: $${(correctPaymentTotal - currentPaymentTotal).toFixed(2)}`);

        // Final AR balance comparison
        const currentFinalAR = currentARTotal + currentPaymentTotal;
        const correctFinalAR = correctARTotal + correctPaymentTotal;
        const totalDifference = correctFinalAR - currentFinalAR;

        console.log(`\n🎯 Final AR Balance Comparison:`);
        console.log(`Current filtering final AR: $${currentFinalAR.toFixed(2)}`);
        console.log(`Correct filtering final AR: $${correctFinalAR.toFixed(2)}`);
        console.log(`Total difference: $${totalDifference.toFixed(2)}`);

        if (Math.abs(totalDifference) > 0.01) {
            console.log(`\n🚨 CONFIRMED: The strict monthly filtering is causing a $${totalDifference.toFixed(2)} discrepancy!`);
            console.log(`This explains the balance sheet imbalance. Balance sheets should use cumulative filtering.`);
        } else {
            console.log(`\n✅ No significant difference found.`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

debugBalanceSheetFiltering();
