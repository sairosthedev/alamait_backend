const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER_EMAIL = 'admin@example.com'; // Replace with actual admin email
const TEST_USER_PASSWORD = 'password123'; // Replace with actual password

// Test data for request creation
const testRequestData = {
    title: "Test Request with File Upload",
    description: "Testing file upload functionality for request quotations",
    type: "operational",
    department: "operations",
    requestedBy: "test-user",
    deliveryLocation: "test-location",
    priority: "medium",
    residence: "67c13eb8425a2e078f61d00e", // Replace with actual residence ID
    items: [
        {
            description: "Test Item",
            quantity: 1,
            estimatedCost: 200,
            purpose: "testing",
            quotations: [
                {
                    provider: "Test Provider",
                    amount: 150,
                    description: "Test quotation",
                    unitPrice: 150,
                    quantity: 1,
                    quotationDate: "2025-07-30",
                    validUntil: "2025-08-29",
                    notes: "Test notes"
                }
            ]
        }
    ]
};

async function login() {
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD
        });
        
        return response.data.token;
    } catch (error) {
        console.error('Login failed:', error.response?.data || error.message);
        throw error;
    }
}

async function testRequestCreationWithFile() {
    try {
        console.log('🔐 Logging in...');
        const token = await login();
        
        console.log('📝 Creating request with file upload...');
        
        // Create FormData for multipart request
        const formData = new FormData();
        
        // Add request data
        formData.append('title', testRequestData.title);
        formData.append('description', testRequestData.description);
        formData.append('type', testRequestData.type);
        formData.append('department', testRequestData.department);
        formData.append('requestedBy', testRequestData.requestedBy);
        formData.append('deliveryLocation', testRequestData.deliveryLocation);
        formData.append('priority', testRequestData.priority);
        formData.append('residence', testRequestData.residence);
        formData.append('items', JSON.stringify(testRequestData.items));
        
        // Add a test file for quotation
        const testFilePath = path.join(__dirname, 'test-quotation.pdf');
        if (fs.existsSync(testFilePath)) {
            formData.append('items[0].quotations[0].file', fs.createReadStream(testFilePath));
        } else {
            console.log('⚠️  Test file not found, creating request without file...');
        }
        
        const response = await axios.post(`${BASE_URL}/requests`, formData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                ...formData.getHeaders()
            }
        });
        
        console.log('✅ Request created successfully!');
        console.log('📋 Request ID:', response.data._id);
        console.log('📊 Request status:', response.data.status);
        
        if (response.data.items && response.data.items[0].quotations) {
            const quotation = response.data.items[0].quotations[0];
            console.log('📄 Quotation file URL:', quotation.fileUrl);
            console.log('📄 Quotation file name:', quotation.fileName);
        }
        
        return response.data;
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response?.data?.debug) {
            console.log('🔍 Debug info:', error.response.data.debug);
        }
        throw error;
    }
}

async function testRequestCreationWithoutFile() {
    try {
        console.log('🔐 Logging in...');
        const token = await login();
        
        console.log('📝 Creating request without file upload...');
        
        const response = await axios.post(`${BASE_URL}/requests`, testRequestData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Request created successfully without file!');
        console.log('📋 Request ID:', response.data._id);
        console.log('📊 Request status:', response.data.status);
        
        return response.data;
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        throw error;
    }
}

async function runTests() {
    console.log('🧪 Starting request file upload tests...\n');
    
    try {
        // Test 1: Create request without file
        console.log('=== Test 1: Request Creation Without File ===');
        await testRequestCreationWithoutFile();
        console.log('');
        
        // Test 2: Create request with file (if test file exists)
        console.log('=== Test 2: Request Creation With File ===');
        const testFilePath = path.join(__dirname, 'test-quotation.pdf');
        if (fs.existsSync(testFilePath)) {
            await testRequestCreationWithFile();
        } else {
            console.log('⚠️  Skipping file upload test - test-quotation.pdf not found');
            console.log('💡 Create a test PDF file named "test-quotation.pdf" in the project root to test file uploads');
        }
        
        console.log('\n🎉 All tests completed!');
        
    } catch (error) {
        console.error('\n💥 Test suite failed:', error.message);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = {
    testRequestCreationWithFile,
    testRequestCreationWithoutFile,
    runTests
}; 