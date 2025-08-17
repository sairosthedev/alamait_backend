const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testValidFileType() {
  try {
    console.log('🚀 Testing Valid File Type Upload...\n');

    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@alamait.com',
      password: 'Admin@123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Step 2: Create test PDF file
    const testFilePath = 'test-quotation.pdf';
    // Create a simple PDF-like content (for testing)
    const pdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test Quotation) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n297\n%%EOF';
    fs.writeFileSync(testFilePath, pdfContent);

    // Step 3: Create FormData
    console.log('2️⃣ Creating FormData with PDF file...');
    const formData = new FormData();

    // Basic request data
    formData.append('title', 'Test Request with PDF');
    formData.append('description', 'Testing PDF file upload');
    formData.append('type', 'operational');
    formData.append('residence', '67d723cf20f89c4ae69804f3');
    formData.append('department', 'test');
    formData.append('requestedBy', 'Test User');
    formData.append('deliveryLocation', 'Test Location');
    formData.append('priority', 'medium');
    formData.append('proposedVendor', 'Test Vendor');
    formData.append('totalEstimatedCost', '200');
    formData.append('status', 'pending');

    // Add items
    formData.append('items[0][description]', 'Test Item');
    formData.append('items[0][quantity]', '1');
    formData.append('items[0][unitCost]', '200');
    formData.append('items[0][totalCost]', '200');
    formData.append('items[0][purpose]', 'Testing');

    // Add quotation with PDF file
    formData.append('items[0][quotations][0][provider]', 'Test Provider');
    formData.append('items[0][quotations][0][amount]', '200');
    formData.append('items[0][quotations][0][description]', 'Test quotation');
    formData.append('items[0][quotations][0][quotationDate]', '2025-08-01');
    formData.append('items[0][quotations][0][validUntil]', '2025-12-31');
    formData.append('items[0][quotations][0][notes]', 'Test notes');
    formData.append('items[0][quotations][0][isApproved]', 'false');
    formData.append('items[0][quotations][0][uploadedBy]', '67c023adae5e27657502e887');
    formData.append('items[0][quotations][0][itemIndex]', '0');

    // Add the PDF file
    console.log('📎 Adding PDF file to FormData...');
    formData.append('items[0][quotations][0][quotation]', fs.createReadStream(testFilePath), {
      filename: 'test-quotation.pdf',
      contentType: 'application/pdf'
    });
    formData.append('items[0][quotations][0][fileName]', 'test-quotation.pdf');

    console.log('✅ FormData created with PDF\n');

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
    if (fs.existsSync('test-quotation.pdf')) {
      fs.unlinkSync('test-quotation.pdf');
    }
  }
}

testValidFileType(); 