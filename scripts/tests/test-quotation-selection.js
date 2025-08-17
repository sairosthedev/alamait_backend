const axios = require('axios');

const BASE_URL = 'https://alamait-backend.onrender.com';
const ADMIN_EMAIL = 'admin@alamait.com';
const ADMIN_PASSWORD = 'Admin@123';

let authToken = '';

// Login function
async function login() {
    try {
        console.log('🔐 Logging in as admin...');
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        
        authToken = response.data.token;
        console.log('✅ Login successful');
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message);
        return false;
    }
}

// Create a test request with multiple quotations
async function createTestRequest() {
    try {
        console.log('\n📝 Creating test request with multiple quotations...');
        
        const formData = new FormData();
        formData.append('title', 'Test Quotation Selection');
        formData.append('description', 'Testing quotation selection functionality');
        formData.append('type', 'operational');
        formData.append('residence', '67d723cf20f89c4ae69804f3');
        formData.append('department', 'Operations');
        formData.append('requestedBy', 'Test User');
        formData.append('deliveryLocation', 'Test Location');
        formData.append('priority', 'medium');
        formData.append('proposedVendor', 'Test Vendor');
        formData.append('totalEstimatedCost', '600');
        formData.append('status', 'pending');
        
        // Add item with multiple quotations
        formData.append('items[0][description]', 'Test Item 1');
        formData.append('items[0][quantity]', '1');
        formData.append('items[0][unitCost]', '200');
        formData.append('items[0][totalCost]', '200');
        formData.append('items[0][purpose]', 'Testing');
        
        // First quotation
        formData.append('items[0][quotations][0][provider]', 'Vendor A');
        formData.append('items[0][quotations][0][amount]', '200');
        formData.append('items[0][quotations][0][description]', 'Quote from Vendor A');
        formData.append('items[0][quotations][0][quotationDate]', '2025-08-02');
        formData.append('items[0][quotations][0][validUntil]', '2025-09-02');
        formData.append('items[0][quotations][0][notes]', 'First quotation');
        formData.append('items[0][quotations][0][isApproved]', 'false');
        formData.append('items[0][quotations][0][uploadedBy]', '67c023adae5e27657502e887');
        
        // Second quotation
        formData.append('items[0][quotations][1][provider]', 'Vendor B');
        formData.append('items[0][quotations][1][amount]', '180');
        formData.append('items[0][quotations][1][description]', 'Quote from Vendor B');
        formData.append('items[0][quotations][1][quotationDate]', '2025-08-02');
        formData.append('items[0][quotations][1][validUntil]', '2025-09-02');
        formData.append('items[0][quotations][1][notes]', 'Second quotation');
        formData.append('items[0][quotations][1][isApproved]', 'false');
        formData.append('items[0][quotations][1][uploadedBy]', '67c023adae5e27657502e887');
        
        // Third quotation
        formData.append('items[0][quotations][2][provider]', 'Vendor C');
        formData.append('items[0][quotations][2][amount]', '220');
        formData.append('items[0][quotations][2][description]', 'Quote from Vendor C');
        formData.append('items[0][quotations][2][quotationDate]', '2025-08-02');
        formData.append('items[0][quotations][2][validUntil]', '2025-09-02');
        formData.append('items[0][quotations][2][notes]', 'Third quotation');
        formData.append('items[0][quotations][2][isApproved]', 'false');
        formData.append('items[0][quotations][2][uploadedBy]', '67c023adae5e27657502e887');

        const response = await axios.post(`${BASE_URL}/api/requests`, formData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'multipart/form-data'
            }
        });

        console.log('✅ Test request created successfully');
        console.log('📋 Request ID:', response.data._id);
        console.log('💰 Total Estimated Cost:', response.data.totalEstimatedCost);
        
        return response.data._id;
    } catch (error) {
        console.error('❌ Failed to create test request:', error.response?.data || error.message);
        return null;
    }
}

// Select a quotation (Admin)
async function selectQuotation(requestId, itemIndex, quotationIndex, reason) {
    try {
        console.log(`\n🎯 Admin selecting quotation ${quotationIndex + 1} for item ${itemIndex + 1}...`);
        
        const response = await axios.post(
            `${BASE_URL}/api/requests/${requestId}/items/${itemIndex}/quotations/${quotationIndex}/select`,
            { reason },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Quotation selected successfully');
        console.log('📊 Selected quotation:', response.data.selectedQuotation);
        console.log('💰 Updated total cost:', response.data.request.totalEstimatedCost);
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to select quotation:', error.response?.data || error.message);
        return null;
    }
}

// Override quotation selection (Finance)
async function overrideQuotationSelection(requestId, itemIndex, quotationIndex, reason) {
    try {
        console.log(`\n🔄 Finance overriding quotation selection to quotation ${quotationIndex + 1}...`);
        
        const response = await axios.post(
            `${BASE_URL}/api/requests/${requestId}/items/${itemIndex}/quotations/${quotationIndex}/override`,
            { reason },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Quotation selection overridden successfully');
        console.log('📊 New selected quotation:', response.data.selectedQuotation);
        console.log('💰 Updated total cost:', response.data.request.totalEstimatedCost);
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to override quotation selection:', error.response?.data || error.message);
        return null;
    }
}

// Get request details
async function getRequestDetails(requestId) {
    try {
        console.log('\n📋 Getting request details...');
        
        const response = await axios.get(`${BASE_URL}/api/requests/${requestId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Request details retrieved');
        console.log('📊 Request status:', response.data.status);
        console.log('💰 Total estimated cost:', response.data.totalEstimatedCost);
        
        // Show quotation selection status
        if (response.data.items && response.data.items[0] && response.data.items[0].quotations) {
            console.log('\n📄 Quotation Selection Status:');
            response.data.items[0].quotations.forEach((quotation, index) => {
                console.log(`  Quotation ${index + 1}: ${quotation.provider} - $${quotation.amount}`);
                console.log(`    Selected: ${quotation.isSelected ? '✅ Yes' : '❌ No'}`);
                if (quotation.isSelected) {
                    console.log(`    Selected by: ${quotation.selectedByEmail}`);
                    console.log(`    Selected at: ${quotation.selectedAt}`);
                }
                if (quotation.deselectedByEmail) {
                    console.log(`    Deselected by: ${quotation.deselectedByEmail}`);
                    console.log(`    Deselected at: ${quotation.deselectedAt}`);
                }
            });
        }
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to get request details:', error.response?.data || error.message);
        return null;
    }
}

// Main test function
async function runTest() {
    console.log('🚀 Starting Quotation Selection Test\n');
    
    // Step 1: Login
    if (!await login()) {
        return;
    }
    
    // Step 2: Create test request
    const requestId = await createTestRequest();
    if (!requestId) {
        return;
    }
    
    // Step 3: Get initial request details
    await getRequestDetails(requestId);
    
    // Step 4: Admin selects first quotation
    await selectQuotation(requestId, 0, 0, 'Best value for money');
    
    // Step 5: Get request details after selection
    await getRequestDetails(requestId);
    
    // Step 6: Finance overrides to second quotation
    await overrideQuotationSelection(requestId, 0, 1, 'Lower cost option preferred');
    
    // Step 7: Get final request details
    await getRequestDetails(requestId);
    
    console.log('\n🎉 Quotation Selection Test Completed!');
}

// Run the test
runTest().catch(console.error); 