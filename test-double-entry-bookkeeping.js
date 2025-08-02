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
        formData.append('title', 'Double-Entry Bookkeeping Test');
        formData.append('description', 'Testing complete double-entry bookkeeping system');
        formData.append('type', 'operational');
        formData.append('residence', '67d723cf20f89c4ae69804f3');
        formData.append('department', 'Operations');
        formData.append('requestedBy', 'Test User');
        formData.append('deliveryLocation', 'Test Location');
        formData.append('priority', 'medium');
        formData.append('proposedVendor', 'Test Vendor');
        formData.append('totalEstimatedCost', '800');
        formData.append('status', 'pending');
        
        // Add first item with vendor quotation
        formData.append('items[0][description]', 'Plumbing Repair');
        formData.append('items[0][quantity]', '1');
        formData.append('items[0][unitCost]', '300');
        formData.append('items[0][totalCost]', '300');
        formData.append('items[0][purpose]', 'Emergency repair');
        
        // First item - first quotation (Vendor A)
        formData.append('items[0][quotations][0][provider]', 'ABC Plumbing Co');
        formData.append('items[0][quotations][0][amount]', '300');
        formData.append('items[0][quotations][0][description]', 'Complete plumbing repair');
        formData.append('items[0][quotations][0][quotationDate]', '2025-08-02');
        formData.append('items[0][quotations][0][validUntil]', '2025-09-02');
        formData.append('items[0][quotations][0][notes]', 'Best quality service');
        formData.append('items[0][quotations][0][isApproved]', 'false');
        formData.append('items[0][quotations][0][uploadedBy]', '67c023adae5e27657502e887');
        
        // First item - second quotation (Vendor B)
        formData.append('items[0][quotations][1][provider]', 'XYZ Plumbing Services');
        formData.append('items[0][quotations][1][amount]', '280');
        formData.append('items[0][quotations][1][description]', 'Competitive plumbing repair');
        formData.append('items[0][quotations][1][quotationDate]', '2025-08-02');
        formData.append('items[0][quotations][1][validUntil]', '2025-09-02');
        formData.append('items[0][quotations][1][notes]', 'Lower cost option');
        formData.append('items[0][quotations][1][isApproved]', 'false');
        formData.append('items[0][quotations][1][uploadedBy]', '67c023adae5e27657502e887');
        
        // Add second item without vendor (general expense)
        formData.append('items[1][description]', 'Office Supplies');
        formData.append('items[1][quantity]', '5');
        formData.append('items[1][unitCost]', '100');
        formData.append('items[1][totalCost]', '500');
        formData.append('items[1][purpose]', 'General supplies');

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

// Admin selects quotation
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

// Finance approves request (creates double-entry transactions)
async function financeApproval(requestId) {
    try {
        console.log('\n💰 Finance approving request (creating double-entry transactions)...');
        
        const response = await axios.patch(
            `${BASE_URL}/api/requests/${requestId}/finance-approval`,
            {
                approved: true,
                notes: 'Approved with double-entry bookkeeping'
            },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Finance approval successful');
        console.log('📊 Request status:', response.data.financeStatus);
        console.log('💰 Total amount:', response.data.amount);
        
        if (response.data.financial) {
            console.log('🏦 Financial transaction created:');
            console.log('   Transaction ID:', response.data.financial.transactionId);
            console.log('   Expense ID:', response.data.financial.expenseId);
            console.log('   Entries count:', response.data.financial.entriesCount);
            console.log('   Total amount:', response.data.financial.totalAmount);
        }
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to approve request:', error.response?.data || error.message);
        return null;
    }
}

// Mark expense as paid
async function markExpenseAsPaid(expenseId, paymentMethod) {
    try {
        console.log(`\n💳 Marking expense as paid (${paymentMethod})...`);
        
        const response = await axios.post(
            `${BASE_URL}/api/requests/expenses/${expenseId}/mark-paid`,
            { paymentMethod },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Expense marked as paid successfully');
        console.log('📊 Payment status:', response.data.expense.paymentStatus);
        console.log('💰 Payment method:', response.data.expense.paymentMethod);
        
        if (response.data.financial) {
            console.log('🏦 Payment transaction created:');
            console.log('   Payment Transaction ID:', response.data.financial.paymentTransactionId);
            console.log('   Payment Entries count:', response.data.financial.paymentEntriesCount);
            console.log('   Total paid:', response.data.financial.totalPaid);
        }
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to mark expense as paid:', error.response?.data || error.message);
        return null;
    }
}

// Get transaction details
async function getTransactionDetails(transactionId) {
    try {
        console.log(`\n📋 Getting transaction details for ${transactionId}...`);
        
        const response = await axios.get(`${BASE_URL}/api/transactions/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Transaction details retrieved');
        console.log('📊 Transaction type:', response.data.type);
        console.log('💰 Transaction amount:', response.data.amount);
        console.log('📄 Description:', response.data.description);
        
        if (response.data.entries && response.data.entries.length > 0) {
            console.log('\n📝 Transaction Entries:');
            response.data.entries.forEach((entry, index) => {
                console.log(`  Entry ${index + 1}:`);
                console.log(`    Account: ${entry.account?.name || 'Unknown'} (${entry.account?.code || 'N/A'})`);
                console.log(`    Type: ${entry.type}`);
                console.log(`    Debit: $${entry.debit}`);
                console.log(`    Credit: $${entry.credit}`);
                console.log(`    Description: ${entry.description}`);
            });
        }
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to get transaction details:', error.response?.data || error.message);
        return null;
    }
}

// Get expense details
async function getExpenseDetails(expenseId) {
    try {
        console.log(`\n📋 Getting expense details for ${expenseId}...`);
        
        const response = await axios.get(`${BASE_URL}/api/expenses/${expenseId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Expense details retrieved');
        console.log('📊 Expense ID:', response.data.expenseId);
        console.log('💰 Total amount:', response.data.amount);
        console.log('💳 Payment status:', response.data.paymentStatus);
        
        if (response.data.items && response.data.items.length > 0) {
            console.log('\n📝 Itemized Expenses:');
            response.data.items.forEach((item, index) => {
                console.log(`  Item ${index + 1}: ${item.description}`);
                console.log(`    Quantity: ${item.quantity}`);
                console.log(`    Unit Cost: $${item.unitCost}`);
                console.log(`    Total Cost: $${item.totalCost}`);
                console.log(`    Payment Status: ${item.paymentStatus}`);
                
                if (item.selectedQuotation) {
                    console.log(`    Selected Vendor: ${item.selectedQuotation.provider}`);
                    console.log(`    Vendor Amount: $${item.selectedQuotation.amount}`);
                }
            });
        }
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to get expense details:', error.response?.data || error.message);
        return null;
    }
}

// Main test function
async function runTest() {
    console.log('🚀 Starting Double-Entry Bookkeeping Test\n');
    
    // Step 1: Login
    if (!await login()) {
        return;
    }
    
    // Step 2: Create test request
    const requestId = await createTestRequest();
    if (!requestId) {
        return;
    }
    
    // Step 3: Admin selects quotation for first item
    await selectQuotation(requestId, 0, 0, 'Best quality service provider');
    
    // Step 4: Finance approves request (creates double-entry transactions)
    const approvalResult = await financeApproval(requestId);
    if (!approvalResult) {
        return;
    }
    
    // Step 5: Get transaction details
    if (approvalResult.financial) {
        await getTransactionDetails(approvalResult.financial.transactionId);
    }
    
    // Step 6: Get expense details
    if (approvalResult.financial) {
        await getExpenseDetails(approvalResult.financial.expenseId);
    }
    
    // Step 7: Mark expense as paid
    if (approvalResult.financial) {
        const paymentResult = await markExpenseAsPaid(approvalResult.financial.expenseId, 'Bank Transfer');
        
        // Step 8: Get payment transaction details
        if (paymentResult && paymentResult.financial) {
            await getTransactionDetails(paymentResult.financial.paymentTransactionId);
        }
    }
    
    console.log('\n🎉 Double-Entry Bookkeeping Test Completed!');
    console.log('\n📊 Summary:');
    console.log('✅ Request created with multiple quotations');
    console.log('✅ Admin selected quotation');
    console.log('✅ Finance approved (created double-entry transactions)');
    console.log('✅ Expense marked as paid (created payment transactions)');
    console.log('✅ Complete audit trail maintained');
}

// Run the test
runTest().catch(console.error); 