/**
 * Script to fetch audit logs with user email information
 * This demonstrates how to get audit logs with populated user data
 */

const mongoose = require('mongoose');
const AuditLog = require('./src/models/AuditLog');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Fetch audit logs with user email information
const fetchAuditLogsWithEmails = async (options = {}) => {
  try {
    const {
      collection = null,
      action = null,
      userId = null,
      startDate = null,
      endDate = null,
      limit = 50
    } = options;

    // Build filter
    const filter = {};
    if (collection) filter.collection = collection;
    if (action) filter.action = action;
    if (userId) filter.user = userId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    console.log('🔍 Fetching audit logs with filter:', filter);

    // Fetch audit logs with populated user information
    const logs = await AuditLog.find(filter)
      .populate('user', 'firstName lastName email role')
      .sort({ timestamp: -1 })
      .limit(limit);

    console.log(`\n📊 Found ${logs.length} audit log entries:`);
    console.log('=' .repeat(80));

    logs.forEach((log, index) => {
      console.log(`\n${index + 1}. ${log.action.toUpperCase()} on ${log.collection}`);
      console.log(`   📅 Date: ${log.timestamp.toISOString()}`);
      console.log(`   👤 User: ${log.user ? `${log.user.firstName} ${log.user.lastName} (${log.user.email})` : 'Unknown User'}`);
      console.log(`   🏷️  Role: ${log.user ? log.user.role : 'Unknown'}`);
      console.log(`   🆔 Record ID: ${log.recordId}`);
      
      if (log.details) {
        console.log(`   📝 Details: ${log.details}`);
      }
      
      if (log.before && log.after) {
        console.log(`   🔄 Changed: ${log.collection} record modified`);
      } else if (log.before && !log.after) {
        console.log(`   🗑️  Deleted: ${log.collection} record removed`);
      } else if (!log.before && log.after) {
        console.log(`   ➕ Created: ${log.collection} record added`);
      }
    });

    return logs;
  } catch (error) {
    console.error('❌ Error fetching audit logs:', error);
    throw error;
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();

    // Example 1: Fetch all recent audit logs
    console.log('\n🚀 Example 1: Recent audit logs');
    await fetchAuditLogsWithEmails({ limit: 10 });

    // Example 2: Fetch expense-related audit logs
    console.log('\n\n🚀 Example 2: Expense-related audit logs');
    await fetchAuditLogsWithEmails({ 
      collection: 'Expense',
      limit: 5 
    });

    // Example 3: Fetch delete actions
    console.log('\n\n🚀 Example 3: Delete actions');
    await fetchAuditLogsWithEmails({ 
      action: 'delete',
      limit: 5 
    });

    // Example 4: Fetch logs for a specific user (if you have a user ID)
    // console.log('\n\n🚀 Example 4: Logs for specific user');
    // await fetchAuditLogsWithEmails({ 
    //   userId: '68b7909295210ad2fa2c5dcf', // Replace with actual user ID
    //   limit: 5 
    // });

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { fetchAuditLogsWithEmails };

