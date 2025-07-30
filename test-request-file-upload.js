const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api';
const ADMIN_TOKEN = 'your-admin-token-here'; // Replace with actual admin token

async function testRequestFileUpload() {
    console.log('=== Testing Request File Upload ===\n');

    try {
        // Create a test file
        const testFilePath = path.join(__dirname, 'test-quotation.txt');
        const testContent = 'This is a test quotation file for testing file upload functionality.';
        fs.writeFileSync(testFilePath, testContent);

        // Test 1: Upload quotation to a request
        console.log('1. Testing quotation upload...');
        
        const formData = new FormData();
        formData.append('quotation', fs.createReadStream(testFilePath), {
            filename: 'test-quotation.txt',
            contentType: 'text/plain'
        });
        formData.append('provider', 'Test Provider');
        formData.append('amount', '150');
        formData.append('description', 'Test quotation description');
        formData.append('validUntil', '2025-08-29');
        formData.append('terms', 'Test terms and conditions');

        try {
            const uploadResponse = await axios.post(
                `${BASE_URL}/requests/test-request-id/quotations`, 
                formData, 
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_TOKEN}`,
                        ...formData.getHeaders()
                    },
                    timeout: 30000
                }
            );
            
            console.log('✅ Quotation upload successful:', uploadResponse.data);
        } catch (error) {
            console.log('❌ Quotation upload failed:', error.response?.data || error.message);
        }

        // Test 2: Add item quotation
        console.log('\n2. Testing item quotation upload...');
        
        const itemFormData = new FormData();
        itemFormData.append('quotation', fs.createReadStream(testFilePath), {
            filename: 'test-item-quotation.txt',
            contentType: 'text/plain'
        });
        itemFormData.append('provider', 'Test Item Provider');
        itemFormData.append('amount', '200');
        itemFormData.append('description', 'Test item quotation description');

        try {
            const itemUploadResponse = await axios.post(
                `${BASE_URL}/requests/test-request-id/items/0/quotations`, 
                itemFormData, 
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_TOKEN}`,
                        ...itemFormData.getHeaders()
                    },
                    timeout: 30000
                }
            );
            
            console.log('✅ Item quotation upload successful:', itemUploadResponse.data);
        } catch (error) {
            console.log('❌ Item quotation upload failed:', error.response?.data || error.message);
        }

        // Clean up test file
        fs.unlinkSync(testFilePath);
        console.log('\n✅ Test completed');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testRequestFileUpload(); 