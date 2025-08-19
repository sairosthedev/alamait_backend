const mongoose = require('mongoose');
require('dotenv').config();

async function testNextCodeEndpoint() {
  try {
    console.log('\n🧪 TESTING NEXT-CODE ENDPOINT');
    console.log('================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const Account = require('../src/models/Account');
    
    // Test 1: Check if Account model has getNextCode method
    console.log('🔍 TEST 1: Checking Account model methods');
    console.log('─'.repeat(40));
    
    if (typeof Account.getNextCode === 'function') {
      console.log('✅ Account.getNextCode method exists');
    } else {
      console.log('❌ Account.getNextCode method does not exist');
      console.log('Available static methods:', Object.getOwnPropertyNames(Account).filter(name => typeof Account[name] === 'function'));
      return;
    }
    
    // Test 2: Test getNextCode with Asset type
    console.log('\n🔍 TEST 2: Testing getNextCode with Asset type');
    console.log('─'.repeat(45));
    
    try {
      const code = await Account.getNextCode('Asset');
      console.log(`✅ Generated code for Asset: ${code}`);
    } catch (error) {
      console.log(`❌ Error generating code for Asset: ${error.message}`);
      console.log('Stack trace:', error.stack);
    }
    
    // Test 3: Test getNextCode with Asset + Current Assets category
    console.log('\n🔍 TEST 3: Testing getNextCode with Asset + Current Assets category');
    console.log('─'.repeat(55));
    
    try {
      const code = await Account.getNextCode('Asset', 'Current Assets');
      console.log(`✅ Generated code for Asset + Current Assets: ${code}`);
    } catch (error) {
      console.log(`❌ Error generating code for Asset + Current Assets: ${error.message}`);
      console.log('Stack trace:', error.stack);
    }
    
    // Test 4: Check existing accounts to understand the pattern
    console.log('\n🔍 TEST 4: Checking existing accounts');
    console.log('─'.repeat(35));
    
    const existingAccounts = await Account.find().sort({ code: 1 }).limit(10);
    console.log(`Found ${existingAccounts.length} existing accounts`);
    
    if (existingAccounts.length > 0) {
      console.log('Sample accounts:');
      existingAccounts.forEach(acc => {
        console.log(`  ${acc.code} - ${acc.name} (${acc.type})`);
      });
    }
    
    // Test 5: Check if there are any validation errors
    console.log('\n🔍 TEST 5: Checking Account schema validation');
    console.log('─'.repeat(40));
    
    const AccountSchema = Account.schema;
    const requiredFields = [];
    
    // Check required fields
    Object.keys(AccountSchema.paths).forEach(path => {
      const pathObj = AccountSchema.paths[path];
      if (pathObj.isRequired) {
        requiredFields.push(path);
      }
    });
    
    console.log('Required fields:', requiredFields);
    
    // Test 6: Try to create a minimal account to see validation
    console.log('\n🔍 TEST 6: Testing account creation validation');
    console.log('─'.repeat(45));
    
    try {
      const testAccount = new Account({
        name: 'Test Account',
        code: '9999',
        type: 'Asset',
        category: 'Test Category'
      });
      
      const validationResult = testAccount.validateSync();
      if (validationResult) {
        console.log('❌ Validation errors:', validationResult.errors);
      } else {
        console.log('✅ Validation passed');
      }
    } catch (error) {
      console.log(`❌ Error testing validation: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing next-code endpoint:', error);
    console.log('Stack trace:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

testNextCodeEndpoint();
