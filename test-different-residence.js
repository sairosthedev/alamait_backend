const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./src/models/User');
const Application = require('./src/models/Application');
const Debtor = require('./src/models/Debtor');
const Residence = require('./src/models/Residence');
const ReapplicationService = require('./src/services/reapplicationService');

// Connect to database
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

// Test different residence re-application
async function testDifferentResidence() {
    try {
        console.log('\n🧪 Testing Re-application for Different Residence\n');
        
        // Get available residences
        const residences = await Residence.find().select('name _id rooms');
        console.log(`📍 Available residences: ${residences.length}`);
        residences.forEach(res => {
            console.log(`   ${res.name} (${res._id}) - ${res.rooms?.length || 0} rooms`);
        });
        
        if (residences.length < 2) {
            console.log('❌ Need at least 2 residences to test different residence scenario');
            return;
        }
        
        // Use first two residences for testing
        const originalResidence = residences[0];
        const newResidence = residences[1];
        
        console.log(`\n🔄 Testing move from ${originalResidence.name} to ${newResidence.name}`);
        
        // Find our test student
        const testStudent = await User.findOne({ email: 'test.student3@example.com' });
        if (!testStudent) {
            console.log('❌ Test student not found. Please run the setup first.');
            return;
        }
        
        console.log(`✅ Found test student: ${testStudent.firstName} ${testStudent.lastName}`);
        console.log(`   Current residence: ${testStudent.residence}`);
        console.log(`   Current room: ${testStudent.currentRoom}`);
        
        // Check current debtor
        const currentDebtor = await Debtor.findOne({ user: testStudent._id });
        if (!currentDebtor) {
            console.log('❌ No debtor account found for test student');
            return;
        }
        
        console.log(`\n💰 Current debtor account:`);
        console.log(`   Debtor Code: ${currentDebtor.debtorCode}`);
        console.log(`   Current Residence: ${currentDebtor.residence}`);
        console.log(`   Current Room: ${currentDebtor.roomNumber}`);
        console.log(`   Current Balance: $${currentDebtor.currentBalance}`);
        console.log(`   Total Paid: $${currentDebtor.totalPaid}`);
        console.log(`   Total Owed: $${currentDebtor.totalOwed}`);
        
        // Test 1: Create re-application for different residence
        console.log('\n📋 Test 1: Create re-application for different residence');
        console.log('=' .repeat(60));
        
        const reapplicationData = {
            email: testStudent.email,
            firstName: testStudent.firstName,
            lastName: testStudent.lastName,
            phone: testStudent.phone,
            preferredRoom: 'New Room 1', // Different room
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            residence: newResidence._id, // DIFFERENT RESIDENCE
            reason: 'Moving to different residence for 2026',
            additionalInfo: {
                course: 'Computer Science',
                yearOfStudy: 3,
                reasonForMove: 'Closer to campus'
            }
        };
        
        console.log(`🔄 Creating re-application for ${newResidence.name}...`);
        const reapplicationResult = await ReapplicationService.createReapplication(reapplicationData);
        
        if (reapplicationResult.success) {
            console.log('✅ Re-application created successfully');
            console.log(`   Application Code: ${reapplicationResult.reapplication.applicationCode}`);
            console.log(`   Previous Debtor: ${reapplicationResult.reapplication.previousDebtorCode}`);
            console.log(`   New Residence: ${newResidence.name}`);
            console.log(`   New Room: ${reapplicationData.preferredRoom}`);
            
            // Test 2: Check if the re-application has correct residence info
            console.log('\n📋 Test 2: Verify re-application residence data');
            console.log('=' .repeat(60));
            
            const reapplication = reapplicationResult.reapplication;
            console.log(`📋 Re-application Details:`);
            console.log(`   ID: ${reapplication._id}`);
            console.log(`   Residence: ${reapplication.residence}`);
            console.log(`   Preferred Room: ${reapplication.preferredRoom}`);
            console.log(`   Start Date: ${reapplication.startDate.toDateString()}`);
            console.log(`   End Date: ${reapplication.endDate.toDateString()}`);
            console.log(`   Is Re-application: ${reapplication.isReapplication}`);
            console.log(`   Previous Debtor: ${reapplication.previousDebtorCode}`);
            
            // Test 3: Simulate admin approval process
            console.log('\n📋 Test 3: Simulate admin approval for different residence');
            console.log('=' .repeat(60));
            
            // Get a room from the new residence
            const newResidenceRooms = await Residence.findById(newResidence._id).populate('rooms');
            const availableRoom = newResidenceRooms.rooms?.find(r => r.status !== 'occupied') || 
                                 { roomNumber: 'New Room 1', price: 180, capacity: 1 };
            
            console.log(`🏠 New residence room details:`);
            console.log(`   Room: ${availableRoom.roomNumber || 'New Room 1'}`);
            console.log(`   Price: $${availableRoom.price || 180}/month`);
            console.log(`   Capacity: ${availableRoom.capacity || 1}`);
            
            // Update the re-application status to approved
            reapplication.status = 'approved';
            reapplication.allocatedRoom = availableRoom.roomNumber || 'New Room 1';
            await reapplication.save();
            
            console.log(`✅ Updated re-application status to approved`);
            
            // Test 4: Test debtor service update for different residence
            console.log('\n📋 Test 4: Test debtor service update for different residence');
            console.log('=' .repeat(60));
            
            const { createDebtorForStudent } = require('./src/services/debtorService');
            
            const debtorOptions = {
                residenceId: newResidence._id,
                roomNumber: availableRoom.roomNumber || 'New Room 1',
                createdBy: testStudent._id,
                startDate: reapplication.startDate,
                endDate: reapplication.endDate,
                roomPrice: availableRoom.price || 180,
                application: reapplication._id,
                applicationCode: reapplication.applicationCode,
                isReapplication: true,
                previousDebtorCode: currentDebtor.debtorCode
            };
            
            console.log(`🔄 Updating debtor account for new residence...`);
            console.log(`   New Residence: ${newResidence.name}`);
            console.log(`   New Room: ${debtorOptions.roomNumber}`);
            console.log(`   New Price: $${debtorOptions.roomPrice}/month`);
            
            const updatedDebtor = await createDebtorForStudent(testStudent, debtorOptions);
            
            if (updatedDebtor) {
                console.log(`✅ Debtor account updated successfully!`);
                console.log(`\n📊 Updated Debtor Details:`);
                console.log(`   Debtor Code: ${updatedDebtor.debtorCode}`);
                console.log(`   New Residence: ${updatedDebtor.residence}`);
                console.log(`   New Room: ${updatedDebtor.roomNumber}`);
                console.log(`   New Room Price: $${updatedDebtor.roomPrice}`);
                console.log(`   New Total Owed: $${updatedDebtor.totalOwed}`);
                console.log(`   Current Balance: $${updatedDebtor.currentBalance}`);
                console.log(`   Total Paid: $${updatedDebtor.totalPaid}`);
                
                // Verify the residence was actually changed
                if (updatedDebtor.residence.toString() === newResidence._id.toString()) {
                    console.log(`✅ ✅ RESIDENCE SUCCESSFULLY UPDATED!`);
                    console.log(`   From: ${originalResidence.name} (${currentDebtor.residence})`);
                    console.log(`   To: ${newResidence.name} (${updatedDebtor.residence})`);
                } else {
                    console.log(`❌ ❌ RESIDENCE NOT UPDATED!`);
                    console.log(`   Expected: ${newResidence.name} (${newResidence._id})`);
                    console.log(`   Actual: ${updatedDebtor.residence}`);
                }
                
                // Check if room details were updated
                if (updatedDebtor.roomNumber === debtorOptions.roomNumber) {
                    console.log(`✅ ✅ ROOM NUMBER SUCCESSFULLY UPDATED!`);
                    console.log(`   From: ${currentDebtor.roomNumber}`);
                    console.log(`   To: ${updatedDebtor.roomNumber}`);
                } else {
                    console.log(`❌ ❌ ROOM NUMBER NOT UPDATED!`);
                    console.log(`   Expected: ${debtorOptions.roomNumber}`);
                    console.log(`   Actual: ${updatedDebtor.roomNumber}`);
                }
                
                // Check if pricing was updated
                if (updatedDebtor.roomPrice === debtorOptions.roomPrice) {
                    console.log(`✅ ✅ ROOM PRICE SUCCESSFULLY UPDATED!`);
                    console.log(`   From: $${currentDebtor.roomPrice}`);
                    console.log(`   To: $${updatedDebtor.roomPrice}`);
                } else {
                    console.log(`❌ ❌ ROOM PRICE NOT UPDATED!`);
                    console.log(`   Expected: $${debtorOptions.roomPrice}`);
                    console.log(`   Actual: $${updatedDebtor.roomPrice}`);
                }
                
            } else {
                console.log(`❌ Failed to update debtor account`);
            }
            
        } else {
            console.log('❌ Failed to create re-application:', reapplicationResult.message);
        }
        
        console.log('\n✅ Different residence re-application test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Main execution
async function main() {
    await connectDB();
    await testDifferentResidence();
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
}

// Run the test
main().catch(console.error);
