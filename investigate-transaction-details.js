require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('./src/models/Transaction');
const Account = require('./src/models/Account');

async function investigateTransactionDetails() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Investigating Complete Transaction Details...');
        console.log('=============================================');

        // Get all transactions
        const transactions = await Transaction.find({});
        const accounts = await Account.find({});

        console.log(`📊 Total Transactions: ${transactions.length}`);
        console.log(`📊 Total Accounts: ${accounts.length}`);

        // Find the specific internet service transaction
        const internetTransaction = transactions.find(t => 
            t.description && t.description.toLowerCase().includes('internet service')
        );

        if (internetTransaction) {
            console.log('\n🔍 Internet Service Transaction Details:');
            console.log('========================================');
            
            // Get the raw document
            const rawDoc = internetTransaction.toObject();
            
            console.log(`Transaction ID: ${internetTransaction.transactionId}`);
            console.log(`Description: ${internetTransaction.description}`);
            console.log(`Amount: $${internetTransaction.amount}`);
            console.log(`Type: ${internetTransaction.transactionType || internetTransaction.type}`);
            console.log(`Date: ${internetTransaction.date}`);
            console.log(`Reference: ${internetTransaction.reference}`);
            
            // Show all available fields
            console.log('\n📋 All Available Fields:');
            Object.keys(rawDoc).forEach(key => {
                if (key !== '$__' && key !== '$isNew' && key !== '_doc') {
                    console.log(`   ${key}: ${rawDoc[key]}`);
                }
            });

            // Check for nested objects
            console.log('\n🔍 Checking for Nested Objects:');
            Object.keys(rawDoc).forEach(key => {
                const value = rawDoc[key];
                if (value && typeof value === 'object' && !Array.isArray(value) && key !== '$__' && key !== '$isNew' && key !== '_doc') {
                    console.log(`\n   ${key}:`);
                    Object.keys(value).forEach(nestedKey => {
                        console.log(`      ${nestedKey}: ${value[nestedKey]}`);
                    });
                }
            });

            // Check for arrays
            console.log('\n🔍 Checking for Arrays:');
            Object.keys(rawDoc).forEach(key => {
                const value = rawDoc[key];
                if (Array.isArray(value) && key !== '$__' && key !== '$isNew' && key !== '_doc') {
                    console.log(`\n   ${key} (Array):`);
                    value.forEach((item, index) => {
                        if (typeof item === 'object') {
                            console.log(`      [${index}]:`);
                            Object.keys(item).forEach(itemKey => {
                                console.log(`         ${itemKey}: ${item[itemKey]}`);
                            });
                        } else {
                            console.log(`      [${index}]: ${item}`);
                        }
                    });
                }
            });
        }

        // Check for any transactions with account references
        console.log('\n🔍 Looking for Transactions with Account References...');
        console.log('=====================================================');
        
        const transactionsWithAccounts = transactions.filter(t => {
            const rawDoc = t.toObject();
            return Object.keys(rawDoc).some(key => 
                key.toLowerCase().includes('account') && 
                rawDoc[key] && 
                rawDoc[key] !== 'N/A' && 
                rawDoc[key] !== undefined
            );
        });

        console.log(`\n📊 Found ${transactionsWithAccounts.length} transactions with account references:`);
        transactionsWithAccounts.forEach((transaction, index) => {
            const rawDoc = transaction.toObject();
            console.log(`\n   ${index + 1}. Transaction ID: ${transaction.transactionId}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Amount: $${transaction.amount}`);
            
            // Show account-related fields
            Object.keys(rawDoc).forEach(key => {
                if (key.toLowerCase().includes('account') && rawDoc[key]) {
                    console.log(`      ${key}: ${rawDoc[key]}`);
                }
            });
        });

        // Check for any $500 amounts in the entire database
        console.log('\n💰 Looking for $500 Amounts Anywhere...');
        console.log('======================================');
        
        let found500 = false;
        transactions.forEach(transaction => {
            const rawDoc = transaction.toObject();
            
            // Check all fields for $500
            Object.keys(rawDoc).forEach(key => {
                const value = rawDoc[key];
                if (value === 500 || value === -500 || value === '500' || value === '-500') {
                    if (!found500) {
                        console.log(`\n💵 Found $500 in transaction: ${transaction.transactionId}`);
                        found500 = true;
                    }
                    console.log(`   Field: ${key}, Value: ${value}`);
                }
                
                // Check nested objects
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    Object.keys(value).forEach(nestedKey => {
                        const nestedValue = value[nestedKey];
                        if (nestedValue === 500 || nestedValue === -500 || nestedValue === '500' || nestedValue === '-500') {
                            if (!found500) {
                                console.log(`\n💵 Found $500 in nested field: ${key}.${nestedKey}`);
                                found500 = true;
                            }
                            console.log(`   Nested Field: ${key}.${nestedKey}, Value: ${nestedValue}`);
                        }
                    });
                }
            });
        });

        if (!found500) {
            console.log('❌ No $500 amounts found in any transaction fields');
        }

        // Check for transportation account references
        console.log('\n🚗 Looking for Transportation Account References...');
        console.log('==================================================');
        
        const transportationAccount = accounts.find(a => 
            a.name && a.name.toLowerCase().includes('transportation')
        );

        if (transportationAccount) {
            console.log(`\n🚗 Transportation Account Found:`);
            console.log(`   ID: ${transportationAccount._id}`);
            console.log(`   Name: ${transportationAccount.name}`);
            console.log(`   Type: ${transportationAccount.type}`);
            console.log(`   Balance: $${transportationAccount.balance || 0}`);
        }

        // Check if any transactions reference this account
        const transactionsWithTransportation = transactions.filter(t => {
            const rawDoc = t.toObject();
            return Object.keys(rawDoc).some(key => {
                const value = rawDoc[key];
                return value && value.toString() === transportationAccount?._id.toString();
            });
        });

        console.log(`\n📊 Found ${transactionsWithTransportation.length} transactions referencing transportation account:`);
        transactionsWithTransportation.forEach((transaction, index) => {
            const rawDoc = transaction.toObject();
            console.log(`\n   ${index + 1}. Transaction ID: ${transaction.transactionId}`);
            console.log(`      Description: ${transaction.description}`);
            console.log(`      Amount: $${transaction.amount}`);
            
            // Show which field references the transportation account
            Object.keys(rawDoc).forEach(key => {
                const value = rawDoc[key];
                if (value && value.toString() === transportationAccount._id.toString()) {
                    console.log(`      References Transportation Account in field: ${key}`);
                }
            });
        });

        console.log('\n🎉 Transaction Details Investigation Complete!');
        console.log('============================================');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Transaction Details Investigation...');
investigateTransactionDetails();
