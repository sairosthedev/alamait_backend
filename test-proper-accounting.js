const mongoose = require('mongoose');
require('dotenv').config();

// Import the proper accounting service
const ProperAccountingService = require('./src/services/properAccountingService');

async function testProperAccountingSystem() {
    try {
        console.log('🚀 Starting Proper Accounting System Test...\n');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const testPeriod = '2024';
        const testResidence = '67d723cf20f89c4ae69804f3';
        
        console.log(`📊 Testing Financial Statements for Period: ${testPeriod}`);
        console.log(`🏠 Testing with Residence: ${testResidence}\n`);
        
        // Test 1: Accrual Basis Income Statement
        console.log('🔄 TEST 1: ACCRUAL BASIS INCOME STATEMENT');
        console.log('=' .repeat(50));
        
        try {
            const incomeStatement = await ProperAccountingService.generateAccrualBasisIncomeStatement(testPeriod, testResidence);
            console.log('✅ Accrual Basis Income Statement Generated Successfully');
            console.log(`📈 Revenue Earned: $${incomeStatement.revenue.total_earned?.toLocaleString() || '0'}`);
            console.log(`💸 Expenses Incurred: $${incomeStatement.expenses.total_incurred?.toLocaleString() || '0'}`);
            console.log(`📊 Net Income: $${incomeStatement.net_income.after_adjustments?.toLocaleString() || '0'}`);
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
        
        // Test 2: Cash Basis Cash Flow Statement
        console.log('\n💵 TEST 2: CASH BASIS CASH FLOW STATEMENT');
        console.log('=' .repeat(50));
        
        try {
            const cashFlowStatement = await ProperAccountingService.generateCashBasisCashFlowStatement(testPeriod, testResidence);
            console.log('✅ Cash Basis Cash Flow Statement Generated Successfully');
            console.log(`💸 Net Operating Cash Flow: $${cashFlowStatement.operating_activities.net_operating_cash_flow?.toLocaleString() || '0'}`);
            console.log(`📊 Net Change in Cash: $${cashFlowStatement.net_change_in_cash?.toLocaleString() || '0'}`);
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
        
        // Test 3: Cash Basis Balance Sheet
        console.log('\n💰 TEST 3: CASH BASIS BALANCE SHEET');
        console.log('=' .repeat(50));
        
        try {
            const balanceSheet = await ProperAccountingService.generateCashBasisBalanceSheet(`${testPeriod}-12-31`, testResidence);
            console.log('✅ Cash Basis Balance Sheet Generated Successfully');
            console.log(`💵 Total Assets: $${balanceSheet.assets.total_assets?.toLocaleString() || '0'}`);
            console.log(`📋 Total Liabilities: $${balanceSheet.liabilities.total_liabilities?.toLocaleString() || '0'}`);
            console.log(`🏠 Total Equity: $${balanceSheet.equity.total_equity?.toLocaleString() || '0'}`);
            console.log(`⚖️ Balanced: ${balanceSheet.accounting_equation.is_balanced ? '✅ YES' : '❌ NO'}`);
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
        
        console.log('\n🚀 Proper Accounting System Test Completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed');
    }
}

testProperAccountingSystem();
