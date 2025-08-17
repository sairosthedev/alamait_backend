const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test data
const testResidenceId = '507f1f77bcf86cd799439011'; // Example MongoDB ObjectId
const testUserId = '507f1f77bcf86cd799439012'; // Example MongoDB ObjectId

// Test Other Income endpoints
async function testOtherIncomeEndpoints() {
    console.log('🧪 Testing Other Income Endpoints...\n');

    try {
        // Test 1: Get all other income entries
        console.log('1. Testing GET /api/finance/other-income');
        try {
            const response = await axios.get(`${BASE_URL}/finance/other-income`);
            console.log('✅ Success:', response.status, response.data.message || 'Data retrieved');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 2: Get other income summary
        console.log('\n2. Testing GET /api/finance/other-income/summary/stats');
        try {
            const response = await axios.get(`${BASE_URL}/finance/other-income/summary/stats`);
            console.log('✅ Success:', response.status, 'Summary retrieved');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 3: Create new other income entry
        console.log('\n3. Testing POST /api/finance/other-income');
        const newOtherIncome = {
            residence: testResidenceId,
            category: 'Investment',
            amount: 5000,
            description: 'Test investment income',
            incomeDate: new Date().toISOString(),
            paymentStatus: 'Pending'
        };

        try {
            const response = await axios.post(`${BASE_URL}/finance/other-income`, newOtherIncome);
            console.log('✅ Success:', response.status, response.data.message);
            const createdId = response.data.otherIncome._id;
            
            // Test 4: Get specific other income entry
            console.log('\n4. Testing GET /api/finance/other-income/:id');
            try {
                const getResponse = await axios.get(`${BASE_URL}/finance/other-income/${createdId}`);
                console.log('✅ Success:', getResponse.status, 'Entry retrieved');
            } catch (error) {
                console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            }

            // Test 5: Update other income entry
            console.log('\n5. Testing PUT /api/finance/other-income/:id');
            const updateData = {
                amount: 6000,
                description: 'Updated test investment income'
            };

            try {
                const updateResponse = await axios.put(`${BASE_URL}/finance/other-income/${createdId}`, updateData);
                console.log('✅ Success:', updateResponse.status, updateResponse.data.message);
            } catch (error) {
                console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            }

            // Test 6: Delete other income entry
            console.log('\n6. Testing DELETE /api/finance/other-income/:id');
            try {
                const deleteResponse = await axios.delete(`${BASE_URL}/finance/other-income/${createdId}`);
                console.log('✅ Success:', deleteResponse.status, deleteResponse.data.message);
            } catch (error) {
                console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            }

        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

// Test Other Expense endpoints
async function testOtherExpenseEndpoints() {
    console.log('\n🧪 Testing Other Expense Endpoints...\n');

    try {
        // Test 1: Get all other expense entries
        console.log('1. Testing GET /api/finance/other-expenses');
        try {
            const response = await axios.get(`${BASE_URL}/finance/other-expenses`);
            console.log('✅ Success:', response.status, response.data.message || 'Data retrieved');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 2: Get other expense summary
        console.log('\n2. Testing GET /api/finance/other-expenses/summary/stats');
        try {
            const response = await axios.get(`${BASE_URL}/finance/other-expenses/summary/stats`);
            console.log('✅ Success:', response.status, 'Summary retrieved');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 3: Create new other expense entry
        console.log('\n3. Testing POST /api/finance/other-expenses');
        const newOtherExpense = {
            residence: testResidenceId,
            category: 'Office Supplies',
            amount: 250,
            description: 'Test office supplies expense',
            expenseDate: new Date().toISOString(),
            paymentStatus: 'Pending'
        };

        try {
            const response = await axios.post(`${BASE_URL}/finance/other-expenses`, newOtherExpense);
            console.log('✅ Success:', response.status, response.data.message);
            const createdId = response.data.otherExpense._id;
            
            // Test 4: Get specific other expense entry
            console.log('\n4. Testing GET /api/finance/other-expenses/:id');
            try {
                const getResponse = await axios.get(`${BASE_URL}/finance/other-expenses/${createdId}`);
                console.log('✅ Success:', getResponse.status, 'Entry retrieved');
            } catch (error) {
                console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            }

            // Test 5: Update other expense entry
            console.log('\n5. Testing PUT /api/finance/other-expenses/:id');
            const updateData = {
                amount: 300,
                description: 'Updated test office supplies expense'
            };

            try {
                const updateResponse = await axios.put(`${BASE_URL}/finance/other-expenses/${createdId}`, updateData);
                console.log('✅ Success:', updateResponse.status, updateResponse.data.message);
            } catch (error) {
                console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            }

            // Test 6: Delete other expense entry
            console.log('\n6. Testing DELETE /api/finance/other-expenses/:id');
            try {
                const deleteResponse = await axios.delete(`${BASE_URL}/finance/other-expenses/${createdId}`);
                console.log('✅ Success:', deleteResponse.status, deleteResponse.data.message);
            } catch (error) {
                console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            }

        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

// Run tests
async function runTests() {
    console.log('🚀 Starting Other Income and Other Expense Endpoint Tests...\n');
    
    await testOtherIncomeEndpoints();
    await testOtherExpenseEndpoints();
    
    console.log('\n✨ Test completed!');
}

// Run the tests
runTests().catch(console.error); 