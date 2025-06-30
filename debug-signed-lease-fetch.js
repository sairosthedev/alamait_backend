const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data - REPLACE WITH ACTUAL TOKENS
const testStudentToken = 'YOUR_STUDENT_TOKEN_HERE'; // Replace with the student's token
const testAdminToken = 'YOUR_ADMIN_TOKEN_HERE'; // Replace with admin token

async function debugSignedLeaseFetch() {
  console.log('=== Debugging Signed Lease Fetch ===\n');

  try {
    // Test 1: Check if the user has the signed lease path in their record
    console.log('1. Testing student signed lease fetch...');
    try {
      const studentResponse = await axios.get(`${BASE_URL}/student/signed-leases`, {
        headers: {
          'Authorization': `Bearer ${testStudentToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Student fetch response:', JSON.stringify(studentResponse.data, null, 2));
      
      if (studentResponse.data.signedLeases && studentResponse.data.signedLeases.length > 0) {
        console.log('✅ Found signed lease in student response');
        const lease = studentResponse.data.signedLeases[0];
        console.log('   File URL:', lease.fileUrl);
        console.log('   File Name:', lease.fileName);
        console.log('   Upload Date:', lease.uploadDate);
        
        // Test if the S3 URL is accessible
        console.log('\n2. Testing S3 URL accessibility...');
        try {
          const s3Response = await axios.get(lease.fileUrl, {
            timeout: 10000,
            validateStatus: function (status) {
              return status < 500; // Accept any status less than 500
            }
          });
          console.log('✅ S3 URL is accessible, status:', s3Response.status);
          console.log('   Content-Type:', s3Response.headers['content-type']);
          console.log('   Content-Length:', s3Response.headers['content-length']);
        } catch (s3Error) {
          console.log('❌ S3 URL not accessible:', s3Error.message);
          if (s3Error.response) {
            console.log('   Status:', s3Error.response.status);
            console.log('   Headers:', s3Error.response.headers);
          }
        }
      } else {
        console.log('❌ No signed leases found in student response');
      }
      
    } catch (error) {
      console.log('❌ Student fetch error:', error.response?.data || error.message);
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Headers:', error.response.headers);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 2: Admin fetch all signed leases
    console.log('3. Testing admin all signed leases fetch...');
    try {
      const adminResponse = await axios.get(`${BASE_URL}/admin/students/all-signed-leases`, {
        headers: {
          'Authorization': `Bearer ${testAdminToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Admin fetch response:', JSON.stringify(adminResponse.data, null, 2));
      
      if (adminResponse.data.signedLeases && adminResponse.data.signedLeases.length > 0) {
        console.log('✅ Found signed leases in admin response');
        adminResponse.data.signedLeases.forEach((lease, index) => {
          console.log(`   ${index + 1}. ${lease.studentName} - ${lease.fileName}`);
          console.log(`      URL: ${lease.fileUrl}`);
        });
      } else {
        console.log('❌ No signed leases found in admin response');
      }
      
    } catch (error) {
      console.log('❌ Admin fetch error:', error.response?.data || error.message);
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Headers:', error.response.headers);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 3: Check S3 connectivity
    console.log('4. Testing S3 connectivity...');
    try {
      const s3Response = await axios.get(`${BASE_URL}/monitoring/test-s3-connection`);
      console.log('✅ S3 connectivity test:', JSON.stringify(s3Response.data, null, 2));
    } catch (error) {
      console.log('❌ S3 connectivity test failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run the debug
debugSignedLeaseFetch(); 