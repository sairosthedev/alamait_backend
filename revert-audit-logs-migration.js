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
  await revertAuditLogsMigration();
});

/**
 * Script to revert audit logs migration
 */
async function revertAuditLogsMigration() {
  try {
    console.log('🔄 Starting audit logs migration rollback...');
    
    // Get the audit logs collection
    const auditLogsCollection = db.collection('auditlogs');
    
    // Find all audit logs
    const existingLogs = await auditLogsCollection.find({}).toArray();
    console.log(`📊 Found ${existingLogs.length} audit logs to revert`);
    
    if (existingLogs.length === 0) {
      console.log('ℹ️  No audit logs found. Nothing to revert.');
      process.exit(0);
    }
    
    let revertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const log of existingLogs) {
      try {
        const updateData = {};
        let needsRevert = false;
        
        // Remove the fields we added during migration
        const fieldsToRemove = [
          'ipAddress',
          'userAgent', 
          'endpoint',
          'requestBody',
          'queryParams',
          'statusCode',
          'responseTime',
          'errorMessage',
          'errorStack',
          'sessionId',
          'correlationId'
        ];
        
        // Check if any of these fields exist and have non-null values
        for (const field of fieldsToRemove) {
          if (log.hasOwnProperty(field) && log[field] !== null) {
            updateData[field] = null;
            needsRevert = true;
          }
        }
        
        // Revert details field if it was auto-generated
        if (log.details && log.details.includes('operation on')) {
          updateData.details = '';
          needsRevert = true;
        }
        
        // Update the document if needed
        if (needsRevert) {
          await auditLogsCollection.updateOne(
            { _id: log._id },
            { $set: updateData }
          );
          revertedCount++;
          console.log(`✅ Reverted audit log: ${log._id}`);
        } else {
          skippedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error reverting audit log ${log._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Rollback Summary:');
    console.log(`   Total logs processed: ${existingLogs.length}`);
    console.log(`   Reverted: ${revertedCount}`);
    console.log(`   Skipped (no changes needed): ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some logs had errors during rollback. Check the logs above.');
    } else {
      console.log('\n✅ Rollback completed successfully!');
    }
    
    // Test the rollback by fetching some logs
    console.log('\n🧪 Testing rollback...');
    try {
      const testLogs = await auditLogsCollection.find({}).limit(5).toArray();
      console.log(`✅ Successfully fetched ${testLogs.length} test logs`);
      
      if (testLogs.length > 0) {
        const sampleLog = testLogs[0];
        console.log('📋 Sample log structure after rollback:');
        console.log(`   ID: ${sampleLog._id}`);
        console.log(`   User: ${sampleLog.user}`);
        console.log(`   Action: ${sampleLog.action}`);
        console.log(`   Collection: ${sampleLog.collection}`);
        console.log(`   Timestamp: ${sampleLog.timestamp}`);
        console.log(`   Details: ${sampleLog.details || 'N/A'}`);
        console.log(`   IP Address: ${sampleLog.ipAddress || 'N/A'}`);
        console.log(`   Endpoint: ${sampleLog.endpoint || 'N/A'}`);
      }
    } catch (testError) {
      console.error('❌ Error testing rollback:', testError.message);
    }
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
  } finally {
    console.log('\n🏁 Rollback process completed.');
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Rollback interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 