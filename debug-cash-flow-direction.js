const mongoose = require('mongoose');
require('dotenv').config();

// Import the TransactionEntry model
const TransactionEntry = require('./src/models/TransactionEntry');

async function debugCashFlowDirection() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas\n');

        console.log('🔍 DEBUGGING CASH FLOW DIRECTION LOGIC');
        console.log('='.repeat(80));

        // Get a specific transaction to understand the double-entry structure
        const adminPettyCashTransaction = await TransactionEntry.findOne({
            'entries.accountName': { $regex: /Admin Petty Cash/i },
            date: { $gte: new Date('2025-08-01'), $lte: new Date('2025-08-31') }
        }).populate('entries');

        if (adminPettyCashTransaction) {
            console.log('🔍 Admin Petty Cash Transaction Analysis:');
            console.log(`   ID: ${adminPettyCashTransaction._id}`);
            console.log(`   Date: ${adminPettyCashTransaction.date.toDateString()}`);
            console.log(`   Source: ${adminPettyCashTransaction.source}`);
                            console.log(`   Description: ${adminPettyCashTransaction.description || 'N/A'}`);
            
            console.log('\n   Double-Entry Structure:');
            adminPettyCashTransaction.entries.forEach((line, index) => {
                console.log(`     Entry ${index + 1}:`);
                console.log(`       Account: ${line.accountCode} - ${line.accountName}`);
                console.log(`       Type: ${line.accountType}`);
                console.log(`       Debit: ${line.debit || 0}`);
                console.log(`       Credit: ${line.credit || 0}`);
                console.log(`       Net: ${(line.debit || 0) - (line.credit || 0)}`);
            });
        }

        // Check for duplicate AR accounts
        console.log('\n🔍 Checking for Duplicate AR Accounts:');
        const arAccounts = await TransactionEntry.aggregate([
            {
                $match: {
                    date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
                    'entries.accountCode': { $regex: /^110/ }
                }
            },
            {
                $unwind: '$entries'
            },
            {
                $match: {
                    'entries.accountCode': { $regex: /^110/ }
                }
            },
            {
                $group: {
                    _id: {
                        accountCode: '$entries.accountCode',
                        accountName: '$entries.accountName'
                    },
                    count: { $sum: 1 },
                    totalDebit: { $sum: '$entries.debit' },
                    totalCredit: { $sum: '$entries.credit' }
                }
            },
            { $sort: { '_id.accountCode': 1 } }
        ]);

        console.log('\n📊 AR Account Summary:');
        console.log('-'.repeat(60));
        arAccounts.forEach(account => {
            console.log(`   ${account._id.accountCode} - ${account._id.accountName}:`);
            console.log(`     Transactions: ${account.count}`);
            console.log(`     Total Debit: ${account.totalDebit}`);
            console.log(`     Total Credit: ${account.totalCredit}`);
            console.log(`     Net: ${account.totalDebit - account.totalCredit}`);
        });

        // Check the cash flow calculation logic
        console.log('\n🔍 Cash Flow Calculation Logic Test:');
        console.log('-'.repeat(50));
        
        // Test the current calculateCashFlow method
        const testCases = [
            { accountType: 'Asset', debit: 600, credit: 0, description: 'Cash to Admin Petty Cash' },
            { accountType: 'Asset', debit: 0, credit: 600, description: 'Admin Petty Cash from Cash' },
            { accountType: 'Asset', debit: 0, credit: 1000, description: 'AR Collection' },
            { accountType: 'Asset', debit: 1000, credit: 0, description: 'AR Increase' }
        ];

        testCases.forEach(testCase => {
            // Simulate the current logic
            let cashFlow;
            if (testCase.accountType === 'Asset') {
                cashFlow = testCase.credit - testCase.debit;
            } else if (testCase.accountType === 'Liability') {
                cashFlow = testCase.debit - testCase.credit;
            } else if (testCase.accountType === 'Income') {
                cashFlow = testCase.credit;
            } else if (testCase.accountType === 'Expense') {
                cashFlow = -(testCase.debit - testCase.credit);
            }
            
            console.log(`   ${testCase.description}:`);
            console.log(`     Debit: ${testCase.debit}, Credit: ${testCase.credit}`);
            console.log(`     Cash Flow: ${cashFlow} (${cashFlow > 0 ? 'Inflow' : 'Outflow'})`);
        });

        // Check for transactions with multiple AR entries
        console.log('\n🔍 Transactions with Multiple AR Entries:');
        const multiARTransactions = await TransactionEntry.find({
            date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
            $expr: {
                $gt: [
                    { $size: { $filter: { input: '$entries', cond: { $regexMatch: { input: '$$this.accountCode', regex: /^110/ } } } } },
                    1
                ]
            }
        }).populate('entries');

        if (multiARTransactions.length > 0) {
            console.log(`   Found ${multiARTransactions.length} transactions with multiple AR entries:`);
            multiARTransactions.forEach((entry, index) => {
                console.log(`\n     Transaction ${index + 1}:`);
                console.log(`       Date: ${entry.date.toDateString()}`);
                console.log(`       Source: ${entry.source}`);
                entry.entries.forEach(line => {
                    if (line.accountCode.startsWith('110')) {
                        console.log(`         ${line.accountCode} - ${line.accountName}: Debit ${line.debit || 0}, Credit ${line.credit || 0}`);
                    }
                });
            });
        } else {
            console.log('   No transactions with multiple AR entries found');
        }

    } catch (error) {
        console.error('❌ Error debugging cash flow direction:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the debug
debugCashFlowDirection();
