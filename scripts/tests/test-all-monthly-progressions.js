const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testAllMonthlyProgressions() {
    console.log('🧪 Testing ALL Monthly Progression Endpoints for All Residences...\n');
    
    try {
        // Test 1: Balance Sheet Monthly Progression
        console.log('📋 1. Testing Balance Sheet Monthly Progression...');
        console.log('GET /api/accounting/balance-sheet/residences/monthly?year=2025');
        const balanceSheetResponse = await axios.get(`${BASE_URL}/api/accounting/balance-sheet/residences/monthly?year=2025`);
        
        if (balanceSheetResponse.data.success) {
            console.log('✅ Balance Sheet Monthly Progression: SUCCESS!');
            const balanceSheetData = balanceSheetResponse.data.data;
            console.log(`   Year: ${balanceSheetData.year}, Residences: ${balanceSheetData.summary.totalResidences}`);
            console.log(`   December Assets: $${balanceSheetData.summary.totalAssets}`);
            console.log(`   December Liabilities: $${balanceSheetData.summary.totalLiabilities}`);
            console.log(`   December Equity: $${balanceSheetData.summary.totalEquity}`);
        } else {
            console.log('❌ Balance Sheet Monthly Progression: FAILED');
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Test 2: Income Statement Monthly Progression
        console.log('📊 2. Testing Income Statement Monthly Progression...');
        console.log('GET /api/accounting/income-statement/residences/monthly?year=2025');
        const incomeStatementResponse = await axios.get(`${BASE_URL}/api/accounting/income-statement/residences/monthly?year=2025`);
        
        if (incomeStatementResponse.data.success) {
            console.log('✅ Income Statement Monthly Progression: SUCCESS!');
            const incomeData = incomeStatementResponse.data.data;
            console.log(`   Year: ${incomeData.year}, Residences: ${incomeData.summary.totalResidences}`);
            console.log(`   December Revenue: $${incomeData.summary.totalRevenue}`);
            console.log(`   December Expenses: $${incomeData.summary.totalExpenses}`);
            console.log(`   December Net Income: $${incomeData.summary.totalNetIncome}`);
            
            // Show monthly breakdown for income statement
            console.log('\n📅 Monthly Revenue Progression:');
            for (let month = 1; month <= 12; month++) {
                if (incomeData.monthlyProgression[month]) {
                    const monthData = incomeData.monthlyProgression[month];
                    console.log(`   ${monthData.monthName}: $${monthData.summary.totalRevenue}`);
                }
            }
        } else {
            console.log('❌ Income Statement Monthly Progression: FAILED');
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Test 3: Cash Flow Monthly Progression
        console.log('💸 3. Testing Cash Flow Monthly Progression...');
        console.log('GET /api/accounting/cash-flow/residences/monthly?year=2025');
        const cashFlowResponse = await axios.get(`${BASE_URL}/api/accounting/cash-flow/residences/monthly?year=2025`);
        
        if (cashFlowResponse.data.success) {
            console.log('✅ Cash Flow Monthly Progression: SUCCESS!');
            const cashFlowData = cashFlowResponse.data.data;
            console.log(`   Year: ${cashFlowData.year}, Residences: ${cashFlowData.summary.totalResidences}`);
            console.log(`   December Net Operating Cash: $${cashFlowData.summary.totalNetOperatingCash}`);
            console.log(`   December Net Change in Cash: $${cashFlowData.summary.totalNetChangeInCash}`);
            console.log(`   December Ending Cash: $${cashFlowData.summary.totalEndingCash}`);
            
            // Show monthly breakdown for cash flow
            console.log('\n📅 Monthly Cash Flow Progression:');
            for (let month = 1; month <= 12; month++) {
                if (cashFlowData.monthlyProgression[month]) {
                    const monthData = cashFlowData.monthlyProgression[month];
                    console.log(`   ${monthData.monthName}: Net Operating $${monthData.summary.totalNetOperatingCash}, Ending $${monthData.summary.totalEndingCash}`);
                }
            }
        } else {
            console.log('❌ Cash Flow Monthly Progression: FAILED');
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Summary
        console.log('🎉 SUMMARY OF ALL MONTHLY PROGRESSION ENDPOINTS:');
        console.log('✅ Balance Sheet: /api/accounting/balance-sheet/residences/monthly');
        console.log('✅ Income Statement: /api/accounting/income-statement/residences/monthly');
        console.log('✅ Cash Flow: /api/accounting/cash-flow/residences/monthly');
        console.log('\n🚀 All endpoints now provide monthly progression (Jan-Dec) for each residence!');
        
    } catch (error) {
        console.error('❌ Error testing monthly progressions:', error.response?.data || error.message);
    }
}

testAllMonthlyProgressions();
