/**
 * 📊 Test Income Statement Endpoints
 * 
 * This script tests the available income statement endpoints
 * and displays the monthly income statement data.
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function testIncomeStatementEndpoints() {
    try {
        console.log('📊 Testing Income Statement Endpoints...\n');
        
        // Wait for connection to be ready
        await mongoose.connection.asPromise();
        
        // Test 1: Direct database query using AccountingService
        console.log('🔍 Test 1: Direct Database Query (AccountingService)');
        console.log('=====================================');
        
        try {
            const AccountingService = require('./src/services/accountingService');
            
            // Get current month and year
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();
            
            console.log(`📅 Generating Income Statement for ${currentMonth}/${currentYear}...`);
            
            const incomeStatement = await AccountingService.generateMonthlyIncomeStatement(currentMonth, currentYear);
            
            console.log('✅ Income Statement Generated Successfully!');
            console.log('\n📊 **Income Statement Details:**');
            console.log(`   Period: ${currentMonth}/${currentYear}`);
            console.log(`   Total Revenue: $${incomeStatement.revenue.total}`);
            console.log(`   Total Expenses: $${incomeStatement.expenses.total}`);
            console.log(`   Net Income: $${incomeStatement.netIncome}`);
            
            if (incomeStatement.revenue.breakdown) {
                console.log('\n💰 **Revenue Breakdown:**');
                Object.entries(incomeStatement.revenue.breakdown).forEach(([account, amount]) => {
                    if (account !== 'total') {
                        console.log(`   ${account}: $${amount}`);
                    }
                });
            }
            
            if (incomeStatement.expenses.breakdown) {
                console.log('\n💸 **Expense Breakdown:**');
                Object.entries(incomeStatement.expenses.breakdown).forEach(([account, amount]) => {
                    if (account !== 'total') {
                        console.log(`   ${account}: $${amount}`);
                    }
                });
            }
            
        } catch (error) {
            console.log(`❌ Direct query failed: ${error.message}`);
        }
        
        // Test 2: Check if we can access the collections directly
        console.log('\n🔍 Test 2: Direct Collection Access');
        console.log('=====================================');
        
        try {
            const transactionEntriesCollection = mongoose.connection.db.collection('transactionentries');
            const accountsCollection = mongoose.connection.db.collection('accounts');
            
            // Count total transaction entries
            const totalEntries = await transactionEntriesCollection.countDocuments();
            console.log(`📊 Total Transaction Entries: ${totalEntries}`);
            
            // Count total accounts
            const totalAccounts = await accountsCollection.countDocuments();
            console.log(`📊 Total Accounts: ${totalAccounts}`);
            
            // Get income accounts
            const incomeAccounts = await accountsCollection.find({ type: 'Income' }).toArray();
            console.log(`💰 Income Accounts: ${incomeAccounts.length}`);
            incomeAccounts.forEach(account => {
                console.log(`   - ${account.code}: ${account.name}`);
            });
            
            // Get recent income transactions
            const recentIncomeEntries = await transactionEntriesCollection.find({
                'entries.accountType': 'Income',
                date: { $gte: new Date(currentYear, currentMonth - 1, 1) }
            }).limit(5).toArray();
            
            console.log(`\n📈 Recent Income Entries (${currentMonth}/${currentYear}): ${recentIncomeEntries.length}`);
            recentIncomeEntries.forEach((entry, index) => {
                console.log(`   ${index + 1}. ${entry.description || 'No description'}`);
                console.log(`      Date: ${entry.date.toDateString()}`);
                console.log(`      Amount: $${entry.totalCredit || entry.totalDebit}`);
                console.log(`      Account: ${entry.entries?.[0]?.accountCode || 'Unknown'}`);
            });
            
        } catch (error) {
            console.log(`❌ Collection access failed: ${error.message}`);
        }
        
        // Test 3: Check for specific month data
        console.log('\n🔍 Test 3: Specific Month Analysis');
        console.log('=====================================');
        
        try {
            const transactionEntriesCollection = mongoose.connection.db.collection('transactionentries');
            
            // Check August 2025 data
            const augustStart = new Date(2025, 7, 1); // August 1, 2025
            const augustEnd = new Date(2025, 7, 31); // August 31, 2025
            
            const augustEntries = await transactionEntriesCollection.find({
                date: { $gte: augustStart, $lte: augustEnd }
            }).toArray();
            
            console.log(`📅 August 2025 Entries: ${augustEntries.length}`);
            
            if (augustEntries.length > 0) {
                // Group by account type
                const byAccountType = {};
                augustEntries.forEach(entry => {
                    if (entry.entries && entry.entries.length > 0) {
                        entry.entries.forEach(subEntry => {
                            const accountType = subEntry.accountType;
                            if (!byAccountType[accountType]) {
                                byAccountType[accountType] = { count: 0, total: 0 };
                            }
                            byAccountType[accountType].count++;
                            byAccountType[accountType].total += (subEntry.credit || 0) - (subEntry.debit || 0);
                        });
                    }
                });
                
                console.log('\n📊 August 2025 Summary by Account Type:');
                Object.entries(byAccountType).forEach(([type, data]) => {
                    console.log(`   ${type}: ${data.count} entries, Net: $${data.total}`);
                });
            }
            
        } catch (error) {
            console.log(`❌ Month analysis failed: ${error.message}`);
        }
        
    } catch (error) {
        console.error('❌ Error testing endpoints:', error);
    }
}

async function main() {
    try {
        // Use connection string from .env file
        const connectionString = process.env.MONGODB_URI;
        
        if (!connectionString) {
            throw new Error('MONGODB_URI not found in .env file');
        }
        
        console.log('🔗 Connecting to MongoDB Atlas...');
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB Atlas');
        
        // Test income statement endpoints
        await testIncomeStatementEndpoints();
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// Run the test
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testIncomeStatementEndpoints };
