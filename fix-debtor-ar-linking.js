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

async function fixDebtorARLinking() {
    try {
        console.log('\n🔧 FIXING DEBTOR-AR ACCOUNT LINKING');
        console.log('=====================================\n');

        // Step 1: Get all debtors
        const debtors = await Debtor.find({});
        console.log(`📊 Found ${debtors.length} debtors`);

        // Step 2: Get all AR accounts
        const arAccounts = await Account.find({
            type: 'Asset',
            code: { $regex: '^1100-' }
        });
        console.log(`📊 Found ${arAccounts.length} AR accounts`);

        // Step 3: Get all AR transactions to understand the mapping
        const arTransactions = await TransactionEntry.find({
            'entries.accountCode': { $regex: '^1100-' }
        });
        console.log(`📊 Found ${arTransactions.length} AR transactions`);

        // Step 4: Create a mapping of user IDs to AR account codes
        const userToARMapping = {};
        
        arTransactions.forEach(transaction => {
            transaction.entries.forEach(entry => {
                if (entry.accountCode.startsWith('1100-')) {
                    // Extract user ID from account code (1100-{userId})
                    const userId = entry.accountCode.replace('1100-', '');
                    if (userId && !userToARMapping[userId]) {
                        userToARMapping[userId] = entry.accountCode;
                    }
                }
            });
        });

        console.log(`📊 Created mapping for ${Object.keys(userToARMapping).length} users`);

        // Step 5: Update debtors with correct AR account codes
        let updatedCount = 0;
        let errorCount = 0;

        for (const debtor of debtors) {
            try {
                console.log(`\n🔍 Processing debtor: ${debtor.debtorCode} (User: ${debtor.user})`);
                
                // Find the correct AR account code for this debtor's user
                const correctARCode = userToARMapping[debtor.user.toString()];
                
                if (correctARCode) {
                    console.log(`   Found AR account: ${correctARCode}`);
                    
                    // Check if the debtor's account code is different
                    if (debtor.accountCode !== correctARCode) {
                        console.log(`   Updating account code from ${debtor.accountCode} to ${correctARCode}`);
                        
                        // Update the debtor
                        await Debtor.findByIdAndUpdate(debtor._id, {
                            accountCode: correctARCode,
                            updatedAt: new Date()
                        });
                        
                        updatedCount++;
                        console.log(`   ✅ Updated debtor ${debtor.debtorCode}`);
                    } else {
                        console.log(`   ✅ Account code already correct: ${debtor.accountCode}`);
                    }
                } else {
                    console.log(`   ⚠️ No AR account found for user ${debtor.user}`);
                    errorCount++;
                }
            } catch (error) {
                console.error(`   ❌ Error processing debtor ${debtor.debtorCode}:`, error.message);
                errorCount++;
            }
        }

        // Step 6: Verify the fixes
        console.log('\n🔍 VERIFYING FIXES');
        console.log('==================');
        
        const updatedDebtors = await Debtor.find({});
        let verifiedCount = 0;
        
        for (const debtor of updatedDebtors) {
            const correctARCode = userToARMapping[debtor.user.toString()];
            if (debtor.accountCode === correctARCode) {
                verifiedCount++;
            } else {
                console.log(`   ❌ Still mismatched: ${debtor.debtorCode} - ${debtor.accountCode} vs ${correctARCode}`);
            }
        }

        console.log(`\n📊 FIX SUMMARY:`);
        console.log(`   • Total debtors processed: ${debtors.length}`);
        console.log(`   • Debtors updated: ${updatedCount}`);
        console.log(`   • Errors encountered: ${errorCount}`);
        console.log(`   • Successfully verified: ${verifiedCount}/${debtors.length}`);

        // Step 7: Test the debtors collection report functionality
        console.log('\n🧪 TESTING DEBTORS COLLECTION REPORT');
        console.log('=====================================');
        
        if (updatedDebtors.length > 0) {
            const testDebtor = updatedDebtors[0];
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

                debtorTransactions.forEach(transaction => {
                    transaction.entries.forEach(entry => {
                        if (entry.accountCode === testDebtor.accountCode) {
                            if (transaction.source === 'rental_accrual' || transaction.source === 'lease_start') {
                                totalExpected += entry.debit || 0;
                            } else if (transaction.source === 'payment' || transaction.source === 'accounts_receivable_collection') {
                                totalPaid += entry.credit || 0;
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
            } else {
                console.log(`❌ Still no AR account found for debtor ${testDebtor.debtorCode}`);
            }
        }

        console.log('\n✅ Debtor-AR Linking Fix Completed');
        console.log('===================================');

    } catch (error) {
        console.error('❌ Error in fix:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the fix
fixDebtorARLinking();
