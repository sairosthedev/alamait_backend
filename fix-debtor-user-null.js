const mongoose = require('mongoose');
require('dotenv').config();

const Debtor = require('./src/models/Debtor');
const User = require('./src/models/User');
const Application = require('./src/models/Application');

async function fixDebtorUserNull() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all debtors with user: null
        const debtorsWithNullUser = await Debtor.find({ user: null });
        console.log(`\n📋 Found ${debtorsWithNullUser.length} debtors with user: null\n`);

        for (const debtor of debtorsWithNullUser) {
            console.log(`\n🔍 Processing debtor: ${debtor.debtorCode} (${debtor._id})`);
            
            let userId = null;
            
            // Try to find user from application
            if (debtor.application) {
                console.log(`   Checking application: ${debtor.application}`);
                const application = await Application.findById(debtor.application);
                if (application && application.student) {
                    userId = application.student;
                    console.log(`   ✅ Found user ID from application: ${userId}`);
                } else {
                    console.log(`   ⚠️ Application found but no student field`);
                }
            }
            
            // Try to find user from contactInfo email
            if (!userId && debtor.contactInfo && debtor.contactInfo.email) {
                console.log(`   Checking email: ${debtor.contactInfo.email}`);
                const user = await User.findOne({ email: debtor.contactInfo.email });
                if (user) {
                    userId = user._id;
                    console.log(`   ✅ Found user ID from email: ${userId}`);
                } else {
                    console.log(`   ⚠️ No user found with email: ${debtor.contactInfo.email}`);
                }
            }
            
            // Try to find user from accountCode (if it contains user ID)
            if (!userId && debtor.accountCode) {
                const accountCodeMatch = debtor.accountCode.match(/1100-([a-f0-9]{24})/);
                if (accountCodeMatch) {
                    const possibleUserId = accountCodeMatch[1];
                    const user = await User.findById(possibleUserId);
                    if (user) {
                        userId = user._id;
                        console.log(`   ✅ Found user ID from accountCode: ${userId}`);
                    } else {
                        console.log(`   ⚠️ AccountCode contains ID but user not found: ${possibleUserId}`);
                    }
                }
            }
            
            // Try to find user from transactions
            if (!userId) {
                const TransactionEntry = require('./src/models/TransactionEntry');
                const transactions = await TransactionEntry.find({
                    'entries.accountCode': debtor.accountCode
                }).limit(5);
                
                for (const tx of transactions) {
                    if (tx.metadata && tx.metadata.studentId) {
                        const user = await User.findById(tx.metadata.studentId);
                        if (user) {
                            userId = user._id;
                            console.log(`   ✅ Found user ID from transaction metadata: ${userId}`);
                            break;
                        }
                    }
                }
            }
            
            if (userId) {
                // Verify user exists
                const user = await User.findById(userId);
                if (user) {
                    debtor.user = userId;
                    await debtor.save();
                    console.log(`   ✅ Updated debtor ${debtor.debtorCode} to link to user ${userId} (${user.firstName} ${user.lastName})`);
                } else {
                    console.log(`   ❌ User ID ${userId} not found in database`);
                }
            } else {
                console.log(`   ❌ Could not determine user ID for debtor ${debtor.debtorCode}`);
                console.log(`   ⚠️ Manual intervention required`);
            }
        }

        // Also check for Talent Manhando specifically
        const talentDebtorId = '69933c08f6bac4efd2f31ad4';
        const talentUserId = '69933c05f6bac4efd2f31a35';
        
        const talentDebtor = await Debtor.findById(talentDebtorId);
        if (talentDebtor && !talentDebtor.user) {
            console.log(`\n🔍 Fixing Talent Manhando's debtor specifically...`);
            const talentUser = await User.findById(talentUserId);
            if (talentUser) {
                talentDebtor.user = talentUserId;
                await talentDebtor.save();
                console.log(`✅ Fixed Talent Manhando's debtor: ${talentDebtor.debtorCode} → user ${talentUserId}`);
            } else {
                console.log(`❌ Talent's user not found: ${talentUserId}`);
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

fixDebtorUserNull();
