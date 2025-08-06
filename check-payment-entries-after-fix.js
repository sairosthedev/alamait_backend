process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkPaymentEntriesAfterFix() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n🔍 CHECKING PAYMENT ENTRIES AFTER FIX...\n');

        // Get all payment entries
        const paymentEntries = await TransactionEntry.find({
            source: 'payment'
        });

        console.log(`Found ${paymentEntries.length} payment entries`);

        paymentEntries.forEach((entry, index) => {
            console.log(`\n📋 Payment Entry ${index + 1}:`);
            console.log(`   ID: ${entry._id}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Source: ${entry.source}`);
            console.log(`   Date: ${entry.date}`);
            
            console.log('   Entries array:');
            entry.entries.forEach((line, lineIndex) => {
                console.log(`     Line ${lineIndex + 1}:`);
                console.log(`       Account Code: ${line.accountCode}`);
                console.log(`       Account Name: ${line.accountName}`);
                console.log(`       Account Type: ${line.accountType}`);
                console.log(`       Debit: ${line.debit}, Credit: ${line.credit}`);
            });
        });

        console.log('\n✅ CHECK COMPLETED!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

checkPaymentEntriesAfterFix(); 