// Script to show all accounts in the accounts collection
const { MongoClient } = require('mongodb');

// Database connection configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
const DB_NAME = process.env.DB_NAME || 'alamait';

async function showAllAccounts() {
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        console.log('✅ Connected to MongoDB successfully!');
        
        const db = client.db(DB_NAME);
        const accountsCollection = db.collection('accounts');
        
        // Get total count
        const totalCount = await accountsCollection.countDocuments();
        console.log(`\n📊 Total accounts found: ${totalCount}`);
        
        if (totalCount === 0) {
            console.log('❌ No accounts found in the accounts collection!');
            return;
        }
        
        // Get all accounts with pagination for better display
        const accounts = await accountsCollection.find({}).toArray();
        
        console.log('\n=== ALL ACCOUNTS IN DATABASE ===\n');
        
        // Group accounts by type for better organization
        const accountsByType = {};
        accounts.forEach(account => {
            const type = account.type || 'Unknown';
            if (!accountsByType[type]) {
                accountsByType[type] = [];
            }
            accountsByType[type].push(account);
        });
        
        // Display accounts grouped by type
        Object.keys(accountsByType).sort().forEach(type => {
            console.log(`\n📁 ${type.toUpperCase()} ACCOUNTS (${accountsByType[type].length})`);
            console.log('─'.repeat(80));
            
            accountsByType[type].forEach((account, index) => {
                console.log(`${index + 1}. Code: ${account.code || 'N/A'} | Name: ${account.name || 'N/A'}`);
                
                // Show additional fields if they exist
                if (account.description) {
                    console.log(`   Description: ${account.description}`);
                }
                if (account.parentAccount) {
                    console.log(`   Parent Account: ${account.parentAccount}`);
                }
                if (account.isActive !== undefined) {
                    console.log(`   Active: ${account.isActive ? 'Yes' : 'No'}`);
                }
                if (account.balance !== undefined) {
                    console.log(`   Balance: ${account.balance}`);
                }
                if (account.createdAt) {
                    console.log(`   Created: ${new Date(account.createdAt).toLocaleDateString()}`);
                }
                console.log(''); // Empty line for readability
            });
        });
        
        // Show summary statistics
        console.log('\n=== SUMMARY STATISTICS ===');
        Object.keys(accountsByType).forEach(type => {
            console.log(`${type}: ${accountsByType[type].length} accounts`);
        });
        
        // Show sample account structure
        if (accounts.length > 0) {
            console.log('\n=== SAMPLE ACCOUNT STRUCTURE ===');
            const sampleAccount = accounts[0];
            console.log(JSON.stringify(sampleAccount, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        if (client) {
            await client.close();
            console.log('\n🔌 MongoDB connection closed.');
        }
    }
}

// Run the script
if (require.main === module) {
    showAllAccounts()
        .then(() => {
            console.log('\n✅ Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = { showAllAccounts };
