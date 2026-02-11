/**
 * Script to find and delete duplicate debtors for the same person (same email)
 * This identifies debtors with the same email and deletes duplicates, keeping only one
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Debtor = require('../src/models/Debtor');
const User = require('../src/models/User');

async function fixDuplicateDebtors() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        console.log('🔍 Finding duplicate debtors by email...\n');

        // Find all debtors with email addresses
        const debtors = await Debtor.find({
            'contactInfo.email': { $exists: true, $ne: null, $ne: '' }
        }).populate('user', 'email firstName lastName');

        console.log(`📊 Found ${debtors.length} debtors with email addresses\n`);

        // Group debtors by email (case-insensitive)
        const debtorsByEmail = {};
        debtors.forEach(debtor => {
            const email = debtor.contactInfo?.email?.toLowerCase().trim();
            if (email) {
                if (!debtorsByEmail[email]) {
                    debtorsByEmail[email] = [];
                }
                debtorsByEmail[email].push(debtor);
            }
        });

        // Find emails with multiple debtors
        const duplicates = {};
        Object.keys(debtorsByEmail).forEach(email => {
            if (debtorsByEmail[email].length > 1) {
                duplicates[email] = debtorsByEmail[email];
            }
        });

        console.log(`⚠️  Found ${Object.keys(duplicates).length} emails with duplicate debtors:\n`);

        // Display duplicates
        Object.keys(duplicates).forEach(email => {
            console.log(`   ${email}: ${duplicates[email].length} debtors`);
            duplicates[email].forEach((debtor, index) => {
                const userInfo = debtor.user ? `${debtor.user.firstName} ${debtor.user.lastName}` : 'No user';
                console.log(`      ${index + 1}. ${debtor.debtorCode} (User: ${debtor.user?._id || 'N/A'}, Status: ${debtor.status}, Balance: $${debtor.currentBalance}) - ${userInfo}`);
            });
            console.log('');
        });

        if (Object.keys(duplicates).length === 0) {
            console.log('✅ No duplicate debtors found!');
            await mongoose.disconnect();
            return;
        }

        // Confirm before proceeding
        const shouldFix = process.argv.includes('--fix') || process.argv.includes('--confirm');
        
        if (!shouldFix) {
            console.log('💡 To actually delete duplicates, run: node scripts/fixDuplicateDebtors.js --fix');
            console.log('   This will:');
            console.log('   1. Keep the debtor with the most recent activity (or active status)');
            console.log('   2. Delete all other duplicate debtors');
            await mongoose.disconnect();
            return;
        }

        console.log('\n🗑️  Deleting duplicate debtors...\n');

        let fixedCount = 0;
        let errorCount = 0;

        for (const [email, duplicateDebtors] of Object.entries(duplicates)) {
            try {
                console.log(`\n📧 Processing: ${email}`);
                console.log(`   Found ${duplicateDebtors.length} duplicate debtors`);

                // Determine primary debtor (keep the one with most recent activity or active status)
                let primaryDebtor = duplicateDebtors[0];
                let maxActivity = 0;

                for (const debtor of duplicateDebtors) {
                    // Prefer active debtors
                    if (debtor.status === 'active' && primaryDebtor.status !== 'active') {
                        primaryDebtor = debtor;
                    }
                    // Prefer debtors with linked users
                    if (debtor.user && !primaryDebtor.user) {
                        primaryDebtor = debtor;
                    }
                    // Prefer most recent updatedAt
                    const updatedAt = debtor.updatedAt ? new Date(debtor.updatedAt).getTime() : 0;
                    if (updatedAt > maxActivity) {
                        maxActivity = updatedAt;
                        if (updatedAt > (primaryDebtor.updatedAt ? new Date(primaryDebtor.updatedAt).getTime() : 0)) {
                            primaryDebtor = debtor;
                        }
                    }
                }

                console.log(`   ✅ Keeping primary debtor: ${primaryDebtor.debtorCode}`);
                console.log(`      Status: ${primaryDebtor.status}`);
                console.log(`      Balance: $${primaryDebtor.currentBalance || 0}`);
                console.log(`      User: ${primaryDebtor.user ? `${primaryDebtor.user.firstName} ${primaryDebtor.user.lastName}` : 'None'}`);

                // Get all other debtors (duplicates to delete)
                const duplicateDebtorsToDelete = duplicateDebtors.filter(d => d._id.toString() !== primaryDebtor._id.toString());

                console.log(`   🗑️  Deleting ${duplicateDebtorsToDelete.length} duplicate debtor(s):`);
                duplicateDebtorsToDelete.forEach(duplicate => {
                    console.log(`      - ${duplicate.debtorCode} (Status: ${duplicate.status}, Balance: $${duplicate.currentBalance || 0})`);
                });

                // Delete duplicate debtors
                const duplicateIds = duplicateDebtorsToDelete.map(d => d._id);
                const deleteResult = await Debtor.deleteMany({ _id: { $in: duplicateIds } });
                console.log(`   ✅ Deleted ${deleteResult.deletedCount} duplicate debtor(s)`);

                fixedCount++;
                console.log(`   ✅ Deleted duplicates for ${email}\n`);

            } catch (error) {
                console.error(`   ❌ Error fixing duplicates for ${email}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Processed: ${fixedCount} email(s)`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📧 Total duplicate emails found: ${Object.keys(duplicates).length}`);

        await mongoose.disconnect();
        console.log('\n✅ Script completed');

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    fixDuplicateDebtors();
}

module.exports = { fixDuplicateDebtors };
