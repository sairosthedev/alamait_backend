const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import the TransactionEntry model
const TransactionEntry = require('./src/models/TransactionEntry');

async function testTransactionEntryEnums() {
  try {
    console.log('🔍 Testing TransactionEntry enum values...');
    
    // Get the schema
    const schema = TransactionEntry.schema;
    
    // Check source enum
    const sourceField = schema.path('source');
    console.log('📋 Source enum values:', sourceField.enumValues);
    
    // Check sourceModel enum
    const sourceModelField = schema.path('sourceModel');
    console.log('📋 SourceModel enum values:', sourceModelField.enumValues);
    
    // Test creating a transaction entry with expense_payment
    console.log('\n🧪 Testing expense_payment creation...');
    
    const testEntry = new TransactionEntry({
      transactionId: `TEST${Date.now()}`,
      date: new Date(),
      description: 'Test expense payment',
      reference: 'TEST123',
      entries: [
        {
          accountCode: '1000',
          accountName: 'Test Account',
          accountType: 'Asset',
          debit: 100,
          credit: 0,
          description: 'Test debit'
        },
        {
          accountCode: '2000',
          accountName: 'Test Account 2',
          accountType: 'Liability',
          debit: 0,
          credit: 100,
          description: 'Test credit'
        }
      ],
      totalDebit: 100,
      totalCredit: 100,
      source: 'expense_payment',
      sourceId: new mongoose.Types.ObjectId(),
      sourceModel: 'Expense',
      createdBy: 'test@example.com'
    });
    
    console.log('✅ Test entry created successfully');
    console.log('📝 Source:', testEntry.source);
    console.log('📝 SourceModel:', testEntry.sourceModel);
    
    // Validate the entry
    await testEntry.validate();
    console.log('✅ Validation passed');
    
    // Clean up
    await testEntry.deleteOne();
    console.log('✅ Test entry cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('📋 Error details:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testTransactionEntryEnums(); 