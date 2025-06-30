const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';

// Test data - REPLACE WITH ACTUAL TOKENS
const testStudentToken = 'YOUR_STUDENT_TOKEN_HERE';
const testAdminToken = 'YOUR_ADMIN_TOKEN_HERE';

// Create a test PDF file for upload
const createTestPDF = () => {
  const testContent = `
    This is a test signed lease agreement.
    Student: Test Student
    Date: ${new Date().toISOString()}
    This is a sample signed lease document for testing purposes.
  `;
  
  // Create a simple text file as PDF (for testing)
  const testFilePath = path.join(__dirname, 'test-signed-lease.txt');
  fs.writeFileSync(testFilePath, testContent);
  return testFilePath;
};

async function testLeaseUploadAndFetch() {
  console.log('=== Testing Lease Upload and Fetch Functionality ===\n');

  try {
    // Test 1: Upload signed lease
    console.log('1. Testing signed lease upload...');
    const testFilePath = createTestPDF();
    
    try {
      const formData = new FormData();
      formData.append('signedLease', fs.createReadStream(testFilePath), {
        filename: 'test-signed-lease.txt',
        contentType: 'text/plain'
      });

      const uploadResponse = await axios.post(`${BASE_URL}/student/lease-agreement/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${testStudentToken}`,
          ...formData.getHeaders()
        },
        timeout: 60000 // 60 second timeout
      });
      
      console.log('✅ Upload successful:', uploadResponse.data);
      
      // Store the file URL for later testing
      const uploadedFileUrl = uploadResponse.data.fileUrl;
      
      // Wait a moment for S3 to process
      console.log('Waiting 2 seconds for S3 processing...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test 2: Fetch student's own signed lease
      console.log('\n2. Testing student signed lease fetch...');
      try {
        const studentFetchResponse = await axios.get(`${BASE_URL}/student/signed-leases`, {
          headers: {
            'Authorization': `Bearer ${testStudentToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('✅ Student fetch successful:', studentFetchResponse.data);
        
        // Verify the uploaded file is in the response
        const signedLeases = studentFetchResponse.data.signedLeases;
        if (signedLeases.length > 0) {
          console.log('✅ Found uploaded lease in student fetch');
          console.log('   File URL:', signedLeases[0].fileUrl);
          console.log('   File Name:', signedLeases[0].fileName);
        } else {
          console.log('❌ No signed leases found in student fetch');
        }
        
      } catch (error) {
        console.log('❌ Student fetch error:', error.response?.data || error.message);
      }
      
      // Test 3: Admin fetch all signed leases
      console.log('\n3. Testing admin all signed leases fetch...');
      try {
        const adminFetchResponse = await axios.get(`${BASE_URL}/admin/students/all-signed-leases`, {
          headers: {
            'Authorization': `Bearer ${testAdminToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('✅ Admin fetch successful:', adminFetchResponse.data);
        
        // Verify the uploaded file is in admin response
        const allSignedLeases = adminFetchResponse.data.signedLeases;
        const foundLease = allSignedLeases.find(lease => lease.fileUrl === uploadedFileUrl);
        
        if (foundLease) {
          console.log('✅ Found uploaded lease in admin fetch');
          console.log('   Student:', foundLease.studentName);
          console.log('   File URL:', foundLease.fileUrl);
        } else {
          console.log('❌ Uploaded lease not found in admin fetch');
        }
        
      } catch (error) {
        console.log('❌ Admin fetch error:', error.response?.data || error.message);
      }
      
      // Clean up test file
      fs.unlinkSync(testFilePath);
      
    } catch (error) {
      console.log('❌ Upload error:', error.response?.data || error.message);
      
      // Clean up test file even if upload fails
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test S3 connectivity first
async function testS3Connectivity() {
  console.log('=== Testing S3 Connectivity ===\n');
  
  try {
    const response = await axios.get(`${BASE_URL}/test-s3-connection`);
    console.log('✅ S3 connectivity test:', response.data);
  } catch (error) {
    console.log('❌ S3 connectivity test failed:', error.response?.data || error.message);
  }
}

// Run tests
async function runAllTests() {
  await testS3Connectivity();
  console.log('\n' + '='.repeat(60) + '\n');
  await testLeaseUploadAndFetch();
}

runAllTests(); 