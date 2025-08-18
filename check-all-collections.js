const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkAllCollections() {
    try {
        console.log('🔍 Checking All Collections for Data...\n');
        
        const db = mongoose.connection.db;
        
        // Get all collection names
        const collections = await db.listCollections().toArray();
        console.log('📚 All Collections:');
        collections.forEach(col => console.log(`  - ${col.name}`));
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Check each collection for data
        for (const collection of collections) {
            const collectionName = collection.name;
            const count = await db.collection(collectionName).countDocuments();
            
            console.log(`📊 ${collectionName}: ${count} documents`);
            
            if (count > 0) {
                // Show sample document structure
                const sample = await db.collection(collectionName).findOne();
                console.log(`  Sample fields: ${Object.keys(sample).join(', ')}`);
                
                // If it looks like payment data, show more details
                if (collectionName.toLowerCase().includes('payment') || 
                    sample.amount || sample.totalAmount || sample.paymentId) {
                    console.log(`  Sample document:`);
                    console.log(`    ${JSON.stringify(sample, null, 4)}`);
                }
                
                console.log('  ---');
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking collections:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Wait for connection then run
mongoose.connection.once('open', () => {
    checkAllCollections();
});
