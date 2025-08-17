require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');

async function detailedRevenueCheck() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔍 Detailed Revenue Check...');

        const allEntries = await TransactionEntry.find({});
        let totalRevenue = 0;
        const revenueByAccount = {};

        console.log('\n📊 Checking ALL entries for revenue...');
        
        allEntries.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(subEntry => {
                    // Check if this is a revenue account (credit > 0)
                    if (subEntry.credit > 0) {
                        const accountCode = subEntry.accountCode;
                        const amount = subEntry.credit;
                        
                        if (!revenueByAccount[accountCode]) {
                            revenueByAccount[accountCode] = 0;
                        }
                        revenueByAccount[accountCode] += amount;
                        totalRevenue += amount;
                        
                        console.log(`  Found revenue: Account ${accountCode} - $${amount} (${entry.description})`);
                    }
                });
            }
        });

        console.log('\n📊 Revenue by Account Code:');
        Object.entries(revenueByAccount)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([code, amount]) => {
                console.log(`  Account ${code}: $${amount.toLocaleString()}`);
            });

        console.log(`\n💰 TOTAL REVENUE FOUND: $${totalRevenue.toLocaleString()}`);

        // Now check what the getRetainedEarnings method would calculate
        console.log('\n🔍 What getRetainedEarnings method calculates:');
        
        const revenueEntries = await TransactionEntry.find({
            'entries.accountCode': { $in: ['4000', '4001', '4020', '4100'] },
            status: 'posted'
        });
        
        let calculatedRevenue = 0;
        revenueEntries.forEach(entry => {
            if (entry.entries && Array.isArray(entry.entries)) {
                entry.entries.forEach(subEntry => {
                    if (['4000', '4001', '4020', '4100'].includes(subEntry.accountCode)) {
                        calculatedRevenue += subEntry.credit || 0;
                    }
                });
            }
        });
        
        console.log(`  Revenue from getRetainedEarnings: $${calculatedRevenue.toLocaleString()}`);
        console.log(`  Difference: $${(totalRevenue - calculatedRevenue).toLocaleString()}`);

        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

detailedRevenueCheck();




