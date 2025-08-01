const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const BASE_URL = 'https://alamait-backend.onrender.com';
const TEST_USER_EMAIL = 'admin@alamait.com';
const TEST_USER_PASSWORD = 'Admin@123';

async function testFileUpload() {
  try {
    console.log('🚀 Testing File Upload Debug...\n');

    // Step 1: Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Step 2: Create FormData with file
    console.log('2️⃣ Creating FormData with file...');
    const formData = new FormData();

    // Create a simple test file
    const testFileContent = 'This is a test PDF file content';
    const testFileName = 'test-file.pdf';
    
    // Add basic request data
    formData.append('title', 'Test File Upload Debug');
    formData.append('description', 'Testing file upload with debug');
    formData.append('type', 'operational');
    formData.append('residence', '67d723cf20f89c4ae69804f3');
    formData.append('department', 'IT Department');
    formData.append('requestedBy', 'Test User');
    formData.append('deliveryLocation', 'Main Office');
    formData.append('priority', 'medium');
    formData.append('proposedVendor', 'Test Vendor');
    formData.append('totalEstimatedCost', 1000);
    formData.append('status', 'pending');

    // Add items with quotations
    formData.append('items[0][description]', 'Test Item with File');
    formData.append('items[0][quantity]', 1);
    formData.append('items[0][unitCost]', 1000);
    formData.append('items[0][totalCost]', 1000);
    formData.append('items[0][purpose]', 'Testing file upload');

    // Add quotation with file
    formData.append('items[0][quotations][0][provider]', 'Test Provider');
    formData.append('items[0][quotations][0][amount]', 1000);
    formData.append('items[0][quotations][0][description]', 'Test quotation with file');
    formData.append('items[0][quotations][0][quotationDate]', '2024-01-15');
    formData.append('items[0][quotations][0][validUntil]', '2024-02-15');
    formData.append('items[0][quotations][0][notes]', 'Test notes');
    formData.append('items[0][quotations][0][isApproved]', false);
    formData.append('items[0][quotations][0][uploadedBy]', '67c023adae5e27657502e887');
    formData.append('items[0][quotations][0][itemIndex]', 0);

    // Add the file with the exact fieldname from the logs
    formData.append('items[0][quotations][0][quotation]', Buffer.from(testFileContent), {
      filename: testFileName,
      contentType: 'application/pdf'
    });

    console.log('✅ FormData created with file\n');

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
    
    // Check if file was uploaded
    const quotation = response.data.data.items[0].quotations[0];
    console.log('📥 Quotation fileUrl:', quotation.fileUrl);
    console.log('📥 Quotation fileName:', quotation.fileName);

    if (quotation.fileUrl) {
      console.log('✅ File upload successful!');
    } else {
      console.log('❌ File upload failed - no fileUrl');
    }

    console.log('\n🎉 Test completed!');

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
testFileUpload(); 