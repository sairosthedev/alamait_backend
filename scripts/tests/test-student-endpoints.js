const axios = require('axios');

const BASE_URL = 'https://alamait-backend.onrender.com';

async function testStudentEndpoints() {
    console.log('Testing student endpoints...\n');

    try {
        // Test 1: Get all students (admin)
        console.log('1. Testing GET /api/admin/students...');
        const studentsResponse = await axios.get(`${BASE_URL}/api/admin/students`, {
            headers: {
                'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE',
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Students response status:', studentsResponse.status);
        console.log('✅ Students count:', studentsResponse.data.students?.length || 0);
        
        if (studentsResponse.data.students && studentsResponse.data.students.length > 0) {
            const firstStudent = studentsResponse.data.students[0];
            console.log('✅ First student ID:', firstStudent._id);
            
            // Test 2: Get student payments
            console.log('\n2. Testing GET /api/admin/students/:studentId/payments...');
            const paymentsResponse = await axios.get(`${BASE_URL}/api/admin/students/${firstStudent._id}/payments`, {
                headers: {
                    'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE',
                    'Content-Type': 'application/json'
                }
            });
            console.log('✅ Payments response status:', paymentsResponse.status);
            console.log('✅ Payments data:', paymentsResponse.data);
            
            // Test 3: Get student leases
            console.log('\n3. Testing GET /api/admin/students/:studentId/leases...');
            const leasesResponse = await axios.get(`${BASE_URL}/api/admin/students/${firstStudent._id}/leases`, {
                headers: {
                    'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE',
                    'Content-Type': 'application/json'
                }
            });
            console.log('✅ Leases response status:', leasesResponse.status);
            console.log('✅ Leases data:', leasesResponse.data);
            
            // Test 4: Finance endpoints
            console.log('\n4. Testing GET /api/finance/students/:studentId/payments...');
            const financePaymentsResponse = await axios.get(`${BASE_URL}/api/finance/students/${firstStudent._id}/payments`, {
                headers: {
                    'Authorization': 'Bearer YOUR_FINANCE_TOKEN_HERE',
                    'Content-Type': 'application/json'
                }
            });
            console.log('✅ Finance payments response status:', financePaymentsResponse.status);
            console.log('✅ Finance payments data:', financePaymentsResponse.data);
            
            // Test 5: Finance leases
            console.log('\n5. Testing GET /api/finance/students/:studentId/leases...');
            const financeLeasesResponse = await axios.get(`${BASE_URL}/api/finance/students/${firstStudent._id}/leases`, {
                headers: {
                    'Authorization': 'Bearer YOUR_FINANCE_TOKEN_HERE',
                    'Content-Type': 'application/json'
                }
            });
            console.log('✅ Finance leases response status:', financeLeasesResponse.status);
            console.log('✅ Finance leases data:', financeLeasesResponse.data);
            
        } else {
            console.log('❌ No students found to test with');
        }
        
    } catch (error) {
        console.error('❌ Error testing endpoints:', error.response?.data || error.message);
        console.error('❌ Status:', error.response?.status);
        console.error('❌ URL:', error.config?.url);
    }
}

// Test with a specific student ID that was failing
async function testSpecificStudent() {
    console.log('\n\nTesting specific student ID that was failing...\n');
    
    const failingStudentId = '6867ae194067615f779101d2';
    
    try {
        console.log('Testing GET /api/admin/students/:studentId/payments for ID:', failingStudentId);
        const response = await axios.get(`${BASE_URL}/api/admin/students/${failingStudentId}/payments`, {
            headers: {
                'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE',
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Response status:', response.status);
        console.log('✅ Response data:', response.data);
    } catch (error) {
        console.error('❌ Error with specific student:', error.response?.data || error.message);
        console.error('❌ Status:', error.response?.status);
    }
}

// Run tests
testStudentEndpoints().then(() => {
    return testSpecificStudent();
}).catch(console.error); 