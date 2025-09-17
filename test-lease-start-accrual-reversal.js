/**
 * Test Script: Reverse ALL Accrual Entries from Lease Start Transaction
 * 
 * This script demonstrates how to use the new lease start accrual reversal endpoint
 * to reverse ALL accrual entries (rental income, admin fees, and security deposits)
 * for student forfeiture scenarios.
 * 
 * Example: Kudzai Vella's lease start transaction
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/finance/transactions';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual token

// Example transaction data from your provided example
const kudzaiVellaTransaction = {
    transactionId: "LEASE_START_APP1757847503810JUPIH_1757847505432",
    studentId: "68c69fcf016eede4d42d2746", // Kudzai Vella's student ID
    studentName: "Kudzai Vella",
    reason: "Student no-show for September lease start - visa issues",
    date: "2025-09-14T00:00:00.000Z"
};

/**
 * Reverse ALL accrual entries from lease start transaction
 */
async function reverseLeaseStartAccruals(transactionData) {
    try {
        console.log('🚫 Reversing ALL accrual entries from lease start transaction...');
        console.log(`Transaction ID: ${transactionData.transactionId}`);
        console.log(`Student: ${transactionData.studentName}`);
        console.log(`Reason: ${transactionData.reason}`);
        
        const response = await axios.post(
            `${API_BASE_URL}/reverse-lease-start-accruals`,
            transactionData,
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.success) {
            console.log('✅ All accrual entries reversed successfully!');
            
            // Display comprehensive results
            const data = response.data.data;
            
            console.log('\n📋 Original Transaction:');
            console.log(`   ID: ${data.originalTransaction.id}`);
            console.log(`   Transaction ID: ${data.originalTransaction.transactionId}`);
            console.log(`   Description: ${data.originalTransaction.description}`);
            console.log(`   Total Debit: $${data.originalTransaction.totalDebit}`);
            console.log(`   Total Credit: $${data.originalTransaction.totalCredit}`);
            console.log(`   Entries Count: ${data.originalTransaction.entriesCount}`);
            
            console.log('\n🔄 Reversal Transaction:');
            console.log(`   ID: ${data.reversalTransaction.id}`);
            console.log(`   Transaction ID: ${data.reversalTransaction.transactionId}`);
            console.log(`   Description: ${data.reversalTransaction.description}`);
            console.log(`   Total Debit: $${data.reversalTransaction.totalDebit}`);
            console.log(`   Total Credit: $${data.reversalTransaction.totalCredit}`);
            console.log(`   Entries Count: ${data.reversalTransaction.entriesCount}`);
            
            console.log('\n👤 Student Information:');
            console.log(`   ID: ${data.student.id}`);
            console.log(`   Name: ${data.student.name}`);
            
            console.log('\n💰 Accounting Impact:');
            console.log(`   Entries Reversed: ${data.accounting.entriesReversed}`);
            console.log(`   Total Amount Reversed: $${data.accounting.totalAmountReversed}`);
            console.log(`   Net Effect: $${data.accounting.netEffect}`);
            console.log(`   Reversal Type: ${data.accounting.reversalType}`);
            
            console.log('\n📊 Summary:');
            console.log(`   Reason: ${data.summary.reason}`);
            console.log(`   Date: ${data.summary.date}`);
            console.log(`   Complete Reversal: ${data.summary.completeReversal}`);
            console.log(`   All Accruals Reversed: ${data.summary.allAccrualsReversed}`);
            
            return response.data;
        } else {
            throw new Error(response.data.message);
        }
        
    } catch (error) {
        console.error('❌ Error reversing lease start accruals:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Example 1: Reverse Kudzai Vella's lease start accruals
 */
async function reverseKudzaiVellaAccruals() {
    try {
        console.log('=== Example: Reverse Kudzai Vella\'s Lease Start Accruals ===\n');
        
        const result = await reverseLeaseStartAccruals(kudzaiVellaTransaction);
        
        console.log('\n✅ Process completed successfully!');
        console.log('All accrual entries from lease start transaction have been reversed.');
        console.log('This includes:');
        console.log('  - Rental Income accruals ($160)');
        console.log('  - Administrative Fees accruals ($20)');
        console.log('  - Security Deposit accruals ($160)');
        console.log('  - Accounts Receivable entries ($340 total)');
        
        return result;
        
    } catch (error) {
        console.error('❌ Process failed:', error.message);
        throw error;
    }
}

/**
 * Example 2: Reverse with custom parameters
 */
async function reverseWithCustomParameters() {
    try {
        console.log('\n=== Example: Reverse with Custom Parameters ===\n');
        
        const customTransaction = {
            transactionId: "LEASE_START_APP1757847503810JUPIH_1757847505432",
            studentId: "68c69fcf016eede4d42d2746",
            studentName: "Kudzai Vella",
            reason: "Student forfeiture - contract breach",
            date: "2025-09-15T00:00:00.000Z"
        };
        
        const result = await reverseLeaseStartAccruals(customTransaction);
        
        console.log('\n✅ Custom reversal completed successfully!');
        
        return result;
        
    } catch (error) {
        console.error('❌ Custom reversal failed:', error.message);
        throw error;
    }
}

/**
 * Main function to run examples
 */
async function main() {
    try {
        console.log('=== Lease Start Accrual Reversal Examples ===\n');
        
        // Choose which example to demonstrate
        const example = process.argv[2] || '1'; // Default to example 1
        
        if (example === '1') {
            await reverseKudzaiVellaAccruals();
        } else if (example === '2') {
            await reverseWithCustomParameters();
        } else {
            console.log('Usage: node test-lease-start-accrual-reversal.js [1|2]');
            console.log('  1: Reverse Kudzai Vella\'s accruals (default)');
            console.log('  2: Reverse with custom parameters');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Process failed:', error.message);
        process.exit(1);
    }
}

// Run the example if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = {
    reverseLeaseStartAccruals,
    reverseKudzaiVellaAccruals,
    reverseWithCustomParameters,
    kudzaiVellaTransaction
};


