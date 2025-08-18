require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('./src/models/Transaction');
const Residence = require('./src/models/Residence');
const Account = require('./src/models/Account');

async function investigateAccountsTransactions() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Investigating Accounts, Amounts & Transactions...');
        console.log('==================================================');

        // Get all collections
        const transactions = await Transaction.find({});
        const residences = await Residence.find({});
        const accounts = await Account.find({});
        
        console.log(`📊 Total Transactions: ${transactions.length}`);
        console.log(`📊 Total Residences: ${residences.length}`);
        console.log(`📊 Total Accounts: ${accounts.length}`);

        // Show residence details
        console.log('\n🏠 Residences:');
        console.log('==============');
        residences.forEach((residence, index) => {
            console.log(`\n   ${index + 1}. ${residence.name}:`);
            console.log(`      ID: ${residence._id}`);
            console.log(`      Address: ${residence.address || 'N/A'}`);
            console.log(`      Rooms: ${residence.rooms ? residence.rooms.length : 0}`);
            if (residence.rooms && residence.rooms.length > 0) {
                residence.rooms.slice(0, 3).forEach((room, roomIndex) => {
                    console.log(`         Room ${roomIndex + 1}: ${room.roomNumber} - $${room.price}`);
                });
            }
        });

        // Show account details if they exist
        if (accounts.length > 0) {
            console.log('\n💰 Accounts:');
            console.log('=============');
            accounts.forEach((account, index) => {
                console.log(`\n   ${index + 1}. ${account.name || 'Unnamed Account'}:`);
                console.log(`      ID: ${account._id}`);
                console.log(`      Type: ${account.type || 'N/A'}`);
                console.log(`      Balance: $${account.balance || 0}`);
                console.log(`      Currency: ${account.currency || 'N/A'}`);
            });
        } else {
            console.log('\n💰 No Accounts found in database');
        }

        // Analyze transaction structure and amounts
        console.log('\n🔍 Transaction Analysis:');
        console.log('=========================');
        
        let totalTransactionAmount = 0;
        let transactionsByType = {};
        let transactionsByResidence = {};
        let transactionsByMonth = {};

        transactions.forEach((transaction, index) => {
            const amount = transaction.amount || 0;
            const type = transaction.type || 'unknown';
            const residenceId = transaction.residence?.toString() || 'unknown';
            const date = transaction.date || transaction.createdAt;
            const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';

            totalTransactionAmount += amount;

            // Track by type
            if (!transactionsByType[type]) {
                transactionsByType[type] = { total: 0, count: 0, amounts: [] };
            }
            transactionsByType[type].total += amount;
            transactionsByType[type].count++;
            if (amount > 0) transactionsByType[type].amounts.push(amount);

            // Track by residence
            if (!transactionsByResidence[residenceId]) {
                transactionsByResidence[residenceId] = { total: 0, count: 0, amounts: [] };
            }
            transactionsByResidence[residenceId].total += amount;
            transactionsByResidence[residenceId].count++;
            if (amount > 0) transactionsByResidence[residenceId].amounts.push(amount);

            // Track by month
            if (!transactionsByMonth[month]) {
                transactionsByMonth[month] = { total: 0, count: 0, amounts: [] };
            }
            transactionsByMonth[month].total += amount;
            transactionsByMonth[month].count++;
            if (amount > 0) transactionsByMonth[month].amounts.push(amount);

            // Show first 10 transactions in detail
            if (index < 10) {
                console.log(`\nTransaction ${index + 1}:`);
                console.log(`   ID: ${transaction.transactionId}`);
                console.log(`   Type: ${type}`);
                console.log(`   Amount: $${amount}`);
                console.log(`   Residence: ${residenceId}`);
                console.log(`   Date: ${date}`);
                console.log(`   Description: ${transaction.description || 'N/A'}`);
                console.log(`   Reference: ${transaction.reference || 'N/A'}`);
            }
        });

        // Display transaction summaries
        console.log('\n📊 Transaction Summary:');
        console.log('========================');
        console.log(`   Total Transaction Amount: $${totalTransactionAmount.toLocaleString()}`);
        console.log(`   Total Transactions: ${transactions.length}`);

        console.log('\n🏷️  Transactions by Type:');
        console.log('==========================');
        Object.entries(transactionsByType).forEach(([type, data]) => {
            console.log(`\n   ${type}:`);
            console.log(`      Count: ${data.count}`);
            console.log(`      Total: $${data.total.toLocaleString()}`);
            if (data.amounts.length > 0) {
                console.log(`      Amounts: ${data.amounts.slice(0, 5).map(a => `$${a}`).join(', ')}${data.amounts.length > 5 ? '...' : ''}`);
            }
        });

        console.log('\n🏠 Transactions by Residence:');
        console.log('==============================');
        Object.entries(transactionsByResidence).forEach(([residenceId, data]) => {
            const residenceName = residences.find(r => r._id.toString() === residenceId)?.name || 'Unknown';
            console.log(`\n   ${residenceName} (${residenceId}):`);
            console.log(`      Count: ${data.count}`);
            console.log(`      Total: $${data.total.toLocaleString()}`);
            if (data.amounts.length > 0) {
                console.log(`      Amounts: ${data.amounts.slice(0, 5).map(a => `$${a}`).join(', ')}${data.amounts.length > 5 ? '...' : ''}`);
            }
        });

        console.log('\n📅 Transactions by Month:');
        console.log('==========================');
        Object.entries(transactionsByMonth)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([month, data]) => {
                console.log(`\n   ${month}:`);
                console.log(`      Count: ${data.count}`);
                console.log(`      Total: $${data.total.toLocaleString()}`);
                if (data.amounts.length > 0) {
                    console.log(`      Amounts: ${data.amounts.slice(0, 5).map(a => `$${a}`).join(', ')}${data.amounts.length > 5 ? '...' : ''}`);
                }
            });

        console.log('\n🎉 Investigation Complete!');
        console.log('==========================');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Accounts & Transactions Investigation...');
investigateAccountsTransactions();
