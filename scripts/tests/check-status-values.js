require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkStatusValues() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔍 Checking TransactionEntry Status Values...');

        // Get all unique status values
        const allEntries = await TransactionEntry.find({});
        const statusCounts = {};
        
        allEntries.forEach(entry => {
            const status = entry.status || 'null';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        console.log('\n📊 Status Breakdown:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`  ${status}: ${count} entries`);
        });

        // Check a few sample entries
        console.log('\n📋 Sample Entries:');
        const sampleEntries = await TransactionEntry.find({}).limit(3);
        sampleEntries.forEach((entry, i) => {
            console.log(`\nEntry ${i + 1}:`);
            console.log(`  ID: ${entry._id}`);
            console.log(`  Status: ${entry.status}`);
            console.log(`  Description: ${entry.description}`);
            console.log(`  Metadata Type: ${entry.metadata?.type || 'none'}`);
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

checkStatusValues();

