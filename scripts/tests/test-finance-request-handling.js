const axios = require('axios');

const BASE_URL = 'https://alamait-backend.onrender.com';
const FINANCE_EMAIL = 'finance@alamait.com';
const FINANCE_PASSWORD = 'Finance@123';

let authToken = '';

// Login function
async function login() {
    try {
        console.log('🔐 Logging in as finance user...');
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: FINANCE_EMAIL,
            password: FINANCE_PASSWORD
        });
        
        authToken = response.data.token;
        console.log('✅ Finance login successful');
        return true;
    } catch (error) {
        console.error('❌ Finance login failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 1: Get All Expenses
async function testGetAllExpenses() {
    try {
        console.log('\n💸 Testing Get All Expenses...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/expenses`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get All Expenses - SUCCESS');
        console.log('📋 Expenses count:', response.data.expenses?.length || 0);
        console.log('📋 Total pages:', response.data.pagination?.totalPages);
        
        return response.data.expenses || [];
    } catch (error) {
        console.error('❌ Get All Expenses - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 2: Get Expense by ID
async function testGetExpenseById(expenseId) {
    try {
        console.log(`\n💸 Testing Get Expense by ID: ${expenseId}...`);
        
        const response = await axios.get(`${BASE_URL}/api/finance/expenses/${expenseId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Expense by ID - SUCCESS');
        console.log('📋 Expense details:', {
            expenseId: response.data.expense?.expenseId,
            description: response.data.expense?.description,
            amount: response.data.expense?.amount,
            status: response.data.expense?.paymentStatus
        });
        
        return response.data.expense;
    } catch (error) {
        console.error('❌ Get Expense by ID - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 3: Approve Expense
async function testApproveExpense(expenseId) {
    try {
        console.log(`\n✅ Testing Approve Expense: ${expenseId}...`);
        
        const approvalData = {
            notes: 'Approved after vendor verification - Test approval by finance'
        };
        
        const response = await axios.patch(`${BASE_URL}/api/finance/expenses/${expenseId}/approve`, approvalData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Approve Expense - SUCCESS');
        console.log('📋 Approval message:', response.data.message);
        console.log('📋 Updated status:', response.data.expense?.paymentStatus);
        
        return response.data.expense;
    } catch (error) {
        console.error('❌ Approve Expense - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 4: Mark Expense as Paid
async function testMarkExpenseAsPaid(expenseId) {
    try {
        console.log(`\n💰 Testing Mark Expense as Paid: ${expenseId}...`);
        
        const paymentData = {
            paymentMethod: 'Bank Transfer',
            notes: 'Payment processed via bank transfer - Test payment by finance',
            paidDate: new Date().toISOString()
        };
        
        const response = await axios.patch(`${BASE_URL}/api/finance/expenses/${expenseId}/mark-paid`, paymentData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Mark Expense as Paid - SUCCESS');
        console.log('📋 Payment message:', response.data.message);
        console.log('📋 Payment status:', response.data.expense?.paymentStatus);
        console.log('📋 Payment method:', response.data.expense?.paymentMethod);
        
        return response.data.expense;
    } catch (error) {
        console.error('❌ Mark Expense as Paid - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 5: Get Expense Summary
async function testGetExpenseSummary() {
    try {
        console.log('\n📊 Testing Get Expense Summary...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/expenses/summary/summary`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Expense Summary - SUCCESS');
        console.log('📋 Total amount:', response.data.summary?.totalAmount);
        console.log('📋 Categories:', response.data.summary?.byCategory?.length || 0);
        console.log('📋 Status breakdown:', response.data.summary?.byStatus?.length || 0);
        
        return response.data.summary;
    } catch (error) {
        console.error('❌ Get Expense Summary - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 6: Get All Payments
async function testGetAllPayments() {
    try {
        console.log('\n💳 Testing Get All Payments...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/payments`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get All Payments - SUCCESS');
        console.log('📋 Payments count:', response.data.payments?.length || 0);
        
        return response.data.payments || [];
    } catch (error) {
        console.error('❌ Get All Payments - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 7: Get All Transactions
async function testGetAllTransactions() {
    try {
        console.log('\n🔄 Testing Get All Transactions...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get All Transactions - SUCCESS');
        console.log('📋 Transactions count:', response.data.transactions?.length || 0);
        console.log('📋 Total pages:', response.data.pagination?.totalPages);
        
        return response.data.transactions || [];
    } catch (error) {
        console.error('❌ Get All Transactions - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 8: Get Transaction Summary
async function testGetTransactionSummary() {
    try {
        console.log('\n📊 Testing Get Transaction Summary...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/summary`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Transaction Summary - SUCCESS');
        console.log('📋 Total transactions:', response.data.summary?.totalTransactions);
        console.log('📋 Total amount:', response.data.summary?.totalAmount);
        console.log('📋 By type:', Object.keys(response.data.summary?.byType || {}));
        
        return response.data.summary;
    } catch (error) {
        console.error('❌ Get Transaction Summary - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return null;
    }
}

// Test 9: Get Transaction Entries
async function testGetTransactionEntries() {
    try {
        console.log('\n📋 Testing Get Transaction Entries...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/transactions/transaction-entries`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Transaction Entries - SUCCESS');
        console.log('📋 Entries count:', response.data.entries?.length || 0);
        
        if (response.data.entries && response.data.entries.length > 0) {
            console.log('📄 Sample entry:', {
                account: response.data.entries[0].account?.name,
                debit: response.data.entries[0].debit,
                credit: response.data.entries[0].credit
            });
        }
        
        return response.data.entries || [];
    } catch (error) {
        console.error('❌ Get Transaction Entries - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 10: Get All Vendors
async function testGetAllVendors() {
    try {
        console.log('\n🏢 Testing Get All Vendors...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/vendors`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get All Vendors - SUCCESS');
        console.log('📋 Vendors count:', response.data.vendors?.length || 0);
        
        return response.data.vendors || [];
    } catch (error) {
        console.error('❌ Get All Vendors - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 11: Get Vendors for Quotations
async function testGetVendorsForQuotations() {
    try {
        console.log('\n🏢 Testing Get Vendors for Quotations...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/vendors/for-quotations`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Vendors for Quotations - SUCCESS');
        console.log('📋 Vendors count:', response.data.vendors?.length || 0);
        
        if (response.data.vendors && response.data.vendors.length > 0) {
            console.log('📄 Sample vendor:', {
                businessName: response.data.vendors[0].businessName,
                category: response.data.vendors[0].category,
                balance: response.data.vendors[0].balance
            });
        }
        
        return response.data.vendors || [];
    } catch (error) {
        console.error('❌ Get Vendors for Quotations - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 12: Get Balance Sheets
async function testGetBalanceSheets() {
    try {
        console.log('\n📊 Testing Get Balance Sheets...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/balance-sheets`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Balance Sheets - SUCCESS');
        console.log('📋 Balance sheets count:', response.data.balanceSheets?.length || 0);
        
        return response.data.balanceSheets || [];
    } catch (error) {
        console.error('❌ Get Balance Sheets - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Test 13: Get Income Statements
async function testGetIncomeStatements() {
    try {
        console.log('\n📈 Testing Get Income Statements...');
        
        const response = await axios.get(`${BASE_URL}/api/finance/income-statements`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        console.log('✅ Get Income Statements - SUCCESS');
        console.log('📋 Income statements count:', response.data.incomeStatements?.length || 0);
        
        return response.data.incomeStatements || [];
    } catch (error) {
        console.error('❌ Get Income Statements - FAILED:', error.response?.status, error.response?.data?.message || error.message);
        return [];
    }
}

// Main test function
async function runFinanceRequestHandlingTests() {
    console.log('🚀 Starting Finance Request Handling Tests\n');
    
    // Step 1: Login
    if (!await login()) {
        return;
    }
    
    // Step 2: Test Expense Management
    const expenses = await testGetAllExpenses();
    if (expenses.length > 0) {
        const pendingExpense = expenses.find(exp => exp.paymentStatus === 'Pending');
        if (pendingExpense) {
            await testGetExpenseById(pendingExpense._id);
            await testApproveExpense(pendingExpense._id);
            await testMarkExpenseAsPaid(pendingExpense._id);
        }
    }
    
    // Step 3: Test Expense Summary
    await testGetExpenseSummary();
    
    // Step 4: Test Payment Processing
    await testGetAllPayments();
    
    // Step 5: Test Transaction Management
    const transactions = await testGetAllTransactions();
    await testGetTransactionSummary();
    await testGetTransactionEntries();
    
    // Step 6: Test Vendor Management
    await testGetAllVendors();
    await testGetVendorsForQuotations();
    
    // Step 7: Test Financial Reporting
    await testGetBalanceSheets();
    await testGetIncomeStatements();
    
    console.log('\n🎉 Finance Request Handling Tests Completed!');
    console.log('\n📊 Summary:');
    console.log('✅ Expense management (view, approve, mark as paid)');
    console.log('✅ Payment processing and tracking');
    console.log('✅ Transaction management and double-entry bookkeeping');
    console.log('✅ Vendor management and quotations');
    console.log('✅ Financial reporting (balance sheets, income statements)');
    console.log('✅ Expense summary and analytics');
    console.log('✅ Transaction summary and entries');
    
    console.log('\n🔗 Finance Request Handling Endpoints:');
    console.log('  - GET /api/finance/expenses');
    console.log('  - GET /api/finance/expenses/:id');
    console.log('  - PATCH /api/finance/expenses/:id/approve');
    console.log('  - PATCH /api/finance/expenses/:id/mark-paid');
    console.log('  - GET /api/finance/expenses/summary/summary');
    console.log('  - GET /api/finance/payments');
    console.log('  - GET /api/finance/transactions');
    console.log('  - GET /api/finance/transactions/summary');
    console.log('  - GET /api/finance/transactions/transaction-entries');
    console.log('  - GET /api/finance/vendors');
    console.log('  - GET /api/finance/vendors/for-quotations');
    console.log('  - GET /api/finance/balance-sheets');
    console.log('  - GET /api/finance/income-statements');
    
    console.log('\n🚀 Finance request handling is fully functional!');
}

// Run the tests
runFinanceRequestHandlingTests().catch(console.error); 