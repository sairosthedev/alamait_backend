const mongoose = require('mongoose');
const Account = require('./src/models/Account');
const AccountCodeService = require('./src/services/accountCodeService');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend';

async function testAccountCodeGeneration() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB successfully!\n');

    // Clear existing accounts for testing
    console.log('🧹 Clearing existing accounts for testing...');
    await Account.deleteMany({});
    console.log('✅ Cleared existing accounts\n');

    // Test 1: Generate codes for different account types
    console.log('🧪 Test 1: Generating codes for different account types...\n');

    const testAccounts = [
      { name: "Cash", type: "Asset", category: "Current Assets" },
      { name: "Bank Account", type: "Asset", category: "Current Assets" },
      { name: "Office Equipment", type: "Asset", category: "Fixed Assets" },
      { name: "Accounts Payable", type: "Liability", category: "Current Liabilities" },
      { name: "Owner's Capital", type: "Equity", category: "Owner Equity" },
      { name: "Rental Income", type: "Income", category: "Operating Revenue" },
      { name: "Office Rent Expense", type: "Expense", category: "Operating Expenses" }
    ];

    for (const accountData of testAccounts) {
      console.log(`📝 Creating account: ${accountData.name}`);
      
      // Generate code
      const code = await AccountCodeService.generateAccountCode(accountData.type, accountData.category);
      console.log(`   Generated code: ${code}`);
      
      // Validate account data
      const validation = await AccountCodeService.validateAccountData(accountData);
      if (!validation.isValid) {
        console.log(`   ❌ Validation failed: ${validation.errors.join(', ')}`);
        continue;
      }
      
      // Create account
      const account = new Account({
        ...accountData,
        code,
        description: `${accountData.name} account`
      });
      
      await account.save();
      console.log(`   ✅ Account created successfully with code: ${code}\n`);
    }

    // Test 2: Get code suggestions
    console.log('🧪 Test 2: Getting code suggestions...\n');
    
    const suggestions = await AccountCodeService.getCodeSuggestions('Asset', 'Current Assets');
    console.log('Code suggestions for Asset > Current Assets:');
    suggestions.forEach((suggestion, index) => {
      console.log(`   ${index + 1}. ${suggestion.code} - ${suggestion.description}`);
    });
    console.log();

    // Test 3: Get account hierarchy
    console.log('🧪 Test 3: Getting account hierarchy...\n');
    
    const hierarchy = await Account.getAccountHierarchy();
    console.log('Account hierarchy:');
    Object.keys(hierarchy).forEach(type => {
      console.log(`\n${type}:`);
      hierarchy[type].forEach(account => {
        console.log(`   ${account.code} - ${account.name} (${account.category})`);
      });
    });
    console.log();

    // Test 4: Validate code format
    console.log('🧪 Test 4: Validating code formats...\n');
    
    const testCodes = ['1001', '2001', '3001', '4001', '5001', '9999', 'abc123'];
    testCodes.forEach(code => {
      const isValid = AccountCodeService.validateCodeFormat(code);
      console.log(`   Code ${code}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    });
    console.log();

    // Test 5: Get account type information
    console.log('🧪 Test 5: Getting account type information...\n');
    
    const types = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
    types.forEach(type => {
      const typeInfo = AccountCodeService.getAccountTypeInfo(type);
      const categories = AccountCodeService.getSuggestedCategories(type);
      console.log(`${type}:`);
      console.log(`   Prefix: ${typeInfo.prefix}`);
      console.log(`   Description: ${typeInfo.description}`);
      console.log(`   Normal Balance: ${typeInfo.normalBalance}`);
      console.log(`   Categories: ${categories.join(', ')}`);
      console.log();
    });

    // Test 6: Bulk code generation
    console.log('🧪 Test 6: Bulk code generation...\n');
    
    const bulkAccounts = [
      { name: "Inventory", type: "Asset", category: "Current Assets" },
      { name: "Prepaid Insurance", type: "Asset", category: "Current Assets" },
      { name: "Long-term Loan", type: "Liability", category: "Long-term Liabilities" },
      { name: "Retained Earnings", type: "Equity", category: "Retained Earnings" },
      { name: "Service Income", type: "Income", category: "Operating Revenue" }
    ];

    const bulkResults = await AccountCodeService.bulkGenerateCodes(bulkAccounts);
    console.log('Bulk code generation results:');
    bulkResults.forEach(result => {
      if (result.code) {
        console.log(`   ✅ ${result.name}: ${result.code}`);
      } else {
        console.log(`   ❌ ${result.name}: ${result.errors.join(', ')}`);
      }
    });
    console.log();

    // Test 7: Get account statistics
    console.log('🧪 Test 7: Getting account statistics...\n');
    
    const stats = await Account.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: ['$isActive', 1, 0] }
          }
        }
      }
    ]);

    console.log('Account statistics:');
    stats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} total, ${stat.activeCount} active`);
    });

    const totalAccounts = await Account.countDocuments();
    const activeAccounts = await Account.countDocuments({ isActive: true });
    console.log(`   Total accounts: ${totalAccounts}`);
    console.log(`   Active accounts: ${activeAccounts}`);
    console.log(`   Inactive accounts: ${totalAccounts - activeAccounts}`);

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testAccountCodeGeneration();
}

module.exports = { testAccountCodeGeneration }; 