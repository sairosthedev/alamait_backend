const mongoose = require('mongoose');
require('dotenv').config();

const Debtor = require('./src/models/Debtor');
const User = require('./src/models/User');
const Application = require('./src/models/Application');

async function checkTalentUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const debtorId = '69933c08f6bac4efd2f31ad4';
        const expectedUserId = '69933c05f6bac4efd2f31a35';

        // Get debtor without population
        const debtor = await Debtor.findById(debtorId).lean();
        console.log('\n📋 Debtor (raw, no population):');
        console.log(`   Debtor ID: ${debtor._id}`);
        console.log(`   Debtor Code: ${debtor.debtorCode}`);
        console.log(`   User field (raw): ${debtor.user}`);
        console.log(`   User field type: ${typeof debtor.user}`);
        console.log(`   Application: ${debtor.application}`);

        // Check if user exists
        const user = await User.findById(expectedUserId).lean();
        console.log(`\n📋 User check:`);
        console.log(`   User ID: ${expectedUserId}`);
        console.log(`   User exists: ${user ? 'YES' : 'NO'}`);
        if (user) {
            console.log(`   Name: ${user.firstName} ${user.lastName}`);
            console.log(`   Email: ${user.email}`);
        }

        // Check application
        if (debtor.application) {
            const application = await Application.findById(debtor.application).lean();
            console.log(`\n📋 Application:`);
            console.log(`   Application ID: ${debtor.application}`);
            console.log(`   Application exists: ${application ? 'YES' : 'NO'}`);
            if (application) {
                console.log(`   Student field: ${application.student}`);
                console.log(`   Student matches expected: ${application.student?.toString() === expectedUserId ? 'YES' : 'NO'}`);
            }
        }

        // Check if debtor.user matches expected user
        if (debtor.user) {
            console.log(`\n📋 User field comparison:`);
            console.log(`   Debtor.user: ${debtor.user}`);
            console.log(`   Expected user: ${expectedUserId}`);
            console.log(`   Match: ${debtor.user.toString() === expectedUserId ? 'YES' : 'NO'}`);
            
            // Check if the user in debtor.user exists
            const debtorUser = await User.findById(debtor.user).lean();
            console.log(`   User in debtor.user exists: ${debtorUser ? 'YES' : 'NO'}`);
            if (debtorUser) {
                console.log(`   Name: ${debtorUser.firstName} ${debtorUser.lastName}`);
            }
        } else {
            console.log(`\n❌ Debtor.user is null/undefined - this shouldn't happen!`);
            
            // Try to fix it
            if (user) {
                console.log(`\n🔧 Fixing debtor user field...`);
                await Debtor.findByIdAndUpdate(debtorId, { user: expectedUserId });
                console.log(`✅ Updated debtor to link to user ${expectedUserId}`);
                
                // Verify
                const updatedDebtor = await Debtor.findById(debtorId).lean();
                console.log(`   Updated user field: ${updatedDebtor.user}`);
            }
        }

        await mongoose.disconnect();
        console.log('\n✅ Done');
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

checkTalentUser();
