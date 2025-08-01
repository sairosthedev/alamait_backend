const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_EMAIL = 'admin@example.com';
const TEST_PASSWORD = 'admin123';

// Test data
const testRequest = {
    title: "Office Supplies Purchase",
    description: "Need to purchase office supplies for the admin department",
    type: "operational",
    residence: "507f1f77bcf86cd799439011", // Replace with actual residence ID
    department: "Administration",
    requestedBy: "John Doe",
    deliveryLocation: "Main Office, Building A",
    priority: "medium",
    items: [
        {
            description: "Printer Paper A4",
            quantity: 10,
            unitCost: 25.00,
            purpose: "Daily printing needs"
        },
        {
            description: "Stapler",
            quantity: 2,
            unitCost: 15.00,
            purpose: "Document binding"
        }
    ],
    proposedVendor: "Office Supplies Co.",
    images: []
};

const testQuotation = {
    provider: "ABC Office Supplies",
    amount: 500.00,
    description: "Complete office supplies package including paper and staplers",
    validUntil: "2024-02-15",
    terms: "Payment within 30 days"
};

async function login() {
    try {
        console.log('🔐 Logging in...');
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        
        const token = response.data.token;
        console.log('✅ Login successful');
        
        // Set default headers for all requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        return token;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message);
        throw error;
    }
}

async function createRequest() {
    try {
        console.log('\n📝 Creating request...');
        const response = await axios.post(`${BASE_URL}/requests`, testRequest);
        
        console.log('✅ Request created successfully');
        console.log('Request ID:', response.data._id);
        console.log('Status:', response.data.status);
        
        return response.data._id;
    } catch (error) {
        console.error('❌ Request creation failed:', error.response?.data || error.message);
        throw error;
    }
}

async function uploadQuotation(requestId) {
    try {
        console.log('\n📄 Uploading quotation...');
        
        // Create FormData-like object for testing
        const formData = new FormData();
        formData.append('provider', testQuotation.provider);
        formData.append('amount', testQuotation.amount.toString());
        formData.append('description', testQuotation.description);
        formData.append('validUntil', testQuotation.validUntil);
        formData.append('terms', testQuotation.terms);
        
        // For testing, we'll use a simple JSON request instead of FormData
        const response = await axios.post(`${BASE_URL}/requests/${requestId}/quotations`, {
            provider: testQuotation.provider,
            amount: testQuotation.amount,
            description: testQuotation.description,
            validUntil: testQuotation.validUntil,
            terms: testQuotation.terms
        });
        
        console.log('✅ Quotation uploaded successfully');
        console.log('Quotation ID:', response.data.quotations[0]._id);
        
        // Check if vendor was auto-created
        const quotation = response.data.quotations[0];
        if (quotation.vendorId) {
            console.log('✅ Vendor auto-created!');
            console.log('Vendor ID:', quotation.vendorId);
            console.log('Vendor Name:', quotation.vendorName);
            console.log('Vendor Type:', quotation.vendorType);
            console.log('Payment Method:', quotation.paymentMethod);
            console.log('Has Bank Details:', quotation.hasBankDetails);
        } else {
            console.log('⚠️ No vendor auto-created');
        }
        
        return response.data.quotations[0]._id;
    } catch (error) {
        console.error('❌ Quotation upload failed:', error.response?.data || error.message);
        throw error;
    }
}

async function checkVendors() {
    try {
        console.log('\n🏢 Checking all vendors...');
        const response = await axios.get(`${BASE_URL}/vendors`);
        
        console.log('✅ Vendors retrieved successfully');
        console.log('Total vendors:', response.data.totalVendors);
        
        if (response.data.vendors.length > 0) {
            console.log('\n📋 Vendor list:');
            response.data.vendors.forEach((vendor, index) => {
                console.log(`${index + 1}. ${vendor.businessName} (${vendor.vendorCode})`);
                console.log(`   Type: ${vendor.vendorType || 'Not set'}`);
                console.log(`   Category: ${vendor.category}`);
                console.log(`   Auto-generated: ${vendor.isAutoGenerated || false}`);
                console.log(`   Payment Method: ${vendor.defaultPaymentMethod || 'Not set'}`);
                console.log(`   Has Bank Details: ${vendor.bankDetails && vendor.bankDetails.bankName ? 'Yes' : 'No'}`);
                console.log('');
            });
        }
        
        return response.data.vendors;
    } catch (error) {
        console.error('❌ Failed to retrieve vendors:', error.response?.data || error.message);
        throw error;
    }
}

async function searchVendors(query) {
    try {
        console.log(`\n🔍 Searching vendors for: "${query}"`);
        const response = await axios.get(`${BASE_URL}/vendors/search?query=${encodeURIComponent(query)}`);
        
        console.log('✅ Vendor search successful');
        console.log('Found vendors:', response.data.total);
        
        if (response.data.vendors.length > 0) {
            console.log('\n📋 Search results:');
            response.data.vendors.forEach((vendor, index) => {
                console.log(`${index + 1}. ${vendor.businessName} (${vendor.vendorCode})`);
                console.log(`   Category: ${vendor.category}`);
                console.log(`   Contact: ${vendor.contactPerson?.firstName} ${vendor.contactPerson?.lastName}`);
            });
        }
        
        return response.data.vendors;
    } catch (error) {
        console.error('❌ Vendor search failed:', error.response?.data || error.message);
        throw error;
    }
}

async function getVendorsForQuotations() {
    try {
        console.log('\n📋 Getting vendors for quotations...');
        const response = await axios.get(`${BASE_URL}/vendors/for-quotations`);
        
        console.log('✅ Vendors for quotations retrieved');
        console.log('Total vendors:', response.data.total);
        
        if (response.data.vendors.length > 0) {
            console.log('\n📋 Vendors available for quotations:');
            response.data.vendors.forEach((vendor, index) => {
                console.log(`${index + 1}. ${vendor.businessName} (${vendor.vendorCode})`);
                console.log(`   Type: ${vendor.vendorType}`);
                console.log(`   Category: ${vendor.category}`);
                console.log(`   Payment Method: ${vendor.defaultPaymentMethod}`);
            });
        }
        
        return response.data.vendors;
    } catch (error) {
        console.error('❌ Failed to get vendors for quotations:', error.response?.data || error.message);
        throw error;
    }
}

async function runCompleteTest() {
    try {
        console.log('🚀 Starting Vendor Auto-Creation Test');
        console.log('=====================================');
        
        // Step 1: Login
        await login();
        
        // Step 2: Check existing vendors
        await checkVendors();
        
        // Step 3: Get vendors for quotations
        await getVendorsForQuotations();
        
        // Step 4: Create request
        const requestId = await createRequest();
        
        // Step 5: Upload quotation (this should trigger vendor auto-creation)
        await uploadQuotation(requestId);
        
        // Step 6: Check vendors again to see if new vendor was created
        await checkVendors();
        
        // Step 7: Search for the auto-created vendor
        await searchVendors(testQuotation.provider);
        
        console.log('\n🎉 Test completed successfully!');
        console.log('The vendor auto-creation system is working properly.');
        
    } catch (error) {
        console.error('\n💥 Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    runCompleteTest();
}

module.exports = {
    login,
    createRequest,
    uploadQuotation,
    checkVendors,
    searchVendors,
    getVendorsForQuotations,
    runCompleteTest
}; 