const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');

async function verifyCleanup() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('🔍 Verifying cleanup...');
    
    // Check if any transactions remain for this student
    const remainingTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentId': '68c308dacad4b54252cec896' },
        { 'entries.metadata.studentId': '68c308dacad4b54252cec896' }
      ]
    });
    
    console.log('📊 Remaining transactions for student: ' + remainingTransactions.length);
    
    if (remainingTransactions.length === 0) {
      console.log('✅ All transactions cleaned up successfully');
    } else {
      remainingTransactions.forEach(t => {
        console.log('- ' + t.transactionId + ': ' + t.description);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

verifyCleanup();


