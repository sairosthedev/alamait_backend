require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkAccountCodes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔍 Checking Account Codes in TransactionEntry...');

        const allEntries = await TransactionEntry.find({});
        const accountCodeCounts = {};
        
        allEntries.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(subEntry => {
                    const code = subEntry.accountCode;
                    if (code) {
                        accountCodeCounts[code] = (accountCodeCounts[code] || 0) + 1;
                    }
                });
            }
        });

        console.log('\n📊 Account Code Breakdown:');
        Object.entries(accountCodeCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([code, count]) => {
                console.log(`  ${code}: ${count} entries`);
            });

        // Check specific revenue accounts
        console.log('\n🔍 Revenue Account Details:');
        const revenueEntries = await TransactionEntry.find({
            'entries.accountCode': { $in: ['4000', '4100'] }
        });
        console.log(`Entries with revenue account codes (4000, 4100): ${revenueEntries.length}`);

        // Check specific expense accounts
        console.log('\n🔍 Expense Account Details:');
        const expenseEntries = await TransactionEntry.find({
            'entries.accountCode': { $regex: /^5/ }
        });
        console.log(`Entries with expense account codes (5xxx): ${expenseEntries.length}`);

        // Check what's actually in the revenue accounts
        console.log('\n📊 Revenue Account Contents:');
        const revenueCodes = ['4000', '4100'];
        revenueCodes.forEach(code => {
            const entries = allEntries.filter(entry => 
                entry.entries && entry.entries.some(sub => sub.accountCode === code)
            );
            console.log(`  Account ${code}: ${entries.length} entries`);
            
            if (entries.length > 0) {
                let totalCredit = 0;
                entries.forEach(entry => {
                    entry.entries.forEach(sub => {
                        if (sub.accountCode === code) {
                            totalCredit += sub.credit || 0;
                        }
                    });
                });
                console.log(`    Total Credit: $${totalCredit.toLocaleString()}`);
            }
        });

        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

checkAccountCodes();

