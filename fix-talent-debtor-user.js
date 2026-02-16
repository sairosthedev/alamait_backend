const mongoose = require('mongoose');
require('dotenv').config();

const Debtor = require('./src/models/Debtor');
const User = require('./src/models/User');
const Application = require('./src/models/Application');

async function fixTalentDebtor() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const debtorId = '69933c08f6bac4efd2f31ad4';
        const expectedUserId = '69933c05f6bac4efd2f31a35';

        // Find the debtor
        const debtor = await Debtor.findById(debtorId);
        if (!debtor) {
            console.error(`❌ Debtor not found: ${debtorId}`);
            return;
        }

        console.log(`📋 Found debtor: ${debtor.debtorCode}`);
        console.log(`   Current user: ${debtor.user || 'null'}`);
        console.log(`   Application: ${debtor.application || 'null'}`);

        // Find the user
        const user = await User.findById(expectedUserId);
        if (!user) {
            console.error(`❌ User not found: ${expectedUserId}`);
            return;
        }

        console.log(`📋 Found user: ${user.firstName} ${user.lastName} (${user.email})`);

        // Check if debtor has application
        if (debtor.application) {
            const application = await Application.findById(debtor.application);
            if (application && application.student) {
                const appStudentId = application.student.toString();
                console.log(`📋 Application student ID: ${appStudentId}`);
                
                if (appStudentId !== expectedUserId) {
                    console.warn(`⚠️ Application student ID (${appStudentId}) doesn't match expected user ID (${expectedUserId})`);
                }
            }
        }

        // Update debtor user field
        debtor.user = expectedUserId;
        await debtor.save();

        console.log(`✅ Updated debtor ${debtor.debtorCode} to link to user ${expectedUserId}`);

        // Verify the update
        const updatedDebtor = await Debtor.findById(debtorId).populate('user', 'firstName lastName email');
        console.log(`\n✅ Verification:`);
        console.log(`   Debtor: ${updatedDebtor.debtorCode}`);
        console.log(`   User: ${updatedDebtor.user ? `${updatedDebtor.user.firstName} ${updatedDebtor.user.lastName} (${updatedDebtor.user.email})` : 'null'}`);
        console.log(`   Account Code: ${updatedDebtor.accountCode}`);

        await mongoose.disconnect();
        console.log('\n✅ Done');
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

fixTalentDebtor();
