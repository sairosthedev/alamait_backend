const axios = require('axios');

// Test the new monthly income & expenses endpoint with authentication
async function testMonthlyIncomeExpenses() {
    const baseURL = 'http://localhost:5000'; // Adjust if your server runs on different port
    let authToken = null;
    
    console.log('🧪 Testing Monthly Income & Expenses Endpoint...\n');
    
    // Step 1: Login to get authentication token
    console.log('🔐 Step 1: Authenticating...');
    try {
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            email: 'admin@alamait.com', // Use admin user
            password: 'admin123' // Try common password
        });
        
        if (loginResponse.data.token) {
            authToken = loginResponse.data.token;
            console.log('✅ Authentication successful!');
            console.log(`👤 User: ${loginResponse.data.user.email} (${loginResponse.data.user.role})`);
        } else {
            console.log('❌ No token in login response');
            return;
        }
        
    } catch (error) {
        console.log('❌ Login failed:', error.response?.data?.message || error.message);
        if (error.response) {
            console.log('📊 Response status:', error.response.status);
            console.log('📊 Response data:', JSON.stringify(error.response.data, null, 2));
        }
        console.log('💡 Please check your admin credentials or create a test user');
        return;
    }
    
    // Set up axios headers with authentication
    const authHeaders = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
    };
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 1: All residences (no filter) - Dashboard default
    console.log('📊 Test 1: All Residences (2025, Cash Basis - Dashboard Default)');
    try {
        const response1 = await axios.get(`${baseURL}/api/financial-reports/monthly-income-expenses`, {
            headers: authHeaders,
            params: {
                period: '2025'
                // basis defaults to 'cash' for dashboards
            }
        });
        
        console.log('✅ Success!');
        console.log(`📅 Period: ${response1.data.data.period}`);
        console.log(`📊 Basis: ${response1.data.data.basis}`);
        console.log(`🏠 Residence: ${response1.data.data.residence || 'All'}`);
        console.log(`💰 Annual Revenue: $${response1.data.data.annualSummary.totalAnnualRevenue.toLocaleString()}`);
        console.log(`💸 Annual Expenses: $${response1.data.data.annualSummary.totalAnnualExpenses.toLocaleString()}`);
        console.log(`📈 Annual Net Income: $${response1.data.data.annualSummary.totalAnnualNetIncome.toLocaleString()}`);
        
        // Show sample monthly data
        console.log('\n📋 Sample Monthly Data:');
        const months = Object.keys(response1.data.data.monthlyBreakdown).slice(0, 3);
        months.forEach(month => {
            const monthData = response1.data.data.monthlyBreakdown[month];
            console.log(`  ${monthData.monthName}: Revenue $${monthData.summary.totalRevenue}, Expenses $${monthData.summary.totalExpenses}, Net $${monthData.summary.totalNetIncome}`);
        });
        
    } catch (error) {
        console.log('❌ Error:', error.response?.data?.message || error.message);
        if (error.response?.status === 403) {
            console.log('💡 This might be a role permission issue. Check if your user has finance access.');
        }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 2: St Kilda residence only - Dashboard with filter
    console.log('📊 Test 2: St Kilda Residence Only (2025, Cash Basis - Dashboard Filter)');
    try {
        const response2 = await axios.get(`${baseURL}/api/financial-reports/monthly-income-expenses`, {
            headers: authHeaders,
            params: {
                period: '2025',
                residence: '67d723cf20f89c4ae69804f3' // St Kilda ID
                // basis defaults to 'cash' for dashboards
            }
        });
        
        console.log('✅ Success!');
        console.log(`📅 Period: ${response2.data.data.period}`);
        console.log(`📊 Basis: ${response2.data.data.basis}`);
        console.log(`🏠 Residence: ${response2.data.data.residence || 'All'}`);
        console.log(`💰 Annual Revenue: $${response2.data.data.annualSummary.totalAnnualRevenue.toLocaleString()}`);
        console.log(`💸 Annual Expenses: $${response2.data.data.annualSummary.totalAnnualExpenses.toLocaleString()}`);
        console.log(`📈 Annual Net Income: $${response2.data.data.annualSummary.totalAnnualNetIncome.toLocaleString()}`);
        
        // Show sample monthly data
        console.log('\n📋 Sample Monthly Data:');
        const months = Object.keys(response2.data.data.monthlyBreakdown).slice(0, 3);
        months.forEach(month => {
            const monthData = response2.data.data.monthlyBreakdown[month];
            console.log(`  ${monthData.monthName}: Revenue $${monthData.summary.totalRevenue}, Expenses $${monthData.summary.totalExpenses}, Net $${monthData.summary.totalNetIncome}`);
        });
        
    } catch (error) {
        console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 3: Accrual basis (explicit override)
    console.log('📊 Test 3: Accrual Basis (2025, All Residences) - Explicit Override');
    try {
        const response3 = await axios.get(`${baseURL}/api/financial-reports/monthly-income-expenses`, {
            headers: authHeaders,
            params: {
                period: '2025',
                basis: 'accrual' // Explicitly override default
            }
        });
        
        console.log('✅ Success!');
        console.log(`📅 Period: ${response3.data.data.period}`);
        console.log(`📊 Basis: ${response3.data.data.basis}`);
        console.log(`🏠 Residence: ${response3.data.data.residence || 'All'}`);
        console.log(`💰 Annual Revenue: $${response3.data.data.annualSummary.totalAnnualRevenue.toLocaleString()}`);
        console.log(`💸 Annual Expenses: $${response3.data.data.annualSummary.totalAnnualExpenses.toLocaleString()}`);
        console.log(`📈 Annual Net Income: $${response3.data.data.annualSummary.totalAnnualNetIncome.toLocaleString()}`);
        
    } catch (error) {
        console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 4: Error case - missing period
    console.log('📊 Test 4: Error Case - Missing Period');
    try {
        const response4 = await axios.get(`${baseURL}/api/financial-reports/monthly-income-expenses`, {
            headers: authHeaders,
            params: {
                basis: 'accrual'
            }
        });
        
        console.log('❌ Should have failed but got:', response4.data);
        
    } catch (error) {
        console.log('✅ Correctly failed with error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n🎉 Testing Complete!');
}

// Run the tests
testMonthlyIncomeExpenses().catch(console.error);
