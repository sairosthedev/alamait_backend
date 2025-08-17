const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_EMAIL = 'admin@alamait.com'; // Replace with your admin email
const TEST_PASSWORD = 'admin123'; // Replace with your admin password

// Test data
const testMonthlyRequest = {
    title: 'Test Monthly Request',
    description: 'Test description',
    residence: '67c13eb8425a2e078f61d00e', // Belvedere ID
    month: 1,
    year: 2025,
    items: [
        {
            itemName: 'Test Item',
            description: 'Test item description',
            quantity: 1,
            estimatedCost: 100,
            supplier: 'Test Supplier',
            paymentMethod: 'bank_transfer'
        }
    ]
};

async function login() {
    try {
        console.log('🔐 Logging in...');
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        
        const token = response.data.token;
        console.log('✅ Login successful');
        return token;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message);
        throw error;
    }
}

async function testEndpoints(token) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    console.log('\n🧪 Testing Monthly Request Endpoints...\n');

    // Test 1: Get all monthly requests
    try {
        console.log('1️⃣ Testing GET /api/monthly-requests');
        const response = await axios.get(`${BASE_URL}/monthly-requests`, { headers });
        console.log('✅ Success:', {
            count: response.data.monthlyRequests?.length || 0,
            pagination: response.data.pagination
        });
        console.log('Response structure:', Object.keys(response.data));
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }

    // Test 2: Create a monthly request
    try {
        console.log('\n2️⃣ Testing POST /api/monthly-requests');
        const response = await axios.post(`${BASE_URL}/monthly-requests`, testMonthlyRequest, { headers });
        console.log('✅ Success:', {
            id: response.data._id,
            title: response.data.title,
            status: response.data.status
        });
        
        // Store the created request ID for further tests
        const createdRequestId = response.data._id;
        
        // Test 3: Get specific monthly request
        console.log('\n3️⃣ Testing GET /api/monthly-requests/:id');
        const getResponse = await axios.get(`${BASE_URL}/monthly-requests/${createdRequestId}`, { headers });
        console.log('✅ Success:', {
            id: getResponse.data._id,
            title: getResponse.data.title
        });

        // Test 4: Update monthly request
        console.log('\n4️⃣ Testing PUT /api/monthly-requests/:id');
        const updateResponse = await axios.put(`${BASE_URL}/monthly-requests/${createdRequestId}`, {
            title: 'Updated Test Monthly Request',
            description: 'Updated description'
        }, { headers });
        console.log('✅ Success:', {
            id: updateResponse.data._id,
            title: updateResponse.data.title
        });

        // Test 5: Get by residence
        console.log('\n5️⃣ Testing GET /api/monthly-requests/residence/:residenceId/:month/:year');
        const residenceResponse = await axios.get(`${BASE_URL}/monthly-requests/residence/67c13eb8425a2e078f61d00e/1/2025`, { headers });
        console.log('✅ Success:', {
            count: residenceResponse.data.monthlyRequests?.length || 0
        });

        // Test 6: Get templates
        console.log('\n6️⃣ Testing GET /api/monthly-requests/templates/:residence');
        const templatesResponse = await axios.get(`${BASE_URL}/monthly-requests/templates/67c13eb8425a2e078f61d00e`, { headers });
        console.log('✅ Success:', {
            count: templatesResponse.data.templates?.length || 0
        });

        // Test 7: Finance dashboard (if user has finance role)
        try {
            console.log('\n7️⃣ Testing GET /api/monthly-requests/finance/dashboard');
            const financeResponse = await axios.get(`${BASE_URL}/monthly-requests/finance/dashboard`, { headers });
            console.log('✅ Success:', {
                count: financeResponse.data.monthlyRequests?.length || 0,
                summary: financeResponse.data.summary
            });
        } catch (error) {
            console.log('⚠️ Finance dashboard test skipped (user may not have finance role):', error.response?.data?.message || error.message);
        }

        // Test 8: CEO dashboard (if user has CEO role)
        try {
            console.log('\n8️⃣ Testing GET /api/monthly-requests/ceo/dashboard');
            const ceoResponse = await axios.get(`${BASE_URL}/monthly-requests/ceo/dashboard`, { headers });
            console.log('✅ Success:', {
                count: ceoResponse.data.monthlyRequests?.length || 0,
                summary: ceoResponse.data.summary
            });
        } catch (error) {
            console.log('⚠️ CEO dashboard test skipped (user may not have CEO role):', error.response?.data?.message || error.message);
        }

        // Clean up: Delete the test request
        console.log('\n9️⃣ Testing DELETE /api/monthly-requests/:id');
        await axios.delete(`${BASE_URL}/monthly-requests/${createdRequestId}`, { headers });
        console.log('✅ Test request deleted successfully');

    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }
}

async function runTests() {
    try {
        const token = await login();
        await testEndpoints(token);
        console.log('\n🎉 All tests completed!');
    } catch (error) {
        console.error('\n💥 Test suite failed:', error.message);
    }
}

// Run the tests
runTests(); 