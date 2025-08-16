const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testEnhancedBalanceSheet() {
    console.log('🧪 Testing Enhanced Balance Sheet with Account Codes...\n');
    
    try {
        // Test the new monthly balance sheet with account codes
        console.log('📋 Testing GET /api/accounting/balance-sheet-monthly?year=2025...');
        const response = await axios.get(`${BASE_URL}/api/accounting/balance-sheet-monthly?year=2025`);
        
        console.log('✅ Response Status:', response.status);
        console.log('✅ Enhanced Balance Sheet with Account Codes:');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
            console.log('\n🎉 SUCCESS! Enhanced Balance Sheet with Account Codes!');
            
            const monthlyData = response.data.data.monthlyData;
            const summary = response.data.data.summary;
            
            console.log('\n📊 Monthly Breakdown with Account Codes:');
            console.log('=' .repeat(80));
            
            for (let month = 1; month <= 12; month++) {
                if (monthlyData[month]) {
                    const data = monthlyData[month];
                    console.log(`\n📅 ${month}/${data.year} (${new Date(data.year, month - 1, 1).toLocaleString('default', { month: 'long' })})`);
                    console.log(`   Assets: $${data.assets.total}`);
                    console.log(`     Bank (${data.assets.current.bank.accountCode}): $${data.assets.current.bank.amount}`);
                    console.log(`     A/R (${data.assets.current.accountsReceivable.accountCode}): $${data.assets.current.accountsReceivable.amount}`);
                    console.log(`   Liabilities: $${data.liabilities.total}`);
                    console.log(`     A/P (${data.liabilities.current.accountsPayable.accountCode}): $${data.liabilities.current.accountsPayable.amount}`);
                    console.log(`     Deposits (${data.liabilities.current.tenantDeposits.accountCode}): $${data.liabilities.current.tenantDeposits.amount}`);
                    console.log(`   Equity: $${data.equity.total}`);
                    console.log(`     Retained Earnings (${data.equity.retainedEarnings.accountCode}): $${data.equity.retainedEarnings.amount}`);
                    console.log(`   Balance Check: ${data.balanceCheck}`);
                }
            }
            
            console.log('\n📋 YEAR-END SUMMARY:');
            console.log('=' .repeat(50));
            console.log(`Total Assets: $${summary.totalAssets}`);
            console.log(`Total Liabilities: $${summary.totalLiabilities}`);
            console.log(`Total Equity: $${summary.totalEquity}`);
            console.log(`Balance Check: $${summary.totalAssets - (summary.totalLiabilities + summary.totalEquity)}`);
            
        } else {
            console.log('\n❌ Still getting an error:', response.data.message);
        }
        
    } catch (error) {
        console.error('❌ Error testing enhanced balance sheet:', error.response?.data || error.message);
    }
}

// Run the test
testEnhancedBalanceSheet();
