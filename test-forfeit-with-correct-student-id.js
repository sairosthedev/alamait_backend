/**
 * Test Script: Forfeit Kudzai Vella with Correct Student User ID
 * 
 * This script tests the forfeiture system using the correct student user ID
 * instead of the application ID.
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api/finance/transactions';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual token

// Possible student user IDs based on transaction data
const possibleStudentIds = [
    "68c814da42bf9ffb8792f124", // SourceId from lease start transaction
    "68c814da42bf9ffb8792f12b", // Transaction ID from lease start
    // Add more IDs as needed
];

/**
 * Test forfeiture with a specific student ID
 */
async function testForfeitWithStudentId(studentId) {
    try {
        console.log(`🚫 Testing forfeiture with Student ID: ${studentId}`);
        
        const forfeitData = {
            studentId: studentId,
            reason: "Student no-show for September lease start - using correct student ID",
            date: "2025-09-15T00:00:00.000Z"
        };
        
        const response = await axios.post(
            `${API_BASE_URL}/forfeit-student`,
            forfeitData,
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.success) {
            console.log('✅ Forfeiture completed successfully!');
            
            const data = response.data.data;
            
            console.log('\n📋 Results:');
            console.log(`   Student Name: ${data.student.name}`);
            console.log(`   Student Email: ${data.student.email}`);
            console.log(`   Applications Expired: ${data.summary.applicationsExpired}`);
            console.log(`   Payments Forfeited: $${data.summary.paymentsForfeited}`);
            console.log(`   Accruals Reversed: ${data.summary.accrualsReversed}`);
            
            if (data.accrualReversals.transactionsReversed > 0) {
                console.log('\n🔄 Accrual Reversals:');
                data.accrualReversals.details.forEach((reversal, index) => {
                    console.log(`   ${index + 1}. Original: ${reversal.originalTransactionId}`);
                    console.log(`      Reversal ID: ${reversal.reversalId}`);
                });
            }
            
            if (data.payments.paymentTransactions.totalCount > 0) {
                console.log('\n💰 Payment Transactions Found:');
                data.payments.paymentTransactions.transactions.forEach((transaction, index) => {
                    console.log(`   ${index + 1}. ${transaction.transactionId}: ${transaction.description} ($${transaction.amount})`);
                });
            }
            
            return {
                success: true,
                studentId: studentId,
                results: data
            };
        } else {
            console.log(`❌ Forfeiture failed: ${response.data.message}`);
            return {
                success: false,
                studentId: studentId,
                error: response.data.message
            };
        }
        
    } catch (error) {
        console.log(`❌ Error with Student ID ${studentId}:`, error.response?.data?.message || error.message);
        return {
            success: false,
            studentId: studentId,
            error: error.response?.data?.message || error.message
        };
    }
}

/**
 * Test all possible student IDs
 */
async function testAllPossibleStudentIds() {
    console.log('=== Testing Forfeiture with Different Student IDs ===\n');
    
    const results = [];
    
    for (const studentId of possibleStudentIds) {
        console.log(`\n--- Testing Student ID: ${studentId} ---`);
        const result = await testForfeitWithStudentId(studentId);
        results.push(result);
        
        if (result.success) {
            console.log(`✅ SUCCESS with Student ID: ${studentId}`);
            break; // Stop testing if we found a working ID
        } else {
            console.log(`❌ FAILED with Student ID: ${studentId}`);
        }
    }
    
    console.log('\n📊 Summary of Results:');
    results.forEach((result, index) => {
        console.log(`${index + 1}. Student ID: ${result.studentId}`);
        console.log(`   Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        if (!result.success) {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    const successfulResult = results.find(r => r.success);
    if (successfulResult) {
        console.log(`\n🎯 CORRECT STUDENT ID FOUND: ${successfulResult.studentId}`);
        console.log('Use this Student ID for future forfeiture operations.');
    } else {
        console.log('\n❌ No working Student ID found. Please run the find-kudzai-vella-student-id.js script to identify the correct ID.');
    }
    
    return results;
}

/**
 * Main function
 */
async function main() {
    try {
        const results = await testAllPossibleStudentIds();
        
        if (results.some(r => r.success)) {
            console.log('\n✅ Test completed successfully!');
        } else {
            console.log('\n❌ All tests failed. Please check the student ID.');
        }
        
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
    testForfeitWithStudentId,
    testAllPossibleStudentIds,
    possibleStudentIds
};


