const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const ADMIN_TOKEN = 'your_admin_token_here'; // Replace with actual admin token

// Test data
const testRequestId = 'your_request_id_here'; // Replace with actual request ID
const testQuotationId = 'your_quotation_id_here'; // Replace with actual quotation ID
const testItemIndex = 0; // First item
const testQuotationIndex = 0; // First quotation

// Headers for authenticated requests
const headers = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
};

// Test 1: Update request-level quotation (JSON only)
async function updateRequestQuotationJson() {
    try {
        console.log('🔄 Testing: Update request-level quotation (JSON only)');
        
        const updateData = {
            provider: 'Updated Vendor Name',
            amount: 1500,
            description: 'Updated quotation description'
        };

        const response = await axios.put(
            `${BASE_URL}/requests/${testRequestId}/quotations/${testQuotationId}`,
            updateData,
            { headers }
        );

        console.log('✅ Success:', response.data.message);
        console.log('📄 Updated quotation:', {
            provider: response.data.request.quotations.find(q => q._id === testQuotationId)?.provider,
            amount: response.data.request.quotations.find(q => q._id === testQuotationId)?.amount,
            description: response.data.request.quotations.find(q => q._id === testQuotationId)?.description
        });
    } catch (error) {
        console.error('❌ Error updating request quotation (JSON):', error.response?.data || error.message);
    }
}

// Test 2: Update request-level quotation (with file upload)
async function updateRequestQuotationWithFile() {
    try {
        console.log('\n🔄 Testing: Update request-level quotation (with file upload)');
        
        const formData = new FormData();
        formData.append('provider', 'Updated Vendor with File');
        formData.append('amount', '2000');
        formData.append('description', 'Updated quotation with new file');
        
        // Add a test file if it exists
        const testFilePath = path.join(__dirname, 'test-quotation.pdf');
        if (fs.existsSync(testFilePath)) {
            formData.append('quotation', fs.createReadStream(testFilePath));
        } else {
            console.log('⚠️  Test file not found, skipping file upload');
        }

        const response = await axios.put(
            `${BASE_URL}/requests/${testRequestId}/quotations/${testQuotationId}`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${ADMIN_TOKEN}`
                }
            }
        );

        console.log('✅ Success:', response.data.message);
        console.log('📄 Updated quotation with file:', {
            provider: response.data.request.quotations.find(q => q._id === testQuotationId)?.provider,
            amount: response.data.request.quotations.find(q => q._id === testQuotationId)?.amount,
            fileName: response.data.request.quotations.find(q => q._id === testQuotationId)?.fileName
        });
    } catch (error) {
        console.error('❌ Error updating request quotation (with file):', error.response?.data || error.message);
    }
}

// Test 3: Update item-level quotation (JSON only)
async function updateItemQuotationJson() {
    try {
        console.log('\n🔄 Testing: Update item-level quotation (JSON only)');
        
        const updateData = {
            provider: 'Updated Item Vendor',
            amount: 750,
            description: 'Updated item quotation description'
        };

        const response = await axios.put(
            `${BASE_URL}/requests/${testRequestId}/items/${testItemIndex}/quotations/${testQuotationIndex}`,
            updateData,
            { headers }
        );

        console.log('✅ Success:', response.data.message);
        console.log('📄 Updated item quotation:', {
            provider: response.data.request.items[testItemIndex]?.quotations[testQuotationIndex]?.provider,
            amount: response.data.request.items[testItemIndex]?.quotations[testQuotationIndex]?.amount,
            description: response.data.request.items[testItemIndex]?.quotations[testQuotationIndex]?.description
        });
    } catch (error) {
        console.error('❌ Error updating item quotation (JSON):', error.response?.data || error.message);
    }
}

// Test 4: Update item-level quotation (with file upload)
async function updateItemQuotationWithFile() {
    try {
        console.log('\n🔄 Testing: Update item-level quotation (with file upload)');
        
        const formData = new FormData();
        formData.append('provider', 'Updated Item Vendor with File');
        formData.append('amount', '1200');
        formData.append('description', 'Updated item quotation with new file');
        
        // Add a test file if it exists
        const testFilePath = path.join(__dirname, 'test-quotation.pdf');
        if (fs.existsSync(testFilePath)) {
            formData.append('quotation', fs.createReadStream(testFilePath));
        } else {
            console.log('⚠️  Test file not found, skipping file upload');
        }

        const response = await axios.put(
            `${BASE_URL}/requests/${testRequestId}/items/${testItemIndex}/quotations/${testQuotationIndex}`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${ADMIN_TOKEN}`
                }
            }
        );

        console.log('✅ Success:', response.data.message);
        console.log('📄 Updated item quotation with file:', {
            provider: response.data.request.items[testItemIndex]?.quotations[testQuotationIndex]?.provider,
            amount: response.data.request.items[testItemIndex]?.quotations[testQuotationIndex]?.amount,
            fileName: response.data.request.items[testItemIndex]?.quotations[testQuotationIndex]?.fileName
        });
    } catch (error) {
        console.error('❌ Error updating item quotation (with file):', error.response?.data || error.message);
    }
}

// Test 5: Update monthly request item quotation
async function updateMonthlyRequestQuotation() {
    try {
        console.log('\n🔄 Testing: Update monthly request item quotation');
        
        const monthlyRequestId = 'your_monthly_request_id_here'; // Replace with actual monthly request ID
        
        const updateData = {
            provider: 'Updated Monthly Request Vendor',
            amount: 1800,
            description: 'Updated monthly request quotation'
        };

        const response = await axios.put(
            `${BASE_URL}/monthly-requests/${monthlyRequestId}/items/${testItemIndex}/quotations/${testQuotationIndex}`,
            updateData,
            { headers }
        );

        console.log('✅ Success:', response.data.message);
        console.log('📄 Updated monthly request quotation:', {
            provider: response.data.request.items[testItemIndex]?.quotations[testQuotationIndex]?.provider,
            amount: response.data.request.items[testItemIndex]?.quotations[testQuotationIndex]?.amount
        });
    } catch (error) {
        console.error('❌ Error updating monthly request quotation:', error.response?.data || error.message);
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Quotation Update Tests\n');
    
    await updateRequestQuotationJson();
    await updateRequestQuotationWithFile();
    await updateItemQuotationJson();
    await updateItemQuotationWithFile();
    await updateMonthlyRequestQuotation();
    
    console.log('\n✨ All tests completed!');
}

// Instructions
console.log(`
📋 QUOTATION UPDATE API TEST

This script tests the new quotation update functionality.

🔧 SETUP REQUIRED:
1. Replace 'your_admin_token_here' with an actual admin JWT token
2. Replace 'your_request_id_here' with an actual request ID
3. Replace 'your_quotation_id_here' with an actual quotation ID
4. Replace 'your_monthly_request_id_here' with an actual monthly request ID
5. Create a test PDF file named 'test-quotation.pdf' in the project root (optional)

📡 NEW ENDPOINTS:
- PUT /api/requests/:id/quotations/:quotationId - Update request-level quotation
- PUT /api/requests/:id/items/:itemIndex/quotations/:quotationIndex - Update item-level quotation
- PUT /api/monthly-requests/:id/items/:itemIndex/quotations/:quotationIndex - Update monthly request quotation

🔒 PERMISSIONS:
- Only admin users can update quotations
- Quotations can only be updated for requests in 'pending' or 'admin-approved' status
- Monthly request quotations can only be updated for requests in 'draft' or 'pending' status

📝 FEATURES:
- Update provider, amount, and description
- Upload new quotation files (replaces old files)
- Automatic unapproval of modified quotations
- Request history tracking
- S3 file management (deletes old files)

`);

// Uncomment the line below to run tests
// runAllTests();

module.exports = {
    updateRequestQuotationJson,
    updateRequestQuotationWithFile,
    updateItemQuotationJson,
    updateItemQuotationWithFile,
    updateMonthlyRequestQuotation
}; 