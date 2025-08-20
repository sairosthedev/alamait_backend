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

// Comprehensive re-application test
async function testReapplicationComplete() {
    try {
        console.log('\n🧪 COMPREHENSIVE RE-APPLICATION SYSTEM TEST\n');
        console.log('=' .repeat(60));
        
        // Step 1: Get available residences
        const residences = await Residence.find().select('name _id rooms');
        console.log(`📍 Available residences: ${residences.length}`);
        residences.forEach(res => {
            console.log(`   ${res.name} (${res._id}) - ${res.rooms?.length || 0} rooms`);
        });
        
        if (residences.length < 2) {
            console.log('❌ Need at least 2 residences to test different residence scenario');
            return;
        }
        
        const residence1 = residences[0];
        const residence2 = residences[1];
        
        console.log(`\n🔄 Testing re-application system with:`);
        console.log(`   Original Residence: ${residence1.name}`);
        console.log(`   New Residence: ${residence2.name}`);
        
        // Step 2: Create a test student
        console.log('\n👤 Step 2: Creating test student...');
        const testStudent = new User({
            email: 'test.reapplication@example.com',
            firstName: 'Test',
            lastName: 'Reapplication',
            phone: '+1234567890',
            password: 'testpassword123',
            role: 'student',
            isVerified: true,
            currentRoom: 'Test Room A',
            roomValidUntil: new Date('2025-12-31'),
            roomApprovalDate: new Date(),
            residence: residence1._id
        });
        
        await testStudent.save();
        console.log(`✅ Created test student: ${testStudent.firstName} ${testStudent.lastName}`);
        console.log(`   Email: ${testStudent.email}`);
        console.log(`   Residence: ${residence1.name}`);
        console.log(`   Room: ${testStudent.currentRoom}`);
        
        // Step 3: Create initial application and debtor
        console.log('\n📋 Step 3: Creating initial application and debtor...');
        const initialApplication = new Application({
            student: testStudent._id,
            firstName: testStudent.firstName,
            lastName: testStudent.lastName,
            email: testStudent.email,
            phone: testStudent.phone,
            requestType: 'new',
            preferredRoom: 'Test Room A',
            residence: residence1._id,
            startDate: new Date('2025-08-01'),
            endDate: new Date('2025-12-31'),
            status: 'approved',
            applicationCode: 'INITIAL_APP_001',
            applicationDate: new Date(),
            allocatedRoom: 'Test Room A'
        });
        
        await initialApplication.save();
        console.log(`✅ Created initial application: ${initialApplication.applicationCode}`);
        
        // Create debtor account
        const initialDebtor = new Debtor({
            debtorCode: 'INITIAL_DR_001',
            user: testStudent._id,
            accountCode: 'INITIAL_AR_001',
            accountName: `Initial Account - ${testStudent.firstName} ${testStudent.lastName}`,
            status: 'active',
            currentBalance: 600,
            totalOwed: 800,
            totalPaid: 200,
            creditLimit: 800,
            paymentTerms: 'monthly',
            residence: residence1._id,
            roomNumber: 'Test Room A',
            application: initialApplication._id,
            applicationCode: initialApplication.applicationCode,
            createdBy: testStudent._id,
            roomPrice: 200,
            startDate: new Date('2025-08-01'),
            endDate: new Date('2025-12-31')
        });
        
        await initialDebtor.save();
        console.log(`✅ Created initial debtor: ${initialDebtor.debtorCode}`);
        console.log(`   Balance: $${initialDebtor.currentBalance}`);
        console.log(`   Total Paid: $${initialDebtor.totalPaid}`);
        
        // Link debtor to application
        initialApplication.debtor = initialDebtor._id;
        await initialApplication.save();
        
        // Step 4: Set initial application to expired
        console.log('\n⏰ Step 4: Setting initial application to expired...');
        initialApplication.status = 'expired';
        await initialApplication.save();
        console.log(`✅ Initial application status set to: ${initialApplication.status}`);
        
        // Step 5: Test re-application eligibility
        console.log('\n🔍 Step 5: Testing re-application eligibility...');
        console.log('=' .repeat(60));
        
        const eligibility = await ReapplicationService.checkReapplicationEligibility(testStudent.email);
        console.log('Eligibility Result:', JSON.stringify(eligibility, null, 2));
        
        if (eligibility.canReapply) {
            console.log('✅ Student can re-apply');
            console.log(`   Previous debtor: ${eligibility.previousDebtor?.debtorCode}`);
            console.log(`   Financial history: ${eligibility.financialHistory ? 'Available' : 'None'}`);
        } else {
            console.log('❌ Student cannot re-apply:', eligibility.reason);
            return;
        }
        
        // Step 6: Create re-application for different residence
        console.log('\n🔄 Step 6: Creating re-application for different residence...');
        console.log('=' .repeat(60));
        
        const reapplicationData = {
            email: testStudent.email,
            firstName: testStudent.firstName,
            lastName: testStudent.lastName,
            phone: testStudent.phone,
            preferredRoom: 'New Room B',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            residence: residence2._id, // DIFFERENT RESIDENCE
            reason: 'Moving to different residence for 2026 academic year',
            additionalInfo: {
                course: 'Computer Science',
                yearOfStudy: 3,
                reasonForMove: 'Closer to campus and better facilities'
            }
        };
        
        const reapplicationResult = await ReapplicationService.createReapplication(reapplicationData);
        
        if (reapplicationResult.success) {
            console.log('✅ Re-application created successfully');
            console.log(`   Application Code: ${reapplicationResult.reapplication.applicationCode}`);
            console.log(`   Previous Debtor: ${reapplicationResult.reapplication.previousDebtorCode}`);
            console.log(`   New Residence: ${residence2.name}`);
            console.log(`   Is Re-application: ${reapplicationResult.reapplication.isReapplication}`);
            
            const reapplication = reapplicationResult.reapplication;
            
            // Step 7: Test debtor service update for different residence
            console.log('\n💰 Step 7: Testing debtor service update for different residence...');
            console.log('=' .repeat(60));
            
            const { createDebtorForStudent } = require('./src/services/debtorService');
            
            const debtorOptions = {
                residenceId: residence2._id,
                roomNumber: 'New Room B',
                createdBy: testStudent._id,
                startDate: reapplication.startDate,
                endDate: reapplication.endDate,
                roomPrice: 180, // Different price for new residence
                application: reapplication._id,
                applicationCode: reapplication.applicationCode,
                isReapplication: true,
                previousDebtorCode: initialDebtor.debtorCode
            };
            
            console.log(`🔄 Updating debtor account for new residence...`);
            console.log(`   New Residence: ${residence2.name}`);
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
                if (updatedDebtor.residence.toString() === residence2._id.toString()) {
                    console.log(`✅ ✅ RESIDENCE SUCCESSFULLY UPDATED!`);
                    console.log(`   From: ${residence1.name} (${initialDebtor.residence})`);
                    console.log(`   To: ${residence2.name} (${updatedDebtor.residence})`);
                } else {
                    console.log(`❌ ❌ RESIDENCE NOT UPDATED!`);
                    console.log(`   Expected: ${residence2.name} (${residence2._id})`);
                    console.log(`   Actual: ${updatedDebtor.residence}`);
                }
                
                // Check if room details were updated
                if (updatedDebtor.roomNumber === debtorOptions.roomNumber) {
                    console.log(`✅ ✅ ROOM NUMBER SUCCESSFULLY UPDATED!`);
                    console.log(`   From: ${initialDebtor.roomNumber}`);
                    console.log(`   To: ${updatedDebtor.roomNumber}`);
                } else {
                    console.log(`❌ ❌ ROOM NUMBER NOT UPDATED!`);
                    console.log(`   Expected: ${debtorOptions.roomNumber}`);
                    console.log(`   Actual: ${updatedDebtor.roomNumber}`);
                }
                
                // Check if pricing was updated
                if (updatedDebtor.roomPrice === debtorOptions.roomPrice) {
                    console.log(`✅ ✅ ROOM PRICE SUCCESSFULLY UPDATED!`);
                    console.log(`   From: $${initialDebtor.roomPrice}`);
                    console.log(`   To: $${updatedDebtor.roomPrice}`);
                } else {
                    console.log(`❌ ❌ ROOM PRICE NOT UPDATED!`);
                    console.log(`   Expected: $${debtorOptions.roomPrice}`);
                    console.log(`   Actual: $${updatedDebtor.roomPrice}`);
                }
                
                // Check if financial history was preserved
                if (updatedDebtor.totalPaid === initialDebtor.totalPaid) {
                    console.log(`✅ ✅ FINANCIAL HISTORY PRESERVED!`);
                    console.log(`   Total Paid: $${updatedDebtor.totalPaid} (unchanged)`);
                } else {
                    console.log(`❌ ❌ FINANCIAL HISTORY NOT PRESERVED!`);
                    console.log(`   Expected: $${initialDebtor.totalPaid}`);
                    console.log(`   Actual: $${updatedDebtor.totalPaid}`);
                }
                
            } else {
                console.log(`❌ Failed to update debtor account`);
            }
            
            // Step 8: Test re-application summary
            console.log('\n📋 Step 8: Testing re-application summary...');
            console.log('=' .repeat(60));
            
            const summary = await ReapplicationService.getReapplicationSummary(reapplication._id);
            console.log('Summary Result:', JSON.stringify(summary, null, 2));
            
            if (summary.financialSummary) {
                console.log('✅ Financial summary retrieved successfully');
                console.log(`   Debtor Code: ${summary.financialSummary.debtorCode}`);
                console.log(`   Previous Balance: $${summary.financialSummary.previousBalance}`);
                console.log(`   Total Paid: $${summary.financialSummary.totalPaid}`);
            }
            
            // Step 9: Test linking to financial history
            console.log('\n🔗 Step 9: Testing linking to financial history...');
            console.log('=' .repeat(60));
            
            const linkResult = await ReapplicationService.linkToFinancialHistory(reapplication._id);
            console.log('Link Result:', JSON.stringify(linkResult, null, 2));
            
            if (linkResult.success) {
                console.log('✅ Re-application linked to financial history successfully');
                console.log(`   Debtor Code: ${linkResult.debtorCode}`);
            }
            
        } else {
            console.log('❌ Failed to create re-application:', reapplicationResult.message);
        }
        
        // Step 10: Final verification
        console.log('\n🔍 Step 10: Final system verification...');
        console.log('=' .repeat(60));
        
        const allReapplications = await Application.find({ isReapplication: true })
            .select('applicationCode email status isReapplication previousDebtorCode createdAt')
            .sort({ createdAt: -1 });
        
        console.log(`📊 Found ${allReapplications.length} re-applications in the system:`);
        allReapplications.forEach(app => {
            console.log(`   ${app.applicationCode}: ${app.email} - ${app.status} (Previous: ${app.previousDebtorCode || 'None'})`);
        });
        
        // Check final debtor state
        const finalDebtor = await Debtor.findById(updatedDebtor._id);
        if (finalDebtor) {
            console.log(`\n💰 Final Debtor State:`);
            console.log(`   Debtor Code: ${finalDebtor.debtorCode}`);
            console.log(`   Residence: ${finalDebtor.residence}`);
            console.log(`   Room: ${finalDebtor.roomNumber}`);
            console.log(`   Price: $${finalDebtor.roomPrice}/month`);
            console.log(`   Total Owed: $${finalDebtor.totalOwed}`);
            console.log(`   Current Balance: $${finalDebtor.currentBalance}`);
            console.log(`   Total Paid: $${finalDebtor.totalPaid}`);
            console.log(`   Status: ${finalDebtor.status}`);
        }
        
        console.log('\n🎯 RE-APPLICATION SYSTEM TEST COMPLETED!');
        console.log('=' .repeat(60));
        
        if (updatedDebtor && 
            updatedDebtor.residence.toString() === residence2._id.toString() &&
            updatedDebtor.roomNumber === 'New Room B' &&
            updatedDebtor.roomPrice === 180 &&
            updatedDebtor.totalPaid === initialDebtor.totalPaid) {
            console.log('✅ ✅ ✅ ALL TESTS PASSED! RE-APPLICATION SYSTEM IS WORKING PERFECTLY!');
        } else {
            console.log('❌ ❌ ❌ SOME TESTS FAILED! RE-APPLICATION SYSTEM HAS ISSUES!');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Main execution
async function main() {
    await connectDB();
    await testReapplicationComplete();
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
}

// Run the test
main().catch(console.error);
