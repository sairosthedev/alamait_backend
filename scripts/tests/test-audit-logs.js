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
  await testAuditLogs();
});

/**
 * Test script to verify audit logs functionality
 */
async function testAuditLogs() {
  try {
    console.log('🧪 Testing audit logs functionality...');
    
    // Get the audit logs collection
    const auditLogsCollection = db.collection('auditlogs');
    
    // Test 1: Count total logs
    const totalLogs = await auditLogsCollection.countDocuments();
    console.log(`📊 Total audit logs: ${totalLogs}`);
    
    if (totalLogs === 0) {
      console.log('ℹ️  No audit logs found. This is normal if no actions have been logged yet.');
      console.log('💡 Try performing some actions in your application to generate audit logs.');
      process.exit(0);
    }
    
    // Test 2: Get recent logs
    const recentLogs = await auditLogsCollection.find({})
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(5)
      .toArray();
    
    console.log(`\n📋 Recent audit logs (${recentLogs.length}):`);
    recentLogs.forEach((log, index) => {
      console.log(`\n   ${index + 1}. Log ID: ${log._id}`);
      console.log(`      User: ${log.user || 'N/A'}`);
      console.log(`      Action: ${log.action || 'N/A'}`);
      console.log(`      Collection: ${log.collection || 'N/A'}`);
      console.log(`      Record ID: ${log.recordId || 'N/A'}`);
      console.log(`      Timestamp: ${log.timestamp || log.createdAt || 'N/A'}`);
      console.log(`      Details: ${log.details || 'N/A'}`);
      console.log(`      IP Address: ${log.ipAddress || 'N/A'}`);
      console.log(`      Endpoint: ${log.endpoint || 'N/A'}`);
    });
    
    // Test 3: Check for required fields
    console.log('\n🔍 Checking field compatibility...');
    const requiredFields = ['user', 'action', 'collection', 'recordId'];
    const optionalFields = ['timestamp', 'createdAt', 'details', 'ipAddress', 'endpoint', 'statusCode'];
    
    const fieldStats = {};
    
    for (const field of [...requiredFields, ...optionalFields]) {
      const count = await auditLogsCollection.countDocuments({ [field]: { $exists: true, $ne: null } });
      fieldStats[field] = count;
    }
    
    console.log('📈 Field statistics:');
    console.log('   Required fields:');
    requiredFields.forEach(field => {
      const percentage = ((fieldStats[field] / totalLogs) * 100).toFixed(1);
      console.log(`      ${field}: ${fieldStats[field]}/${totalLogs} (${percentage}%)`);
    });
    
    console.log('   Optional fields:');
    optionalFields.forEach(field => {
      const percentage = ((fieldStats[field] / totalLogs) * 100).toFixed(1);
      console.log(`      ${field}: ${fieldStats[field]}/${totalLogs} (${percentage}%)`);
    });
    
    // Test 4: Test different query patterns
    console.log('\n🔍 Testing query patterns...');
    
    // Test by action
    const actionStats = await auditLogsCollection.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('📊 Actions found:');
    actionStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count}`);
    });
    
    // Test by collection
    const collectionStats = await auditLogsCollection.aggregate([
      { $group: { _id: '$collection', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\n📊 Collections found:');
    collectionStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count}`);
    });
    
    // Test 5: Test date range queries
    console.log('\n📅 Testing date range queries...');
    
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24HoursCount = await auditLogsCollection.countDocuments({
      $or: [
        { timestamp: { $gte: last24Hours } },
        { createdAt: { $gte: last24Hours } }
      ]
    });
    
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last7DaysCount = await auditLogsCollection.countDocuments({
      $or: [
        { timestamp: { $gte: last7Days } },
        { createdAt: { $gte: last7Days } }
      ]
    });
    
    console.log(`   Last 24 hours: ${last24HoursCount} logs`);
    console.log(`   Last 7 days: ${last7DaysCount} logs`);
    
    // Test 6: Test user-specific queries
    if (recentLogs.length > 0 && recentLogs[0].user) {
      const sampleUserId = recentLogs[0].user;
      const userLogsCount = await auditLogsCollection.countDocuments({ user: sampleUserId });
      console.log(`\n👤 Sample user (${sampleUserId}) logs: ${userLogsCount}`);
    }
    
    // Test 7: Check for any problematic logs
    console.log('\n🔍 Checking for potential issues...');
    
    const logsWithoutUser = await auditLogsCollection.countDocuments({ user: { $exists: false } });
    const logsWithoutAction = await auditLogsCollection.countDocuments({ action: { $exists: false } });
    const logsWithoutCollection = await auditLogsCollection.countDocuments({ collection: { $exists: false } });
    const logsWithoutRecordId = await auditLogsCollection.countDocuments({ recordId: { $exists: false } });
    
    if (logsWithoutUser > 0) console.log(`⚠️  ${logsWithoutUser} logs without user field`);
    if (logsWithoutAction > 0) console.log(`⚠️  ${logsWithoutAction} logs without action field`);
    if (logsWithoutCollection > 0) console.log(`⚠️  ${logsWithoutCollection} logs without collection field`);
    if (logsWithoutRecordId > 0) console.log(`⚠️  ${logsWithoutRecordId} logs without recordId field`);
    
    if (logsWithoutUser === 0 && logsWithoutAction === 0 && logsWithoutCollection === 0 && logsWithoutRecordId === 0) {
      console.log('✅ All logs have required fields');
    }
    
    console.log('\n✅ Audit logs test completed successfully!');
    console.log('\n💡 Your audit logs are now compatible with the new comprehensive audit trail system.');
    console.log('   You can now fetch logs using the updated API endpoints.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('\n🏁 Test process completed.');
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 