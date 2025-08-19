const mongoose = require('mongoose');
require('dotenv').config();

// Import the TransactionEntry model
const TransactionEntry = require('./src/models/TransactionEntry');

async function debugARAPSources() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas\n');

        console.log('🔍 DEBUGGING AR/AP SOURCES IN CASH FLOW');
        console.log('='.repeat(80));

        // Get all transactions with AR/AP accounts
        const arApTransactions = await TransactionEntry.find({
            date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
            $or: [
                { 'entries.accountCode': { $regex: /^110/ } }, // AR accounts
                { 'entries.accountCode': { $regex: /^200/ } }  // AP accounts
            ]
        }).populate('entries');

        console.log(`📊 Found ${arApTransactions.length} transactions with AR/AP accounts\n`);

        // Analyze each transaction
        arApTransactions.forEach((entry, index) => {
            console.log(`\n🔍 Transaction ${index + 1}:`);
            console.log(`   ID: ${entry._id}`);
            console.log(`   Date: ${entry.date.toDateString()}`);
            console.log(`   Source: ${entry.source}`);
            console.log(`   Source Model: ${entry.sourceModel || 'N/A'}`);
            console.log(`   Description: ${entry.description || 'N/A'}`);
            
            console.log('   Entries:');
            entry.entries.forEach(line => {
                if (line.accountCode.startsWith('110') || line.accountCode.startsWith('200')) {
                    console.log(`     ${line.accountCode} - ${line.accountName}:`);
                    console.log(`       Type: ${line.accountType}`);
                    console.log(`       Debit: ${line.debit || 0}`);
                    console.log(`       Credit: ${line.credit || 0}`);
                    console.log(`       Net: ${(line.debit || 0) - (line.credit || 0)}`);
                }
            });
        });

        // Check what sources are being used for AR/AP
        const arApSources = await TransactionEntry.aggregate([
            {
                $match: {
                    date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
                    $or: [
                        { 'entries.accountCode': { $regex: /^110/ } },
                        { 'entries.accountCode': { $regex: /^200/ } }
                    ]
                }
            },
            {
                $group: {
                    _id: '$source',
                    count: { $sum: 1 },
                    totalAmount: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        console.log('\n📊 AR/AP Transaction Sources:');
        console.log('-'.repeat(50));
        arApSources.forEach(source => {
            console.log(`   ${source._id}: ${source.count} transactions`);
        });

        // Check if any AR/AP transactions have cash-related sources
        const cashRelatedARAP = arApTransactions.filter(entry => 
            ['manual', 'expense_payment', 'payment', 'rental_payment'].includes(entry.source)
        );

        console.log(`\n💰 AR/AP Transactions with Cash-Related Sources: ${cashRelatedARAP.length}`);
        
        if (cashRelatedARAP.length > 0) {
            console.log('These should be included in cash flow:');
            cashRelatedARAP.forEach(entry => {
                console.log(`   ${entry.source} - ${entry.date.toDateString()}`);
            });
        }

        // Check for non-cash AR/AP transactions
        const nonCashARAP = arApTransactions.filter(entry => 
            !['manual', 'expense_payment', 'payment', 'rental_payment'].includes(entry.source)
        );

        console.log(`\n📝 AR/AP Transactions with Non-Cash Sources: ${nonCashARAP.length}`);
        
        if (nonCashARAP.length > 0) {
            console.log('These should NOT be included in cash flow:');
            nonCashARAP.forEach(entry => {
                console.log(`   ${entry.source} - ${entry.date.toDateString()}`);
            });
        }

    } catch (error) {
        console.error('❌ Error debugging AR/AP sources:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the debug
debugARAPSources();
