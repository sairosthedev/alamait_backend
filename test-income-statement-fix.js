const axios = require('axios');

async function testIncomeStatementFix() {
    try {
        console.log('🧪 Testing income statement fix for forfeiture transactions...\n');

        // Test the income statement for September 2025 (where forfeitures occurred)
        const response = await axios.get('http://localhost:5000/api/financial-reports/income-statement?period=2025&basis=accrual', {
            headers: {
                'Authorization': 'Bearer YOUR_TOKEN' // Replace with actual token
            }
        });

        console.log('✅ Income Statement Response:');
        const data = response.data.data;
        
        // Check September data specifically
        const september = data.monthly_breakdown['8']; // September is index 8
        console.log('\n📊 September 2025 Analysis:');
        console.log('Total Revenue:', september.total_revenue);
        console.log('Total Expenses:', september.total_expenses);
        console.log('Net Income:', september.net_income);
        console.log('Transaction Count:', september.transaction_count);
        
        // Check if revenue accounts show proper debits/credits
        console.log('\n💰 Revenue Breakdown:');
        Object.entries(september.revenue).forEach(([account, amount]) => {
            console.log(`  ${account}: $${amount}`);
        });
        
        // The revenue should now be lower due to forfeiture debits
        if (september.total_revenue < 10720) {
            console.log('\n🎉 SUCCESS: Revenue reduced by forfeiture transactions!');
            console.log(`   Original: $10,720`);
            console.log(`   After forfeitures: $${september.total_revenue}`);
            console.log(`   Reduction: $${10720 - september.total_revenue}`);
        } else {
            console.log('\n❌ ISSUE: Revenue not reduced by forfeitures');
            console.log('   Expected: Less than $10,720');
            console.log(`   Actual: $${september.total_revenue}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testIncomeStatementFix();

