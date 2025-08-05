const mongoose = require('mongoose');
const { createDebtorsForAllStudents } = require('../src/services/debtorService');
require('dotenv').config();

/**
 * Script to ensure all students have debtor accounts
 * This ensures that when role is student, they are automatically debtors
 * so they can be fetched in the debtors collection in frontend
 */

async function ensureAllStudentsHaveDebtors() {
    try {
        console.log('🔍 Starting debtor account verification for all students...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');

        // Create debtors for all students
        const result = await createDebtorsForAllStudents({
            // The service will use each student's own ID as createdBy
        });

        console.log('\n📊 RESULTS SUMMARY:');
        console.log(`✅ Successfully created: ${result.createdDebtors.length} debtor accounts`);
        console.log(`❌ Errors encountered: ${result.errors.length}`);
        
        if (result.createdDebtors.length > 0) {
            console.log('\n✅ CREATED DEBTOR ACCOUNTS:');
            result.createdDebtors.forEach((debtor, index) => {
                console.log(`  ${index + 1}. ${debtor.debtorCode} - ${debtor.accountCode}`);
            });
        }

        if (result.errors.length > 0) {
            console.log('\n❌ ERRORS ENCOUNTERED:');
            result.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error.student}: ${error.error}`);
            });
        }

        console.log('\n🎯 VERIFICATION COMPLETE');
        console.log('All students should now have debtor accounts and will appear in the frontend debtors collection.');

    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
if (require.main === module) {
    ensureAllStudentsHaveDebtors()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { ensureAllStudentsHaveDebtors }; 