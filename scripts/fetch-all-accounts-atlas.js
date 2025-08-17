const { MongoClient } = require('mongodb');

async function fetchAllAccountsAtlas() {
    console.log('🔌 Fetching All Accounts from MongoDB Atlas');
    console.log('=============================================');
    
    // Connect to your MongoDB Atlas cluster
    const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';
    const DB_NAME = 'test';
    
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB Atlas...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        console.log('✅ Connected to MongoDB Atlas successfully!');
        console.log(`📊 Database: ${DB_NAME}`);
        
        const db = client.db(DB_NAME);
        
        // Check the accounts collection
        const accountsCollection = db.collection('accounts');
        const totalAccounts = await accountsCollection.countDocuments();
        console.log(`\n💰 Total accounts in 'accounts' collection: ${totalAccounts}`);
        
        if (totalAccounts === 0) {
            console.log('❌ No accounts found in the accounts collection!');
            return;
        }
        
        // Get all accounts
        const accounts = await accountsCollection.find({}).toArray();
        
        console.log('\n=== ALL ACCOUNTS WITH THEIR TYPES ===\n');
        
        // Display all accounts with their types
        accounts.forEach((account, index) => {
            const accountType = account.type || 'Unknown';
            const accountCode = account.code || 'N/A';
            const accountName = account.name || 'N/A';
            
            console.log(`${index + 1}. Code: ${accountCode} | Name: ${accountName}`);
            console.log(`   Type: ${accountType}`);
            
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
            if (account.status) {
                console.log(`   Status: ${account.status}`);
            }
            console.log(''); // Empty line for readability
        });
        
        // Group accounts by type for summary
        const accountsByType = {};
        accounts.forEach(account => {
            const type = account.type || 'Unknown';
            if (!accountsByType[type]) {
                accountsByType[type] = [];
            }
            accountsByType[type].push(account);
        });
        
        // Show summary statistics by type
        console.log('\n=== SUMMARY BY TYPE ===');
        console.log('========================');
        Object.keys(accountsByType).sort().forEach(type => {
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
            console.log('\n🔌 MongoDB Atlas connection closed.');
        }
    }
}

// Run the script
fetchAllAccountsAtlas()
    .then(() => {
        console.log('\n✅ Script completed successfully!');
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
    });
