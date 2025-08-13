const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testFinanceApprovalFixed() {
    console.log('🧪 Testing Fixed Finance Approval Logic');
    console.log('=======================================');

    if (!process.env.MONGODB_URI) {
        console.log('❌ MONGODB_URI not found in environment variables');
        return;
    }

    try {
        console.log('🔌 Connecting to MongoDB...');
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();
        const maintenanceCollection = db.collection('maintenance');

        console.log('\n🔍 Finding the water request for testing...');
        const waterRequest = await maintenanceCollection.findOne({
            title: 'water'
        });

        if (!waterRequest) {
            console.log('❌ Water request not found');
            await client.close();
            return;
        }

        console.log('✅ Found water request:', {
            id: waterRequest._id,
            title: waterRequest.title,
            status: waterRequest.status,
            financeStatus: waterRequest.financeStatus,
            convertedToExpense: waterRequest.convertedToExpense,
            items: waterRequest.items?.length || 0
        });

        // Check current expense records
        const expensesCollection = db.collection('expenses');
        const existingExpenses = await expensesCollection.find({
            requestId: waterRequest._id
        }).toArray();

        console.log(`\n💰 Current expense records for this request: ${existingExpenses.length}`);
        existingExpenses.forEach((exp, index) => {
            console.log(`  ${index + 1}. Expense ID: ${exp.expenseId}`);
            console.log(`     Amount: ${exp.amount}`);
            console.log(`     Status: ${exp.paymentStatus}`);
            console.log(`     Created: ${exp.createdAt}`);
        });

        // Check transaction records
        const transactionsCollection = db.collection('transactions');
        const existingTransactions = await transactionsCollection.find({
            reference: waterRequest._id.toString()
        }).toArray();

        console.log(`\n💳 Current transaction records for this request: ${existingTransactions.length}`);
        existingTransactions.forEach((txn, index) => {
            console.log(`  ${index + 1}. Transaction ID: ${txn.transactionId}`);
            console.log(`     Amount: ${txn.amount}`);
            console.log(`     Description: ${txn.description}`);
            console.log(`     Created: ${txn.createdAt}`);
        });

        // Check transaction entries
        const transactionEntriesCollection = db.collection('transactionentries');
        const existingEntries = await transactionEntriesCollection.find({
            reference: { $regex: waterRequest._id.toString() }
        }).toArray();

        console.log(`\n📝 Current transaction entries for this request: ${existingEntries.length}`);
        existingEntries.forEach((entry, index) => {
            console.log(`  ${index + 1}. Entry ID: ${entry._id}`);
            console.log(`     Account: ${entry.account}`);
            console.log(`     Debit: ${entry.debit}, Credit: ${entry.credit}`);
            console.log(`     Type: ${entry.type}`);
        });

        // Summary of what should happen when finance approval is triggered
        console.log('\n📋 Summary of Finance Approval Process:');
        console.log('=========================================');
        console.log('1. ✅ Request.financeStatus = "approved"');
        console.log('2. ✅ Request.status = "approved"');
        console.log('3. ✅ Request.convertedToExpense = true');
        console.log('4. 💰 Create Expense record');
        console.log('5. 💳 Create Transaction record');
        console.log('6. 📝 Create TransactionEntry records (double-entry)');
        console.log('7. 🔗 Link expenseId to request');

        // Check if the request is ready for finance approval
        const isReadyForApproval = 
            waterRequest.status === 'pending' && 
            waterRequest.financeStatus === 'pending';

        if (isReadyForApproval) {
            console.log('\n🎯 Request is ready for finance approval');
            console.log('   - Status: pending ✅');
            console.log('   - Finance Status: pending ✅');
        } else {
            console.log('\n⚠️  Request is NOT ready for finance approval');
            console.log(`   - Status: ${waterRequest.status} ${waterRequest.status === 'pending' ? '✅' : '❌'}`);
            console.log(`   - Finance Status: ${waterRequest.financeStatus} ${waterRequest.financeStatus === 'pending' ? '✅' : '❌'}`);
            
            if (waterRequest.financeStatus === 'approved') {
                console.log('\n💡 Request is already approved by finance!');
                console.log('   To test the complete flow, you would need to:');
                console.log('   1. Reset the request to pending status');
                console.log('   2. Trigger the finance approval endpoint');
                console.log('   3. Verify all fields are updated correctly');
            }
        }

        await client.close();
        console.log('\n✅ Test completed');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testFinanceApprovalFixed();
