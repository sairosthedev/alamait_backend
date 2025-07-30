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

        // Test 1: Upload quotation using FormData (file upload)
        console.log('1. Testing quotation upload with FormData...');
        
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
            
            console.log('✅ FormData quotation upload successful:', uploadResponse.data);
        } catch (error) {
            console.log('❌ FormData quotation upload failed:', error.response?.data || error.message);
        }

        // Test 2: Upload quotation using JSON (file URL)
        console.log('\n2. Testing quotation upload with JSON (file URL)...');
        
        const jsonData = {
            provider: 'Test JSON Provider',
            amount: '200',
            description: 'Test JSON quotation description',
            validUntil: '2025-08-29',
            terms: 'Test JSON terms and conditions',
            fileUrl: 'https://example.com/test-file.pdf',
            fileName: 'test-file.pdf'
        };

        try {
            const jsonUploadResponse = await axios.post(
                `${BASE_URL}/requests/test-request-id/quotations`, 
                jsonData, 
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            
            console.log('✅ JSON quotation upload successful:', jsonUploadResponse.data);
        } catch (error) {
            console.log('❌ JSON quotation upload failed:', error.response?.data || error.message);
        }

        // Test 3: Add item quotation using FormData
        console.log('\n3. Testing item quotation upload with FormData...');
        
        const itemFormData = new FormData();
        itemFormData.append('quotation', fs.createReadStream(testFilePath), {
            filename: 'test-item-quotation.txt',
            contentType: 'text/plain'
        });
        itemFormData.append('provider', 'Test Item Provider');
        itemFormData.append('amount', '250');
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
            
            console.log('✅ FormData item quotation upload successful:', itemUploadResponse.data);
        } catch (error) {
            console.log('❌ FormData item quotation upload failed:', error.response?.data || error.message);
        }

        // Test 4: Add item quotation using JSON
        console.log('\n4. Testing item quotation upload with JSON...');
        
        const itemJsonData = {
            provider: 'Test Item JSON Provider',
            amount: '300',
            description: 'Test item JSON quotation description',
            fileUrl: 'https://example.com/test-item-file.pdf',
            fileName: 'test-item-file.pdf'
        };

        try {
            const itemJsonUploadResponse = await axios.post(
                `${BASE_URL}/requests/test-request-id/items/0/quotations`, 
                itemJsonData, 
                {
                    headers: {
                        'Authorization': `Bearer ${ADMIN_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            
            console.log('✅ JSON item quotation upload successful:', itemJsonUploadResponse.data);
        } catch (error) {
            console.log('❌ JSON item quotation upload failed:', error.response?.data || error.message);
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