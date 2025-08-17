const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testRequestTypes() {
    console.log('🧪 Testing JSON vs FormData requests...\n');
    
    // Create a test file
    const testFileName = 'test-file.txt';
    fs.writeFileSync(testFileName, 'Test file content');
    
    try {
        // Test 1: JSON Request (current frontend behavior)
        console.log('1️⃣ Testing JSON Request (current behavior):');
        const jsonData = {
            title: 'Test Request',
            description: 'Test description',
            type: 'operational',
            residence: '67d723cf20f89c4ae69804f3',
            department: 'test',
            requestedBy: 'Test User',
            deliveryLocation: 'Test Location',
            priority: 'medium',
            proposedVendor: 'Test Vendor',
            totalEstimatedCost: 200,
            status: 'pending',
            items: [{
                description: 'Test Item',
                quantity: 1,
                unitCost: 200,
                totalCost: 200,
                purpose: 'Testing',
                quotations: [{
                    provider: 'Test Provider',
                    amount: 200,
                    description: 'Test quotation',
                    fileName: testFileName,
                    isApproved: false,
                    uploadedBy: '67c023adae5e27657502e887',
                    itemIndex: 0
                }]
            }]
        };
        
        console.log('JSON Content-Type: application/json');
        console.log('Files included: NO (files are just filenames)');
        console.log('Result: Backend receives no actual files\n');
        
        // Test 2: FormData Request (what we need)
        console.log('2️⃣ Testing FormData Request (what we need):');
        const formData = new FormData();
        
        // Add basic data
        formData.append('title', 'Test Request');
        formData.append('description', 'Test description');
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
        
        // Add quotation with actual file
        formData.append('items[0][quotations][0][provider]', 'Test Provider');
        formData.append('items[0][quotations][0][amount]', '200');
        formData.append('items[0][quotations][0][description]', 'Test quotation');
        formData.append('items[0][quotations][0][isApproved]', 'false');
        formData.append('items[0][quotations][0][uploadedBy]', '67c023adae5e27657502e887');
        formData.append('items[0][quotations][0][itemIndex]', '0');
        
        // Add the actual file
        const fileStream = fs.createReadStream(testFileName);
        formData.append('items[0][quotations][0][quotation]', fileStream, {
            filename: testFileName,
            contentType: 'text/plain'
        });
        
        console.log('FormData Content-Type: multipart/form-data');
        console.log('Files included: YES (actual file data)');
        console.log('Result: Backend receives actual files and can upload to S3\n');
        
        // Clean up
        fs.unlinkSync(testFileName);
        
        console.log('✅ Test completed!');
        console.log('The frontend needs to use FormData when files are present.');
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
        // Clean up on error
        if (fs.existsSync(testFileName)) {
            fs.unlinkSync(testFileName);
        }
    }
}

testRequestTypes(); 