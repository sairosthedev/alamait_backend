process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function fixPaymentEntriesDirect() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n🔧 FIXING PAYMENT ENTRIES DIRECTLY...\n');

        // Get all payment entries
        const paymentEntries = await TransactionEntry.find({
            source: 'payment'
        });

        console.log(`Found ${paymentEntries.length} payment entries to fix`);

        let fixedCount = 0;

        for (const entry of paymentEntries) {
            console.log(`\n🔧 Processing payment entry: ${entry._id}`);
            console.log(`   Description: ${entry.description}`);

            // Update the entries array with proper account types
            const updatedEntries = entry.entries.map(line => {
                console.log(`   Checking line: ${line.accountCode} - ${line.accountName}`);
                
                let accountType = null;
                let accountName = line.accountName;

                // Determine account type based on account code
                if (line.accountCode === '4001') {
                    accountType = 'Income';
                    accountName = 'Rental Income - School Accommodation';
                    console.log(`   🎓 Setting as Income: ${accountName}`);
                } else if (line.accountCode.startsWith('10')) {
                    accountType = 'Asset';
                    console.log(`   🏦 Setting as Asset: ${accountName}`);
                } else if (line.accountCode.startsWith('20')) {
                    accountType = 'Liability';
                    console.log(`   📝 Setting as Liability: ${accountName}`);
                } else {
                    console.log(`   ⚠️  Unknown account code: ${line.accountCode}`);
                    return line;
                }

                return {
                    ...line,
                    accountType: accountType,
                    accountName: accountName
                };
            });

            // Update the document directly
            try {
                await TransactionEntry.updateOne(
                    { _id: entry._id },
                    { $set: { entries: updatedEntries } }
                );
                console.log(`   ✅ Updated payment entry`);
                fixedCount++;
            } catch (error) {
                console.log(`   ❌ Error updating entry: ${error.message}`);
            }
        }

        console.log('\n📊 FIX SUMMARY:');
        console.log('=' .repeat(50));
        console.log(`✅ Fixed: ${fixedCount} payment entries`);
        console.log(`📋 Total processed: ${paymentEntries.length} payment entries`);

        // Verify the fix
        console.log('\n🔍 VERIFYING FIX...');
        const verifyEntries = await TransactionEntry.find({
            source: 'payment'
        }).limit(2);

        verifyEntries.forEach((entry, index) => {
            console.log(`\n📋 Verification Entry ${index + 1}:`);
            entry.entries.forEach((line, lineIndex) => {
                console.log(`   Line ${lineIndex + 1}: ${line.accountCode} - ${line.accountName} (${line.accountType})`);
            });
        });

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

        console.log('\n✅ PAYMENT ENTRIES DIRECT FIX COMPLETED!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

fixPaymentEntriesDirect(); 