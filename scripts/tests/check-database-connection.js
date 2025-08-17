/**
 * 🔍 Database Connection Check
 * 
 * This script checks which database we're actually connected to
 * and lists all available databases and collections.
 */

const mongoose = require('mongoose');

async function checkDatabaseConnection() {
    try {
        console.log('🔍 Checking Database Connection...\n');
        
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');
        
        // Get the database name we're actually connected to
        const dbName = mongoose.connection.db.databaseName;
        console.log(`📊 Connected to database: ${dbName}`);
        
        // List all databases
        const adminDb = mongoose.connection.db.admin();
        const dbList = await adminDb.listDatabases();
        console.log('\n📋 Available Databases:');
        dbList.databases.forEach(db => {
            console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });
        
        // List all collections in current database
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`\n📋 Collections in ${dbName}:`);
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });
        
        // Try to get residences from different possible collection names
        const possibleNames = ['residences', 'residence', 'properties', 'property', 'houses', 'house'];
        
        console.log('\n🔍 Checking for Residence Data...');
        for (const collectionName of possibleNames) {
            try {
                const collection = mongoose.connection.db.collection(collectionName);
                const count = await collection.countDocuments();
                if (count > 0) {
                    console.log(`✅ Found ${count} records in '${collectionName}' collection`);
                    
                    // Get a sample record
                    const sample = await collection.findOne({});
                    if (sample) {
                        console.log(`   Sample: ${sample.name || sample._id}`);
                    }
                } else {
                    console.log(`❌ '${collectionName}' collection exists but is empty`);
                }
            } catch (error) {
                console.log(`❌ '${collectionName}' collection not found`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking database connection:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// Run the check
if (require.main === module) {
    checkDatabaseConnection().catch(console.error);
}

module.exports = { checkDatabaseConnection };
