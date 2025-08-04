const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const User = require('./src/models/User');
const jwt = require('jsonwebtoken');

async function testTransactionsWithAuth() {
  try {
    console.log('🔍 Testing /transactions/all endpoint with authentication...');
    
    // Find a finance user
    const user = await User.findOne({ role: { $in: ['finance', 'finance_admin', 'finance_user', 'admin'] } });
    
    if (!user) {
      console.log('❌ No finance user found for testing');
      return;
    }
    
    console.log(`👤 Found user: ${user.email} (${user.role})`);
    
    // Generate a token
    const token = jwt.sign(
      { user: { id: user._id, email: user.email, role: user.role } },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('🔑 Generated token');
    
    // Test the endpoint
    const response = await axios.get('http://localhost:5000/api/transactions/all', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success! Response status:', response.status);
    console.log('📊 Response data length:', response.data.length);
    
    if (response.data.length > 0) {
      console.log('\n📋 Transaction Summary:');
      console.log('   Total transactions:', response.data.length);
      
      // Count transactions with entries
      const transactionsWithEntries = response.data.filter(tx => tx.entries && tx.entries.length > 0);
      const transactionsWithoutEntries = response.data.filter(tx => !tx.entries || tx.entries.length === 0);
      
      console.log('   Transactions with entries:', transactionsWithEntries.length);
      console.log('   Transactions without entries:', transactionsWithoutEntries.length);
      
      if (transactionsWithEntries.length > 0) {
        console.log('\n📋 First transaction with entries:');
        console.log('   ID:', transactionsWithEntries[0]._id);
        console.log('   Date:', transactionsWithEntries[0].date);
        console.log('   Description:', transactionsWithEntries[0].description);
        console.log('   Entries count:', transactionsWithEntries[0].entries?.length || 0);
        
        if (transactionsWithEntries[0].entries && transactionsWithEntries[0].entries.length > 0) {
          console.log('   All entries:');
          transactionsWithEntries[0].entries.forEach((entry, index) => {
            console.log(`     Entry ${index + 1}:`, {
              id: entry._id,
              account: entry.account,
              debit: entry.debit,
              credit: entry.credit,
              type: entry.type
            });
          });
        }
      }
      
      if (transactionsWithoutEntries.length > 0) {
        console.log('\n📋 Sample transaction without entries:');
        console.log('   ID:', transactionsWithoutEntries[0]._id);
        console.log('   Date:', transactionsWithoutEntries[0].date);
        console.log('   Description:', transactionsWithoutEntries[0].description);
        console.log('   Source:', transactionsWithoutEntries[0].source);
        console.log('   SourceModel:', transactionsWithoutEntries[0].sourceModel);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.statusText);
    console.error('Error message:', error.response?.data);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testTransactionsWithAuth(); 