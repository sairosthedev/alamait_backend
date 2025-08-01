const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_USER_EMAIL = 'admin@alamait.com';
const TEST_USER_PASSWORD = 'Admin@123';

// Create test file
const testFilePath = path.join(__dirname, 'test-quotation.pdf');
fs.writeFileSync(testFilePath, 'This is a test quotation file');

async function testEnhancedRequestSystem() {
  try {
    console.log('🚀 Testing Enhanced Request System with File Upload...\n');

    // Step 1: Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Step 2: Create FormData with files
    console.log('2️⃣ Creating FormData with files...');
    const formData = new FormData();

    // Basic request data
    formData.append('title', 'Test Enhanced Request with Files');
    formData.append('description', 'Testing file upload functionality');
    formData.append('type', 'operational');
    formData.append('residence', '507f1f77bcf86cd799439011'); // Use a valid residence ID
    formData.append('department', 'IT Department');
    formData.append('requestedBy', 'Test User');
    formData.append('deliveryLocation', 'Main Office');
    formData.append('priority', 'medium');
    formData.append('proposedVendor', 'Test Vendor');
    formData.append('totalEstimatedCost', 1500);
    formData.append('status', 'pending');

    // Add items with quotations and files
    formData.append('items[0][description]', 'Test Item 1');
    formData.append('items[0][quantity]', 2);
    formData.append('items[0][unitCost]', 500);
    formData.append('items[0][totalCost]', 1000);
    formData.append('items[0][purpose]', 'Testing purposes');

    // Add quotations with files
    formData.append('items[0][quotations][0][provider]', 'Test Provider 1');
    formData.append('items[0][quotations][0][amount]', 1000);
    formData.append('items[0][quotations][0][description]', 'Test quotation 1');
    formData.append('items[0][quotations][0][quotationDate]', '2024-01-15');
    formData.append('items[0][quotations][0][validUntil]', '2024-02-15');
    formData.append('items[0][quotations][0][notes]', 'Test notes');
    formData.append('items[0][quotations][0][isApproved]', false);
    formData.append('items[0][quotations][0][uploadedBy]', '507f1f77bcf86cd799439011');
    formData.append('items[0][quotations][0][itemIndex]', 0);

    // Add the file - THIS IS THE KEY PART
    console.log('📎 Adding file to FormData...');
    formData.append('items[0][quotations][0][quotation]', fs.createReadStream(testFilePath));
    formData.append('items[0][quotations][0][fileName]', 'test-quotation.pdf');

    // Add second quotation without file
    formData.append('items[0][quotations][1][provider]', 'Test Provider 2');
    formData.append('items[0][quotations][1][amount]', 1200);
    formData.append('items[0][quotations][1][description]', 'Test quotation 2');
    formData.append('items[0][quotations][1][quotationDate]', '2024-01-16');
    formData.append('items[0][quotations][1][validUntil]', '2024-02-16');
    formData.append('items[0][quotations][1][notes]', 'Test notes 2');
    formData.append('items[0][quotations][1][isApproved]', false);
    formData.append('items[0][quotations][1][uploadedBy]', '507f1f77bcf86cd799439011');
    formData.append('items[0][quotations][1][itemIndex]', 0);

    // Add second item
    formData.append('items[1][description]', 'Test Item 2');
    formData.append('items[1][quantity]', 1);
    formData.append('items[1][unitCost]', 500);
    formData.append('items[1][totalCost]', 500);
    formData.append('items[1][purpose]', 'Testing purposes 2');

    // Add quotation with file for second item
    formData.append('items[1][quotations][0][provider]', 'Test Provider 3');
    formData.append('items[1][quotations][0][amount]', 500);
    formData.append('items[1][quotations][0][description]', 'Test quotation 3');
    formData.append('items[1][quotations][0][quotationDate]', '2024-01-17');
    formData.append('items[1][quotations][0][validUntil]', '2024-02-17');
    formData.append('items[1][quotations][0][notes]', 'Test notes 3');
    formData.append('items[1][quotations][0][isApproved]', false);
    formData.append('items[1][quotations][0][uploadedBy]', '507f1f77bcf86cd799439011');
    formData.append('items[1][quotations][0][itemIndex]', 1);

    // Add file for second item
    console.log('📎 Adding second file to FormData...');
    formData.append('items[1][quotations][0][quotation]', fs.createReadStream(testFilePath));
    formData.append('items[1][quotations][0][fileName]', 'test-quotation-2.pdf');

    console.log('✅ FormData created with files\n');

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
    console.log('📥 Response data:', JSON.stringify(response.data, null, 2));

    // Step 5: Verify file uploads
    if (response.data.success && response.data.data) {
      const request = response.data.data;
      console.log('\n5️⃣ Verifying file uploads...');
      
      if (request.items && Array.isArray(request.items)) {
        request.items.forEach((item, itemIndex) => {
          console.log(`\n📦 Item ${itemIndex + 1}: ${item.description}`);
          
          if (item.quotations && Array.isArray(item.quotations)) {
            item.quotations.forEach((quotation, quotationIndex) => {
              console.log(`  📄 Quotation ${quotationIndex + 1}: ${quotation.provider}`);
              console.log(`    💰 Amount: $${quotation.amount}`);
              console.log(`    📁 File URL: ${quotation.fileUrl || 'No file uploaded'}`);
              console.log(`    📄 File Name: ${quotation.fileName || 'No file name'}`);
              
              if (quotation.fileUrl) {
                console.log(`    ✅ File uploaded successfully to S3!`);
              } else {
                console.log(`    ❌ No file URL found - upload may have failed`);
              }
            });
          }
        });
      }
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('📥 Response status:', error.response.status);
      console.error('📥 Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.request) {
      console.error('📤 Request was made but no response received');
    }
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}

// Run the test
testEnhancedRequestSystem(); 