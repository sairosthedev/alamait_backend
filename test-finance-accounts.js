const mongoose = require('mongoose');

// Test script to check /finance/accounts endpoint
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend';

async function testFinanceAccounts() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Test the Account model directly
        const Account = require('./src/models/Account');
        
        console.log('🔍 Testing Account model...');
        const accounts = await Account.find().limit(5);
        console.log(`📊 Found ${accounts.length} accounts (showing first 5):`);
        accounts.forEach(acc => {
            console.log(`  - ${acc.code}: ${acc.name} (${acc.type})`);
        });

        // Test the account controller
        console.log('\n🔍 Testing AccountController...');
        const accountController = require('./src/controllers/finance/accountController');
        
        // Mock request and response objects
        const mockReq = {
            query: {} // No pagination parameters
        };
        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    if (code === 200) {
                        console.log('✅ Controller response:', {
                            success: true,
                            count: Array.isArray(data) ? data.length : 'not array',
                            isArray: Array.isArray(data),
                            firstAccount: Array.isArray(data) && data.length > 0 ? {
                                code: data[0].code,
                                name: data[0].name,
                                type: data[0].type
                            } : null
                        });
                    } else {
                        console.log(`❌ Controller error (${code}):`, data);
                    }
                }
            })
        };

        // Test the getAllAccounts method
        await accountController.getAllAccounts(mockReq, mockRes);

        console.log('\n✅ Finance accounts test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing finance accounts:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

testFinanceAccounts();
