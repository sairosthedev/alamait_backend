const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');
const Expense = require('./src/models/finance/Expense');

async function testExpensePayment() {
  try {
    console.log('🔍 Testing expense payment functionality...');
    
    // Find an existing expense
    const expense = await Expense.findOne({ paymentStatus: 'Pending' });
    if (!expense) {
      console.log('❌ No pending expenses found for testing');
      return;
    }
    
    console.log('📋 Found expense:', expense.expenseId);
    console.log('💰 Amount:', expense.amount);
    console.log('📊 Payment Status:', expense.paymentStatus);
    
    // Test creating a transaction entry similar to what the controller does
    console.log('\n🧪 Testing transaction entry creation...');
    
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const transactionEntry = new TransactionEntry({
      transactionId,
      date: new Date(),
      description: `Payment for Expense ${expense.expenseId} - ${expense.description}`,
      reference: 'TEST123',
      entries: [
        {
          accountCode: '2000',
          accountName: 'Accounts Payable',
          accountType: 'Liability',
          debit: 0,
          credit: 150,
          description: `Payment received for expense ${expense.expenseId}`
        },
        {
          accountCode: '1011',
          accountName: 'Admin Petty Cash',
          accountType: 'Asset',
          debit: 150,
          credit: 0,
          description: `Payment made for expense ${expense.expenseId}`
        }
      ],
      totalDebit: 150,
      totalCredit: 150,
      source: 'expense_payment',
      sourceId: expense._id,
      sourceModel: 'Expense',
      createdBy: 'test@example.com',
      createdAt: new Date(),
      metadata: {
        expenseId: expense.expenseId,
        expenseDescription: expense.description,
        paymentMethod: 'Cash',
        reference: 'TEST123'
      }
    });
    
    console.log('📝 Transaction entry created with:');
    console.log('   Source:', transactionEntry.source);
    console.log('   SourceModel:', transactionEntry.sourceModel);
    console.log('   SourceId:', transactionEntry.sourceId);
    
    // Validate the entry
    await transactionEntry.validate();
    console.log('✅ Validation passed');
    
    // Try to save
    await transactionEntry.save();
    console.log('✅ Transaction entry saved successfully');
    
    // Clean up
    await transactionEntry.deleteOne();
    console.log('✅ Test entry cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('📋 Error details:', error);
    
    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      console.log('\n🔍 Validation Error Details:');
      for (const field in error.errors) {
        console.log(`   ${field}: ${error.errors[field].message}`);
        console.log(`   Value: ${error.errors[field].value}`);
        console.log(`   Path: ${error.errors[field].path}`);
      }
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testExpensePayment(); 