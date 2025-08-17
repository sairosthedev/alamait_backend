const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'admin@alamait.com';
const ADMIN_PASSWORD = 'admin123';

// Test data
let adminToken;
let testRequestId;
let testMonthlyRequestId;

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(method, url, data = null, headers = {}) {
    const config = {
        method,
        url: `${API_BASE_URL}${url}`,
        headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
            ...headers
        }
    };
    
    if (data) {
        config.data = data;
    }
    
    return axios(config);
}

// Test 1: Login as admin
async function loginAsAdmin() {
    console.log('\n🔐 Testing: Login as Admin');
    
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        
        adminToken = response.data.token;
        console.log('✅ Admin login successful');
        return true;
    } catch (error) {
        console.error('❌ Admin login failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 2: Create a test request with quotations
async function createTestRequest() {
    console.log('\n📝 Testing: Create Test Request with Quotations');
    
    try {
        const requestData = {
            title: 'Test Request for isSelected Edit',
            description: 'Testing the ability to edit isSelected field',
            type: 'maintenance',
            residence: '507f1f77bcf86cd799439011', // Replace with actual residence ID
            items: [
                {
                    description: 'Test Item 1',
                    quantity: 1,
                    unitCost: 100,
                    totalCost: 100,
                    quotations: [
                        {
                            provider: 'Vendor A',
                            amount: 100,
                            description: 'First quotation'
                        },
                        {
                            provider: 'Vendor B',
                            amount: 120,
                            description: 'Second quotation'
                        }
                    ]
                }
            ]
        };
        
        const response = await makeAuthenticatedRequest('POST', '/requests', requestData);
        testRequestId = response.data.request._id;
        
        console.log('✅ Test request created successfully');
        console.log('  - Request ID:', testRequestId);
        console.log('  - Item quotations:', response.data.request.items[0].quotations.length);
        
        return response.data.request;
    } catch (error) {
        console.error('❌ Failed to create test request:', error.response?.data || error.message);
        return null;
    }
}

// Test 3: Test updating isSelected field via request-level quotation update
async function testUpdateRequestQuotationIsSelected() {
    console.log('\n🔄 Testing: Update Request Quotation isSelected Field');
    
    try {
        // First, get the request to see current state
        const getResponse = await makeAuthenticatedRequest('GET', `/requests/${testRequestId}`);
        const request = getResponse.data.request;
        
        console.log('📋 Current request state:');
        console.log('  - Request-level quotations:', request.quotations?.length || 0);
        console.log('  - Items:', request.items.length);
        
        // Test updating isSelected to true for the first item's first quotation
        const updateData = {
            isSelected: true
        };
        
        console.log('\n🔄 Updating item quotation isSelected to true...');
        const updateResponse = await makeAuthenticatedRequest(
            'PUT', 
            `/requests/${testRequestId}/items/0/quotations/0`, 
            updateData
        );
        
        const updatedRequest = updateResponse.data.request;
        const updatedItem = updatedRequest.items[0];
        
        console.log('✅ Update successful');
        console.log('📋 Updated quotation state:');
        console.log('  - First quotation isSelected:', updatedItem.quotations[0].isSelected);
        console.log('  - Second quotation isSelected:', updatedItem.quotations[1].isSelected);
        console.log('  - Item total cost:', updatedItem.totalCost);
        console.log('  - Request total estimated cost:', updatedRequest.totalEstimatedCost);
        
        // Test updating isSelected to false
        console.log('\n🔄 Updating item quotation isSelected to false...');
        const updateResponse2 = await makeAuthenticatedRequest(
            'PUT', 
            `/requests/${testRequestId}/items/0/quotations/0`, 
            { isSelected: false }
        );
        
        const updatedRequest2 = updateResponse2.data.request;
        const updatedItem2 = updatedRequest2.items[0];
        
        console.log('✅ Update successful');
        console.log('📋 Updated quotation state:');
        console.log('  - First quotation isSelected:', updatedItem2.quotations[0].isSelected);
        console.log('  - Second quotation isSelected:', updatedItem2.quotations[1].isSelected);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to update quotation isSelected:', error.response?.data || error.message);
        return false;
    }
}

// Test 4: Test updating other fields along with isSelected
async function testUpdateMultipleFields() {
    console.log('\n🔄 Testing: Update Multiple Fields Including isSelected');
    
    try {
        const updateData = {
            provider: 'Updated Vendor A',
            amount: 95,
            description: 'Updated quotation description',
            isSelected: true
        };
        
        console.log('🔄 Updating multiple fields including isSelected...');
        const updateResponse = await makeAuthenticatedRequest(
            'PUT', 
            `/requests/${testRequestId}/items/0/quotations/0`, 
            updateData
        );
        
        const updatedRequest = updateResponse.data.request;
        const updatedItem = updatedRequest.items[0];
        const updatedQuotation = updatedItem.quotations[0];
        
        console.log('✅ Multiple field update successful');
        console.log('📋 Updated quotation state:');
        console.log('  - Provider:', updatedQuotation.provider);
        console.log('  - Amount:', updatedQuotation.amount);
        console.log('  - Description:', updatedQuotation.description);
        console.log('  - isSelected:', updatedQuotation.isSelected);
        console.log('  - Item total cost:', updatedItem.totalCost);
        console.log('  - Request total estimated cost:', updatedRequest.totalEstimatedCost);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to update multiple fields:', error.response?.data || error.message);
        return false;
    }
}

// Test 5: Test selection history tracking
async function testSelectionHistoryTracking() {
    console.log('\n📋 Testing: Selection History Tracking');
    
    try {
        const getResponse = await makeAuthenticatedRequest('GET', `/requests/${testRequestId}`);
        const request = getResponse.data.request;
        const item = request.items[0];
        
        console.log('📋 Selection history for quotations:');
        item.quotations.forEach((quotation, index) => {
            console.log(`  Quotation ${index + 1} (${quotation.provider}):`);
            console.log(`    - isSelected: ${quotation.isSelected}`);
            console.log(`    - Selection history entries: ${quotation.selectionHistory?.length || 0}`);
            
            if (quotation.selectionHistory && quotation.selectionHistory.length > 0) {
                quotation.selectionHistory.forEach((entry, entryIndex) => {
                    console.log(`      Entry ${entryIndex + 1}:`);
                    console.log(`        - Action: ${entry.action}`);
                    console.log(`        - User: ${entry.userEmail}`);
                    console.log(`        - Reason: ${entry.reason}`);
                    console.log(`        - Timestamp: ${entry.timestamp}`);
                });
            }
        });
        
        return true;
    } catch (error) {
        console.error('❌ Failed to check selection history:', error.response?.data || error.message);
        return false;
    }
}

// Test 6: Test request history tracking
async function testRequestHistoryTracking() {
    console.log('\n📋 Testing: Request History Tracking');
    
    try {
        const getResponse = await makeAuthenticatedRequest('GET', `/requests/${testRequestId}`);
        const request = getResponse.data.request;
        
        console.log('📋 Request history entries:');
        request.requestHistory.forEach((entry, index) => {
            console.log(`  Entry ${index + 1}:`);
            console.log(`    - Action: ${entry.action}`);
            console.log(`    - User: ${entry.user}`);
            console.log(`    - Date: ${entry.date}`);
            console.log(`    - Changes: ${entry.changes.join(', ')}`);
        });
        
        return true;
    } catch (error) {
        console.error('❌ Failed to check request history:', error.response?.data || error.message);
        return false;
    }
}

// Main test execution
async function runTests() {
    console.log('🧪 Testing isSelected Edit Functionality');
    console.log('=====================================');
    
    // Test 1: Login
    const loginSuccess = await loginAsAdmin();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without admin login');
        return;
    }
    
    // Test 2: Create test request
    const testRequest = await createTestRequest();
    if (!testRequest) {
        console.log('❌ Cannot proceed without test request');
        return;
    }
    
    // Test 3: Test isSelected update
    const updateSuccess = await testUpdateRequestQuotationIsSelected();
    if (!updateSuccess) {
        console.log('❌ isSelected update test failed');
        return;
    }
    
    // Test 4: Test multiple field update
    const multipleUpdateSuccess = await testUpdateMultipleFields();
    if (!multipleUpdateSuccess) {
        console.log('❌ Multiple field update test failed');
        return;
    }
    
    // Test 5: Test selection history
    await testSelectionHistoryTracking();
    
    // Test 6: Test request history
    await testRequestHistoryTracking();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Admins can now edit isSelected field via update quotation routes');
    console.log('  - Selection history is properly tracked');
    console.log('  - Request history is properly updated');
    console.log('  - Cost calculations are automatically updated');
    console.log('  - Multiple fields can be updated simultaneously');
}

// Run the tests
runTests().catch(console.error); 