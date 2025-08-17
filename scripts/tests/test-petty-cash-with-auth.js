const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = '6889172ba1487dda41654a97'; // Admin user ID
const TEST_AMOUNT = 200;

// Test authentication token (you'll need to replace this with a valid token)
const AUTH_TOKEN = 'your_jwt_token_here'; // Replace with actual token

async function testPettyCashAllocation() {
    console.log('🧪 Testing Petty Cash Allocation Flow\n');

    try {
        // Test 1: Check if user is eligible for petty cash
        console.log('1️⃣ Checking user eligibility...');
        try {
            const eligibleResponse = await axios.get(`${BASE_URL}/api/finance/petty-cash/eligible-users`, {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const eligibleUsers = eligibleResponse.data;
            const targetUser = eligibleUsers.find(user => user._id === TEST_USER_ID);
            
            if (targetUser) {
                console.log(`✅ User ${targetUser.firstName} ${targetUser.lastName} (${targetUser.role}) is eligible for petty cash`);
            } else {
                console.log(`❌ User ${TEST_USER_ID} not found in eligible users list`);
                return;
            }
        } catch (error) {
            console.log('❌ Error checking eligibility:', error.response?.data?.message || error.message);
            return;
        }

        // Test 2: Check current petty cash allocations
        console.log('\n2️⃣ Checking current petty cash allocations...');
        try {
            const allocationsResponse = await axios.get(`${BASE_URL}/api/finance/petty-cash`, {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const allocations = allocationsResponse.data;
            const userAllocation = allocations.find(alloc => alloc.user._id === TEST_USER_ID && alloc.status === 'active');
            
            if (userAllocation) {
                console.log(`⚠️  User already has active petty cash allocation:`);
                console.log(`   - Amount: $${userAllocation.allocatedAmount}`);
                console.log(`   - Date: ${new Date(userAllocation.createdAt).toLocaleDateString()}`);
                console.log(`   - Notes: ${userAllocation.notes || 'None'}`);
                
                // Test 3: Update existing allocation
                console.log('\n3️⃣ Updating existing allocation...');
                try {
                    const updateResponse = await axios.put(`${BASE_URL}/api/finance/petty-cash/${userAllocation._id}`, {
                        allocatedAmount: TEST_AMOUNT,
                        notes: 'Updated girlfriend allowance'
                    }, {
                        headers: {
                            'Authorization': `Bearer ${AUTH_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    console.log('✅ Petty cash allocation updated successfully');
                    console.log('   - New amount:', updateResponse.data.allocatedAmount);
                    console.log('   - Notes:', updateResponse.data.notes);
                    
                } catch (error) {
                    console.log('❌ Error updating allocation:', error.response?.data?.message || error.message);
                }
            } else {
                console.log('✅ No active petty cash allocation found for user');
                
                // Test 3: Create new allocation
                console.log('\n3️⃣ Creating new petty cash allocation...');
                try {
                    const allocationResponse = await axios.post(`${BASE_URL}/api/finance/petty-cash`, {
                        userId: TEST_USER_ID,
                        amount: TEST_AMOUNT,
                        notes: 'Girlfriend allowance'
                    }, {
                        headers: {
                            'Authorization': `Bearer ${AUTH_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    console.log('✅ Petty cash allocated successfully');
                    console.log('   - Amount:', allocationResponse.data.allocatedAmount);
                    console.log('   - User:', allocationResponse.data.userName);
                    console.log('   - Notes:', allocationResponse.data.notes);
                    console.log('   - Allocation ID:', allocationResponse.data._id);
                    
                } catch (error) {
                    console.log('❌ Error creating allocation:', error.response?.data?.message || error.message);
                }
            }
            
        } catch (error) {
            console.log('❌ Error checking allocations:', error.response?.data?.message || error.message);
        }

        // Test 4: Check petty cash balance
        console.log('\n4️⃣ Checking petty cash balance...');
        try {
            const balanceResponse = await axios.get(`${BASE_URL}/api/finance/petty-cash/balance`, {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Petty cash balance retrieved');
            console.log('   - Account:', balanceResponse.data.account.name);
            console.log('   - Current Balance: $', balanceResponse.data.currentBalance);
            console.log('   - Recent Transactions:', balanceResponse.data.recentTransactions.length);
            
        } catch (error) {
            console.log('❌ Error checking balance:', error.response?.data?.message || error.message);
        }

        // Test 5: Check all petty cash balances (finance users only)
        console.log('\n5️⃣ Checking all petty cash balances...');
        try {
            const allBalancesResponse = await axios.get(`${BASE_URL}/api/finance/petty-cash/all-balances`, {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ All petty cash balances retrieved');
            console.log('   - Total Balance: $', allBalancesResponse.data.totalBalance);
            console.log('   - Account Balances:');
            allBalancesResponse.data.balances.forEach(balance => {
                console.log(`     * ${balance.accountName}: $${balance.balance}`);
            });
            
        } catch (error) {
            console.log('❌ Error checking all balances:', error.response?.data?.message || error.message);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Instructions for running the test
console.log('📋 PETTY CASH ALLOCATION TEST INSTRUCTIONS\n');
console.log('1. Make sure your server is running on port 5000');
console.log('2. Replace AUTH_TOKEN with a valid JWT token from a finance user');
console.log('3. Update TEST_USER_ID if needed');
console.log('4. Run: node test-petty-cash-with-auth.js\n');

// Run the test
testPettyCashAllocation(); 