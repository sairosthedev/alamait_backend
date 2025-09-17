/**
 * Test Script: Re-run Kudzai Vella Forfeiture with Improved Search Logic
 * 
 * This script tests the improved forfeiture system that should now find and reverse
 * all lease start transactions and payment transactions for Kudzai Vella.
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api/finance/transactions';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual token

// Kudzai Vella's data
const kudzaiVellaForfeit = {
    studentId: "68c814d942bf9ffb8792f0e3", // Application ID
    reason: "Student no-show for September lease start - comprehensive test",
    date: "2025-09-15T00:00:00.000Z"
};

/**
 * Test the improved forfeiture system
 */
async function testImprovedForfeit() {
    try {
        console.log('🚫 Testing improved forfeiture system for Kudzai Vella...');
        console.log(`Student ID: ${kudzaiVellaForfeit.studentId}`);
        console.log(`Reason: ${kudzaiVellaForfeit.reason}`);
        
        const response = await axios.post(
            `${API_BASE_URL}/forfeit-student`,
            kudzaiVellaForfeit,
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.success) {
            console.log('✅ Improved forfeiture completed successfully!');
            
            const data = response.data.data;
            
            console.log('\n📋 Student Information:');
            console.log(`   ID: ${data.student.id}`);
            console.log(`   Name: ${data.student.name}`);
            console.log(`   Email: ${data.student.email}`);
            console.log(`   Status: ${data.student.status}`);
            
            console.log('\n🔄 Accrual Reversals:');
            console.log(`   Transactions Reversed: ${data.accrualReversals.transactionsReversed}`);
            if (data.accrualReversals.details && data.accrualReversals.details.length > 0) {
                data.accrualReversals.details.forEach((reversal, index) => {
                    console.log(`   ${index + 1}. Original: ${reversal.originalTransactionId}`);
                    console.log(`      Reversal ID: ${reversal.reversalId}`);
                });
            } else {
                console.log('   No accrual reversals found');
            }
            
            console.log('\n💰 Payments:');
            console.log(`   Payment Records: ${data.payments.totalCount} ($${data.payments.totalAmount})`);
            console.log(`   Payment Transactions: ${data.payments.paymentTransactions.totalCount} ($${data.payments.paymentTransactions.totalAmount})`);
            
            if (data.payments.paymentTransactions.transactions && data.payments.paymentTransactions.transactions.length > 0) {
                console.log('   Payment Transactions Found:');
                data.payments.paymentTransactions.transactions.forEach((transaction, index) => {
                    console.log(`   ${index + 1}. ${transaction.transactionId}: ${transaction.description} ($${transaction.amount})`);
                });
            }
            
            if (data.payments.forfeitureResult) {
                console.log(`   Forfeiture Transaction: ${data.payments.forfeitureResult.forfeitureTransactionId}`);
                console.log(`   Total Forfeited: $${data.payments.forfeitureResult.totalAmount}`);
            } else {
                console.log('   No payment forfeiture needed');
            }
            
            console.log('\n📊 Summary:');
            console.log(`   Applications Expired: ${data.summary.applicationsExpired}`);
            console.log(`   Payments Forfeited: $${data.summary.paymentsForfeited}`);
            console.log(`   Accruals Reversed: ${data.summary.accrualsReversed}`);
            console.log(`   Archived to Expired Students: ${data.summary.archivedToExpiredStudents ? 'Yes' : 'No'}`);
            
            // Expected results for Kudzai Vella
            console.log('\n🎯 Expected Results:');
            console.log('   - Should find 1 lease start transaction (LEASE_START_APP1757943001482W209T_1757943002968)');
            console.log('   - Should find 2 payment transactions (rent $30 + admin $20)');
            console.log('   - Should reverse all accruals ($340 total)');
            console.log('   - Should forfeit all payments ($50 total)');
            
            return response.data;
        } else {
            throw new Error(response.data.message);
        }
        
    } catch (error) {
        console.error('❌ Error testing improved forfeiture:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('=== Testing Improved Kudzai Vella Forfeiture ===\n');
        
        const result = await testImprovedForfeit();
        
        console.log('\n✅ Test completed successfully!');
        console.log('The improved forfeiture system should now find and process all transactions.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = {
    testImprovedForfeit,
    kudzaiVellaForfeit
};


