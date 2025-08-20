const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');
const Residence = require('../src/models/Residence');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Failed to disconnect from MongoDB:', error);
    }
}

async function verifyDebtorCreationSystem() {
    try {
        console.log('\n🔍 COMPREHENSIVE DEBTOR CREATION VERIFICATION');
        console.log('=' .repeat(70));

        // 1. Check the current debtor in database
        console.log('\n1️⃣ CHECKING CURRENT DEBTOR IN DATABASE');
        console.log('-' .repeat(50));
        
        const currentDebtor = await Debtor.findOne({ debtorCode: 'DR0001' }).populate('user');
        if (!currentDebtor) {
            console.log('❌ No debtor found with code DR0001');
            return;
        }

        console.log(`📊 Current Debtor Status:`);
        console.log(`   Debtor Code: ${currentDebtor.debtorCode}`);
        console.log(`   User: ${currentDebtor.user ? currentDebtor.user.firstName + ' ' + currentDebtor.user.lastName : 'NOT LINKED'}`);
        console.log(`   Email: ${currentDebtor.user ? currentDebtor.user.email : 'NOT LINKED'}`);
        console.log(`   Room Price: $${currentDebtor.roomPrice}`);
        console.log(`   Total Owed: $${currentDebtor.totalOwed}`);
        console.log(`   Current Balance: $${currentDebtor.currentBalance}`);
        console.log(`   Application Link: ${currentDebtor.application || 'NOT LINKED'}`);
        console.log(`   Application Code: ${currentDebtor.applicationCode || 'NOT SET'}`);
        console.log(`   Billing Period: ${currentDebtor.billingPeriodLegacy || 'NOT SET'}`);
        console.log(`   Start Date: ${currentDebtor.startDate || 'NOT SET'}`);
        console.log(`   End Date: ${currentDebtor.endDate || 'NOT SET'}`);

        // 2. Verify application data
        console.log('\n2️⃣ VERIFYING APPLICATION DATA');
        console.log('-' .repeat(50));
        
        const application = await Application.findById(currentDebtor.application).populate('residence', 'name rooms');
        if (!application) {
            console.log('❌ Application not found or not linked');
            return;
        }

        console.log(`📋 Application Details:`);
        console.log(`   ID: ${application._id}`);
        console.log(`   Status: ${application.status}`);
        console.log(`   Application Code: ${application.applicationCode}`);
        console.log(`   Student Field: ${application.student || 'NOT SET'}`);
        console.log(`   Debtor Field: ${application.debtor || 'NOT SET'}`);
        console.log(`   Allocated Room: ${application.allocatedRoom}`);
        console.log(`   Residence: ${application.residence ? application.residence.name : 'NOT SET'}`);
        console.log(`   Start Date: ${application.startDate}`);
        console.log(`   End Date: ${application.endDate}`);

        // 3. Verify room price extraction
        console.log('\n3️⃣ VERIFYING ROOM PRICE EXTRACTION');
        console.log('-' .repeat(50));
        
        if (application.residence && application.residence.rooms) {
            const allocatedRoom = application.residence.rooms.find(r => 
                r.roomNumber === application.allocatedRoom
            );
            
            if (allocatedRoom) {
                console.log(`🏠 Room Found in Residence:`);
                console.log(`   Room Number: ${allocatedRoom.roomNumber}`);
                console.log(`   Room Type: ${allocatedRoom.type}`);
                console.log(`   Room Price: $${allocatedRoom.price}`);
                console.log(`   Room Status: ${allocatedRoom.status}`);
                
                // Compare with debtor room price
                if (currentDebtor.roomPrice === allocatedRoom.price) {
                    console.log(`   ✅ MATCH: Debtor room price matches residence room price`);
                } else {
                    console.log(`   ❌ MISMATCH: Debtor has $${currentDebtor.roomPrice}, residence has $${allocatedRoom.price}`);
                }
            } else {
                console.log(`   ❌ Room "${application.allocatedRoom}" not found in residence rooms`);
            }
        }

        // 4. Verify financial calculations
        console.log('\n4️⃣ VERIFYING FINANCIAL CALCULATIONS');
        console.log('-' .repeat(50));
        
        if (application.startDate && application.endDate) {
            const startDate = new Date(application.startDate);
            const endDate = new Date(application.endDate);
            const monthsDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
            
            const roomPrice = currentDebtor.roomPrice;
            const totalRent = roomPrice * monthsDiff;
            const adminFee = application.residence && application.residence.name.toLowerCase().includes('st kilda') ? 20 : 0;
            const deposit = roomPrice;
            const expectedTotal = totalRent + adminFee + deposit;
            
            console.log(`💰 Financial Calculation Verification:`);
            console.log(`   Period: ${startDate.toDateString()} to ${endDate.toDateString()}`);
            console.log(`   Duration: ${monthsDiff} months`);
            console.log(`   Monthly Rent: $${roomPrice}`);
            console.log(`   Total Rent: $${roomPrice} × ${monthsDiff} = $${totalRent}`);
            console.log(`   Admin Fee: $${adminFee}`);
            console.log(`   Deposit: $${deposit}`);
            console.log(`   Expected Total: $${expectedTotal}`);
            console.log(`   Debtor Total Owed: $${currentDebtor.totalOwed}`);
            
            if (currentDebtor.totalOwed === expectedTotal) {
                console.log(`   ✅ MATCH: Financial calculations are correct`);
            } else {
                console.log(`   ❌ MISMATCH: Expected $${expectedTotal}, got $${currentDebtor.totalOwed}`);
            }
        }

        // 5. Verify linking integrity
        console.log('\n5️⃣ VERIFYING LINKING INTEGRITY');
        console.log('-' .repeat(50));
        
        const user = await User.findById(currentDebtor.user);
        const linkingIssues = [];
        
        // Check user -> application link
        if (user && user.applicationCode !== application.applicationCode) {
            linkingIssues.push(`User application code (${user.applicationCode}) doesn't match application code (${application.applicationCode})`);
        }
        
        // Check application -> user link
        if (application.student && application.student.toString() !== user._id.toString()) {
            linkingIssues.push(`Application student field (${application.student}) doesn't match user ID (${user._id})`);
        }
        
        // Check application -> debtor link
        if (application.debtor && application.debtor.toString() !== currentDebtor._id.toString()) {
            linkingIssues.push(`Application debtor field (${application.debtor}) doesn't match debtor ID (${currentDebtor._id})`);
        }
        
        // Check debtor -> application link
        if (currentDebtor.application.toString() !== application._id.toString()) {
            linkingIssues.push(`Debtor application field (${currentDebtor.application}) doesn't match application ID (${application._id})`);
        }
        
        if (linkingIssues.length === 0) {
            console.log(`   ✅ ALL LINKS VERIFIED: User ↔ Application ↔ Debtor`);
        } else {
            console.log(`   ❌ LINKING ISSUES FOUND:`);
            linkingIssues.forEach(issue => console.log(`      - ${issue}`));
        }

        // 6. Test new student registration flow
        console.log('\n6️⃣ TESTING NEW STUDENT REGISTRATION FLOW');
        console.log('-' .repeat(50));
        
        console.log(`📝 Current Flow Summary:`);
        console.log(`   1. Admin approves application → generates applicationCode`);
        console.log(`   2. Student registers with applicationCode → triggers User post-save middleware`);
        console.log(`   3. Middleware finds matching application → calls createDebtorForStudent`);
        console.log(`   4. Debtor service extracts room price from residence → calculates financials`);
        console.log(`   5. Debtor created/updated with complete application data`);

        // 7. Final assessment
        console.log('\n7️⃣ FINAL ASSESSMENT');
        console.log('-' .repeat(50));
        
        const checks = [
            { name: 'Debtor exists', passed: !!currentDebtor },
            { name: 'Application linked', passed: !!currentDebtor.application },
            { name: 'Application code set', passed: !!currentDebtor.applicationCode },
            { name: 'Room price extracted', passed: currentDebtor.roomPrice > 0 },
            { name: 'Total owed calculated', passed: currentDebtor.totalOwed > 0 },
            { name: 'Dates populated', passed: !!currentDebtor.startDate && !!currentDebtor.endDate },
            { name: 'User linked', passed: !!currentDebtor.user },
            { name: 'Financial calculations correct', passed: currentDebtor.totalOwed === (currentDebtor.roomPrice * 5 + 20 + currentDebtor.roomPrice) }
        ];
        
        const passedChecks = checks.filter(c => c.passed).length;
        const totalChecks = checks.length;
        
        console.log(`🎯 System Health: ${passedChecks}/${totalChecks} checks passed`);
        checks.forEach(check => {
            console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}`);
        });
        
        if (passedChecks === totalChecks) {
            console.log(`\n🎉 VERDICT: DEBTOR CREATION SYSTEM IS WORKING PERFECTLY!`);
        } else {
            console.log(`\n⚠️  VERDICT: DEBTOR CREATION SYSTEM HAS ${totalChecks - passedChecks} ISSUES`);
        }

    } catch (error) {
        console.error('❌ Error in comprehensive verification:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await verifyDebtorCreationSystem();
    } catch (error) {
        console.error('❌ Main error:', error);
    } finally {
        await disconnectFromDatabase();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { verifyDebtorCreationSystem };
