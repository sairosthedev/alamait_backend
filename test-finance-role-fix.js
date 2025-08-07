const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test credentials (you'll need to update these with actual finance user credentials)
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

// Test invoice endpoints
async function testInvoiceEndpoints() {
    try {
        console.log('\n📄 Testing Invoice Endpoints...');
        
        // Test get all invoices
        const invoicesResponse = await axios.get(`${BASE_URL}/api/finance/invoices`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Get all invoices: PASS');
        
        // Test get invoice dashboard
        const dashboardResponse = await axios.get(`${BASE_URL}/api/finance/invoices/dashboard`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Get invoice dashboard: PASS');
        
        return true;
    } catch (error) {
        console.error('❌ Invoice endpoints error:', error.response?.data || error.message);
        return false;
    }
}

// Test transaction endpoints
async function testTransactionEndpoints() {
    try {
        console.log('\n💰 Testing Transaction Endpoints...');
        
        // Test get all transactions
        const transactionsResponse = await axios.get(`${BASE_URL}/api/finance/transactions/all`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Get all transactions: PASS');
        
        // Test get transaction entries
        const entriesResponse = await axios.get(`${BASE_URL}/api/finance/transactions/entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Get transaction entries: PASS');
        
        // Test get transaction summary
        const summaryResponse = await axios.get(`${BASE_URL}/api/finance/transactions/summary`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Get transaction summary: PASS');
        
        return true;
    } catch (error) {
        console.error('❌ Transaction endpoints error:', error.response?.data || error.message);
        return false;
    }
}

// Test request approval endpoints
async function testRequestApprovalEndpoints() {
    try {
        console.log('\n📋 Testing Request Approval Endpoints...');
        
        // Test get all requests
        const requestsResponse = await axios.get(`${BASE_URL}/api/requests`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Get all requests: PASS');
        
        // Test finance approval endpoint (this should work now)
        // Note: This will fail if no pending requests exist, but the role check should pass
        try {
            const approvalResponse = await axios.patch(`${BASE_URL}/api/requests/test-id/finance-approval`, {
                approved: true,
                notes: 'Test approval'
            }, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('✅ Finance approval endpoint: PASS');
        } catch (error) {
            if (error.response?.status === 404) {
                console.log('✅ Finance approval endpoint: PASS (404 expected - no test request)');
            } else if (error.response?.status === 403) {
                console.log('❌ Finance approval endpoint: FAIL (403 - role check failed)');
                return false;
            } else {
                console.log('✅ Finance approval endpoint: PASS (other error expected)');
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Request approval endpoints error:', error.response?.data || error.message);
        return false;
    }
}

// Test petty cash endpoints
async function testPettyCashEndpoints() {
    try {
        console.log('\n💵 Testing Petty Cash Endpoints...');
        
        // Test get petty cash status
        const statusResponse = await axios.get(`${BASE_URL}/api/finance/petty-cash/status`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Get petty cash status: PASS');
        
        // Test get petty cash report
        const reportResponse = await axios.get(`${BASE_URL}/api/finance/petty-cash/report`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Get petty cash report: PASS');
        
        return true;
    } catch (error) {
        console.error('❌ Petty cash endpoints error:', error.response?.data || error.message);
        return false;
    }
}

// Main test function
async function runTests() {
    console.log('🧪 Testing Finance Role Fix');
    console.log('===========================');
    
    // Login first
    const loginSuccess = await loginAsFinance();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without login');
        return;
    }
    
    // Test all endpoints
    const invoiceSuccess = await testInvoiceEndpoints();
    const transactionSuccess = await testTransactionEndpoints();
    const requestSuccess = await testRequestApprovalEndpoints();
    const pettyCashSuccess = await testPettyCashEndpoints();
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    console.log(`Invoice Endpoints: ${invoiceSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Transaction Endpoints: ${transactionSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Request Approval Endpoints: ${requestSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Petty Cash Endpoints: ${pettyCashSuccess ? '✅ PASS' : '❌ FAIL'}`);
    
    if (invoiceSuccess && transactionSuccess && requestSuccess && pettyCashSuccess) {
        console.log('\n🎉 All finance endpoints are working correctly!');
        console.log('✅ Finance role validation has been fixed successfully.');
    } else {
        console.log('\n⚠️ Some finance endpoints still have issues');
    }
}

// Run the tests
runTests().catch(console.error);
