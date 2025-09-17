const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debugBalanceSheetComprehensive() {
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
        
        console.log(`\n📊 Testing comprehensive balance sheet filtering for ${asOfDate}`);
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

        // Get all transaction types with both filters (matching BalanceSheetService exactly)
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

        const otherQuery = {
            source: { $nin: ['rental_accrual', 'expense_accrual', 'payment', 'vendor_payment', 'expense_payment'] },
            date: dateFilter,
            status: 'posted',
            voided: { $ne: true }
        };

        const correctOtherQuery = {
            source: { $nin: ['rental_accrual', 'expense_accrual', 'payment', 'vendor_payment', 'expense_payment'] },
            date: correctDateFilter,
            status: 'posted',
            voided: { $ne: true }
        };

        const manualQuery = {
            source: { $in: ['manual', 'other_income', 'refund', 'negotiated_payment'] },
            date: dateFilter,
            status: 'posted',
            voided: { $ne: true }
        };

        const correctManualQuery = {
            source: { $in: ['manual', 'other_income', 'refund', 'negotiated_payment'] },
            date: correctDateFilter,
            status: 'posted',
            voided: { $ne: true }
        };

        // Get all transactions
        const [currentAccruals, correctAccruals, currentPayments, correctPayments, currentOther, correctOther, currentManual, correctManual] = await Promise.all([
            TransactionEntry.find(accrualQuery).sort({ date: 1 }),
            TransactionEntry.find(correctAccrualQuery).sort({ date: 1 }),
            TransactionEntry.find(paymentQuery).sort({ date: 1 }),
            TransactionEntry.find(correctPaymentQuery).sort({ date: 1 }),
            TransactionEntry.find(otherQuery).sort({ date: 1 }),
            TransactionEntry.find(correctOtherQuery).sort({ date: 1 }),
            TransactionEntry.find(manualQuery).sort({ date: 1 }),
            TransactionEntry.find(correctManualQuery).sort({ date: 1 })
        ]);

        console.log(`\n📈 Transaction Counts:`);
        console.log(`Accruals - Current: ${currentAccruals.length}, Correct: ${correctAccruals.length}`);
        console.log(`Payments - Current: ${currentPayments.length}, Correct: ${correctPayments.length}`);
        console.log(`Other - Current: ${currentOther.length}, Correct: ${correctOther.length}`);
        console.log(`Manual - Current: ${currentManual.length}, Correct: ${correctManual.length}`);

        // Calculate account balances like BalanceSheetService does
        function calculateAccountBalances(transactions) {
            const accountBalances = {};
            const residences = new Set();
            
            transactions.forEach(transaction => {
                if (transaction.residence) {
                    residences.add(transaction.residence.toString());
                }
                
                transaction.entries.forEach(entry => {
                    const key = `${entry.accountCode}`;
                    if (!accountBalances[key]) {
                        accountBalances[key] = {
                            accountCode: entry.accountCode,
                            accountName: entry.accountName,
                            debit: 0,
                            credit: 0,
                            balance: 0
                        };
                    }
                    
                    accountBalances[key].debit += entry.debit || 0;
                    accountBalances[key].credit += entry.credit || 0;
                    accountBalances[key].balance = accountBalances[key].debit - accountBalances[key].credit;
                });
            });
            
            return accountBalances;
        }

        // Calculate balances for both approaches
        const currentAllTransactions = [...currentAccruals, ...currentPayments, ...currentOther, ...currentManual];
        const correctAllTransactions = [...correctAccruals, ...correctPayments, ...correctOther, ...correctManual];

        const currentBalances = calculateAccountBalances(currentAllTransactions);
        const correctBalances = calculateAccountBalances(correctAllTransactions);

        console.log(`\n💰 Account Balance Comparison:`);
        
        // Focus on key accounts that might be causing the discrepancy
        const keyAccounts = ['1100', '1200', '1300', '1400', '1500', '2000', '2100', '2200', '2300', '2400', '3000', '4000', '5000'];
        
        let totalDifference = 0;
        
        keyAccounts.forEach(accountCode => {
            const currentBalance = currentBalances[accountCode]?.balance || 0;
            const correctBalance = correctBalances[accountCode]?.balance || 0;
            const difference = correctBalance - currentBalance;
            
            if (Math.abs(difference) > 0.01) {
                console.log(`${accountCode} - Current: $${currentBalance.toFixed(2)}, Correct: $${correctBalance.toFixed(2)}, Diff: $${difference.toFixed(2)}`);
                totalDifference += difference;
            }
        });

        console.log(`\n🎯 Total Balance Sheet Difference: $${totalDifference.toFixed(2)}`);

        // Check specific accounts mentioned by user
        const arBalance = correctBalances['1100']?.balance || 0;
        const currentArBalance = currentBalances['1100']?.balance || 0;
        const arDifference = arBalance - currentArBalance;

        console.log(`\n📋 Accounts Receivable (1100) Analysis:`);
        console.log(`Current filtering AR balance: $${currentArBalance.toFixed(2)}`);
        console.log(`Correct filtering AR balance: $${arBalance.toFixed(2)}`);
        console.log(`AR difference: $${arDifference.toFixed(2)}`);

        // Check advance payment liability (likely 2100 or 2200)
        const advancePaymentBalance = correctBalances['2100']?.balance || 0;
        const currentAdvancePaymentBalance = currentBalances['2100']?.balance || 0;
        const advancePaymentDifference = advancePaymentBalance - currentAdvancePaymentBalance;

        console.log(`\n📋 Advance Payment Liability (2100) Analysis:`);
        console.log(`Current filtering balance: $${currentAdvancePaymentBalance.toFixed(2)}`);
        console.log(`Correct filtering balance: $${advancePaymentBalance.toFixed(2)}`);
        console.log(`Advance payment difference: $${advancePaymentDifference.toFixed(2)}`);

        // Show excluded transactions that might be causing the issue
        const excludedTransactions = correctAllTransactions.filter(correct => 
            !currentAllTransactions.some(current => current._id.toString() === correct._id.toString())
        );

        console.log(`\n🚫 Excluded transactions: ${excludedTransactions.length}`);
        if (excludedTransactions.length > 0) {
            console.log('Sample excluded transactions:');
            excludedTransactions.slice(0, 10).forEach(t => {
                const arEntries = t.entries.filter(e => e.accountCode === '1100');
                const arAmount = arEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);
                console.log(`  - ${t.date.toISOString().split('T')[0]} | ${t.source} | ${t.description} | AR Impact: $${arAmount.toFixed(2)}`);
            });
        }

        // Final analysis
        console.log(`\n🔍 Analysis Summary:`);
        console.log(`- Excluded ${excludedTransactions.length} transactions due to strict monthly filtering`);
        console.log(`- AR difference: $${arDifference.toFixed(2)}`);
        console.log(`- Advance payment difference: $${advancePaymentDifference.toFixed(2)}`);
        console.log(`- Total balance sheet difference: $${totalDifference.toFixed(2)}`);
        
        if (Math.abs(totalDifference) > 0.01) {
            console.log(`\n🚨 CONFIRMED: Strict monthly filtering is causing balance sheet discrepancies!`);
            console.log(`Balance sheets should use cumulative filtering (all transactions up to as-of date).`);
        } else {
            console.log(`\n✅ No significant balance sheet differences found.`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

debugBalanceSheetComprehensive();



