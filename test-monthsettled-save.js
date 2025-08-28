const mongoose = require('mongoose');

async function testMonthSettledSave() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait');
    console.log('Connected to MongoDB');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Create a test transaction with monthSettled metadata
    console.log('\n=== Creating test transaction with monthSettled ===');
    const testTransaction = new TransactionEntry({
      transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      date: new Date(),
      description: 'Test payment allocation: $100 rent for 2025-05',
      reference: 'TEST-PAYMENT-001',
      entries: [
        {
          accountCode: '1100-test-student',
          accountName: 'Accounts Receivable - Test Student',
          accountType: 'Asset',
          debit: 0,
          credit: 100,
          description: 'Test payment received'
        },
        {
          accountCode: '1000',
          accountName: 'Cash',
          accountType: 'Asset',
          debit: 100,
          credit: 0,
          description: 'Test payment received'
        }
      ],
      totalDebit: 100,
      totalCredit: 100,
      source: 'payment',
      sourceId: new mongoose.Types.ObjectId(), // Use proper ObjectId
      sourceModel: 'Payment',
      residence: new mongoose.Types.ObjectId(), // Use proper ObjectId
      createdBy: 'system',
      status: 'posted',
      metadata: {
        paymentId: 'TEST-PAYMENT-001',
        studentId: 'test-student',
        amount: 100,
        allocationType: 'payment_allocation',
        monthSettled: '2025-05',
        paymentType: 'rent'
      }
    });
    
    await testTransaction.save();
    console.log(`✅ Test transaction created: ${testTransaction._id}`);
    console.log(`   monthSettled: ${testTransaction.metadata?.monthSettled}`);
    
    // Verify it was saved correctly
    console.log('\n=== Verifying saved transaction ===');
    const savedTransaction = await TransactionEntry.findById(testTransaction._id).lean();
    console.log(`Retrieved transaction: ${savedTransaction._id}`);
    console.log(`Description: ${savedTransaction.description}`);
    console.log(`Metadata:`, savedTransaction.metadata);
    console.log(`monthSettled: ${savedTransaction.metadata?.monthSettled}`);
    
    // Clean up - delete the test transaction
    await TransactionEntry.findByIdAndDelete(testTransaction._id);
    console.log('\n✅ Test transaction cleaned up');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testMonthSettledSave();
