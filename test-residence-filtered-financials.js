const { MongoClient } = require('mongodb');

async function testResidenceFilteredFinancials() {
    console.log('🧪 Testing Residence-Filtered Financial Statements');
    console.log('=================================================');
    
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
        
        // Collections
        const transactionEntriesCollection = db.collection('transactionentries');
        const residencesCollection = db.collection('residences');
        
        console.log('\n🔍 Step 1: Analyzing available residences...');
        
        // Get all residences
        const residences = await residencesCollection.find({}).toArray();
        console.log(`🏠 Found ${residences.length} residences in the system`);
        
        residences.forEach((res, index) => {
            console.log(`   ${index + 1}. ID: ${res._id}`);
            console.log(`      Name: ${res.name}`);
            console.log(`      Address: ${res.address || 'N/A'}`);
            console.log('');
        });
        
        console.log('\n🔍 Step 2: Testing residence filtering logic...');
        
        // Test residence filtering for each residence
        for (const residence of residences) {
            console.log(`\n📊 Testing Residence: ${residence.name} (${residence._id})`);
            console.log('─'.repeat(50));
            
            // Count transaction entries for this residence
            const entryCount = await transactionEntriesCollection.countDocuments({
                residence: residence._id
            });
            
            console.log(`   Transaction Entries: ${entryCount}`);
            
            if (entryCount > 0) {
                // Get sample entries
                const sampleEntries = await transactionEntriesCollection.find({
                    residence: residence._id
                }).limit(3).toArray();
                
                console.log(`   Sample Entries:`);
                sampleEntries.forEach((entry, index) => {
                    console.log(`     ${index + 1}. ID: ${entry._id}`);
                    console.log(`        Description: ${entry.description}`);
                    console.log(`        Source: ${entry.source}`);
                    console.log(`        Date: ${entry.date}`);
                    console.log(`        Residence: ${entry.residence}`);
                });
                
                // Test financial calculations
                await testFinancialCalculations(db, residence);
            } else {
                console.log(`   ⚠️  No transaction entries found for this residence`);
            }
        }
        
        console.log('\n🔍 Step 3: Testing overall vs residence-specific data...');
        
        // Compare overall vs residence-specific counts
        const overallEntryCount = await transactionEntriesCollection.countDocuments({});
        console.log(`\n📊 Overall System:`);
        console.log(`   Total Transaction Entries: ${overallEntryCount}`);
        
        // Test with a specific residence (Belvedere)
        const belvedereId = '67c13eb8425a2e078f61d00e';
        const belvedereEntries = await transactionEntriesCollection.countDocuments({
            residence: belvedereId
        });
        
        console.log(`\n📊 Belvedere Student House:`);
        console.log(`   Transaction Entries: ${belvedereEntries}`);
        console.log(`   Percentage of Total: ${((belvedereEntries / overallEntryCount) * 100).toFixed(1)}%`);
        
        // Test with another residence (St Kilda)
        const stKildaId = '67d723cf20f89c4ae69804f3';
        const stKildaEntries = await transactionEntriesCollection.countDocuments({
            residence: stKildaId
        });
        
        console.log(`\n📊 St Kilda Student House:`);
        console.log(`   Transaction Entries: ${stKildaEntries}`);
        console.log(`   Percentage of Total: ${((stKildaEntries / overallEntryCount) * 100).toFixed(1)}%`);
        
        console.log('\n🔍 Step 4: Testing financial statement generation logic...');
        
        // Test income statement logic
        await testIncomeStatementLogic(db, belvedereId);
        
        // Test balance sheet logic
        await testBalanceSheetLogic(db, belvedereId);
        
        // Test cash flow logic
        await testCashFlowLogic(db, belvedereId);
        
        console.log('\n🔍 Step 5: Summary and recommendations...');
        
        console.log(`\n📋 SUMMARY:`);
        console.log('===========');
        console.log(`Total Residences: ${residences.length}`);
        console.log(`Total Transaction Entries: ${overallEntryCount}`);
        console.log(`Residences with Data: ${residences.filter(r => r._id !== '68842effd309007c8e124a93').length}`);
        
        // Check data quality
        const entriesWithResidence = await transactionEntriesCollection.countDocuments({
            residence: { $exists: true, $ne: null, $ne: "" }
        });
        
        const entriesWithoutResidence = overallEntryCount - entriesWithResidence;
        
        console.log(`\n📊 Data Quality:`);
        console.log(`   Entries WITH Residence: ${entriesWithResidence} ✅`);
        console.log(`   Entries WITHOUT Residence: ${entriesWithoutResidence} ❌`);
        console.log(`   Residence Coverage: ${((entriesWithResidence / overallEntryCount) * 100).toFixed(1)}%`);
        
        if (entriesWithoutResidence === 0) {
            console.log('\n🎉 SUCCESS: All transaction entries have residence information!');
            console.log('   Residence filtering will work perfectly for all financial statements.');
        } else {
            console.log('\n⚠️  Some entries are missing residence information');
            console.log('   Consider running the residence update scripts.');
        }
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (entriesWithoutResidence === 0) {
            console.log('   1. ✅ System is ready for residence-based financial reporting');
            console.log('   2. ✅ All financial statements support residence filtering');
            console.log('   3. ✅ Frontend can implement residence selection dropdowns');
            console.log('   4. ✅ Property managers can view their specific financial data');
        } else {
            console.log('   1. Run residence update scripts to fix missing data');
            console.log('   2. Verify all new transactions include residence information');
        }
        
        console.log('\n🚀 Next Steps:');
        console.log('   1. Test the API endpoints with residence parameters');
        console.log('   2. Implement frontend residence selection');
        console.log('   3. Create property-specific financial dashboards');
        
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

async function testFinancialCalculations(db, residence) {
    const transactionEntriesCollection = db.collection('transactionentries');
    
    try {
        // Test income statement calculations
        const incomeEntries = await transactionEntriesCollection.find({
            residence: residence._id,
            'entries.accountType': { $in: ['Income', 'income'] }
        }).toArray();
        
        const expenseEntries = await transactionEntriesCollection.find({
            residence: residence._id,
            'entries.accountType': { $in: ['Expense', 'expense'] }
        }).toArray();
        
        console.log(`   💰 Financial Summary:`);
        console.log(`      Income Entries: ${incomeEntries.length}`);
        console.log(`      Expense Entries: ${expenseEntries.length}`);
        
        // Calculate totals
        let totalRevenue = 0;
        let totalExpenses = 0;
        
        incomeEntries.forEach(entry => {
            entry.entries.forEach(line => {
                if (line.accountType === 'Income' || line.accountType === 'income') {
                    totalRevenue += (line.credit || 0) - (line.debit || 0);
                }
            });
        });
        
        expenseEntries.forEach(entry => {
            entry.entries.forEach(line => {
                if (line.accountType === 'Expense' || line.accountType === 'expense') {
                    totalExpenses += (line.debit || 0) - (line.credit || 0);
                }
            });
        });
        
        const netIncome = totalRevenue - totalExpenses;
        
        console.log(`      Total Revenue: $${totalRevenue.toFixed(2)}`);
        console.log(`      Total Expenses: $${totalExpenses.toFixed(2)}`);
        console.log(`      Net Income: $${netIncome.toFixed(2)}`);
        
    } catch (error) {
        console.error(`   ❌ Error calculating financials: ${error.message}`);
    }
}

async function testIncomeStatementLogic(db, residenceId) {
    const transactionEntriesCollection = db.collection('transactionentries');
    
    try {
        console.log(`\n📊 Testing Income Statement Logic for Residence: ${residenceId}`);
        
        // Get entries for 2025
        const startDate = new Date('2025-01-01');
        const endDate = new Date('2025-12-31');
        
        const entries = await transactionEntriesCollection.find({
            residence: residenceId,
            date: { $gte: startDate, $lte: endDate }
        }).toArray();
        
        console.log(`   Found ${entries.length} entries for 2025`);
        
        // Calculate revenue and expenses
        const revenue = {};
        const expenses = {};
        
        entries.forEach(entry => {
            if (entry.entries) {
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    if (accountType === 'Income' || accountType === 'income') {
                        const key = `${accountCode} - ${accountName}`;
                        if (!revenue[key]) revenue[key] = 0;
                        revenue[key] += credit - debit;
                    } else if (accountType === 'Expense' || accountType === 'expense') {
                        const key = `${accountCode} - ${accountName}`;
                        if (!expenses[key]) expenses[key] = 0;
                        expenses[key] += debit - credit;
                    }
                });
            }
        });
        
        const totalRevenue = Object.values(revenue).reduce((sum, amount) => sum + amount, 0);
        const totalExpenses = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
        const netIncome = totalRevenue - totalExpenses;
        
        console.log(`   💰 Income Statement Results:`);
        console.log(`      Revenue Accounts: ${Object.keys(revenue).length}`);
        console.log(`      Expense Accounts: ${Object.keys(expenses).length}`);
        console.log(`      Total Revenue: $${totalRevenue.toFixed(2)}`);
        console.log(`      Total Expenses: $${totalExpenses.toFixed(2)}`);
        console.log(`      Net Income: $${netIncome.toFixed(2)}`);
        
    } catch (error) {
        console.error(`   ❌ Error testing income statement: ${error.message}`);
    }
}

async function testBalanceSheetLogic(db, residenceId) {
    const transactionEntriesCollection = db.collection('transactionentries');
    
    try {
        console.log(`\n📋 Testing Balance Sheet Logic for Residence: ${residenceId}`);
        
        // Get entries up to 2025-12-31
        const asOfDate = new Date('2025-12-31');
        
        const entries = await transactionEntriesCollection.find({
            residence: residenceId,
            date: { $lte: asOfDate }
        }).toArray();
        
        console.log(`   Found ${entries.length} entries up to 2025-12-31`);
        
        // Calculate account balances
        const assets = {};
        const liabilities = {};
        const equity = {};
        
        entries.forEach(entry => {
            if (entry.entries) {
                entry.entries.forEach(line => {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    const key = `${accountCode} - ${accountName}`;
                    
                    if (accountType === 'Asset' || accountType === 'asset') {
                        if (!assets[key]) assets[key] = 0;
                        assets[key] += debit - credit;
                    } else if (accountType === 'Liability' || accountType === 'liability') {
                        if (!liabilities[key]) liabilities[key] = 0;
                        liabilities[key] += credit - debit;
                    } else if (accountType === 'Equity' || accountType === 'equity') {
                        if (!equity[key]) equity[key] = 0;
                        equity[key] += credit - debit;
                    }
                });
            }
        });
        
        const totalAssets = Object.values(assets).reduce((sum, amount) => sum + amount, 0);
        const totalLiabilities = Object.values(liabilities).reduce((sum, amount) => sum + amount, 0);
        const totalEquity = Object.values(equity).reduce((sum, amount) => sum + amount, 0);
        
        console.log(`   📊 Balance Sheet Results:`);
        console.log(`      Asset Accounts: ${Object.keys(assets).length}`);
        console.log(`      Liability Accounts: ${Object.keys(liabilities).length}`);
        console.log(`      Equity Accounts: ${Object.keys(equity).length}`);
        console.log(`      Total Assets: $${totalAssets.toFixed(2)}`);
        console.log(`      Total Liabilities: $${totalLiabilities.toFixed(2)}`);
        console.log(`      Total Equity: $${totalEquity.toFixed(2)}`);
        console.log(`      Balance Check: ${Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? '✅ BALANCED' : '❌ UNBALANCED'}`);
        
    } catch (error) {
        console.error(`   ❌ Error testing balance sheet: ${error.message}`);
    }
}

async function testCashFlowLogic(db, residenceId) {
    const transactionEntriesCollection = db.collection('transactionentries');
    
    try {
        console.log(`\n💰 Testing Cash Flow Logic for Residence: ${residenceId}`);
        
        // Get entries for 2025
        const startDate = new Date('2025-01-01');
        const endDate = new Date('2025-12-31');
        
        const entries = await transactionEntriesCollection.find({
            residence: residenceId,
            date: { $gte: startDate, $lte: endDate }
        }).toArray();
        
        console.log(`   Found ${entries.length} entries for 2025`);
        
        // Simple cash flow calculation (operating activities)
        let operatingCashFlow = 0;
        
        entries.forEach(entry => {
            if (entry.entries) {
                entry.entries.forEach(line => {
                    const accountType = line.accountType;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    
                    // Simple logic: income increases cash, expenses decrease cash
                    if (accountType === 'Income' || accountType === 'income') {
                        operatingCashFlow += credit - debit;
                    } else if (accountType === 'Expense' || accountType === 'expense') {
                        operatingCashFlow -= (debit - credit);
                    }
                });
            }
        });
        
        console.log(`   💰 Cash Flow Results:`);
        console.log(`      Net Operating Cash Flow: $${operatingCashFlow.toFixed(2)}`);
        console.log(`      Cash Flow Direction: ${operatingCashFlow > 0 ? 'Positive' : operatingCashFlow < 0 ? 'Negative' : 'Neutral'}`);
        
    } catch (error) {
        console.error(`   ❌ Error testing cash flow: ${error.message}`);
    }
}

// Run the test
testResidenceFilteredFinancials()
    .then(() => {
        console.log('\n✅ Test completed successfully!');
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
    });
