require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

async function checkTransactions() {
    try {
        await mongoose.connection.asPromise();
        const db = mongoose.connection.db;
        
        // Check collections
        const transactionEntries = await db.collection('transactionentries').find({}).toArray();
        const transactions = await db.collection('transactions').find({}).toArray();
        const payments = await db.collection('payments').find({}).toArray();
        const debtors = await db.collection('debtors').find({}).toArray();
        
        console.log(`📊 Transaction Entries: ${transactionEntries.length}`);
        console.log(`📊 Transactions: ${transactions.length}`);
        console.log(`📊 Payments: ${payments.length}`);
        console.log(`📊 Debtors: ${debtors.length}`);
        
        if (transactionEntries.length > 0) {
            console.log('\n🔍 Sample Transaction Entry:');
            const sample = transactionEntries[0];
            console.log(JSON.stringify(sample, null, 2));
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

checkTransactions(); 