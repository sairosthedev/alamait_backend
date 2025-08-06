const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
const User = require('./src/models/User');

db.once('open', async () => {
  try {
    console.log('✅ Connected to MongoDB');
    
    // Get a user with finance role
    const financeUser = await User.findOne({
      role: { $in: ['admin', 'finance_admin', 'finance_user', 'ceo'] }
    }).select('email role firstName lastName');
    
    if (!financeUser) {
      console.log('❌ No user found with finance role');
      console.log('Available users:');
      const allUsers = await User.find({}).select('email role firstName lastName');
      allUsers.forEach(user => {
        console.log(`  ${user.email}: ${user.role || 'NO ROLE'}`);
      });
    } else {
      console.log('✅ Found finance user:', {
        email: financeUser.email,
        role: financeUser.role,
        name: `${financeUser.firstName} ${financeUser.lastName}`
      });
    }
    
    // Test audit logs directly
    console.log('\n🧪 Testing audit logs directly from database...');
    const AuditLog = require('./src/models/AuditLog');
    const auditLogs = await AuditLog.find({})
      .populate('user', 'firstName lastName email role')
      .limit(5)
      .sort({ timestamp: -1 });
    
    console.log(`Found ${auditLogs.length} audit logs`);
    auditLogs.forEach((log, index) => {
      console.log(`\n${index + 1}. Log ID: ${log._id}`);
      console.log(`   User: ${log.user ? log.user.email : 'Unknown'}`);
      console.log(`   Action: ${log.action}`);
      console.log(`   Collection: ${log.collection}`);
      console.log(`   Timestamp: ${log.timestamp}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}); 