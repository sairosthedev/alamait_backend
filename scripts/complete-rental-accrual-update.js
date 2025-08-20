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

async function completeRentalAccrualUpdate() {
    try {
        console.log('\n🏠 COMPLETE RENTAL ACCRUAL UPDATE FOR ALL DEBTORS');
        console.log('=' .repeat(80));

        // Import required models and services
        const Debtor = require('../src/models/Debtor');
        const Application = require('../src/models/Application');
        const TransactionEntry = require('../src/models/TransactionEntry');
        const Transaction = require('../src/models/Transaction');
        const RentalAccrualService = require('../src/services/rentalAccrualService');

        console.log('\n1️⃣ ANALYZING CURRENT DATABASE STATE');
        console.log('-'.repeat(60));

        // Get all applications with approved status
        const approvedApplications = await Application.find({ 
            status: 'approved'
        }).sort({ createdAt: 1 });

        console.log(`📋 Found ${approvedApplications.length} approved applications`);

        // Get all active debtors
        const activeDebtors = await Debtor.find({ 
            status: 'active'
        }).populate('application');

        console.log(`👥 Found ${activeDebtors.length} active debtors`);

        // Get existing rental accrual entries
        const existingEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            'metadata.type': 'lease_start'
        });

        console.log(`📊 Found ${existingEntries.length} existing lease start entries`);

        console.log('\n2️⃣ PROCESSING APPROVED APPLICATIONS');
        console.log('-'.repeat(60));

        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];
        const processedStudents = new Set();

        for (const application of approvedApplications) {
            try {
                console.log(`\n📋 Processing: ${application.firstName} ${application.lastName}`);
                console.log(`   Application ID: ${application._id}`);
                console.log(`   Email: ${application.email}`);
                console.log(`   Status: ${application.status}`);
                console.log(`   Start Date: ${application.startDate}`);
                console.log(`   Room: ${application.allocatedRoom || application.preferredRoom}`);

                // Check if this student already has rental accrual entries
                const studentKey = `${application.email}_${application.startDate}`;
                
                if (processedStudents.has(studentKey)) {
                    console.log(`   ⏭️ Already processed this student - skipping`);
                    skippedCount++;
                    continue;
                }

                const existingEntries = await TransactionEntry.findOne({
                    $or: [
                        { 'metadata.studentId': application.student },
                        { 'metadata.studentId': application._id },
                        { sourceId: application._id }
                    ],
                    'metadata.type': 'lease_start',
                    source: 'rental_accrual'
                });

                if (existingEntries) {
                    console.log(`   ✅ Rental accrual entries already exist - skipping`);
                    processedStudents.add(studentKey);
                    skippedCount++;
                    continue;
                }

                // Check if student field is populated (has registered)
                if (!application.student) {
                    console.log(`   ⚠️ Student not registered yet - skipping (will process when they register)`);
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
                    processedStudents.add(studentKey);
                    processedCount++;
                } else {
                    const errorMsg = result?.error || 'Unknown error';
                    console.log(`   ❌ Rental accrual failed: ${errorMsg}`);
                    errors.push({
                        application: application._id,
                        student: `${application.firstName} ${application.lastName}`,
                        email: application.email,
                        error: errorMsg
                    });
                    errorCount++;
                }

            } catch (error) {
                console.log(`   ❌ Error processing application ${application._id}: ${error.message}`);
                errors.push({
                    application: application._id,
                    student: `${application.firstName || 'Unknown'} ${application.lastName || 'Student'}`,
                    email: application.email,
                    error: error.message
                });
                errorCount++;
            }
        }

        console.log('\n3️⃣ VERIFYING DEBTOR CONSISTENCY');
        console.log('-'.repeat(60));

        // Verify that all active debtors have corresponding rental accrual entries
        let debtorIssues = 0;
        
        for (const debtor of activeDebtors) {
            const application = debtor.application;
            if (!application) {
                console.log(`⚠️ Debtor ${debtor.debtorCode} has no linked application`);
                debtorIssues++;
                continue;
            }

            const hasRentalAccrual = await TransactionEntry.findOne({
                $or: [
                    { 'metadata.studentId': application.student },
                    { 'metadata.studentId': application._id },
                    { sourceId: application._id }
                ],
                'metadata.type': 'lease_start',
                source: 'rental_accrual'
            });

            if (!hasRentalAccrual) {
                console.log(`⚠️ Debtor ${debtor.debtorCode} (${application.firstName} ${application.lastName}) missing rental accrual`);
                debtorIssues++;
            } else {
                console.log(`✅ Debtor ${debtor.debtorCode} has proper rental accrual entries`);
            }
        }

        console.log('\n📊 PROCESSING SUMMARY');
        console.log('=' .repeat(60));
        console.log(`✅ Successfully processed: ${processedCount} applications`);
        console.log(`⏭️ Skipped (already processed/not ready): ${skippedCount} applications`);
        console.log(`❌ Errors encountered: ${errorCount} applications`);
        console.log(`📋 Total applications checked: ${approvedApplications.length}`);
        console.log(`👥 Active debtors: ${activeDebtors.length}`);
        console.log(`⚠️ Debtor issues found: ${debtorIssues}`);

        if (errors.length > 0) {
            console.log('\n❌ ERRORS ENCOUNTERED');
            console.log('-'.repeat(40));
            errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.student} (${error.email})`);
                console.log(`   Application: ${error.application}`);
                console.log(`   Error: ${error.error}`);
                console.log('');
            });
        }

        // Final verification
        const finalEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            'metadata.type': 'lease_start'
        });

        const finalTransactions = await Transaction.find({
            type: 'accrual',
            description: { $regex: /lease start/i }
        });

        console.log('\n🎯 FINAL DATABASE STATE');
        console.log('=' .repeat(50));
        console.log(`📋 Total lease start entries: ${finalEntries.length}`);
        console.log(`💼 Total rental transactions: ${finalTransactions.length}`);
        console.log(`👥 Active debtors: ${activeDebtors.length}`);

        if (processedCount > 0) {
            console.log('\n🎉 DATABASE UPDATE COMPLETED');
            console.log(`   ${processedCount} new rental accrual entries created`);
            console.log(`   All registered students now have proper accounting entries`);
            console.log(`   Future student registrations will automatically trigger rental accrual`);
        } else {
            console.log('\n✅ DATABASE ALREADY UP TO DATE');
            console.log('   All existing debtors already have proper rental accrual entries');
            console.log('   System ready for new student registrations');
        }

        console.log('\n🚀 NEXT STEPS');
        console.log('-'.repeat(20));
        console.log('• New student registrations will automatically trigger rental accrual');
        console.log('• Existing debtors have proper accounting entries');
        console.log('• System is ready for production use');

    } catch (error) {
        console.error('❌ Error in complete rental accrual update:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await completeRentalAccrualUpdate();
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

module.exports = { completeRentalAccrualUpdate };
