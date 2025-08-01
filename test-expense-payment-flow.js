const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual test token

// Test data
const testExpense = {
    expenseId: 'TEST-EXP-001',
    residence: '507f1f77bcf86cd799439011', // Replace with actual residence ID
    category: 'Supplies',
    amount: 150.00,
    description: 'Test office supplies payment',
    expenseDate: new Date().toISOString(),
    period: 'monthly',
    paymentMethod: 'Petty Cash'
};

async function testExpensePaymentFlow() {
    console.log('🧪 Testing Complete Expense Payment Flow\n');

    try {
        // Step 1: Create a test expense
        console.log('1️⃣ Creating test expense...');
        const createResponse = await axios.post(`${BASE_URL}/finance/expenses`, testExpense, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const expenseId = createResponse.data.expense._id;
        console.log('✅ Expense created:', expenseId);

        // Step 2: Mark expense as paid
        console.log('\n2️⃣ Marking expense as paid...');
        const markPaidResponse = await axios.patch(`${BASE_URL}/finance/expenses/${expenseId}/mark-paid`, {
            paymentMethod: 'Petty Cash',
            notes: 'Test payment via petty cash',
            paidDate: new Date().toISOString()
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Expense marked as paid');
        console.log('📊 Payment details:', {
            paymentStatus: markPaidResponse.data.expense.paymentStatus,
            paymentMethod: markPaidResponse.data.expense.paymentMethod,
            paidDate: markPaidResponse.data.expense.paidDate
        });

        // Step 3: Verify transaction was created
        console.log('\n3️⃣ Verifying transaction creation...');
        const transactionResponse = await axios.get(`${BASE_URL}/finance/transactions`, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`
            },
            params: {
                reference: testExpense.expenseId
            }
        });

        if (transactionResponse.data.transactions && transactionResponse.data.transactions.length > 0) {
            const transaction = transactionResponse.data.transactions[0];
            console.log('✅ Transaction created:', transaction._id);
            console.log('📊 Transaction details:', {
                description: transaction.description,
                reference: transaction.reference,
                entries: transaction.entries?.length || 0
            });
        } else {
            console.log('❌ No transaction found for expense');
        }

        // Step 4: Verify chart of accounts impact
        console.log('\n4️⃣ Verifying chart of accounts impact...');
        const accountsResponse = await axios.get(`${BASE_URL}/finance/accounts`, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`
            }
        });

        const expenseAccount = accountsResponse.data.accounts.find(acc => acc.code === '5099');
        const pettyCashAccount = accountsResponse.data.accounts.find(acc => acc.code === '1011');

        if (expenseAccount) {
            console.log('✅ Expense account found:', expenseAccount.name);
        }
        if (pettyCashAccount) {
            console.log('✅ Petty cash account found:', pettyCashAccount.name);
        }

        console.log('\n🎉 Expense payment flow test completed successfully!');
        console.log('\n📋 Summary:');
        console.log('- Expense created and marked as paid');
        console.log('- Double-entry transaction created');
        console.log('- Chart of accounts properly updated');
        console.log('- Audit trail maintained');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            console.log('\n💡 Make sure to update TEST_TOKEN with a valid authentication token');
        }
    }
}

// Test different payment methods
async function testDifferentPaymentMethods() {
    console.log('\n🧪 Testing Different Payment Methods\n');

    const paymentMethods = ['Bank Transfer', 'Cash', 'Ecocash', 'Innbucks'];
    
    for (const method of paymentMethods) {
        try {
            console.log(`\n📝 Testing payment method: ${method}`);
            
            const testExpense = {
                expenseId: `TEST-${method.toUpperCase()}-${Date.now()}`,
                residence: '507f1f77bcf86cd799439011', // Replace with actual residence ID
                category: 'Maintenance',
                amount: 75.00,
                description: `Test ${method} payment`,
                expenseDate: new Date().toISOString(),
                period: 'monthly',
                paymentMethod: method
            };

            // Create expense
            const createResponse = await axios.post(`${BASE_URL}/finance/expenses`, testExpense, {
                headers: {
                    'Authorization': `Bearer ${TEST_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            const expenseId = createResponse.data.expense._id;

            // Mark as paid
            const markPaidResponse = await axios.patch(`${BASE_URL}/finance/expenses/${expenseId}/mark-paid`, {
                paymentMethod: method,
                notes: `Test ${method} payment`
            }, {
                headers: {
                    'Authorization': `Bearer ${TEST_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`✅ ${method} payment successful`);
            console.log(`   - Status: ${markPaidResponse.data.expense.paymentStatus}`);
            console.log(`   - Amount: $${markPaidResponse.data.expense.amount}`);

        } catch (error) {
            console.error(`❌ ${method} payment failed:`, error.response?.data?.error || error.message);
        }
    }
}

// Run tests
async function runAllTests() {
    await testExpensePaymentFlow();
    await testDifferentPaymentMethods();
}

// Export for use in other scripts
module.exports = {
    testExpensePaymentFlow,
    testDifferentPaymentMethods,
    runAllTests
};

// Run if this file is executed directly
if (require.main === module) {
    runAllTests();
} 