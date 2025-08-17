const mongoose = require('mongoose');
const Account = require('../src/models/Account');

// Connect to MongoDB (update with your connection string)
const MONGODB_URI = 'mongodb://localhost:27017/alamait_backend';

// Account mappings from the implementation
const CATEGORY_TO_ACCOUNT_CODE = {
  'Maintenance': '5003', // Transportation Expense (for maintenance)
  'Utilities': '5099',   // Other Operating Expenses (for utilities)
  'Taxes': '5099',       // Other Operating Expenses (for taxes)
  'Insurance': '5099',   // Other Operating Expenses (for insurance)
  'Salaries': '5099',    // Other Operating Expenses (for salaries)
  'Supplies': '5099',    // Other Operating Expenses (for supplies)
  'Other': '5099'        // Other Operating Expenses (fallback)
};

const PAYMENT_METHOD_TO_ACCOUNT_CODE = {
  'Cash': '1011',           // Admin Petty Cash
  'Bank Transfer': '1000',  // Bank - Main Account
  'Ecocash': '1011',        // Admin Petty Cash
  'Innbucks': '1011',       // Admin Petty Cash
  'Petty Cash': '1011',     // Admin Petty Cash
  'Online Payment': '1000', // Bank - Main Account
  'MasterCard': '1000',     // Bank - Main Account
  'Visa': '1000',          // Bank - Main Account
  'PayPal': '1000'         // Bank - Main Account
};

async function verifyAccountMappings() {
    try {
        console.log('🔍 Verifying Account Mappings\n');
        
        // Connect to database
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all accounts
        const accounts = await Account.find({}).sort({ code: 1 });
        console.log('📊 Found', accounts.length, 'accounts in database:\n');

        // Display all accounts
        accounts.forEach(account => {
            console.log(`  ${account.code}: "${account.name}" (${account.type})`);
        });

        console.log('\n🔍 Verifying Category to Account Code Mappings:\n');

        // Test category mappings
        for (const [category, accountCode] of Object.entries(CATEGORY_TO_ACCOUNT_CODE)) {
            const account = accounts.find(acc => acc.code === accountCode);
            if (account) {
                console.log(`✅ ${category} → ${accountCode} (${account.name})`);
            } else {
                console.log(`❌ ${category} → ${accountCode} (Account not found!)`);
            }
        }

        console.log('\n🔍 Verifying Payment Method to Account Code Mappings:\n');

        // Test payment method mappings
        for (const [method, accountCode] of Object.entries(PAYMENT_METHOD_TO_ACCOUNT_CODE)) {
            const account = accounts.find(acc => acc.code === accountCode);
            if (account) {
                console.log(`✅ ${method} → ${accountCode} (${account.name})`);
            } else {
                console.log(`❌ ${method} → ${accountCode} (Account not found!)`);
            }
        }

        console.log('\n🧪 Testing Sample Payment Scenarios:\n');

        // Test sample payment scenarios
        const testScenarios = [
            {
                description: 'Office Supplies via Petty Cash',
                category: 'Supplies',
                paymentMethod: 'Petty Cash',
                amount: 150.00
            },
            {
                description: 'Maintenance via Bank Transfer',
                category: 'Maintenance',
                paymentMethod: 'Bank Transfer',
                amount: 300.00
            },
            {
                description: 'Utilities via Ecocash',
                category: 'Utilities',
                paymentMethod: 'Ecocash',
                amount: 75.00
            }
        ];

        for (const scenario of testScenarios) {
            console.log(`📝 ${scenario.description}:`);
            
            const expenseAccountCode = CATEGORY_TO_ACCOUNT_CODE[scenario.category];
            const sourceAccountCode = PAYMENT_METHOD_TO_ACCOUNT_CODE[scenario.paymentMethod];
            
            const expenseAccount = accounts.find(acc => acc.code === expenseAccountCode);
            const sourceAccount = accounts.find(acc => acc.code === sourceAccountCode);
            
            if (expenseAccount && sourceAccount) {
                console.log(`   Debit:  ${expenseAccountCode} (${expenseAccount.name}) - $${scenario.amount.toFixed(2)}`);
                console.log(`   Credit: ${sourceAccountCode} (${sourceAccount.name}) - $${scenario.amount.toFixed(2)}`);
                console.log(`   ✅ Valid transaction`);
            } else {
                console.log(`   ❌ Invalid transaction - missing accounts`);
                if (!expenseAccount) console.log(`      Expense account ${expenseAccountCode} not found`);
                if (!sourceAccount) console.log(`      Source account ${sourceAccountCode} not found`);
            }
            console.log('');
        }

        // Check for missing accounts that might be needed
        console.log('🔍 Checking for Missing Accounts:\n');
        
        const requiredCodes = new Set([
            ...Object.values(CATEGORY_TO_ACCOUNT_CODE),
            ...Object.values(PAYMENT_METHOD_TO_ACCOUNT_CODE)
        ]);

        const existingCodes = new Set(accounts.map(acc => acc.code));
        const missingCodes = [...requiredCodes].filter(code => !existingCodes.has(code));

        if (missingCodes.length > 0) {
            console.log('❌ Missing account codes:');
            missingCodes.forEach(code => {
                console.log(`   - ${code}`);
            });
            console.log('\n💡 You may need to create these accounts in your chart of accounts.');
        } else {
            console.log('✅ All required account codes are present!');
        }

        console.log('\n🎉 Account mapping verification completed!');

    } catch (error) {
        console.error('❌ Error during verification:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run verification
if (require.main === module) {
    verifyAccountMappings();
}

module.exports = { verifyAccountMappings }; 