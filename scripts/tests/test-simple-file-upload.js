const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testSimpleFileUpload() {
  try {
    console.log('🚀 Testing Simple File Upload...\n');

    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@alamait.com',
      password: 'Admin@123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Step 2: Create test file
    const testFilePath = 'test-file.txt';
    fs.writeFileSync(testFilePath, 'This is a test file content');

    // Step 3: Create FormData
    console.log('2️⃣ Creating FormData...');
    const formData = new FormData();

    // Basic request data
    formData.append('title', 'Simple Test Request');
    formData.append('description', 'Testing file upload');
    formData.append('type', 'operational');
    formData.append('residence', '67d723cf20f89c4ae69804f3'); // Use the residence ID from your debug output
    formData.append('department', 'Test');
    formData.append('requestedBy', 'Test User');
    formData.append('deliveryLocation', 'Test Location');
    formData.append('priority', 'medium');
    formData.append('proposedVendor', 'Test Vendor');
    formData.append('totalEstimatedCost', '200');
    formData.append('status', 'pending');

    // Add one item with one quotation and file
    formData.append('items[0][description]', 'Test Item');
    formData.append('items[0][quantity]', '1');
    formData.append('items[0][unitCost]', '200');
    formData.append('items[0][totalCost]', '200');
    formData.append('items[0][purpose]', 'Testing');

    // Add quotation with file
    formData.append('items[0][quotations][0][provider]', 'Test Provider');
    formData.append('items[0][quotations][0][amount]', '200');
    formData.append('items[0][quotations][0][description]', 'Test quotation');
    formData.append('items[0][quotations][0][quotationDate]', '2025-08-01');
    formData.append('items[0][quotations][0][validUntil]', '2025-12-31');
    formData.append('items[0][quotations][0][notes]', 'Test notes');
    formData.append('items[0][quotations][0][isApproved]', 'false');
    formData.append('items[0][quotations][0][uploadedBy]', '67c023adae5e27657502e887');
    formData.append('items[0][quotations][0][itemIndex]', '0');

    // Add the file
    console.log('📎 Adding file to FormData...');
    formData.append('items[0][quotations][0][quotation]', fs.createReadStream(testFilePath));
    formData.append('items[0][quotations][0][fileName]', 'test-file.txt');

    console.log('✅ FormData created\n');

    // Step 4: Send request
    console.log('3️⃣ Sending request...');
    console.log('Content-Type:', formData.getHeaders()['content-type']);
    
    const response = await axios.post('http://localhost:5000/api/requests', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`
      },
      timeout: 30000
    });

    console.log('✅ Request successful!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    // Check for fileUrl
    if (response.data && response.data.items && response.data.items[0] && 
        response.data.items[0].quotations && response.data.items[0].quotations[0]) {
      const quotation = response.data.items[0].quotations[0];
      console.log('\n📄 File Upload Result:');
      console.log('- File Name:', quotation.fileName);
      console.log('- File URL:', quotation.fileUrl);
      
      if (quotation.fileUrl) {
        console.log('✅ File uploaded successfully to S3!');
      } else {
        console.log('❌ No file URL found');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    // Clean up
    if (fs.existsSync('test-file.txt')) {
      fs.unlinkSync('test-file.txt');
    }
  }
}

testSimpleFileUpload(); 