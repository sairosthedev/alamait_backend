const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
  console.log('✅ Connected to MongoDB');
  await findAuditLogs();
});

/**
 * Script to find where audit logs are stored
 */
async function findAuditLogs() {
  try {
    console.log('🔍 Searching for audit logs in your database...');
    
    // Get all collections
    const collections = await db.db.listCollections().toArray();
    console.log(`📊 Found ${collections.length} collections in database:`);
    
    collections.forEach(collection => {
      console.log(`   - ${collection.name}`);
    });
    
    // Look for collections that might contain audit logs
    const possibleAuditCollections = [
      'audit_logs',
      'auditlogs', 
      'auditLogs',
      'audit_log',
      'auditlog',
      'logs',
      'audit',
      'system_logs',
      'systemlogs'
    ];
    
    console.log('\n🔍 Checking possible audit log collections...');
    
    for (const collectionName of possibleAuditCollections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        console.log(`   ${collectionName}: ${count} documents`);
        
        if (count > 0) {
          console.log(`   ✅ Found ${count} documents in ${collectionName}!`);
          
          // Get a sample document to see the structure
          const sample = await collection.findOne();
          console.log(`   📋 Sample document structure:`);
          console.log(`      Keys: ${Object.keys(sample).join(', ')}`);
          
          if (sample.user || sample.action || sample.collection) {
            console.log(`   🎯 This looks like an audit log collection!`);
          }
        }
      } catch (error) {
        // Collection doesn't exist, skip
      }
    }
    
    // Also check for any collection with "audit" in the name
    console.log('\n🔍 Checking all collections for audit-related data...');
    
    for (const collection of collections) {
      try {
        const coll = db.collection(collection.name);
        const count = await coll.countDocuments();
        
        if (count > 0) {
          // Get a sample document
          const sample = await coll.findOne();
          const keys = Object.keys(sample);
          
          // Check if this looks like an audit log
          const hasAuditFields = keys.some(key => 
            ['user', 'action', 'collection', 'recordId', 'timestamp', 'createdAt'].includes(key)
          );
          
          if (hasAuditFields) {
            console.log(`   🎯 ${collection.name}: ${count} documents (looks like audit logs)`);
            console.log(`      Fields: ${keys.join(', ')}`);
          }
        }
      } catch (error) {
        // Skip if we can't access the collection
      }
    }
    
    // Check if there are any documents with audit-like structure in any collection
    console.log('\n🔍 Searching for documents with audit-like structure...');
    
    for (const collection of collections) {
      try {
        const coll = db.collection(collection.name);
        
        // Look for documents with audit-like fields
        const auditLikeDocs = await coll.find({
          $or: [
            { action: { $exists: true } },
            { collection: { $exists: true } },
            { recordId: { $exists: true } },
            { user: { $exists: true } }
          ]
        }).limit(1).toArray();
        
        if (auditLikeDocs.length > 0) {
          const totalCount = await coll.countDocuments();
          console.log(`   🎯 ${collection.name}: ${totalCount} documents with audit-like structure`);
          console.log(`      Sample fields: ${Object.keys(auditLikeDocs[0]).join(', ')}`);
        }
      } catch (error) {
        // Skip if we can't query the collection
      }
    }
    
  } catch (error) {
    console.error('❌ Error searching for audit logs:', error);
  } finally {
    console.log('\n🏁 Search completed.');
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Search interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 