const axios = require('axios');

// Test the actual API endpoint
async function testAPIEndpoint() {
    try {
        console.log('🧪 Testing API Endpoint with Fixed Controller...\n');
        
        const baseURL = 'http://localhost:3000'; // Adjust if your server runs on different port
        
        // Test 1: Accrual Basis
        console.log('🧪 TEST 1: ACCRUAL BASIS via API');
        console.log('='.repeat(50));
        try {
            const accrualResponse = await axios.get(`${baseURL}/api/financial-reports/income-statement`, {
                params: {
                    period: '2025',
                    basis: 'accrual'
                },
                timeout: 10000
            });
            
            console.log('✅ Accrual Basis API Response:');
            console.log(`  - Status: ${accrualResponse.status}`);
            console.log(`  - Basis: ${accrualResponse.data?.data?.basis || 'Not found'}`);
            console.log(`  - Revenue: $${accrualResponse.data?.data?.revenue?.total_revenue || 0}`);
            console.log(`  - Expenses: $${accrualResponse.data?.data?.expenses?.total_expenses || 0}`);
            console.log(`  - Net Income: $${accrualResponse.data?.data?.net_income || 0}`);
            console.log(`  - Message: ${accrualResponse.data?.message || 'No message'}`);
            
        } catch (error) {
            console.log('❌ Accrual Basis API Error:', error.message);
            if (error.response) {
                console.log(`  - Status: ${error.response.status}`);
                console.log(`  - Data:`, error.response.data);
            }
        }
        
        // Test 2: Cash Basis
        console.log('\n🧪 TEST 2: CASH BASIS via API');
        console.log('='.repeat(50));
        try {
            const cashResponse = await axios.get(`${baseURL}/api/financial-reports/income-statement`, {
                params: {
                    period: '2025',
                    basis: 'cash'
                },
                timeout: 10000
            });
            
            console.log('✅ Cash Basis API Response:');
            console.log(`  - Status: ${cashResponse.status}`);
            console.log(`  - Basis: ${cashResponse.data?.data?.basis || 'Not found'}`);
            console.log(`  - Revenue: $${cashResponse.data?.data?.revenue?.total_revenue || 0}`);
            console.log(`  - Expenses: $${cashResponse.data?.data?.expenses?.total_expenses || 0}`);
            console.log(`  - Net Income: $${cashResponse.data?.data?.net_income || 0}`);
            console.log(`  - Message: ${cashResponse.data?.message || 'No message'}`);
            
        } catch (error) {
            console.log('❌ Cash Basis API Error:', error.message);
            if (error.response) {
                console.log(`  - Status: ${error.response.status}`);
                console.log(`  - Data:`, error.response.data);
            }
        }
        
        console.log('\n🎯 Expected Results:');
        console.log('  - Accrual: Revenue $3,295, Expenses $5,340, Net Income -$2,045');
        console.log('  - Cash: Revenue $1,640, Expenses $500, Net Income $1,140');
        console.log('  - Both should show different data and correct basis field');
        
    } catch (error) {
        console.error('❌ General error:', error.message);
    }
}

// Run the test
testAPIEndpoint();
