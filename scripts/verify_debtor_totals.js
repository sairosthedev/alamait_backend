const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Debtor = require('../src/models/Debtor');
const TransactionEntry = require('../src/models/TransactionEntry');
const User = require('../src/models/User');

// Import services
const DebtorTransactionSyncService = require('../src/services/debtorTransactionSyncService');

async function verifyDebtorTotals() {
    try {
        console.log('🔍 VERIFYING DEBTOR TOTALS FROM TRANSACTION ENTRIES');
        console.log('==================================================');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get all debtors
        const debtors = await Debtor.find({}).populate('user', 'firstName lastName email');
        console.log(`📊 Found ${debtors.length} debtors to verify`);
        
        let correctCount = 0;
        let incorrectCount = 0;
        let fixedCount = 0;
        let errorCount = 0;
        
        for (const debtor of debtors) {
            try {
                console.log(`\n🔍 Checking debtor: ${debtor.debtorCode} (${debtor.user?.firstName} ${debtor.user?.lastName})`);
                
                // Get current debtor totals
                const currentTotalOwed = debtor.totalOwed || 0;
                const currentTotalPaid = debtor.totalPaid || 0;
                const currentBalance = debtor.currentBalance || 0;
                
                // Calculate totals from transaction entries
                const transactionEntries = await TransactionEntry.find({
                    'entries.accountCode': debtor.accountCode
                }).sort({ date: 1 });
                
                let calculatedTotalOwed = 0;
                let calculatedTotalPaid = 0;
                
                // Process each transaction entry
                transactionEntries.forEach(transaction => {
                    transaction.entries.forEach(entry => {
                        if (entry.accountCode === debtor.accountCode) {
                            if (transaction.source === 'rental_accrual' || transaction.source === 'lease_start') {
                                calculatedTotalOwed += entry.debit || 0;
                            } else if (transaction.source === 'payment' || transaction.source === 'accounts_receivable_collection') {
                                calculatedTotalPaid += entry.credit || 0;
                            }
                        }
                    });
                });
                
                const calculatedBalance = Math.max(0, calculatedTotalOwed - calculatedTotalPaid);
                
                // Check if totals match
                const totalOwedMatch = Math.abs(currentTotalOwed - calculatedTotalOwed) < 0.01;
                const totalPaidMatch = Math.abs(currentTotalPaid - calculatedTotalPaid) < 0.01;
                const balanceMatch = Math.abs(currentBalance - calculatedBalance) < 0.01;
                
                console.log(`   📊 Current totals:`);
                console.log(`      Total Owed: $${currentTotalOwed.toFixed(2)}`);
                console.log(`      Total Paid: $${currentTotalPaid.toFixed(2)}`);
                console.log(`      Current Balance: $${currentBalance.toFixed(2)}`);
                
                console.log(`   🔢 Calculated from transactions:`);
                console.log(`      Total Owed: $${calculatedTotalOwed.toFixed(2)} (${transactionEntries.length} transactions)`);
                console.log(`      Total Paid: $${calculatedTotalPaid.toFixed(2)}`);
                console.log(`      Current Balance: $${calculatedBalance.toFixed(2)}`);
                
                if (totalOwedMatch && totalPaidMatch && balanceMatch) {
                    console.log(`   ✅ Totals are correct`);
                    correctCount++;
                } else {
                    console.log(`   ❌ Totals are incorrect - fixing...`);
                    incorrectCount++;
                    
                    // Fix the totals
                    debtor.totalOwed = calculatedTotalOwed;
                    debtor.totalPaid = calculatedTotalPaid;
                    debtor.currentBalance = calculatedBalance;
                    debtor.overdueAmount = calculatedBalance > 0 ? calculatedBalance : 0;
                    debtor.updatedAt = new Date();
                    
                    // Update status based on calculated balance
                    if (calculatedBalance === 0) {
                        debtor.status = 'paid';
                    } else if (calculatedBalance > 0) {
                        debtor.status = 'overdue';
                    } else {
                        debtor.status = 'active';
                    }
                    
                    await debtor.save();
                    console.log(`   ✅ Fixed debtor totals`);
                    fixedCount++;
                }
                
            } catch (error) {
                console.error(`   ❌ Error processing debtor ${debtor.debtorCode}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n📊 VERIFICATION SUMMARY');
        console.log('=======================');
        console.log(`✅ Correct debtors: ${correctCount}`);
        console.log(`❌ Incorrect debtors: ${incorrectCount}`);
        console.log(`🔧 Fixed debtors: ${fixedCount}`);
        console.log(`💥 Errors: ${errorCount}`);
        console.log(`📈 Total processed: ${debtors.length}`);
        
        if (incorrectCount > 0) {
            console.log('\n🔄 Running enhanced recalculation for all debtors...');
            const result = await DebtorTransactionSyncService.recalculateAllDebtorTotals();
            console.log(`✅ Enhanced recalculation completed: ${result.processedCount} processed, ${result.errorCount} errors`);
        }
        
    } catch (error) {
        console.error('❌ Error in verification:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the verification
verifyDebtorTotals().then(() => {
    console.log('\n🎉 Verification completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
});
