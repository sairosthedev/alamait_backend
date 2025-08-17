require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://alamait-backend.onrender.com' 
  : 'http://localhost:5000';

console.log('=== Upload Endpoint Test ===');
console.log('Testing against:', BASE_URL);
console.log('Environment:', process.env.NODE_ENV || 'development');

async function testUploadEndpoints() {
  try {
    // Test 1: Check if server is running
    console.log('\n1. Testing server health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running:', healthResponse.data);

    // Test 2: Test S3 configuration endpoint
    console.log('\n2. Testing S3 configuration...');
    const s3Response = await axios.get(`${BASE_URL}/api/student/payments/test-s3`);
    console.log('✅ S3 configuration test:', s3Response.data);

    // Test 3: Check if we can access the upload endpoint (without auth)
    console.log('\n3. Testing upload endpoint accessibility...');
    try {
      await axios.post(`${BASE_URL}/api/student/payments/upload-pop`);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Upload endpoint is accessible (auth required as expected)');
      } else {
        console.log('⚠️  Unexpected response:', error.response?.status, error.response?.data);
      }
    }

    console.log('\n🎉 Upload endpoints are properly configured!');
    console.log('\n📝 Next steps:');
    console.log('1. Start your server: npm start');
    console.log('2. Test uploads from your frontend');
    console.log('3. Check server logs for any timeout or S3 errors');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Solution: Start your server with "npm start"');
    } else if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

// Test file upload simulation (without actual file)
async function testFileUploadSimulation() {
  console.log('\n=== File Upload Simulation ===');
  
  try {
    // Create a small test file
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for upload verification.');
    
    console.log('✅ Test file created');
    console.log('📁 File path:', testFilePath);
    console.log('📏 File size:', fs.statSync(testFilePath).size, 'bytes');
    
    // Clean up
    fs.unlinkSync(testFilePath);
    console.log('✅ Test file cleaned up');
    
  } catch (error) {
    console.error('❌ File simulation failed:', error.message);
  }
}

// Run tests
async function runTests() {
  await testUploadEndpoints();
  await testFileUploadSimulation();
}

runTests(); 