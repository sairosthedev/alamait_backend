process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');

async function fixPaymentEntriesAccountTypes() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n🔧 FIXING PAYMENT ENTRIES ACCOUNT TYPES...\n');

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

        // Get all payment entries that need fixing
        console.log('\n🔍 Finding payment entries to fix...');
        const paymentEntries = await TransactionEntry.find({
            source: 'payment'
        });

        console.log(`Found ${paymentEntries.length} payment entries`);

        let fixedCount = 0;
        let skippedCount = 0;

        for (const entry of paymentEntries) {
            console.log(`\n🔧 Processing payment entry: ${entry._id}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Source: ${entry.source}`);

            let needsUpdate = false;
            const updatedEntries = entry.entries.map(line => {
                console.log(`   Checking line: ${line.accountCode} - ${line.accountName}`);
                
                // If accountType is missing, try to find it
                if (!line.accountType && line.accountCode) {
                    if (accountLookup[line.accountCode]) {
                        const accountInfo = accountLookup[line.accountCode];
                        console.log(`   ✅ Found account type: ${accountInfo.type} - ${accountInfo.name}`);
                        needsUpdate = true;
                        return {
                            ...line,
                            accountType: accountInfo.type,
                            accountName: accountInfo.name
                        };
                    } else {
                        // Special handling for known account codes
                        let accountType = null;
                        let accountName = line.accountName;

                        if (line.accountCode === '4001') {
                            accountType = 'Income';
                            accountName = 'Rental Income - School Accommodation';
                            console.log(`   🎓 Student payment account: ${accountType} - ${accountName}`);
                        } else if (line.accountCode.startsWith('10')) {
                            accountType = 'Asset';
                            console.log(`   🏦 Bank/Cash account: ${accountType} - ${accountName}`);
                        } else if (line.accountCode.startsWith('20')) {
                            accountType = 'Liability';
                            console.log(`   📝 Accounts payable: ${accountType} - ${accountName}`);
                        } else {
                            console.log(`   ⚠️  Could not determine account type for: ${line.accountCode}`);
                            return line;
                        }

                        needsUpdate = true;
                        return {
                            ...line,
                            accountType: accountType,
                            accountName: accountName
                        };
                    }
                }
                
                return line;
            });

            if (needsUpdate) {
                try {
                    await TransactionEntry.findByIdAndUpdate(entry._id, {
                        entries: updatedEntries
                    });
                    console.log(`   ✅ Updated payment entry`);
                    fixedCount++;
                } catch (error) {
                    console.log(`   ❌ Error updating entry: ${error.message}`);
                    skippedCount++;
                }
            } else {
                console.log(`   ✅ No update needed`);
                skippedCount++;
            }
        }

        console.log('\n📊 FIX SUMMARY:');
        console.log('=' .repeat(50));
        console.log(`✅ Fixed: ${fixedCount} payment entries`);
        console.log(`⚠️  Skipped: ${skippedCount} payment entries`);
        console.log(`📋 Total processed: ${paymentEntries.length} payment entries`);

        // Test financial reports after fix
        console.log('\n🧪 TESTING FINANCIAL REPORTS AFTER FIX...');
        const FinancialReportsController = require('../src/controllers/financialReportsController');

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

        console.log('\n✅ PAYMENT ENTRIES ACCOUNT TYPES FIX COMPLETED!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

fixPaymentEntriesAccountTypes(); 