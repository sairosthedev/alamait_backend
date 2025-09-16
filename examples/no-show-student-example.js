/**
 * Example: How to handle a no-show student payment scenario
 * 
 * This script demonstrates how to use the new no-show student payment
 * forfeiture functionality when a student doesn't show up for their lease.
 * 
 * Two approaches are shown:
 * 1. Process no-show and assign replacement in one API call
 * 2. Process no-show first, then add replacement through admin panel
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/finance/transactions';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual token

// Example scenario data
const noShowScenario = {
  studentId: "64f1a2b3c4d5e6f7g8h9i0j1",
  studentName: "John Smith",
  paymentId: "64f1a2b3c4d5e6f7g8h9i0j2",
  originalPaymentAmount: 500,
  reason: "Student no-show for September lease start - visa issues",
  replacementStudentId: "64f1a2b3c4d5e6f7g8h9i0j3",
  replacementStudentName: "Jane Doe",
  residenceId: "64f1a2b3c4d5e6f7g8h9i0j4",
  date: "2024-09-01T00:00:00.000Z"
};

/**
 * Process a no-show student payment forfeiture
 */
async function handleNoShowStudentPayment(scenarioData) {
  try {
    console.log('🚫 Processing no-show student payment forfeiture...');
    console.log(`Student: ${scenarioData.studentName}`);
    console.log(`Amount: $${scenarioData.originalPaymentAmount}`);
    console.log(`Reason: ${scenarioData.reason}`);
    
    const response = await axios.post(
      `${API_BASE_URL}/handle-no-show-payment`,
      scenarioData,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log('✅ Forfeiture processed successfully!');
      console.log('📊 Accounting Impact:');
      console.log(`   Income Recognized: $${response.data.data.accountingImpact.incomeRecognized}`);
      console.log(`   Account Used: ${response.data.data.accountingImpact.accountUsed.name}`);
      console.log(`   A/R Reduction: $${response.data.data.accountingImpact.arReduction}`);
      
      console.log('🔄 Next Steps:');
      console.log(`   Process replacement student: ${scenarioData.replacementStudentName}`);
      console.log('   Use standard application/payment flow for replacement');
      
      return response.data;
    } else {
      throw new Error(response.data.message);
    }
    
  } catch (error) {
    console.error('❌ Error processing forfeiture:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 1: Process no-show and assign replacement in one API call
 */
async function handleNoShowWithReplacement() {
  try {
    console.log('=== Approach 1: No-Show + Replacement in One Call ===\n');
    
    const result = await handleNoShowStudentPayment(noShowScenario);
    
    console.log('\n📋 Transaction Details:');
    console.log(`Transaction ID: ${result.data.forfeitureTransaction.transactionId}`);
    console.log(`Description: ${result.data.forfeitureTransaction.description}`);
    console.log(`Date: ${result.data.forfeitureTransaction.date}`);
    
    console.log('\n🏠 Room Availability:');
    if (result.data.roomAvailability.roomFreed) {
      console.log(`Room Freed: ${result.data.roomAvailability.freedRoom.roomNumber}`);
      console.log(`New Status: ${result.data.roomAvailability.freedRoom.newStatus}`);
      console.log(`Occupancy: ${result.data.roomAvailability.freedRoom.oldOccupancy} → ${result.data.roomAvailability.freedRoom.newOccupancy}`);
    }
    
    console.log('\n🔄 Replacement Student:');
    if (result.data.replacementInfo.replacementResult?.assigned) {
      console.log(`Replacement Assigned: ${result.data.replacementInfo.replacementStudentName}`);
      console.log(`Room: ${result.data.replacementInfo.replacementResult.replacementStudent.roomNumber}`);
      console.log(`Valid Until: ${result.data.replacementInfo.replacementResult.replacementStudent.validUntil}`);
    }
    
    console.log('\n✅ Process completed successfully!');
    console.log('Payment forfeited, room freed, and replacement student assigned.');
    
    return result;
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    throw error;
  }
}

/**
 * Example 2: Process no-show first, then add replacement through admin panel
 */
async function handleNoShowThenAddReplacement() {
  try {
    console.log('\n=== Approach 2: No-Show First, Then Add Replacement ===\n');
    
    // Step 1: Process no-show WITHOUT replacement student
    const noShowOnlyScenario = { ...noShowScenario };
    delete noShowOnlyScenario.replacementStudentId;
    delete noShowOnlyScenario.replacementStudentName;
    
    console.log('Step 1: Processing no-show student...');
    const noShowResult = await handleNoShowStudentPayment(noShowOnlyScenario);
    
    console.log('\n📋 No-Show Processed:');
    console.log(`Transaction ID: ${noShowResult.data.forfeitureTransaction.transactionId}`);
    console.log(`Payment Forfeited: $${noShowResult.data.forfeitureTransaction.totalAmount}`);
    
    if (noShowResult.data.roomAvailability.roomFreed) {
      console.log(`Room Freed: ${noShowResult.data.roomAvailability.freedRoom.roomNumber}`);
      console.log(`Room Status: ${noShowResult.data.roomAvailability.freedRoom.newStatus}`);
    }
    
    console.log('\nStep 2: Room is now available for replacement student');
    console.log('Use your existing "Add Students" functionality to assign the replacement student');
    console.log(`Available Room: ${noShowResult.data.roomAvailability.freedRoom.roomNumber}`);
    
    console.log('\n✅ No-show processed successfully!');
    console.log('Room is now available for replacement through admin panel.');
    
    return noShowResult;
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    throw error;
  }
}

/**
 * Example usage - Choose your approach
 */
async function main() {
  try {
    console.log('=== No-Show Student Payment Handling Examples ===\n');
    
    // Choose which approach to demonstrate
    const approach = process.argv[2] || '1'; // Default to approach 1
    
    if (approach === '1') {
      await handleNoShowWithReplacement();
    } else if (approach === '2') {
      await handleNoShowThenAddReplacement();
    } else {
      console.log('Usage: node no-show-student-example.js [1|2]');
      console.log('  1: Process no-show and assign replacement in one call');
      console.log('  2: Process no-show first, then add replacement through admin panel');
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
  handleNoShowStudentPayment,
  handleNoShowWithReplacement,
  handleNoShowThenAddReplacement,
  noShowScenario
};
