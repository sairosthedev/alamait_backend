const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

async function testEndpoints() {
    console.log('🧪 Testing Rental Accrual API Endpoints...');
    console.log('==========================================');
    console.log('');

    try {
        // Test 1: Outstanding Balances
        console.log('1️⃣ Testing GET /api/rental-accrual/outstanding-balances');
        try {
            const response = await axios.get(`${API_BASE_URL}/rental-accrual/outstanding-balances`);
            console.log('   ✅ Success!');
            console.log('   📊 Data:', {
                totalOutstanding: response.data.data?.summary?.totalOutstanding,
                totalStudents: response.data.data?.summary?.totalStudents,
                overdueStudents: response.data.data?.summary?.overdueStudents
            });
        } catch (error) {
            console.log('   ❌ Failed:', error.response?.data?.message || error.message);
        }
        console.log('');

        // Test 2: Yearly Summary
        console.log('2️⃣ Testing GET /api/rental-accrual/yearly-summary?year=2025');
        try {
            const response = await axios.get(`${API_BASE_URL}/rental-accrual/yearly-summary?year=2025`);
            console.log('   ✅ Success!');
            console.log('   📊 Data:', {
                year: response.data.data?.year,
                totalAmountAccrued: response.data.data?.totalAmountAccrued,
                totalStudents: response.data.data?.totalStudents
            });
        } catch (error) {
            console.log('   ❌ Failed:', error.response?.data?.message || error.message);
        }
        console.log('');

        // Test 3: Financial Reports - Income Statement
        console.log('3️⃣ Testing GET /api/financial-reports/income-statement?period=2025&basis=accrual');
        try {
            const response = await axios.get(`${API_BASE_URL}/financial-reports/income-statement?period=2025&basis=accrual`);
            console.log('   ✅ Success!');
            console.log('   📊 Data:', {
                period: response.data.data?.period,
                basis: response.data.data?.basis,
                revenue: response.data.data?.revenue
            });
        } catch (error) {
            console.log('   ❌ Failed:', error.response?.data?.message || error.message);
        }
        console.log('');

        // Test 4: Monthly Income Statement
        console.log('4️⃣ Testing GET /api/financial-reports/monthly-income-statement?period=2025&basis=accrual');
        try {
            const response = await axios.get(`${API_BASE_URL}/financial-reports/monthly-income-statement?period=2025&basis=accrual`);
            console.log('   ✅ Success!');
            console.log('   📊 Data:', {
                period: response.data.data?.period,
                basis: response.data.data?.basis,
                monthlyCount: response.data.data?.monthlyBreakdown?.length
            });
        } catch (error) {
            console.log('   ❌ Failed:', error.response?.data?.message || error.message);
        }
        console.log('');

        // Test 5: Create Monthly Accruals (POST)
        console.log('5️⃣ Testing POST /api/rental-accrual/create-monthly');
        console.log('   ⚠️ This will create actual accruals - testing with current month');
        try {
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            
            const response = await axios.post(`${API_BASE_URL}/rental-accrual/create-monthly`, {
                month: currentMonth,
                year: currentYear
            });
            console.log('   ✅ Success!');
            console.log('   📊 Data:', {
                accrualsCreated: response.data.data?.accrualsCreated,
                month: response.data.data?.month,
                year: response.data.data?.year
            });
        } catch (error) {
            console.log('   ❌ Failed:', error.response?.data?.message || error.message);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the tests
testEndpoints();
