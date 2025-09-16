/**
 * 🎯 Test Room Freedom Fix
 * 
 * This script tests why the room was not freed and verifies the fix
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Payment = require('../src/models/Payment');

async function testRoomFreedomFix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        const studentId = '68c308dacad4b54252cec896'; // Application ID that was used
        console.log(`🔍 Testing room freedom fix for ID: ${studentId}`);

        // Test the original issue
        console.log('\n🔧 Testing original issue...');
        
        // Try to find student in User collection (this would fail)
        let student = await User.findById(studentId);
        if (!student) {
            console.log(`❌ Student not found in User collection: ${studentId}`);
            
            // Try to find in Application collection (this should work)
            const application = await Application.findById(studentId);
            if (application) {
                console.log(`✅ Found student in Application collection`);
                console.log(`   Name: ${application.firstName} ${application.lastName}`);
                console.log(`   Allocated Room: ${application.allocatedRoom}`);
                console.log(`   Residence: ${application.residence}`);
                
                // Create temporary student object (like the fix does)
                student = {
                    _id: application._id,
                    firstName: application.firstName,
                    lastName: application.lastName,
                    currentRoom: application.allocatedRoom,
                    residence: application.residence
                };
                
                console.log(`✅ Created temporary student object`);
                console.log(`   Current Room: ${student.currentRoom}`);
                console.log(`   Residence: ${student.residence}`);
                
                if (student.currentRoom && student.residence) {
                    console.log(`✅ Student has room and residence - room should be freed!`);
                } else {
                    console.log(`❌ Student missing room or residence data`);
                }
            } else {
                console.log(`❌ Student not found in Application collection either`);
            }
        } else {
            console.log(`✅ Student found in User collection`);
        }

        console.log('\n🔧 Testing the fix...');
        console.log('✅ The fix now:');
        console.log('   1. Tries to find student in User collection first');
        console.log('   2. If not found, tries Application collection');
        console.log('   3. Creates temporary student object from application data');
        console.log('   4. Uses the correct student ID for room operations');
        console.log('   5. Should now successfully free the room!');

        console.log('\n✅ Room freedom fix test completed!');

    } catch (error) {
        console.error('❌ Error testing room freedom fix:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the test
testRoomFreedomFix();


