process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const Account = require('./src/models/Account');

async function testChartOfAccounts() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n📊 TESTING CHART OF ACCOUNTS...\n');

        // Test getting all accounts
        console.log('📋 GETTING ALL ACCOUNTS:');
        console.log('=' .repeat(50));
        const accounts = await Account.find().sort({ code: 1 });
        
        console.log(`Found ${accounts.length} accounts`);
        console.log('First 5 accounts:');
        accounts.slice(0, 5).forEach(account => {
            console.log(`  ${account.code} - ${account.name} (${account.type})`);
        });

        // Test getting accounts by type
        console.log('\n💰 INCOME ACCOUNTS:');
        console.log('=' .repeat(50));
        const incomeAccounts = await Account.find({ type: 'Income' }).sort({ code: 1 });
        console.log(`Found ${incomeAccounts.length} income accounts`);
        incomeAccounts.forEach(account => {
            console.log(`  ${account.code} - ${account.name}`);
        });

        console.log('\n💸 EXPENSE ACCOUNTS:');
        console.log('=' .repeat(50));
        const expenseAccounts = await Account.find({ type: 'Expense' }).sort({ code: 1 });
        console.log(`Found ${expenseAccounts.length} expense accounts`);
        expenseAccounts.slice(0, 10).forEach(account => {
            console.log(`  ${account.code} - ${account.name}`);
        });

        console.log('\n🏦 ASSET ACCOUNTS:');
        console.log('=' .repeat(50));
        const assetAccounts = await Account.find({ type: 'Asset' }).sort({ code: 1 });
        console.log(`Found ${assetAccounts.length} asset accounts`);
        assetAccounts.forEach(account => {
            console.log(`  ${account.code} - ${account.name}`);
        });

        console.log('\n📝 LIABILITY ACCOUNTS:');
        console.log('=' .repeat(50));
        const liabilityAccounts = await Account.find({ type: 'Liability' }).sort({ code: 1 });
        console.log(`Found ${liabilityAccounts.length} liability accounts`);
        liabilityAccounts.forEach(account => {
            console.log(`  ${account.code} - ${account.name}`);
        });

        // Test the response format that frontend expects
        console.log('\n🧪 TESTING FRONTEND RESPONSE FORMAT:');
        console.log('=' .repeat(50));
        
        // Simulate what the controller should return
        const responseData = accounts.map(account => ({
            _id: account._id,
            code: account.code,
            name: account.name,
            type: account.type,
            category: account.category,
            description: account.description,
            isActive: account.isActive
        }));

        console.log(`Response array length: ${responseData.length}`);
        console.log('Response is array:', Array.isArray(responseData));
        console.log('First account in response:', responseData[0]);

        console.log('\n✅ CHART OF ACCOUNTS TEST COMPLETED');
        console.log('The accounts endpoint should now return an array!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

testChartOfAccounts(); 