const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const TransactionEntry = require('../src/models/TransactionEntry');

async function checkStudentTimeline() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('🔍 Checking student timeline for 68c308dacad4b54252cec896...');
    
    // Check user record
    const user = await User.findById('68c308dacad4b54252cec896');
    if (user) {
      console.log('👤 User record:');
      console.log('- Name: ' + user.firstName + ' ' + user.lastName);
      console.log('- Email: ' + user.email);
      console.log('- Status: ' + user.status);
      console.log('- Created: ' + user.createdAt);
      console.log('- Updated: ' + user.updatedAt);
      console.log('- Application Code: ' + user.applicationCode);
    }
    
    // Check application record
    const application = await Application.findOne({
      student: '68c308dacad4b54252cec896'
    });
    if (application) {
      console.log('\n📋 Application record:');
      console.log('- Status: ' + application.status);
      console.log('- Lease Start: ' + application.leaseStart);
      console.log('- Lease End: ' + application.leaseEnd);
      console.log('- Created: ' + application.createdAt);
      console.log('- Updated: ' + application.updatedAt);
    }
    
    // Check ALL transactions (not just September)
    const allTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.student': '68c308dacad4b54252cec896' },
        { 'reference': { $regex: '68c308dacad4b54252cec896' } }
      ]
    }).sort({ createdAt: 1 });
    
    console.log('\n📊 All transactions for student:');
    if (allTransactions.length === 0) {
      console.log('No transactions found');
    } else {
      allTransactions.forEach((t, index) => {
        console.log('\n' + (index + 1) + '. ' + t.transactionId);
        console.log('   Description: ' + t.description);
        console.log('   Date: ' + t.date);
        console.log('   Type: ' + (t.metadata?.transactionType || 'unknown'));
      });
    }
    
    // Check if there are any transactions that might be related
    const relatedTransactions = await TransactionEntry.find({
      $or: [
        { description: { $regex: 'Kudzai Vella', $options: 'i' } },
        { description: { $regex: 'kudzai.vella@example.com', $options: 'i' } }
      ]
    }).sort({ createdAt: 1 });
    
    console.log('\n🔍 Related transactions by name/email:');
    if (relatedTransactions.length === 0) {
      console.log('No related transactions found');
    } else {
      relatedTransactions.forEach((t, index) => {
        console.log('\n' + (index + 1) + '. ' + t.transactionId);
        console.log('   Description: ' + t.description);
        console.log('   Date: ' + t.date);
        console.log('   Type: ' + (t.metadata?.transactionType || 'unknown'));
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkStudentTimeline();


