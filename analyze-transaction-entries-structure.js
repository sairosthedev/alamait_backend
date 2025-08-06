process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const Transaction = require('./src/models/Transaction');
const Payment = require('./src/models/Payment');
const Expense = require('./src/models/finance/Expense');

async function analyzeTransactionEntriesStructure() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n🔍 ANALYZING TRANSACTION ENTRIES STRUCTURE...\n');

        // Get a few sample entries to understand the structure
        const sampleEntries = await TransactionEntry.find().limit(5);
        
        console.log('📋 SAMPLE TRANSACTION ENTRIES:');
        console.log('=' .repeat(50));
        
        sampleEntries.forEach((entry, index) => {
            console.log(`\nEntry ${index + 1}:`);
            console.log(JSON.stringify(entry.toObject(), null, 2));
        });

        // Check entries with missing account types
        const entriesWithMissingTypes = await TransactionEntry.find({
            $or: [
                { accountType: { $exists: false } },
                { accountType: null },
                { accountType: '' }
            ]
        }).limit(3);

        console.log('\n⚠️  ENTRIES WITH MISSING ACCOUNT TYPES:');
        console.log('=' .repeat(50));
        
        entriesWithMissingTypes.forEach((entry, index) => {
            console.log(`\nMissing Type Entry ${index + 1}:`);
            console.log(JSON.stringify(entry.toObject(), null, 2));
        });

        // Check the entries array structure
        console.log('\n🔍 CHECKING ENTRIES ARRAY STRUCTURE:');
        console.log('=' .repeat(50));
        
        const entriesWithArrays = await TransactionEntry.find({
            'entries.0': { $exists: true }
        }).limit(3);

        entriesWithArrays.forEach((entry, index) => {
            console.log(`\nEntry with Array ${index + 1}:`);
            console.log('Entries array:');
            console.log(JSON.stringify(entry.entries, null, 2));
        });

        // Check payment-related entries
        console.log('\n💰 PAYMENT-RELATED ENTRIES:');
        console.log('=' .repeat(50));
        
        const paymentEntries = await TransactionEntry.find({
            source: 'payment'
        }).limit(3);

        paymentEntries.forEach((entry, index) => {
            console.log(`\nPayment Entry ${index + 1}:`);
            console.log(JSON.stringify(entry.toObject(), null, 2));
        });

        // Check expense-related entries
        console.log('\n💸 EXPENSE-RELATED ENTRIES:');
        console.log('=' .repeat(50));
        
        const expenseEntries = await TransactionEntry.find({
            source: 'expense_payment'
        }).limit(3);

        expenseEntries.forEach((entry, index) => {
            console.log(`\nExpense Entry ${index + 1}:`);
            console.log(JSON.stringify(entry.toObject(), null, 2));
        });

        // Check if there are any entries with proper account data
        console.log('\n✅ ENTRIES WITH PROPER ACCOUNT DATA:');
        console.log('=' .repeat(50));
        
        const properEntries = await TransactionEntry.find({
            accountCode: { $exists: true, $ne: null },
            accountName: { $exists: true, $ne: null },
            accountType: { $exists: true, $ne: null }
        }).limit(3);

        properEntries.forEach((entry, index) => {
            console.log(`\nProper Entry ${index + 1}:`);
            console.log(`Account Code: ${entry.accountCode}`);
            console.log(`Account Name: ${entry.accountName}`);
            console.log(`Account Type: ${entry.accountType}`);
            console.log(`Source: ${entry.source}`);
        });

        console.log('\n✅ ANALYSIS COMPLETED!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

analyzeTransactionEntriesStructure(); 