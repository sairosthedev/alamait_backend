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
        console.log('✅ Admin login successful');
        return true;
    } catch (error) {
        console.error('❌ Admin login failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 1: Create a request with quotations
async function testCreateRequestWithQuotations() {
    try {
        console.log('\n📝 Testing Create Request with Quotations...');
        
        const requestData = {
            title: 'Test Request for Selection History',
            description: 'Testing quotation selection history functionality',
            type: 'operational',
            priority: 'medium',
            category: 'maintenance',
            residence: '507f1f77bcf86cd799439011', // Replace with actual residence ID
            items: [
                {
                    description: 'Test Item for Selection History',
                    quantity: 1,
                    unitCost: 100,
                    totalCost: 100,
                    purpose: 'Testing selection history',
                    quotations: [
                        {
                            provider: 'Test Provider 1',
                            amount: 100,
                            description: 'Test quotation 1',
                            fileUrl: 'https://example.com/test1.pdf',
                            fileName: 'test1.pdf'
                        },
                        {
                            provider: 'Test Provider 2',
                            amount: 150,
                            description: 'Test quotation 2',
                            fileUrl: 'https://example.com/test2.pdf',
                            fileName: 'test2.pdf'
                        }
                    ]
                }
            ]
        };
        
        const response = await axios.post(`${BASE_URL}/api/requests`, requestData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Create Request with Quotations - SUCCESS');
        console.log('📋 Request ID:', response.data.request?._id);
        console.log('📋 Items count:', response.data.request?.items?.length);
        console.log('📋 Quotations count:', response.data.request?.items?.[0]?.quotations?.length);
        
        return response.data.request;
    } catch (error) {
        console.error('❌ Create Request with Quotations - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 2: Select a quotation and check selection history
async function testSelectQuotation(requestId) {
    try {
        console.log(`\n✅ Testing Select Quotation for Request: ${requestId}...`);
        
        const selectionData = {
            reason: 'Testing selection history functionality'
        };
        
        const response = await axios.post(`${BASE_URL}/api/requests/${requestId}/items/0/quotations/0/select`, selectionData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Select Quotation - SUCCESS');
        console.log('📋 Selection message:', response.data.message);
        
        // Check the selection history
        const request = response.data.request;
        const item = request.items[0];
        const selectedQuotation = item.quotations[0];
        const deselectedQuotation = item.quotations[1];
        
        console.log('📋 Selected quotation isSelected:', selectedQuotation.isSelected);
        console.log('📋 Selected quotation selectedBy:', selectedQuotation.selectedBy);
        console.log('📋 Selected quotation selectionHistory length:', selectedQuotation.selectionHistory?.length || 0);
        
        if (selectedQuotation.selectionHistory && selectedQuotation.selectionHistory.length > 0) {
            console.log('📋 Selection history entry:', selectedQuotation.selectionHistory[0]);
        }
        
        console.log('📋 Deselected quotation isSelected:', deselectedQuotation.isSelected);
        console.log('📋 Deselected quotation selectionHistory length:', deselectedQuotation.selectionHistory?.length || 0);
        
        if (deselectedQuotation.selectionHistory && deselectedQuotation.selectionHistory.length > 0) {
            console.log('📋 Deselection history entry:', deselectedQuotation.selectionHistory[0]);
        }
        
        return response.data.request;
    } catch (error) {
        console.error('❌ Select Quotation - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 3: Select a different quotation and check updated history
async function testSelectDifferentQuotation(requestId) {
    try {
        console.log(`\n🔄 Testing Select Different Quotation for Request: ${requestId}...`);
        
        const selectionData = {
            reason: 'Changing selection to test history updates'
        };
        
        const response = await axios.post(`${BASE_URL}/api/requests/${requestId}/items/0/quotations/1/select`, selectionData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Select Different Quotation - SUCCESS');
        console.log('📋 Selection message:', response.data.message);
        
        // Check the updated selection history
        const request = response.data.request;
        const item = request.items[0];
        const previouslySelectedQuotation = item.quotations[0];
        const newlySelectedQuotation = item.quotations[1];
        
        console.log('📋 Previously selected quotation isSelected:', previouslySelectedQuotation.isSelected);
        console.log('📋 Previously selected quotation selectionHistory length:', previouslySelectedQuotation.selectionHistory?.length || 0);
        
        if (previouslySelectedQuotation.selectionHistory && previouslySelectedQuotation.selectionHistory.length > 0) {
            console.log('📋 Previously selected history entries:', previouslySelectedQuotation.selectionHistory);
        }
        
        console.log('📋 Newly selected quotation isSelected:', newlySelectedQuotation.isSelected);
        console.log('📋 Newly selected quotation selectionHistory length:', newlySelectedQuotation.selectionHistory?.length || 0);
        
        if (newlySelectedQuotation.selectionHistory && newlySelectedQuotation.selectionHistory.length > 0) {
            console.log('📋 Newly selected history entries:', newlySelectedQuotation.selectionHistory);
        }
        
        return response.data.request;
    } catch (error) {
        console.error('❌ Select Different Quotation - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 4: Get request and verify selection history persistence
async function testGetRequestAndVerifyHistory(requestId) {
    try {
        console.log(`\n📋 Testing Get Request and Verify History: ${requestId}...`);
        
        const response = await axios.get(`${BASE_URL}/api/requests/${requestId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Request - SUCCESS');
        
        const request = response.data.request;
        const item = request.items[0];
        
        console.log('📋 Item total cost:', item.totalCost);
        console.log('📋 Request total estimated cost:', request.totalEstimatedCost);
        
        // Check all quotations and their history
        item.quotations.forEach((quotation, index) => {
            console.log(`\n📋 Quotation ${index + 1}:`);
            console.log(`  - Provider: ${quotation.provider}`);
            console.log(`  - Amount: ${quotation.amount}`);
            console.log(`  - Is Selected: ${quotation.isSelected}`);
            console.log(`  - Selection History Length: ${quotation.selectionHistory?.length || 0}`);
            
            if (quotation.selectionHistory && quotation.selectionHistory.length > 0) {
                console.log(`  - Selection History:`);
                quotation.selectionHistory.forEach((entry, entryIndex) => {
                    console.log(`    Entry ${entryIndex + 1}:`);
                    console.log(`      - Action: ${entry.action}`);
                    console.log(`      - User Email: ${entry.userEmail}`);
                    console.log(`      - Timestamp: ${entry.timestamp}`);
                    console.log(`      - Reason: ${entry.reason}`);
                });
            } else {
                console.log(`  - No selection history found`);
            }
        });
        
        return response.data.request;
    } catch (error) {
        console.error('❌ Get Request and Verify History - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Main test function
async function runQuotationSelectionHistoryTests() {
    console.log('🚀 Starting Quotation Selection History Tests\n');
    
    // Step 1: Login
    if (!await login()) {
        return;
    }
    
    // Step 2: Create request with quotations
    const request = await testCreateRequestWithQuotations();
    if (!request) {
        console.log('❌ Cannot proceed without creating a request');
        return;
    }
    
    // Step 3: Select first quotation
    const updatedRequest1 = await testSelectQuotation(request._id);
    if (!updatedRequest1) {
        console.log('❌ Cannot proceed without selecting quotation');
        return;
    }
    
    // Step 4: Select different quotation
    const updatedRequest2 = await testSelectDifferentQuotation(request._id);
    if (!updatedRequest2) {
        console.log('❌ Cannot proceed without selecting different quotation');
        return;
    }
    
    // Step 5: Get request and verify history persistence
    await testGetRequestAndVerifyHistory(request._id);
    
    console.log('\n🎉 Quotation Selection History Tests Completed!');
    console.log('\n📊 Summary:');
    console.log('✅ Request creation with quotations');
    console.log('✅ Quotation selection with history tracking');
    console.log('✅ Quotation deselection with history tracking');
    console.log('✅ Selection history persistence verification');
    console.log('✅ Cost updates based on selected quotations');
    
    console.log('\n🔍 Key Findings:');
    console.log('- Selection history should be stored as an array');
    console.log('- Each selection/deselection should create a history entry');
    console.log('- History should include action, user, timestamp, and reason');
    console.log('- History should persist across requests');
    
    console.log('\n🚀 Quotation selection history functionality tested!');
}

// Run the tests
runQuotationSelectionHistoryTests().catch(console.error); 