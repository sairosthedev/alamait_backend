require('dotenv').config();
const mongoose = require('mongoose');
const Account = require('./src/models/Account');

async function checkAvailableAccounts() {
    try {
        console.log('🔗 Connecting to database...');
        
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }

        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ Connected to database');

        // Get all accounts
        const accounts = await Account.find({});
        
        if (accounts.length === 0) {
            console.log('❌ No accounts found in database');
            return;
        }

        console.log(`\n📊 Found ${accounts.length} accounts in database:`);
        console.log('=' .repeat(80));
        
        accounts.forEach((account, index) => {
            console.log(`${index + 1}. Account Code: ${account.accountCode}`);
            console.log(`   Account Name: ${account.accountName}`);
            console.log(`   Account Type: ${account.accountType}`);
            console.log(`   Description: ${account.description || 'N/A'}`);
            console.log('---');
        });

        // Look for specific account types we need
        console.log('\n🔍 Looking for specific accounts we need:');
        
        const expenseAccounts = accounts.filter(acc => 
            acc.accountType === 'Expense' || 
            acc.accountName.toLowerCase().includes('expense') ||
            acc.accountName.toLowerCase().includes('maintenance')
        );
        
        const liabilityAccounts = accounts.filter(acc => 
            acc.accountType === 'Liability' || 
            acc.accountName.toLowerCase().includes('payable')
        );

        console.log('\n💰 Expense Accounts:');
        expenseAccounts.forEach(acc => {
            console.log(`   - ${acc.accountName} (${acc.accountCode}) - ${acc.accountType}`);
        });

        console.log('\n💳 Liability Accounts:');
        liabilityAccounts.forEach(acc => {
            console.log(`   - ${acc.accountName} (${acc.accountCode}) - ${acc.accountType}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

// Run the script
if (require.main === module) {
    checkAvailableAccounts()
        .then(() => {
            console.log('\n🎉 Account check completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Account check failed:', error);
            process.exit(1);
        });
}

module.exports = { checkAvailableAccounts }; 