const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test credentials (you'll need to update these with actual finance credentials)
const FINANCE_EMAIL = process.env.FINANCE_EMAIL || 'finance@alamait.com';
const FINANCE_PASSWORD = process.env.FINANCE_PASSWORD || 'finance123456';

let authToken = null;

// Login as finance user
async function loginAsFinance() {
    try {
        console.log('🔐 Logging in as finance user...');
        
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: FINANCE_EMAIL,
            password: FINANCE_PASSWORD
        });

        if (response.data.success && response.data.token) {
            authToken = response.data.token;
            console.log('✅ Finance login successful');
            console.log('User role:', response.data.user?.role);
            return true;
        } else {
            console.log('❌ Finance login failed:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ Finance login error:', error.response?.data || error.message);
        return false;
    }
}

// Test finance approval without vendor
async function testFinanceApprovalWithoutVendor() {
    try {
        console.log('\n📋 Testing Finance Approval Without Vendor...');
        
        // First, get a list of pending requests
        const requestsResponse = await axios.get(`${BASE_URL}/api/requests?status=pending`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!requestsResponse.data.requests || requestsResponse.data.requests.length === 0) {
            console.log('❌ No pending requests found for testing');
            return false;
        }
        
        const testRequest = requestsResponse.data.requests[0];
        console.log(`✅ Found pending request: ${testRequest.title} (ID: ${testRequest._id})`);
        
        // Test finance approval without vendor
        const approvalResponse = await axios.patch(`${BASE_URL}/api/requests/${testRequest._id}/finance-approval`, {
            approved: true,
            notes: 'Test approval without vendor requirement'
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Finance approval successful without vendor requirement');
        console.log('Approval response:', approvalResponse.data);
        return true;
    } catch (error) {
        console.error('❌ Finance approval error:', error.response?.data || error.message);
        return false;
    }
}

// Test finance approval with quotations that don't have vendors
async function testFinanceApprovalWithQuotationsNoVendor() {
    try {
        console.log('\n📋 Testing Finance Approval With Quotations (No Vendor)...');
        
        // First, get a list of pending requests with quotations
        const requestsResponse = await axios.get(`${BASE_URL}/api/requests?status=pending`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!requestsResponse.data.requests || requestsResponse.data.requests.length === 0) {
            console.log('❌ No pending requests found for testing');
            return false;
        }
        
        // Find a request with quotations
        const requestWithQuotations = requestsResponse.data.requests.find(req => 
            req.quotations && req.quotations.length > 0
        );
        
        if (!requestWithQuotations) {
            console.log('❌ No requests with quotations found for testing');
            return false;
        }
        
        console.log(`✅ Found request with quotations: ${requestWithQuotations.title} (ID: ${requestWithQuotations._id})`);
        console.log(`Quotations count: ${requestWithQuotations.quotations.length}`);
        
        // Check if any quotations don't have vendorId
        const quotationsWithoutVendor = requestWithQuotations.quotations.filter(q => !q.vendorId);
        console.log(`Quotations without vendor: ${quotationsWithoutVendor.length}`);
        
        // Test finance approval
        const approvalResponse = await axios.patch(`${BASE_URL}/api/requests/${requestWithQuotations._id}/finance-approval`, {
            approved: true,
            notes: 'Test approval with quotations that have no vendor'
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Finance approval successful with quotations (no vendor)');
        console.log('Approval response:', approvalResponse.data);
        return true;
    } catch (error) {
        console.error('❌ Finance approval error:', error.response?.data || error.message);
        return false;
    }
}

// Test quotation approval without vendor
async function testQuotationApprovalWithoutVendor() {
    try {
        console.log('\n📋 Testing Quotation Approval Without Vendor...');
        
        // First, get a list of requests with quotations
        const requestsResponse = await axios.get(`${BASE_URL}/api/requests`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!requestsResponse.data.requests || requestsResponse.data.requests.length === 0) {
            console.log('❌ No requests found for testing');
            return false;
        }
        
        // Find a request with quotations that don't have vendorId
        const requestWithQuotations = requestsResponse.data.requests.find(req => 
            req.quotations && req.quotations.length > 0 && 
            req.quotations.some(q => !q.vendorId)
        );
        
        if (!requestWithQuotations) {
            console.log('❌ No requests with quotations without vendor found for testing');
            return false;
        }
        
        console.log(`✅ Found request with quotations (no vendor): ${requestWithQuotations.title} (ID: ${requestWithQuotations._id})`);
        
        // Find a quotation without vendorId
        const quotationWithoutVendor = requestWithQuotations.quotations.find(q => !q.vendorId);
        const quotationIndex = requestWithQuotations.quotations.findIndex(q => !q.vendorId);
        
        console.log(`Quotation without vendor found at index: ${quotationIndex}`);
        
        // Test quotation approval
        const approvalResponse = await axios.patch(`${BASE_URL}/api/requests/${requestWithQuotations._id}/quotations/approve`, {
            quotationIndex: quotationIndex
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Quotation approval successful without vendor');
        console.log('Approval response:', approvalResponse.data);
        return true;
    } catch (error) {
        console.error('❌ Quotation approval error:', error.response?.data || error.message);
        return false;
    }
}

// Test creating a request with quotations without vendor
async function testCreateRequestWithoutVendor() {
    try {
        console.log('\n📋 Testing Create Request Without Vendor...');
        
        // Create a test request with quotations that don't have vendorId
        const requestData = {
            title: 'Test Request Without Vendor',
            description: 'Testing request creation without vendor requirement',
            type: 'operational',
            residence: '507f1f77bcf86cd799439011', // You'll need to update this with a real residence ID
            items: [
                {
                    description: 'Test Item 1',
                    quantity: 1,
                    estimatedCost: 100,
                    purpose: 'Testing without vendor'
                }
            ],
            quotations: [
                {
                    provider: 'Test Provider (No Vendor)',
                    amount: 100,
                    description: 'Test quotation without vendor',
                    // Note: No vendorId field
                    expenseCategory: 'other_expenses'
                }
            ],
            priority: 'medium'
        };
        
        const createResponse = await axios.post(`${BASE_URL}/api/requests`, requestData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Request creation successful without vendor');
        console.log('Created request:', createResponse.data);
        return true;
    } catch (error) {
        console.error('❌ Request creation error:', error.response?.data || error.message);
        return false;
    }
}

// Main test function
async function runTests() {
    console.log('🧪 Testing Finance Approval - Vendor Optional');
    console.log('=============================================');
    
    // Login first
    const loginSuccess = await loginAsFinance();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without login');
        return;
    }
    
    // Test all scenarios
    const approvalWithoutVendorSuccess = await testFinanceApprovalWithoutVendor();
    const approvalWithQuotationsSuccess = await testFinanceApprovalWithQuotationsNoVendor();
    const quotationApprovalSuccess = await testQuotationApprovalWithoutVendor();
    const createRequestSuccess = await testCreateRequestWithoutVendor();
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    console.log(`Finance Approval Without Vendor: ${approvalWithoutVendorSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Finance Approval With Quotations (No Vendor): ${approvalWithQuotationsSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Quotation Approval Without Vendor: ${quotationApprovalSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Create Request Without Vendor: ${createRequestSuccess ? '✅ PASS' : '❌ FAIL'}`);
    
    if (approvalWithoutVendorSuccess && approvalWithQuotationsSuccess && quotationApprovalSuccess && createRequestSuccess) {
        console.log('\n🎉 All finance approval tests passed!');
        console.log('✅ Vendor is now optional for finance approval.');
    } else {
        console.log('\n⚠️ Some finance approval tests failed');
    }
}

// Run the tests
runTests().catch(console.error);
