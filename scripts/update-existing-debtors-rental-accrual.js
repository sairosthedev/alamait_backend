const mongoose = require('mongoose');

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

async function updateExistingDebtorsRentalAccrual() {
    try {
        console.log('\n🏠 UPDATING EXISTING DEBTORS WITH RENTAL ACCRUAL');
        console.log('=' .repeat(70));

        // Import required models and services
        const Debtor = require('../src/models/Debtor');
        const Application = require('../src/models/Application');
        const TransactionEntry = require('../src/models/TransactionEntry');
        const RentalAccrualService = require('../src/services/rentalAccrualService');

        // Get all active debtors
        const activeDebtors = await Debtor.find({ 
            status: 'active',
            application: { $exists: true, $ne: null }
        }).populate('application');

        console.log(`📊 Found ${activeDebtors.length} active debtors with applications`);

        if (activeDebtors.length === 0) {
            console.log('ℹ️ No active debtors found to process');
            return;
        }

        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];

        console.log('\n🔍 PROCESSING EACH DEBTOR');
        console.log('-'.repeat(50));

        for (const debtor of activeDebtors) {
            try {
                const application = debtor.application;
                
                if (!application) {
                    console.log(`⚠️ Skipping debtor ${debtor.debtorCode} - No application found`);
                    skippedCount++;
                    continue;
                }

                console.log(`\n📋 Processing: ${application.firstName} ${application.lastName}`);
                console.log(`   Debtor Code: ${debtor.debtorCode}`);
                console.log(`   Application ID: ${application._id}`);
                console.log(`   Start Date: ${application.startDate}`);
                console.log(`   Room: ${application.allocatedRoom}`);

                // Check if rental accrual entries already exist for this student
                const existingEntries = await TransactionEntry.findOne({
                    'metadata.studentId': application.student,
                    'metadata.type': 'lease_start',
                    'metadata.leaseStartDate': application.startDate
                });

                if (existingEntries) {
                    console.log(`   ✅ Rental accrual entries already exist - skipping`);
                    skippedCount++;
                    continue;
                }

                // Process lease start for this application
                console.log(`   🏠 Running rental accrual service...`);
                const result = await RentalAccrualService.processLeaseStart(application);

                if (result && result.success) {
                    console.log(`   ✅ Rental accrual completed successfully`);
                    console.log(`      Transaction ID: ${result.transactionId}`);
                    console.log(`      Prorated Rent: $${result.proratedRent?.toFixed(2) || 'N/A'}`);
                    console.log(`      Admin Fee: $${result.adminFee || 0}`);
                    console.log(`      Security Deposit: $${result.securityDeposit || 0}`);
                    console.log(`      Total Amount: $${result.totalAmount?.toFixed(2) || 'N/A'}`);
                    processedCount++;
                } else {
                    const errorMsg = result?.error || 'Unknown error';
                    console.log(`   ❌ Rental accrual failed: ${errorMsg}`);
                    errors.push({
                        debtor: debtor.debtorCode,
                        student: `${application.firstName} ${application.lastName}`,
                        error: errorMsg
                    });
                    errorCount++;
                }

            } catch (error) {
                console.log(`   ❌ Error processing debtor ${debtor.debtorCode}: ${error.message}`);
                errors.push({
                    debtor: debtor.debtorCode,
                    student: debtor.contactInfo?.name || 'Unknown',
                    error: error.message
                });
                errorCount++;
            }
        }

        console.log('\n📊 PROCESSING SUMMARY');
        console.log('=' .repeat(50));
        console.log(`✅ Successfully processed: ${processedCount} debtors`);
        console.log(`⏭️ Skipped (already processed): ${skippedCount} debtors`);
        console.log(`❌ Errors encountered: ${errorCount} debtors`);
        console.log(`📋 Total debtors checked: ${activeDebtors.length}`);

        if (errors.length > 0) {
            console.log('\n❌ ERRORS ENCOUNTERED');
            console.log('-'.repeat(30));
            errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.student} (${error.debtor}): ${error.error}`);
            });
        }

        if (processedCount > 0) {
            console.log('\n🎉 DATABASE UPDATE COMPLETED');
            console.log(`   ${processedCount} debtors now have proper rental accrual entries`);
            console.log(`   Initial accounting entries created for lease starts`);
            console.log(`   Prorated rent, admin fees, and deposits recorded`);
        } else {
            console.log('\nℹ️ No new rental accrual entries were created');
            console.log('   All existing debtors already have proper accounting entries');
        }

    } catch (error) {
        console.error('❌ Error updating existing debtors:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await updateExistingDebtorsRentalAccrual();
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

module.exports = { updateExistingDebtorsRentalAccrual };
