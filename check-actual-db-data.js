const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkActualDBData() {
    try {
        console.log('🔍 Checking actual database collections...\n');
        
        const db = mongoose.connection.db;
        
        // Get all collection names
        const collections = await db.listCollections().toArray();
        console.log('📚 Collections found:');
        collections.forEach(col => console.log(`  - ${col.name}`));
        
        // Check transactionentries collection directly
        console.log('\n📊 TransactionEntries Collection (raw):');
        const transactionEntries = await db.collection('transactionentries').find({}).toArray();
        console.log(`  Total entries: ${transactionEntries.length}`);
        
        if (transactionEntries.length > 0) {
            console.log('\n  All entries:');
            transactionEntries.forEach((entry, i) => {
                console.log(`    Entry ${i + 1}:`);
                console.log(`      _id: ${entry._id}`);
                console.log(`      Full entry: ${JSON.stringify(entry, null, 6)}`);
                console.log('      ---');
            });
        }
        
        // Check transactions collection directly
        console.log('\n📋 Transactions Collection (raw):');
        const transactions = await db.collection('transactions').find({}).toArray();
        console.log(`  Total transactions: ${transactions.length}`);
        
        if (transactions.length > 0) {
            console.log('\n  All transactions:');
            transactions.forEach((trans, i) => {
                console.log(`    Transaction ${i + 1}:`);
                console.log(`      _id: ${trans._id}`);
                console.log(`      Full transaction: ${JSON.stringify(trans, null, 6)}`);
                console.log('      ---');
            });
        }
        
        // Check accounts collection directly
        console.log('\n💰 Accounts Collection (raw):');
        const accounts = await db.collection('accounts').find({}).toArray();
        console.log(`  Total accounts: ${accounts.length}`);
        
        if (accounts.length > 0) {
            console.log('\n  All accounts:');
            accounts.forEach((account, i) => {
                console.log(`    Account ${i + 1}:`);
                console.log(`      _id: ${account._id}`);
                console.log(`      Full account: ${JSON.stringify(account, null, 6)}`);
                console.log('      ---');
            });
        }
        
        // Check payments collection
        console.log('\n💳 Payments Collection:');
        const payments = await db.collection('payments').find({}).toArray();
        console.log(`  Total payments: ${payments.length}`);
        
        if (payments.length > 0) {
            console.log('\n  All payments:');
            payments.forEach((payment, i) => {
                console.log(`    Payment ${i + 1}:`);
                console.log(`      _id: ${payment._id}`);
                console.log(`      Full payment: ${JSON.stringify(payment, null, 6)}`);
                console.log('      ---');
            });
        }
        
        // Check expenses collection
        console.log('\n📝 Expenses Collection:');
        const expenses = await db.collection('expenses').find({}).toArray();
        console.log(`  Total expenses: ${expenses.length}`);
        
        if (expenses.length > 0) {
            console.log('\n  All expenses:');
            expenses.forEach((expense, i) => {
                console.log(`    Expense ${i + 1}:`);
                console.log(`      _id: ${expense._id}`);
                console.log(`      Full expense: ${JSON.stringify(expense, null, 6)}`);
                console.log('      ---');
            });
        }
        
    } catch (error) {
        console.error('❌ Error checking database:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Wait for connection then run
mongoose.connection.once('open', () => {
    checkActualDBData();
});
