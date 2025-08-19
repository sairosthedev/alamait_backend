require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

async function checkEntries() {
    try {
        await mongoose.connection.asPromise();
        const db = mongoose.connection.db;
        
        const entries = await db.collection('transactionentries').find({}).toArray();
        console.log(`📊 Transaction Entries: ${entries.length}\n`);
        
        if (entries.length > 0) {
            console.log('📋 Sample Entry:');
            const sample = entries[0];
            console.log(`  Account: ${sample.account}`);
            console.log(`  Type: ${sample.type}`);
            console.log(`  Amount: $${sample.amount}`);
            console.log(`  Residence: ${sample.residence || 'NO RESIDENCE'}`);
            console.log(`  Metadata Type: ${sample.metadata?.type || 'NO TYPE'}`);
        }
        
        // Check types
        const types = new Set();
        entries.forEach(e => {
            if (e.metadata?.type) types.add(e.metadata.type);
        });
        console.log(`\nFound types: ${Array.from(types).join(', ')}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

checkEntries();




