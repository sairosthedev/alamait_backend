require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkRemaining() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔍 Checking remaining unknown entries...');

        const unknownEntries = await TransactionEntry.find({ 'metadata.type': { $exists: false } });
        console.log('Remaining unknown entries:', unknownEntries.length);
        
        unknownEntries.forEach((entry, i) => {
            console.log('\nEntry', i+1, ':');
            console.log('  Description:', entry.description);
            console.log('  Amount:', entry.totalDebit);
            if (entry.entries && entry.entries.length > 0) {
                entry.entries.forEach((subEntry, j) => {
                    console.log('    ', j+1, '.', subEntry.accountCode, '-', subEntry.accountName, ':', subEntry.debit, '/', subEntry.credit);
                });
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

checkRemaining();


