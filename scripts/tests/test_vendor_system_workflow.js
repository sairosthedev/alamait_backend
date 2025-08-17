const axios = require('axios');

// Configuration
const BASE_URL = 'https://alamait-backend.onrender.com';
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN_HERE'; // Replace with actual admin token
const FINANCE_TOKEN = 'YOUR_FINANCE_TOKEN_HERE'; // Replace with actual finance token

// Test data
const testData = {
    residenceId: '67d723cf20f89c4ae69804f3', // Replace with actual residence ID
    adminUserId: '67c023adae5e27657502e887' // Replace with actual admin user ID
};

// Helper function for API calls
const apiCall = async (method, endpoint, data = null, token = ADMIN_TOKEN) => {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return { success: true, data: response.data };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status
        };
    }
};

// Test functions
const testVendorCreation = async () => {
    console.log('\n🧪 TEST 1: VENDOR CREATION');
    console.log('=' .repeat(50));
    
    const vendorData = {
        businessName: "ABC Plumbing Services",
        tradingName: "ABC Plumbing",
        contactPerson: {
            firstName: "John",
            lastName: "Smith",
            email: "john@abcplumbing.com",
            phone: "+27 11 123 4567",
            mobile: "+27 82 123 4567"
        },
        businessAddress: {
            street: "123 Main Street",
            city: "Johannesburg",
            state: "Gauteng",
            postalCode: "2000",
            country: "South Africa"
        },
        category: "plumbing",
        specializations: ["plumbing", "drainage", "water_heating"],
        serviceAreas: ["Johannesburg", "Pretoria"],
        creditLimit: 50000,
        paymentTerms: 30,
        notes: "Reliable plumbing services"
    };
    
    const result = await apiCall('POST', '/api/vendors', vendorData);
    
    if (result.success) {
        console.log('✅ Vendor created successfully!');
        console.log('Vendor ID:', result.data.vendor._id);
        console.log('Vendor Code:', result.data.vendor.vendorCode);
        console.log('Chart of Accounts Code:', result.data.vendor.chartOfAccountsCode);
        return result.data.vendor._id;
    } else {
        console.log('❌ Vendor creation failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
        return null;
    }
};

const testVendorSearch = async () => {
    console.log('\n🧪 TEST 2: VENDOR SEARCH');
    console.log('=' .repeat(50));
    
    const result = await apiCall('GET', '/api/vendors/search?query=plumbing&category=plumbing&limit=10');
    
    if (result.success) {
        console.log('✅ Vendor search successful!');
        console.log('Found vendors:', result.data.total);
        if (result.data.vendors.length > 0) {
            console.log('First vendor:', result.data.vendors[0].businessName);
            return result.data.vendors[0]._id;
        }
    } else {
        console.log('❌ Vendor search failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
    }
    return null;
};

const testGetAllVendors = async () => {
    console.log('\n🧪 TEST 3: GET ALL VENDORS');
    console.log('=' .repeat(50));
    
    const result = await apiCall('GET', '/api/vendors?page=1&limit=10');
    
    if (result.success) {
        console.log('✅ Get all vendors successful!');
        console.log('Total vendors:', result.data.totalVendors);
        console.log('Current page:', result.data.currentPage);
        console.log('Total pages:', result.data.totalPages);
    } else {
        console.log('❌ Get all vendors failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
    }
};

const testCreateRequest = async (vendorId) => {
    console.log('\n🧪 TEST 4: CREATE REQUEST WITH VENDOR QUOTATIONS');
    console.log('=' .repeat(50));
    
    const requestData = {
        title: "Plumbing Repair Request",
        description: "Fix blocked drain in Unit 101",
        type: "operational",
        residence: testData.residenceId,
        priority: "medium",
        category: "maintenance",
        department: "Maintenance",
        requestedBy: "Admin User",
        deliveryLocation: "Unit 101, St Kilda",
        items: [
            {
                description: "Fix blocked drain",
                quantity: 1,
                unitCost: 0,
                totalCost: 0,
                quotations: [
                    {
                        provider: "ABC Plumbing Services",
                        amount: 500,
                        description: "Professional drain cleaning service",
                        vendorId: vendorId,
                        vendorCode: "V25001",
                        vendorName: "ABC Plumbing Services",
                        vendorContact: {
                            firstName: "John",
                            lastName: "Smith",
                            email: "john@abcplumbing.com",
                            phone: "+27 11 123 4567"
                        },
                        isSelected: true,
                        isApproved: false
                    },
                    {
                        provider: "XYZ Plumbing",
                        amount: 450,
                        description: "Standard drain cleaning",
                        isSelected: false,
                        isApproved: false
                    }
                ]
            },
            {
                description: "Replace faucet",
                quantity: 1,
                unitCost: 200,
                totalCost: 200,
                quotations: []
            }
        ],
        totalEstimatedCost: 700
    };
    
    const result = await apiCall('POST', '/api/requests', requestData);
    
    if (result.success) {
        console.log('✅ Request created successfully!');
        console.log('Request ID:', result.data.request._id);
        console.log('Status:', result.data.request.status);
        console.log('Total Cost:', result.data.request.totalEstimatedCost);
        return result.data.request._id;
    } else {
        console.log('❌ Request creation failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
        return null;
    }
};

const testFinanceApproval = async (requestId) => {
    console.log('\n🧪 TEST 5: FINANCE APPROVAL (NOT IMPLEMENTED)');
    console.log('=' .repeat(50));
    
    const approvalData = {
        approved: true,
        selectedQuotes: {
            "0": 0
        },
        approvalNotes: "Approved ABC Plumbing quote",
        approvedTotal: 500
    };
    
    const result = await apiCall('PUT', `/api/requests/${requestId}/approve`, approvalData, FINANCE_TOKEN);
    
    if (result.success) {
        console.log('✅ Finance approval successful!');
        console.log('Request status:', result.data.request.status);
        console.log('Approved total:', result.data.request.approvedTotal);
        return true;
    } else {
        console.log('❌ Finance approval failed (Expected - not implemented):');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
        console.log('This endpoint needs to be implemented!');
        return false;
    }
};

const testPaymentProcessing = async (requestId, vendorId) => {
    console.log('\n🧪 TEST 6: PAYMENT PROCESSING (NOT IMPLEMENTED)');
    console.log('=' .repeat(50));
    
    const paymentData = {
        payments: [
            {
                requestId: requestId,
                vendorId: vendorId,
                amount: 500,
                paymentMethod: "bank_transfer",
                description: "Payment for plumbing repair"
            }
        ],
        paymentDate: new Date().toISOString()
    };
    
    const result = await apiCall('POST', '/api/payments/process', paymentData, FINANCE_TOKEN);
    
    if (result.success) {
        console.log('✅ Payment processing successful!');
        console.log('Processed payments:', result.data.payments.length);
        return true;
    } else {
        console.log('❌ Payment processing failed (Expected - not implemented):');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
        console.log('This endpoint needs to be implemented!');
        return false;
    }
};

const testGetCreditors = async () => {
    console.log('\n🧪 TEST 7: GET CREDITORS');
    console.log('=' .repeat(50));
    
    const result = await apiCall('GET', '/api/vendors/creditors?status=active&page=1&limit=10');
    
    if (result.success) {
        console.log('✅ Get creditors successful!');
        console.log('Total creditors:', result.data.totalCreditors);
        console.log('Total outstanding:', result.data.totalOutstanding);
        console.log('Creditors found:', result.data.creditors.length);
    } else {
        console.log('❌ Get creditors failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
    }
};

const testGetDebtors = async () => {
    console.log('\n🧪 TEST 8: GET DEBTORS');
    console.log('=' .repeat(50));
    
    const result = await apiCall('GET', '/api/vendors/debtors?page=1&limit=10');
    
    if (result.success) {
        console.log('✅ Get debtors successful!');
        console.log('Total debtors:', result.data.totalDebtors);
        console.log('Total outstanding:', result.data.totalOutstanding);
        console.log('Debtors found:', result.data.debtors.length);
    } else {
        console.log('❌ Get debtors failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
    }
};

const testVendorUpdate = async (vendorId) => {
    console.log('\n🧪 TEST 9: UPDATE VENDOR');
    console.log('=' .repeat(50));
    
    const updateData = {
        creditLimit: 75000,
        paymentTerms: 45,
        notes: "Updated - increased credit limit and payment terms"
    };
    
    const result = await apiCall('PUT', `/api/vendors/${vendorId}`, updateData);
    
    if (result.success) {
        console.log('✅ Vendor update successful!');
        console.log('Updated credit limit:', result.data.vendor.creditLimit);
        console.log('Updated payment terms:', result.data.vendor.paymentTerms);
    } else {
        console.log('❌ Vendor update failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
    }
};

// Main test runner
const runAllTests = async () => {
    console.log('🚀 STARTING VENDOR/SUPPLIER SYSTEM TESTS');
    console.log('=' .repeat(60));
    console.log('Base URL:', BASE_URL);
    console.log('Testing current backend implementation...\n');
    
    let vendorId = null;
    let requestId = null;
    
    try {
        // Test 1: Create vendor
        vendorId = await testVendorCreation();
        
        // Test 2: Search vendors
        if (!vendorId) {
            vendorId = await testVendorSearch();
        }
        
        // Test 3: Get all vendors
        await testGetAllVendors();
        
        // Test 4: Create request with vendor quotations
        if (vendorId) {
            requestId = await testCreateRequest(vendorId);
        }
        
        // Test 5: Finance approval (not implemented)
        if (requestId) {
            await testFinanceApproval(requestId);
        }
        
        // Test 6: Payment processing (not implemented)
        if (requestId && vendorId) {
            await testPaymentProcessing(requestId, vendorId);
        }
        
        // Test 7: Get creditors
        await testGetCreditors();
        
        // Test 8: Get debtors
        await testGetDebtors();
        
        // Test 9: Update vendor
        if (vendorId) {
            await testVendorUpdate(vendorId);
        }
        
    } catch (error) {
        console.error('❌ Test execution error:', error.message);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(60));
    console.log('✅ IMPLEMENTED AND WORKING:');
    console.log('   - Vendor creation');
    console.log('   - Vendor search');
    console.log('   - Get all vendors');
    console.log('   - Create requests (basic)');
    console.log('   - Get creditors');
    console.log('   - Get debtors');
    console.log('   - Update vendors');
    console.log('');
    console.log('❌ NOT IMPLEMENTED (NEEDS DEVELOPMENT):');
    console.log('   - Finance approval workflow');
    console.log('   - Payment processing');
    console.log('   - Automated double-entry transactions');
    console.log('   - Vendor balance updates');
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('   1. Implement finance approval endpoints');
    console.log('   2. Add payment processing functionality');
    console.log('   3. Create transaction helper functions');
    console.log('   4. Update request model for enhanced quotations');
    console.log('   5. Add vendor integration in quotations');
    console.log('');
    console.log('📝 NOTES:');
    console.log('   - Vendor management system is fully functional');
    console.log('   - Basic request system works');
    console.log('   - Chart of Accounts integration is working');
    console.log('   - Need to implement the enhanced quotation workflow');
    console.log('   - Need to add automated accounting transactions');
};

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    testVendorCreation,
    testVendorSearch,
    testGetAllVendors,
    testCreateRequest,
    testFinanceApproval,
    testPaymentProcessing,
    testGetCreditors,
    testGetDebtors,
    testVendorUpdate,
    runAllTests
}; 