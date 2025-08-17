require('dotenv').config();
const mongoose = require('mongoose');

async function checkAccountingCollections() {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n📊 Current Collections Status:');
        console.log('==============================');
        
        // Check debtors collection
        const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        console.log(`💰 Debtors: ${debtors.length} records`);
        
        // Check transactions collection
        const transactions = await mongoose.connection.db.collection('transactions').find({}).toArray();
        console.log(`📝 Transactions: ${transactions.length} records`);
        
        // Check transaction entries collection
        const transactionEntries = await mongoose.connection.db.collection('transactionentries').find({}).toArray();
        console.log(`📋 Transaction Entries: ${transactionEntries.length} records`);
        
        // Show sample data if available
        if (debtors.length > 0) {
            console.log('\n💳 Sample Debtor:');
            console.log(JSON.stringify(debtors[0], null, 2));
        }
        
        if (transactions.length > 0) {
            console.log('\n📝 Sample Transaction:');
            console.log(JSON.stringify(transactions[0], null, 2));
        }
        
        if (transactionEntries.length > 0) {
            console.log('\n📋 Sample Transaction Entry:');
            console.log(JSON.stringify(transactionEntries[0], null, 2));
        }
        
        // Check if we need to create accounting records for the payments
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        console.log(`\n💵 Payments: ${payments.length} records`);
        
        if (payments.length > 0 && (debtors.length === 0 || transactions.length === 0)) {
            console.log('\n⚠️  WARNING: You have payments but missing accounting records!');
            console.log('   Need to create:');
            console.log('   - Debtor records for each student');
            console.log('   - Transaction records for each payment');
            console.log('   - Transaction entries for proper double-entry accounting');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Checking Accounting Collections...');
checkAccountingCollections();
