/**
 * Example: How to forfeit a student (comprehensive no-show handling)
 * 
 * This script demonstrates how to use the new student forfeit functionality
 * to handle no-show students with complete system integration.
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/finance/transactions';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual token

// Example scenario data
const forfeitScenario = {
  studentId: "64f1a2b3c4d5e6f7g8h9i0j1",
  reason: "Student no-show for September lease start - visa issues",
  replacementStudentId: "64f1a2b3c4d5e6f7g8h9i0j3",
  replacementStudentName: "Jane Doe",
  date: "2024-09-01T00:00:00.000Z"
};

/**
 * Forfeit a student (comprehensive no-show handling)
 */
async function forfeitStudent(scenarioData) {
  try {
    console.log('🚫 Forfeiting student (comprehensive no-show handling)...');
    console.log(`Student ID: ${scenarioData.studentId}`);
    console.log(`Reason: ${scenarioData.reason}`);
    console.log(`Replacement: ${scenarioData.replacementStudentName || 'None'}`);
    
    const response = await axios.post(
      `${API_BASE_URL}/forfeit-student`,
      scenarioData,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log('✅ Student forfeited successfully!');
      
      // Display comprehensive results
      const data = response.data.data;
      
      console.log('\n📋 Student Information:');
      console.log(`   Name: ${data.student.name}`);
      console.log(`   Email: ${data.student.email}`);
      console.log(`   Status: ${data.student.status}`);
      console.log(`   Archived At: ${data.student.archivedAt}`);
      
      console.log('\n📊 Applications:');
      if (data.applications) {
        console.log(`   Application ID: ${data.applications.applicationId}`);
        console.log(`   Application Code: ${data.applications.applicationCode}`);
        console.log(`   Status Change: ${data.applications.oldStatus} → ${data.applications.newStatus}`);
        console.log(`   Reason: ${data.applications.reason}`);
      }
      
      console.log('\n💰 Payments:');
      console.log(`   Total Amount: $${data.payments.totalAmount}`);
      if (data.payments.forfeitureResult) {
        const accounting = data.payments.forfeitureResult.accountingImpact;
        console.log(`   Rental Income Reversed: $${accounting.rentalIncomeReversal?.amountReversed || 0}`);
        console.log(`   Net Income Impact: $${accounting.netIncomeImpact}`);
      }
      
      console.log('\n🏠 Room Availability:');
      if (data.roomAvailability?.roomFreed) {
        console.log(`   Room Freed: ${data.roomAvailability.freedRoom.roomNumber}`);
        console.log(`   New Status: ${data.roomAvailability.freedRoom.newStatus}`);
        console.log(`   Occupancy: ${data.roomAvailability.freedRoom.oldOccupancy} → ${data.roomAvailability.freedRoom.newOccupancy}`);
      }
      
      console.log('\n🔄 Replacement Student:');
      if (data.replacementStudent?.assigned) {
        console.log(`   Replacement Assigned: ${data.replacementStudent.replacementStudent.studentName}`);
        console.log(`   Room: ${data.replacementStudent.replacementStudent.roomNumber}`);
        console.log(`   Valid Until: ${data.replacementStudent.replacementStudent.validUntil}`);
      } else {
        console.log('   No replacement assigned - room is available for manual assignment');
      }
      
      console.log('\n📦 Archived Data:');
      console.log(`   Expired Student ID: ${data.archivedData.expiredStudentId}`);
      console.log(`   Archived At: ${data.archivedData.archivedAt}`);
      console.log(`   Reason: ${data.archivedData.reason}`);
      
      console.log('\n📊 Summary:');
      console.log(`   Student Removed: ${data.summary.studentRemoved ? 'Yes' : 'No'}`);
      console.log(`   Applications Expired: ${data.summary.applicationsExpired}`);
      console.log(`   Payments Forfeited: $${data.summary.paymentsForfeited}`);
      console.log(`   Room Freed: ${data.summary.roomFreed ? 'Yes' : 'No'}`);
      console.log(`   Replacement Assigned: ${data.summary.replacementAssigned ? 'Yes' : 'No'}`);
      console.log(`   Archived to Expired Students: ${data.summary.archivedToExpiredStudents ? 'Yes' : 'No'}`);
      
      return response.data;
    } else {
      throw new Error(response.data.message);
    }
    
  } catch (error) {
    console.error('❌ Error forfeiting student:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 1: Forfeit student with replacement
 */
async function forfeitStudentWithReplacement() {
  try {
    console.log('=== Example 1: Forfeit Student with Replacement ===\n');
    
    const result = await forfeitStudent(forfeitScenario);
    
    console.log('\n✅ Process completed successfully!');
    console.log('Student forfeited, room freed, and replacement assigned.');
    
    return result;
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    throw error;
  }
}

/**
 * Example 2: Forfeit student without replacement
 */
async function forfeitStudentWithoutReplacement() {
  try {
    console.log('\n=== Example 2: Forfeit Student without Replacement ===\n');
    
    // Remove replacement details
    const noReplacementScenario = { ...forfeitScenario };
    delete noReplacementScenario.replacementStudentId;
    delete noReplacementScenario.replacementStudentName;
    
    const result = await forfeitStudent(noReplacementScenario);
    
    console.log('\n✅ Process completed successfully!');
    console.log('Student forfeited and room freed - available for manual assignment.');
    
    return result;
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    throw error;
  }
}

/**
 * Example usage - Choose your scenario
 */
async function main() {
  try {
    console.log('=== Student Forfeit Examples ===\n');
    
    // Choose which example to demonstrate
    const example = process.argv[2] || '1'; // Default to example 1
    
    if (example === '1') {
      await forfeitStudentWithReplacement();
    } else if (example === '2') {
      await forfeitStudentWithoutReplacement();
    } else {
      console.log('Usage: node student-forfeit-example.js [1|2]');
      console.log('  1: Forfeit student with replacement');
      console.log('  2: Forfeit student without replacement');
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
  forfeitStudent,
  forfeitStudentWithReplacement,
  forfeitStudentWithoutReplacement,
  forfeitScenario
};


