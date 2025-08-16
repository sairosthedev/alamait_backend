/**
 * 🔍 Check Test Database Collections
 * 
 * This script checks all collections in your 'test' database
 * to see where your residence data actually is.
 */

const mongoose = require('mongoose');

async function checkTestDatabase() {
    try {
        console.log('🔍 Checking Test Database Collections...\n');
        
        // Connect to MongoDB - using 'test' database
        await mongoose.connect('mongodb://localhost:27017/test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB (test database)');
        
        // Get the database name we're actually connected to
        const dbName = mongoose.connection.db.databaseName;
        console.log(`📊 Connected to database: ${dbName}`);
        
        // List all collections in current database
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`\n📋 Collections in ${dbName}:`);
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });
        
        // Check each collection for data
        console.log('\n🔍 Checking Each Collection for Data...');
        for (const collection of collections) {
            try {
                const collectionObj = mongoose.connection.db.collection(collection.name);
                const count = await collectionObj.countDocuments();
                
                if (count > 0) {
                    console.log(`\n📊 ${collection.name}: ${count} records`);
                    
                    // Get a sample record
                    const sample = await collectionObj.findOne({});
                    if (sample) {
                        if (sample.name) {
                            console.log(`   Sample: ${sample.name}`);
                        } else if (sample.firstName && sample.lastName) {
                            console.log(`   Sample: ${sample.firstName} ${sample.lastName}`);
                        } else {
                            console.log(`   Sample ID: ${sample._id}`);
                        }
                        
                        // Show key fields
                        const keyFields = Object.keys(sample).filter(key => 
                            !['_id', '__v'].includes(key)
                        ).slice(0, 5);
                        if (keyFields.length > 0) {
                            console.log(`   Key Fields: ${keyFields.join(', ')}`);
                        }
                    }
                } else {
                    console.log(`\n📊 ${collection.name}: 0 records (empty)`);
                }
                
            } catch (error) {
                console.log(`\n❌ Error checking ${collection.name}: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking database:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// Run the check
if (require.main === module) {
    checkTestDatabase().catch(console.error);
}

module.exports = { checkTestDatabase };
