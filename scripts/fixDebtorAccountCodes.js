/**
 * Script to fix debtor account codes to use the correct format: 1100-{userId}
 * This ensures all debtors have account codes that match their AR accounts
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Debtor = require('../src/models/Debtor');
const User = require('../src/models/User');
const Account = require('../src/models/Account');

async function fixDebtorAccountCodes() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        console.log('🔍 Finding debtors with incorrect account codes...\n');

        // Find all debtors
        const debtors = await Debtor.find({}).populate('user', 'email firstName lastName');

        console.log(`📊 Found ${debtors.length} debtors\n`);

        const incorrectDebtors = [];
        const correctDebtors = [];

        // Check each debtor
        for (const debtor of debtors) {
            if (!debtor.user) {
                console.log(`⚠️  Debtor ${debtor.debtorCode} has no user linked - skipping`);
                continue;
            }

            const expectedAccountCode = `1100-${debtor.user._id.toString()}`;
            const currentAccountCode = debtor.accountCode;

            if (currentAccountCode !== expectedAccountCode) {
                incorrectDebtors.push({
                    debtor,
                    currentAccountCode,
                    expectedAccountCode
                });
            } else {
                correctDebtors.push(debtor);
            }
        }

        console.log(`✅ Correct account codes: ${correctDebtors.length}`);
        console.log(`⚠️  Incorrect account codes: ${incorrectDebtors.length}\n`);

        if (incorrectDebtors.length === 0) {
            console.log('✅ All debtors have correct account codes!');
            await mongoose.disconnect();
            return;
        }

        // Display incorrect debtors
        console.log('📋 Debtors with incorrect account codes:\n');
        incorrectDebtors.forEach(({ debtor, currentAccountCode, expectedAccountCode }) => {
            const userInfo = debtor.user ? `${debtor.user.firstName} ${debtor.user.lastName} (${debtor.user.email})` : 'No user';
            console.log(`   ${debtor.debtorCode}:`);
            console.log(`      Current: ${currentAccountCode}`);
            console.log(`      Expected: ${expectedAccountCode}`);
            console.log(`      User: ${userInfo}`);
            console.log('');
        });

        // Confirm before proceeding
        const shouldFix = process.argv.includes('--fix') || process.argv.includes('--confirm');
        
        if (!shouldFix) {
            console.log('💡 To actually fix account codes, run: node scripts/fixDebtorAccountCodes.js --fix');
            console.log('   This will:');
            console.log('   1. Update each debtor\'s accountCode to 1100-{userId}');
            console.log('   2. Verify the AR account exists');
            console.log('   3. Create the AR account if it doesn\'t exist');
            await mongoose.disconnect();
            return;
        }

        console.log('\n🔧 Fixing account codes...\n');

        let fixedCount = 0;
        let errorCount = 0;
        let createdAccounts = 0;

        for (const { debtor, currentAccountCode, expectedAccountCode } of incorrectDebtors) {
            try {
                console.log(`📝 Fixing ${debtor.debtorCode}...`);
                console.log(`   Current: ${currentAccountCode}`);
                console.log(`   Expected: ${expectedAccountCode}`);

                // Check if AR account exists
                let arAccount = await Account.findOne({ code: expectedAccountCode });

                if (!arAccount) {
                    console.log(`   ⚠️  AR account not found, creating it...`);
                    
                    // Create the AR account
                    arAccount = new Account({
                        code: expectedAccountCode,
                        name: `Accounts Receivable - ${debtor.user.firstName} ${debtor.user.lastName}`,
                        type: 'Asset',
                        category: 'Current Assets',
                        subcategory: 'Accounts Receivable',
                        isActive: true,
                        description: `Accounts Receivable account for ${debtor.user.firstName} ${debtor.user.lastName} (${debtor.user.email})`
                    });

                    await arAccount.save();
                    createdAccounts++;
                    console.log(`   ✅ Created AR account: ${expectedAccountCode}`);
                }

                // Update debtor account code
                debtor.accountCode = expectedAccountCode;
                await debtor.save();

                console.log(`   ✅ Updated debtor account code to ${expectedAccountCode}\n`);
                fixedCount++;

            } catch (error) {
                console.error(`   ❌ Error fixing ${debtor.debtorCode}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Fixed: ${fixedCount} debtor(s)`);
        console.log(`   🆕 Created: ${createdAccounts} AR account(s)`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   ✅ Already correct: ${correctDebtors.length}`);

        await mongoose.disconnect();
        console.log('\n✅ Script completed');

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    fixDebtorAccountCodes();
}

module.exports = { fixDebtorAccountCodes };
