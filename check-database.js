const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
    console.log('=== Checking Database Connection ===\n');

    try {
        // Check environment variables
        console.log('1. Environment Variables:');
        console.log(`   MONGODB_URI: ${process.env.MONGODB_URI ? 'Set' : 'Not set'}`);
        if (process.env.MONGODB_URI) {
            const uri = process.env.MONGODB_URI;
            const dbName = uri.split('/').pop().split('?')[0];
            console.log(`   Database name from URI: ${dbName}`);
        }
        console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);

        // Connect to MongoDB
        console.log('\n2. Connecting to MongoDB...');
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ Connected successfully');
        console.log(`   Host: ${conn.connection.host}`);
        console.log(`   Database: ${conn.connection.name}`);
        console.log(`   Ready state: ${conn.connection.readyState}`);

        // Check collections
        console.log('\n3. Available Collections:');
        const collections = await conn.connection.db.listCollections().toArray();
        collections.forEach(collection => {
            console.log(`   - ${collection.name}`);
        });

        // Check if requests collection exists
        const requestsCollection = collections.find(c => c.name === 'requests');
        if (requestsCollection) {
            console.log('\n4. Requests Collection Details:');
            console.log(`   Name: ${requestsCollection.name}`);
            console.log(`   Type: ${requestsCollection.type}`);
            
            // Count documents in requests collection
            const count = await conn.connection.db.collection('requests').countDocuments();
            console.log(`   Document count: ${count}`);
            
            if (count > 0) {
                // Get a sample document
                const sample = await conn.connection.db.collection('requests').findOne({});
                console.log('\n5. Sample Request Document:');
                console.log(JSON.stringify(sample, null, 2));
            }
        } else {
            console.log('\n4. ❌ Requests collection not found!');
        }

        // Check other potential collections
        console.log('\n6. Checking for similar collections:');
        const similarCollections = collections.filter(c => 
            c.name.toLowerCase().includes('request') || 
            c.name.toLowerCase().includes('maintenance') ||
            c.name.toLowerCase().includes('quotation')
        );
        
        if (similarCollections.length > 0) {
            similarCollections.forEach(collection => {
                console.log(`   - ${collection.name}`);
            });
        } else {
            console.log('   No similar collections found');
        }

        // Check database stats
        console.log('\n7. Database Statistics:');
        const stats = await conn.connection.db.stats();
        console.log(`   Collections: ${stats.collections}`);
        console.log(`   Data size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Storage size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);

        // Close connection
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');

    } catch (error) {
        console.error('❌ Database check failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the check
checkDatabase(); 