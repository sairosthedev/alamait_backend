const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Create Macdonald's user record and auto-link to application
async function createMacdonaldUser() {
    try {
        console.log('👤 Creating Macdonald\'s user record...\n');

        // Get the User model
        const User = require('../src/models/User');

        // Check if user already exists
        const existingUser = await User.findOne({ email: 'macdonald.sairos@students.uz.ac.zw' });
        if (existingUser) {
            console.log(`✅ User already exists:`);
            console.log(`   User ID: ${existingUser._id}`);
            console.log(`   Name: ${existingUser.firstName} ${existingUser.lastName}`);
            console.log(`   Email: ${existingUser.email}`);
            console.log(`   Role: ${existingUser.role}`);
            return existingUser;
        }

        // Create new user
        const hashedPassword = await bcrypt.hash('temporary_password_123', 10);
        
        const macdonaldUser = new User({
            email: 'macdonald.sairos@students.uz.ac.zw',
            firstName: 'Macdonald',
            lastName: 'Sairos',
            phone: '+263 78 603 3933',
            role: 'student',
            password: hashedPassword,
            isVerified: true
        });

        console.log('📝 User data prepared:');
        console.log(`   Email: ${macdonaldUser.email}`);
        console.log(`   Name: ${macdonaldUser.firstName} ${macdonaldUser.lastName}`);
        console.log(`   Phone: ${macdonaldUser.phone}`);
        console.log(`   Role: ${macdonaldUser.role}`);
        console.log(`   Password: temporary_password_123 (will need to be changed)`);

        // Save the user (this will trigger the post-save middleware)
        console.log('\n💾 Saving user...');
        await macdonaldUser.save();

        console.log(`✅ User created successfully!`);
        console.log(`   User ID: ${macdonaldUser._id}`);

        // Check if the auto-linking worked
        console.log('\n🔍 Checking if auto-linking worked...');
        const Application = require('../src/models/Application');
        const linkedApplication = await Application.findOne({ 
            email: 'macdonald.sairos@students.uz.ac.zw',
            student: macdonaldUser._id
        });

        if (linkedApplication) {
            console.log(`✅ Application successfully linked!`);
            console.log(`   Application ID: ${linkedApplication._id}`);
            console.log(`   Student ID: ${linkedApplication.student}`);
            console.log(`   Status: ${linkedApplication.status}`);
            console.log(`   Room: ${linkedApplication.allocatedRoom}`);
        } else {
            console.log(`❌ Application linking failed`);
            console.log(`   This might indicate an issue with the auto-linking middleware`);
        }

        // Check if debtor was created (if application is approved)
        if (linkedApplication && linkedApplication.status === 'approved') {
            console.log('\n🏗️  Checking if debtor account was created...');
            const Debtor = require('../src/models/Debtor');
            const debtor = await Debtor.findOne({ user: macdonaldUser._id });

            if (debtor) {
                console.log(`✅ Debtor account created!`);
                console.log(`   Debtor ID: ${debtor._id}`);
                console.log(`   Debtor Code: ${debtor.debtorCode}`);
                console.log(`   Total Owed: $${debtor.totalOwed}`);
                console.log(`   Current Balance: $${debtor.currentBalance}`);
            } else {
                console.log(`⚠️  No debtor account found`);
                console.log(`   This might be normal if the application isn't approved yet`);
            }
        }

        console.log('\n📋 Summary:');
        console.log(`   User Created: ✅ ${macdonaldUser._id}`);
        console.log(`   Application Linked: ${linkedApplication ? '✅' : '❌'}`);
        console.log(`   Debtor Created: ${linkedApplication && linkedApplication.status === 'approved' ? '✅' : '⚠️'}`);

        console.log('\n💡 Next Steps:');
        console.log('   1. Macdonald should change his password from "temporary_password_123"');
        console.log('   2. The application is now properly linked to the user');
        console.log('   3. When payments are made, they will use the correct user ID');
        console.log('   4. Financial reports will now show proper student linking');

        return macdonaldUser;

    } catch (error) {
        console.error('❌ Error creating Macdonald\'s user:', error);
        throw error;
    }
}

// Run the creation
createMacdonaldUser();
