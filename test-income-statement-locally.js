const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

// You'll need to update this connection string with your actual MongoDB Atlas credentials
// Format: mongodb+srv://username:password@cluster0.ulvve.mongodb.net/test
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://username:password@cluster0.ulvve.mongodb.net/test';

async function testIncomeStatementLocally() {
    try {
        console.log('🧪 Testing Income Statement Service Locally...\n');
        console.log('📝 Note: Update the MONGODB_URI in this script with your actual credentials\n');
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to MongoDB Atlas');
        
        const year = process.argv[2] || '2025';
        
        // Test cash basis income statement
        console.log(`\n📊 Testing CASH BASIS Income Statement for ${year}...`);
        const cashStatement = await FinancialReportingService.generateIncomeStatement(year, 'cash');
        console.log('✅ Cash Basis Results:');
        console.log(JSON.stringify(cashStatement, null, 2));
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Test cash basis monthly breakdown
        console.log(`📅 Testing CASH BASIS Monthly Breakdown for ${year}...`);
        const cashMonthly = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(year, 'cash');
        console.log('✅ Cash Basis Monthly Results:');
        console.log(JSON.stringify(cashMonthly, null, 2));
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Test accrual basis
        console.log(`📊 Testing ACCRUAL BASIS Income Statement for ${year}...`);
        const accrualStatement = await FinancialReportingService.generateIncomeStatement(year, 'accrual');
        console.log('✅ Accrual Basis Results:');
        console.log(JSON.stringify(accrualStatement, null, 2));
        
        console.log('\n🎉 All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing income statement:', error);
        
        if (error.message.includes('authentication')) {
            console.log('\n🔐 Authentication Error: Please check your MongoDB Atlas credentials');
            console.log('   Update the MONGODB_URI in this script with your username and password');
        } else if (error.message.includes('ECONNREFUSED')) {
            console.log('\n🌐 Connection Error: Please check your MongoDB Atlas connection string');
        }
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

// Instructions for the user
console.log('📋 INSTRUCTIONS:');
console.log('1. Update the MONGODB_URI variable with your actual MongoDB Atlas credentials');
console.log('2. Run: node test-income-statement-locally.js [year]');
console.log('3. Example: node test-income-statement-locally.js 2025');
console.log('');

// Run the test
testIncomeStatementLocally();
