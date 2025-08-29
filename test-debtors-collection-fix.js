const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Debtor = require('./src/models/Debtor');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');

async function testDebtorsCollectionFix() {
    try {
        console.log('\n🔍 TESTING DEBTORS COLLECTION FIX');
        console.log('==================================\n');

        // Test 1: Check current debtors
        console.log('📊 Test 1: Current Debtors Status');
        console.log('==================================');
        
        const debtors = await Debtor.find({});
        console.log(`Total debtors: ${debtors.length}`);
        
        if (debtors.length > 0) {
            const sampleDebtor = debtors[0];
            console.log(`Sample debtor: ${sampleDebtor.debtorCode}`);
            console.log(`Account code: ${sampleDebtor.accountCode}`);
            console.log(`Total owed: $${sampleDebtor.totalOwed || 0}`);
            console.log(`Total paid: $${sampleDebtor.totalPaid || 0}`);
            console.log(`Current balance: $${sampleDebtor.currentBalance || 0}`);
        }

        // Test 2: Check AR transactions
        console.log('\n📊 Test 2: AR Transactions Status');
        console.log('==================================');
        
        const arTransactions = await TransactionEntry.find({
            'entries.accountCode': { $regex: '^1100-' }
        });
        
        console.log(`Total AR transactions: ${arTransactions.length}`);
        
        if (arTransactions.length > 0) {
            const sampleTransaction = arTransactions[0];
            console.log(`Sample transaction: ${sampleTransaction._id}`);
            console.log(`Date: ${sampleTransaction.date}`);
            console.log(`Source: ${sampleTransaction.source}`);
            console.log(`Description: ${sampleTransaction.description}`);
            
            const arEntries = sampleTransaction.entries.filter(entry => entry.accountCode.startsWith('1100-'));
            console.log(`AR entries in transaction: ${arEntries.length}`);
            
            arEntries.forEach(entry => {
                console.log(`  Account: ${entry.accountCode}, Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
            });
        }

        // Test 3: Check debtor accounts
        console.log('\n📊 Test 3: Debtor Accounts Status');
        console.log('==================================');
        
        const debtorAccounts = await Account.find({
            type: 'Asset',
            code: { $regex: '^1100-' }
        });
        
        console.log(`Total debtor accounts: ${debtorAccounts.length}`);
        
        if (debtorAccounts.length > 0) {
            const sampleAccount = debtorAccounts[0];
            console.log(`Sample account: ${sampleAccount.code} - ${sampleAccount.name}`);
            console.log(`Type: ${sampleAccount.type}`);
            console.log(`Active: ${sampleAccount.isActive}`);
        }

        // Test 4: Simulate debtors collection report
        console.log('\n📊 Test 4: Simulating Debtors Collection Report');
        console.log('================================================');
        
        if (debtors.length > 0) {
            const testDebtor = debtors[0];
            console.log(`Testing with debtor: ${testDebtor.debtorCode}`);
            
            // Find debtor's AR account
            const debtorAccount = await Account.findOne({ 
                code: testDebtor.accountCode,
                type: 'Asset'
            });

            if (debtorAccount) {
                console.log(`✅ Found AR account: ${debtorAccount.code}`);
                
                // Get AR transactions for this debtor
                const debtorTransactions = await TransactionEntry.find({
                    'entries.accountCode': testDebtor.accountCode
                }).sort({ date: 1 });

                console.log(`Found ${debtorTransactions.length} transactions for this debtor`);
                
                let totalExpected = 0;
                let totalPaid = 0;
                let monthlyBreakdown = {};

                debtorTransactions.forEach(transaction => {
                    const transactionDate = new Date(transaction.date);
                    const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    if (!monthlyBreakdown[monthKey]) {
                        monthlyBreakdown[monthKey] = {
                            month: monthKey,
                            expected: 0,
                            paid: 0,
                            outstanding: 0
                        };
                    }

                    transaction.entries.forEach(entry => {
                        if (entry.accountCode === testDebtor.accountCode) {
                            if (transaction.source === 'rental_accrual' || transaction.source === 'lease_start') {
                                totalExpected += entry.debit || 0;
                                monthlyBreakdown[monthKey].expected += entry.debit || 0;
                                monthlyBreakdown[monthKey].outstanding += entry.debit || 0;
                            } else if (transaction.source === 'payment' || transaction.source === 'accounts_receivable_collection') {
                                totalPaid += entry.credit || 0;
                                monthlyBreakdown[monthKey].paid += entry.credit || 0;
                                monthlyBreakdown[monthKey].outstanding -= entry.credit || 0;
                            }
                        }
                    });
                });

                const currentBalance = totalExpected - totalPaid;
                
                console.log(`\n📈 AR Data Summary for ${testDebtor.debtorCode}:`);
                console.log(`   Total Expected: $${totalExpected.toFixed(2)}`);
                console.log(`   Total Paid: $${totalPaid.toFixed(2)}`);
                console.log(`   Current Balance: $${currentBalance.toFixed(2)}`);
                console.log(`   Collection Rate: ${totalExpected > 0 ? (totalPaid / totalExpected * 100).toFixed(1) : 0}%`);
                
                console.log(`\n📅 Monthly Breakdown:`);
                Object.values(monthlyBreakdown).sort((a, b) => a.month.localeCompare(b.month)).forEach(month => {
                    console.log(`   ${month.month}: Expected $${month.expected.toFixed(2)}, Paid $${month.paid.toFixed(2)}, Outstanding $${month.outstanding.toFixed(2)}`);
                });
            } else {
                console.log(`❌ No AR account found for debtor ${testDebtor.debtorCode}`);
            }
        }

        // Test 5: Check payment months data
        console.log('\n📊 Test 5: Payment Months Data');
        console.log('==============================');
        
        if (debtors.length > 0) {
            const testDebtor = debtors[0];
            console.log(`Testing payment months for debtor: ${testDebtor.debtorCode}`);
            
            if (testDebtor.monthlyPayments && testDebtor.monthlyPayments.length > 0) {
                console.log(`Found ${testDebtor.monthlyPayments.length} monthly payments`);
                
                testDebtor.monthlyPayments.forEach((monthlyPayment, index) => {
                    console.log(`\n   Month ${index + 1}: ${monthlyPayment.month}`);
                    console.log(`     Expected: $${monthlyPayment.expectedAmount || 0}`);
                    console.log(`     Paid: $${monthlyPayment.paidAmount || 0}`);
                    console.log(`     Outstanding: $${monthlyPayment.outstandingAmount || 0}`);
                    console.log(`     Status: ${monthlyPayment.status}`);
                    
                    if (monthlyPayment.paymentMonths && monthlyPayment.paymentMonths.length > 0) {
                        console.log(`     Payment months: ${monthlyPayment.paymentMonths.length}`);
                        monthlyPayment.paymentMonths.forEach(pm => {
                            console.log(`       ${pm.paymentMonth}: $${pm.amount} (${pm.status})`);
                        });
                    }
                });
            } else {
                console.log('No monthly payments data found');
            }
        }

        console.log('\n✅ Debtors Collection Fix Test Completed');
        console.log('==========================================');
        console.log('\n📋 Summary:');
        console.log(`   • Total debtors: ${debtors.length}`);
        console.log(`   • Total AR transactions: ${arTransactions.length}`);
        console.log(`   • Total debtor accounts: ${debtorAccounts.length}`);
        console.log('\n🔧 Next Steps:');
        console.log('   1. Use the new API endpoints to get debtors collection reports');
        console.log('   2. Sync debtors with AR data using the sync endpoints');
        console.log('   3. Monitor the collection rates and payment months data');

    } catch (error) {
        console.error('❌ Error in test:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
testDebtorsCollectionFix();
