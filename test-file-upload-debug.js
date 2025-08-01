const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testFileUpload() {
    try {
        console.log('🧪 Testing file upload to backend...');
        
        // Create a test file
        const testFileName = 'test-quotation.pdf';
        const testContent = 'This is a test quotation file content';
        fs.writeFileSync(testFileName, testContent);
        
        // Create FormData
        const formData = new FormData();
        
        // Add basic request data
        formData.append('title', 'Test Request with File');
        formData.append('description', 'Testing file upload functionality');
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
        
        // Add the actual file
        const fileStream = fs.createReadStream(testFileName);
        formData.append('items[0][quotations][0][quotation]', fileStream, {
            filename: testFileName,
            contentType: 'application/pdf'
        });
        
        console.log('📤 Sending request with file...');
        console.log('Fieldname used: items[0][quotations][0][quotation]');
        
        // Send request
        const response = await axios.post('http://localhost:5000/api/requests', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
            }
        });
        
        console.log('✅ Request successful!');
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
        // Check if fileUrl is present
        const request = response.data;
        if (request.items && request.items[0] && request.items[0].quotations && request.items[0].quotations[0]) {
            const quotation = request.items[0].quotations[0];
            console.log('📄 Quotation file info:');
            console.log('- fileName:', quotation.fileName);
            console.log('- fileUrl:', quotation.fileUrl);
            console.log('- uploadedAt:', quotation.uploadedAt);
            
            if (quotation.fileUrl) {
                console.log('✅ File upload successful!');
            } else {
                console.log('❌ File upload failed - no fileUrl');
            }
        }
        
        // Clean up test file
        fs.unlinkSync(testFileName);
        
    } catch (error) {
        console.error('❌ Error testing file upload:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testFileUpload(); 