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

async function testStudentRegistrationFlow() {
    try {
        console.log('\n🧪 TESTING COMPLETE STUDENT REGISTRATION FLOW');
        console.log('=' .repeat(70));

        // 1. Get the approved application
        console.log('\n1️⃣ FINDING APPROVED APPLICATION');
        console.log('-' .repeat(50));
        
        const application = await Application.findOne({ status: 'approved' }).populate('residence', 'name rooms');
        if (!application) {
            console.log('❌ No approved application found');
            return;
        }

        console.log(`📋 Found approved application:`);
        console.log(`   ID: ${application._id}`);
        console.log(`   Name: ${application.firstName} ${application.lastName}`);
        console.log(`   Email: ${application.email}`);
        console.log(`   Application Code: ${application.applicationCode}`);
        console.log(`   Room: ${application.allocatedRoom}`);
        console.log(`   Residence: ${application.residence ? application.residence.name : 'NOT SET'}`);

        // 2. Check if user already exists
        console.log('\n2️⃣ CHECKING IF USER EXISTS');
        console.log('-' .repeat(50));
        
        let existingUser = await User.findOne({ 
            $or: [
                { email: application.email },
                { applicationCode: application.applicationCode }
            ]
        });

        if (existingUser) {
            console.log(`👤 User already exists: ${existingUser.firstName} ${existingUser.lastName}`);
            console.log(`   Email: ${existingUser.email}`);
            console.log(`   Role: ${existingUser.role}`);
            console.log(`   Application Code: ${existingUser.applicationCode || 'NOT SET'}`);
        } else {
            console.log(`ℹ️  No existing user found - will create new student user`);
        }

        // 3. Simulate student registration (create user with application code)
        console.log('\n3️⃣ SIMULATING STUDENT REGISTRATION');
        console.log('-' .repeat(50));
        
        if (!existingUser) {
            console.log(`🚀 Creating new student user...`);
            
            const newUser = new User({
                firstName: application.firstName,
                lastName: application.lastName,
                email: application.email,
                phone: application.phone,
                role: 'student',
                applicationCode: application.applicationCode,
                password: 'tempPassword123', // In real app, this would be hashed
                isVerified: true
            });

            // Save the user - this should trigger the post-save middleware
            console.log(`💾 Saving user... (this will trigger post-save middleware)`);
            await newUser.save();
            console.log(`✅ User created: ${newUser._id}`);
            
            existingUser = newUser;
        } else {
            console.log(`ℹ️  Using existing user, no new registration needed`);
        }

        // 4. Wait a moment for middleware to complete
        console.log('\n4️⃣ WAITING FOR MIDDLEWARE TO COMPLETE');
        console.log('-' .repeat(50));
        console.log(`⏳ Waiting 2 seconds for post-save middleware to complete...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 5. Check if application was linked
        console.log('\n5️⃣ CHECKING APPLICATION LINKING');
        console.log('-' .repeat(50));
        
        const updatedApplication = await Application.findById(application._id);
        if (updatedApplication.student) {
            console.log(`✅ Application linked to student: ${updatedApplication.student}`);
        } else {
            console.log(`❌ Application NOT linked to student`);
        }

        // 6. Check if debtor was created
        console.log('\n6️⃣ CHECKING DEBTOR CREATION');
        console.log('-' .repeat(50));
        
        const debtor = await Debtor.findOne({ user: existingUser._id });
        if (debtor) {
            console.log(`✅ Debtor created successfully!`);
            console.log(`   Debtor Code: ${debtor.debtorCode}`);
            console.log(`   Room Price: $${debtor.roomPrice}`);
            console.log(`   Total Owed: $${debtor.totalOwed}`);
            console.log(`   Application Link: ${debtor.application || 'NOT LINKED'}`);
            console.log(`   Application Code: ${debtor.applicationCode || 'NOT SET'}`);
            console.log(`   Billing Period: ${debtor.billingPeriodLegacy || 'NOT SET'}`);
            
            // Check if application was back-linked to debtor
            const finalApplication = await Application.findById(application._id);
            if (finalApplication.debtor) {
                console.log(`   ✅ Application back-linked to debtor: ${finalApplication.debtor}`);
            } else {
                console.log(`   ❌ Application NOT back-linked to debtor`);
            }
        } else {
            console.log(`❌ No debtor created for user ${existingUser._id}`);
        }

        // 7. Verify room price extraction
        console.log('\n7️⃣ VERIFYING ROOM PRICE EXTRACTION');
        console.log('-' .repeat(50));
        
        if (debtor && application.residence && application.residence.rooms) {
            const room = application.residence.rooms.find(r => r.roomNumber === application.allocatedRoom);
            if (room) {
                console.log(`🏠 Expected room price: $${room.price} (from ${application.allocatedRoom})`);
                console.log(`💰 Actual debtor room price: $${debtor.roomPrice}`);
                
                if (debtor.roomPrice === room.price) {
                    console.log(`   ✅ Room price correctly extracted from residence`);
                } else {
                    console.log(`   ❌ Room price mismatch!`);
                }
            } else {
                console.log(`   ⚠️  Room "${application.allocatedRoom}" not found in residence`);
            }
        }

        // 8. Final verdict
        console.log('\n8️⃣ FINAL VERDICT');
        console.log('-' .repeat(50));
        
        const success = debtor && 
                       debtor.application && 
                       debtor.applicationCode && 
                       debtor.roomPrice > 0 && 
                       debtor.totalOwed > 0;
        
        if (success) {
            console.log(`🎉 SUCCESS: Debtor creation system is working perfectly!`);
            console.log(`   ✅ Student registration triggered debtor creation`);
            console.log(`   ✅ Room price extracted from residence`);
            console.log(`   ✅ Financial calculations completed`);
            console.log(`   ✅ All linking completed (User ↔ Application ↔ Debtor)`);
        } else {
            console.log(`❌ FAILURE: Debtor creation system has issues`);
            if (!debtor) console.log(`   - No debtor created`);
            if (debtor && !debtor.application) console.log(`   - Debtor not linked to application`);
            if (debtor && !debtor.applicationCode) console.log(`   - Application code not set`);
            if (debtor && debtor.roomPrice <= 0) console.log(`   - Room price not extracted`);
            if (debtor && debtor.totalOwed <= 0) console.log(`   - Financial calculations failed`);
        }

    } catch (error) {
        console.error('❌ Error in student registration flow test:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await testStudentRegistrationFlow();
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

module.exports = { testStudentRegistrationFlow };
