require('dotenv').config();
const mongoose = require('mongoose');

async function checkAvailableAccounts() {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n📊 Available Accounts in Chart of Accounts:');
        console.log('==========================================');
        
        // Get all accounts
        const accounts = await mongoose.connection.db.collection('accounts').find({}).toArray();
        console.log(`💰 Total Accounts: ${accounts.length}`);
        
        // Group by type
        const accountsByType = {};
        accounts.forEach(account => {
            if (!accountsByType[account.type]) {
                accountsByType[account.type] = [];
            }
            accountsByType[account.type].push(account);
        });
        
        // Show accounts by type
        Object.keys(accountsByType).forEach(type => {
            console.log(`\n📋 ${type} Accounts:`);
            console.log('─'.repeat(50));
            accountsByType[type].forEach(account => {
                console.log(`   ${account.code} - ${account.name}`);
            });
        });
        
        // Look for specific account types we need
        console.log('\n🔍 Looking for Required Account Types:');
        console.log('=====================================');
        
        const bankAccounts = accounts.filter(a => a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash'));
        const rentAccounts = accounts.filter(a => a.name.toLowerCase().includes('rent') || a.name.toLowerCase().includes('income'));
        const adminAccounts = accounts.filter(a => a.name.toLowerCase().includes('admin') || a.name.toLowerCase().includes('administrative'));
        const depositAccounts = accounts.filter(a => a.name.toLowerCase().includes('deposit') || a.name.toLowerCase().includes('security'));
        
        console.log(`🏦 Bank/Cash Accounts: ${bankAccounts.length}`);
        bankAccounts.forEach(acc => console.log(`   ${acc.code} - ${acc.name}`));
        
        console.log(`🏠 Rent/Income Accounts: ${rentAccounts.length}`);
        rentAccounts.forEach(acc => console.log(`   ${acc.code} - ${acc.name}`));
        
        console.log(`📋 Admin Accounts: ${adminAccounts.length}`);
        adminAccounts.forEach(acc => console.log(`   ${acc.code} - ${acc.name}`));
        
        console.log(`💰 Deposit Accounts: ${depositAccounts.length}`);
        depositAccounts.forEach(acc => console.log(`   ${acc.code} - ${acc.name}`));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Checking Available Accounts...');
checkAvailableAccounts(); 