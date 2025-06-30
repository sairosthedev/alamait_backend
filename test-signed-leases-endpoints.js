const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testStudentToken = 'YOUR_STUDENT_TOKEN_HERE'; // Replace with actual student token
const testAdminToken = 'YOUR_ADMIN_TOKEN_HERE'; // Replace with actual admin token

async function testSignedLeaseEndpoints() {
  console.log('=== Testing Signed Lease Endpoints ===\n');

  try {
    // Test 1: Student getting their own signed leases
    console.log('1. Testing student signed leases endpoint...');
    try {
      const studentResponse = await axios.get(`${BASE_URL}/student/signed-leases`, {
        headers: {
          'Authorization': `Bearer ${testStudentToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Student signed leases response:', studentResponse.data);
    } catch (error) {
      console.log('❌ Student signed leases error:', error.response?.data || error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: Admin getting all signed leases
    console.log('2. Testing admin all signed leases endpoint...');
    try {
      const adminResponse = await axios.get(`${BASE_URL}/admin/students/all-signed-leases`, {
        headers: {
          'Authorization': `Bearer ${testAdminToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Admin all signed leases response:', adminResponse.data);
    } catch (error) {
      console.log('❌ Admin all signed leases error:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSignedLeaseEndpoints(); 