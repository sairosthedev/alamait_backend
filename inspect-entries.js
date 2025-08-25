require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

async function inspectEntries() {
    try {
        await mongoose.connection.asPromise();
        const db = mongoose.connection.db;
        
        const entries = await db.collection('transactionentries').find({}).toArray();
        console.log(`📊 Total Entries: ${entries.length}\n`);
        
        if (entries.length > 0) {
            console.log('📋 FULL STRUCTURE OF FIRST ENTRY:');
            console.log(JSON.stringify(entries[0], null, 2));
            
            console.log('\n🔍 FIELD ANALYSIS:');
            const first = entries[0];
            Object.keys(first).forEach(key => {
                console.log(`  ${key}: ${typeof first[key]} = ${JSON.stringify(first[key])}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

inspectEntries();









