const mongoose = require('mongoose');

// Test script to check account mappings endpoint
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend';

async function testAccountMappings() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Test the Account model
        const Account = require('./src/models/Account');
        
        console.log('🔍 Testing Account model...');
        const accounts = await Account.find().limit(5);
        console.log(`📊 Found ${accounts.length} accounts (showing first 5):`);
        accounts.forEach(acc => {
            console.log(`  - ${acc.code}: ${acc.name} (${acc.type})`);
        });

        // Test the TransactionAccountsController
        console.log('\n🔍 Testing TransactionAccountsController...');
        const TransactionAccountsController = require('./src/controllers/finance/transactionAccountsController');
        
        // Mock request and response objects
        const mockReq = {};
        const mockRes = {
            json: (data) => {
                console.log('✅ Controller response:', {
                    success: data.success,
                    count: data.data?.total,
                    message: data.message
                });
            },
            status: (code) => ({
                json: (data) => {
                    console.log(`❌ Controller error (${code}):`, data);
                }
            })
        };

        // Test the getAccounts method
        await TransactionAccountsController.getAccounts(mockReq, mockRes);

        console.log('\n✅ Account mappings test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing account mappings:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

testAccountMappings();
