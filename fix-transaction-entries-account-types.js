process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const Payment = require('./src/models/Payment');

async function fixTransactionEntriesAccountTypes() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n🔧 FIXING TRANSACTION ENTRIES ACCOUNT TYPES...\n');

        // First, get all accounts to create a lookup map
        console.log('📋 Loading accounts for lookup...');
        const accounts = await Account.find();
        const accountLookup = {};
        
        accounts.forEach(account => {
            if (account.code) {
                accountLookup[account.code] = {
                    type: account.type,
                    name: account.name
                };
            }
        });

        console.log(`✅ Loaded ${accounts.length} accounts for lookup`);

        // Get all transaction entries that need fixing
        console.log('\n🔍 Finding transaction entries to fix...');
        const entriesToFix = await TransactionEntry.find({
            $or: [
                { accountType: { $exists: false } },
                { accountType: null },
                { accountType: '' }
            ]
        });

        console.log(`Found ${entriesToFix.length} transaction entries to fix`);

        if (entriesToFix.length === 0) {
            console.log('✅ No transaction entries need fixing!');
            return;
        }

        // Fix each entry
        let fixedCount = 0;
        let skippedCount = 0;

        for (const entry of entriesToFix) {
            console.log(`\n🔧 Processing entry: ${entry._id}`);
            console.log(`   Account Code: ${entry.accountCode}`);
            console.log(`   Account Name: ${entry.accountName}`);
            console.log(`   Source: ${entry.source}`);

            let accountType = null;
            let accountName = entry.accountName;

            // Check if we have account info in lookup
            if (entry.accountCode && accountLookup[entry.accountCode]) {
                accountType = accountLookup[entry.accountCode].type;
                accountName = accountLookup[entry.accountCode].name;
                console.log(`   ✅ Found in accounts: ${accountType} - ${accountName}`);
            } else {
                // Special handling for student payments
                if (entry.source === 'payment' && entry.accountName && 
                    (entry.accountName.includes('Rental Income') || 
                     entry.accountName.includes('School Accommodation'))) {
                    accountType = 'Income';
                    accountName = 'Rental Income - School Accommodation';
                    console.log(`   🎓 Student payment detected: ${accountType} - ${accountName}`);
                }
                // Special handling for expense payments
                else if (entry.source === 'expense_payment' && entry.accountName && 
                         entry.accountName.includes('Expense')) {
                    accountType = 'Expense';
                    console.log(`   💸 Expense payment detected: ${accountType} - ${accountName}`);
                }
                // Special handling for bank/cash accounts
                else if (entry.accountCode && 
                        (entry.accountCode.startsWith('10') || 
                         entry.accountCode.startsWith('100') ||
                         entry.accountCode.startsWith('101'))) {
                    accountType = 'Asset';
                    console.log(`   🏦 Bank/Cash account detected: ${accountType} - ${accountName}`);
                }
                // Special handling for accounts payable
                else if (entry.accountCode && entry.accountCode.startsWith('20')) {
                    accountType = 'Liability';
                    console.log(`   📝 Accounts payable detected: ${accountType} - ${accountName}`);
                }
                else {
                    console.log(`   ⚠️  Could not determine account type for: ${entry.accountCode} - ${entry.accountName}`);
                    skippedCount++;
                    continue;
                }
            }

            // Update the entry
            try {
                await TransactionEntry.findByIdAndUpdate(entry._id, {
                    accountType: accountType,
                    accountName: accountName
                });
                console.log(`   ✅ Updated: ${accountType} - ${accountName}`);
                fixedCount++;
            } catch (error) {
                console.log(`   ❌ Error updating entry: ${error.message}`);
                skippedCount++;
            }
        }

        console.log('\n📊 FIX SUMMARY:');
        console.log('=' .repeat(50));
        console.log(`✅ Fixed: ${fixedCount} entries`);
        console.log(`⚠️  Skipped: ${skippedCount} entries`);
        console.log(`📋 Total processed: ${entriesToFix.length} entries`);

        // Verify the fixes
        console.log('\n🔍 VERIFYING FIXES...');
        const remainingUnfixed = await TransactionEntry.find({
            $or: [
                { accountType: { $exists: false } },
                { accountType: null },
                { accountType: '' }
            ]
        });

        console.log(`Remaining unfixed entries: ${remainingUnfixed.length}`);

        if (remainingUnfixed.length > 0) {
            console.log('\n⚠️  REMAINING UNFIXED ENTRIES:');
            remainingUnfixed.forEach(entry => {
                console.log(`   ${entry.accountCode} - ${entry.accountName} (${entry.source})`);
            });
        }

        // Test financial reports after fix
        console.log('\n🧪 TESTING FINANCIAL REPORTS AFTER FIX...');
        const FinancialReportsController = require('./src/controllers/financialReportsController');

        const mockReq = {
            query: {
                period: '2025',
                basis: 'cash'
            }
        };

        const mockRes = {
            json: (data) => {
                console.log('\n💰 INCOME STATEMENT AFTER FIX:');
                console.log(JSON.stringify(data, null, 2));
            },
            status: (code) => {
                return {
                    json: (data) => {
                        console.log('❌ Error:', data);
                    }
                };
            }
        };

        await FinancialReportsController.generateIncomeStatement(mockReq, mockRes);

        console.log('\n✅ TRANSACTION ENTRIES ACCOUNT TYPES FIX COMPLETED!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

fixTransactionEntriesAccountTypes(); 