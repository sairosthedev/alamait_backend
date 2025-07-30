const axios = require('axios');

// Test the new CEO audit log endpoint
async function testCEOAuditLog() {
  try {
    console.log('Testing CEO audit log endpoint...');
    
    // First, we need to login as a CEO user
    const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'ceo@alamait.com', // Replace with actual CEO email
      password: 'password123'   // Replace with actual CEO password
    });
    
    const token = loginResponse.data.token;
    console.log('CEO login successful');
    
    // Test the new audit log endpoint
    const auditLogResponse = await axios.get('http://localhost:4000/api/ceo/audit-log', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('CEO audit log endpoint response:', {
      status: auditLogResponse.status,
      dataLength: auditLogResponse.data.length,
      sampleData: auditLogResponse.data.slice(0, 2)
    });
    
    // Test with filters
    const filteredResponse = await axios.get('http://localhost:4000/api/ceo/audit-log?action=create&limit=10', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('CEO audit log with filters response:', {
      status: filteredResponse.status,
      dataLength: filteredResponse.data.length,
      sampleData: filteredResponse.data.slice(0, 2)
    });
    
    console.log('✅ CEO audit log endpoint test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing CEO audit log endpoint:', error.response?.data || error.message);
  }
}

// Run the test
testCEOAuditLog(); 