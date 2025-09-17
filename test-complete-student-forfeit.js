/**
 * Test Script: Complete Student Forfeiture System
 * 
 * This script demonstrates the comprehensive student forfeiture functionality
 * that handles everything: accrual reversal, payment forfeiture, room management,
 * student status updates, and data archiving.
 * 
 * Example: Kudzai Vella's complete forfeiture
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/finance/transactions';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual token

// Example scenario data
const kudzaiVellaForfeit = {
    studentId: "68c69fcf016eede4d42d2746", // Kudzai Vella's student ID
    reason: "Student no-show for September lease start - visa issues",
    replacementStudentId: "68c69fcf016eede4d42d2747", // Optional replacement student
    replacementStudentName: "Jane Doe", // Optional replacement name
    date: "2025-09-14T00:00:00.000Z"
};

/**
 * Complete student forfeiture (comprehensive no-show handling)
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
            console.log(`   ID: ${data.student.id}`);
            console.log(`   Name: ${data.student.name}`);
            console.log(`   Email: ${data.student.email}`);
            console.log(`   Status: ${data.student.status}`);
            console.log(`   Application Only: ${data.student.isApplicationOnly}`);
            console.log(`   Archived At: ${data.student.archivedAt}`);
            
            console.log('\n📊 Applications:');
            console.log(`   Applications Updated: ${data.applications.updated}`);
            if (data.applications.details && data.applications.details.length > 0) {
                data.applications.details.forEach((app, index) => {
                    console.log(`   ${index + 1}. Application ID: ${app.applicationId}`);
                    console.log(`      Code: ${app.applicationCode}`);
                    console.log(`      Status Change: ${app.oldStatus} → ${app.newStatus}`);
                    console.log(`      Reason: ${app.reason}`);
                });
            }
            
            console.log('\n💰 Payments:');
            console.log(`   Total Amount: $${data.payments.totalAmount}`);
            console.log(`   Total Count: ${data.payments.totalCount}`);
            if (data.payments.forfeitureResult) {
                console.log(`   Forfeiture Transaction: ${data.payments.forfeitureResult.forfeitureTransactionId}`);
                console.log(`   Forfeited Amount: $${data.payments.forfeitureResult.totalAmount}`);
            }
            
            console.log('\n🔄 Accrual Reversals:');
            console.log(`   Transactions Reversed: ${data.accrualReversals.transactionsReversed}`);
            if (data.accrualReversals.details && data.accrualReversals.details.length > 0) {
                data.accrualReversals.details.forEach((reversal, index) => {
                    console.log(`   ${index + 1}. Original: ${reversal.originalTransactionId}`);
                    console.log(`      Reversal ID: ${reversal.reversalId}`);
                });
            }
            
            console.log('\n🏠 Room Availability:');
            if (data.roomAvailability?.roomFreed) {
                console.log(`   Room Freed: ${data.roomAvailability.freedRoom.roomNumber}`);
                console.log(`   Room ID: ${data.roomAvailability.freedRoom.roomId}`);
                console.log(`   Occupancy: ${data.roomAvailability.freedRoom.oldOccupancy} → ${data.roomAvailability.freedRoom.newOccupancy}`);
                console.log(`   New Status: ${data.roomAvailability.freedRoom.newStatus}`);
            } else {
                console.log('   No room to free');
            }
            
            console.log('\n🔄 Replacement Student:');
            if (data.replacementStudent?.assigned) {
                console.log(`   Replacement Assigned: ${data.replacementStudent.replacementStudent.studentName}`);
                console.log(`   Student ID: ${data.replacementStudent.replacementStudent.studentId}`);
                console.log(`   Room: ${data.replacementStudent.replacementStudent.roomNumber}`);
                console.log(`   Valid Until: ${data.replacementStudent.replacementStudent.validUntil}`);
            } else {
                console.log('   No replacement assigned - room is available for manual assignment');
                if (data.replacementStudent?.reason) {
                    console.log(`   Reason: ${data.replacementStudent.reason}`);
                }
            }
            
            console.log('\n📦 Archived Data:');
            if (data.archivedData) {
                console.log(`   Expired Student ID: ${data.archivedData.expiredStudentId}`);
                console.log(`   Archived At: ${data.archivedData.archivedAt}`);
                console.log(`   Reason: ${data.archivedData.reason}`);
            } else {
                console.log('   No data archived');
            }
            
            console.log('\n📊 Summary:');
            console.log(`   Student Removed: ${data.summary.studentRemoved ? 'Yes' : 'No'}`);
            console.log(`   Applications Expired: ${data.summary.applicationsExpired}`);
            console.log(`   Payments Forfeited: $${data.summary.paymentsForfeited}`);
            console.log(`   Accruals Reversed: ${data.summary.accrualsReversed}`);
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
 * Example 1: Forfeit Kudzai Vella with replacement
 */
async function forfeitKudzaiVellaWithReplacement() {
    try {
        console.log('=== Example 1: Forfeit Kudzai Vella with Replacement ===\n');
        
        const result = await forfeitStudent(kudzaiVellaForfeit);
        
        console.log('\n✅ Process completed successfully!');
        console.log('Complete forfeiture process executed:');
        console.log('  - All lease start accruals reversed');
        console.log('  - Applications marked as expired');
        console.log('  - Room freed and made available');
        console.log('  - Replacement student assigned');
        console.log('  - Student data archived');
        console.log('  - Student removed from active users');
        
        return result;
        
    } catch (error) {
        console.error('❌ Process failed:', error.message);
        throw error;
    }
}

/**
 * Example 2: Forfeit without replacement
 */
async function forfeitKudzaiVellaWithoutReplacement() {
    try {
        console.log('\n=== Example 2: Forfeit Kudzai Vella without Replacement ===\n');
        
        // Remove replacement details
        const noReplacementScenario = { ...kudzaiVellaForfeit };
        delete noReplacementScenario.replacementStudentId;
        delete noReplacementScenario.replacementStudentName;
        
        const result = await forfeitStudent(noReplacementScenario);
        
        console.log('\n✅ Process completed successfully!');
        console.log('Complete forfeiture process executed:');
        console.log('  - All lease start accruals reversed');
        console.log('  - Applications marked as expired');
        console.log('  - Room freed and made available');
        console.log('  - No replacement assigned - room available for manual assignment');
        console.log('  - Student data archived');
        console.log('  - Student removed from active users');
        
        return result;
        
    } catch (error) {
        console.error('❌ Process failed:', error.message);
        throw error;
    }
}

/**
 * Example 3: Forfeit application-only student
 */
async function forfeitApplicationOnlyStudent() {
    try {
        console.log('\n=== Example 3: Forfeit Application-Only Student ===\n');
        
        const applicationOnlyScenario = {
            studentId: "68c308dacad4b54252cec896", // Application ID
            reason: "Student no-show for September lease start",
            date: "2025-09-14T00:00:00.000Z"
        };
        
        const result = await forfeitStudent(applicationOnlyScenario);
        
        console.log('\n✅ Process completed successfully!');
        console.log('Application-only student forfeiture executed:');
        console.log('  - All lease start accruals reversed');
        console.log('  - Application marked as expired');
        console.log('  - Room freed and made available');
        console.log('  - Student data archived');
        console.log('  - No user deletion (application-only)');
        
        return result;
        
    } catch (error) {
        console.error('❌ Process failed:', error.message);
        throw error;
    }
}

/**
 * Main function to run examples
 */
async function main() {
    try {
        console.log('=== Complete Student Forfeiture Examples ===\n');
        
        // Choose which example to demonstrate
        const example = process.argv[2] || '1'; // Default to example 1
        
        if (example === '1') {
            await forfeitKudzaiVellaWithReplacement();
        } else if (example === '2') {
            await forfeitKudzaiVellaWithoutReplacement();
        } else if (example === '3') {
            await forfeitApplicationOnlyStudent();
        } else {
            console.log('Usage: node test-complete-student-forfeit.js [1|2|3]');
            console.log('  1: Forfeit Kudzai Vella with replacement (default)');
            console.log('  2: Forfeit Kudzai Vella without replacement');
            console.log('  3: Forfeit application-only student');
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
    forfeitKudzaiVellaWithReplacement,
    forfeitKudzaiVellaWithoutReplacement,
    forfeitApplicationOnlyStudent,
    kudzaiVellaForfeit
};


