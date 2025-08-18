const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

// Connect to MongoDB Atlas cluster
mongoose.connect('mongodb+srv://cluster0.ulvve.mongodb.net/test', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function testActualIncomeStatement() {
    try {
        console.log('🧪 Testing Updated FinancialReportingService with Actual Database...\n');
        
        const year = process.argv[2] || '2025';
        
        // Test cash basis income statement (should work with your actual data)
        console.log('📊 Testing CASH BASIS Income Statement...');
        const cashStatement = await FinancialReportingService.generateIncomeStatement(year, 'cash');
        console.log('✅ Cash Basis Results:');
        console.log(JSON.stringify(cashStatement, null, 2));
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Test cash basis monthly breakdown
        console.log('📅 Testing CASH BASIS Monthly Breakdown...');
        const cashMonthly = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(year, 'cash');
        console.log('✅ Cash Basis Monthly Results:');
        console.log(JSON.stringify(cashMonthly, null, 2));
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Test accrual basis (should show no data since no accruals exist yet)
        console.log('📊 Testing ACCRUAL BASIS Income Statement...');
        const accrualStatement = await FinancialReportingService.generateIncomeStatement(year, 'accrual');
        console.log('✅ Accrual Basis Results:');
        console.log(JSON.stringify(accrualStatement, null, 2));
        
    } catch (error) {
        console.error('❌ Error testing income statement:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Wait for connection then run
mongoose.connection.once('open', () => {
    testActualIncomeStatement();
});
