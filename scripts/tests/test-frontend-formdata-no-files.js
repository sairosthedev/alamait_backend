const axios = require('axios');
const FormData = require('form-data');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_USER_EMAIL = 'admin@alamait.com';
const TEST_USER_PASSWORD = 'Admin@123';

async function testFrontendFormData() {
  try {
    console.log('🚀 Testing Frontend FormData Format...\n');

    // Step 1: Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Step 2: Create FormData (simulating frontend behavior)
    console.log('2️⃣ Creating FormData (no files)...');
    const formData = new FormData();

    // Basic request data
    formData.append('title', 'Test Request - No Files');
    formData.append('description', 'Testing FormData without files');
    formData.append('type', 'operational');
    formData.append('residence', '507f1f77bcf86cd799439011');
    formData.append('department', 'IT Department');
    formData.append('requestedBy', 'Test User');
    formData.append('deliveryLocation', 'Main Office');
    formData.append('priority', 'medium');
    formData.append('proposedVendor', 'Test Vendor');
    formData.append('totalEstimatedCost', 1000);
    formData.append('status', 'pending');

    // Add items with quotations (no files)
    formData.append('items[0][description]', 'Test Item 1');
    formData.append('items[0][quantity]', 2);
    formData.append('items[0][unitCost]', 500);
    formData.append('items[0][totalCost]', 1000);
    formData.append('items[0][purpose]', 'Testing purposes');

    // Add quotations without files
    formData.append('items[0][quotations][0][provider]', 'Test Provider 1');
    formData.append('items[0][quotations][0][amount]', 1000);
    formData.append('items[0][quotations][0][description]', 'Test quotation 1');
    formData.append('items[0][quotations][0][quotationDate]', '2024-01-15');
    formData.append('items[0][quotations][0][validUntil]', '2024-02-15');
    formData.append('items[0][quotations][0][notes]', 'Test notes');
    formData.append('items[0][quotations][0][isApproved]', false);
    formData.append('items[0][quotations][0][uploadedBy]', '507f1f77bcf86cd799439011');
    formData.append('items[0][quotations][0][itemIndex]', 0);

    console.log('✅ FormData created (no files)\n');

    // Step 3: Send request
    console.log('3️⃣ Sending request to backend...');
    console.log('📤 Request headers:');
    console.log('- Content-Type:', formData.getHeaders()['content-type']);
    console.log('- Content-Length:', formData.getHeaders()['content-length']);
    
    const response = await axios.post(`${BASE_URL}/requests`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`
      },
      timeout: 30000
    });

    console.log('✅ Request sent successfully!\n');

    // Step 4: Check response
    console.log('4️⃣ Checking response...');
    console.log('📥 Response status:', response.status);
    console.log('📥 Request created with ID:', response.data.data._id);
    console.log('📥 Request status:', response.data.data.status);

    console.log('\n🎉 Test completed successfully!');
    console.log('✅ Frontend is now correctly sending FormData even without files');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('📥 Response status:', error.response.status);
      console.error('📥 Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.request) {
      console.error('📤 Request was made but no response received');
    }
  }
}

// Run the test
testFrontendFormData(); 