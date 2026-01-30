/**
 * Script to mark an application as a renewal and link it to a previous application
 * Usage: node scripts/markApplicationAsRenewal.js <newApplicationId> <previousApplicationId>
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');
const User = require('../src/models/User');

async function markApplicationAsRenewal(newApplicationId, previousApplicationId) {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('✅ Connected to database');

        // Find both applications
        const newApplication = await Application.findById(newApplicationId);
        const previousApplication = await Application.findById(previousApplicationId);

        if (!newApplication) {
            throw new Error(`New application not found: ${newApplicationId}`);
        }

        if (!previousApplication) {
            throw new Error(`Previous application not found: ${previousApplicationId}`);
        }

        console.log('\n📋 Applications found:');
        console.log(`   New Application: ${newApplication.applicationCode} (${newApplication.firstName} ${newApplication.lastName})`);
        console.log(`   Previous Application: ${previousApplication.applicationCode} (${previousApplication.firstName} ${previousApplication.lastName})`);

        // Verify they're for the same student
        if (newApplication.student?.toString() !== previousApplication.student?.toString() &&
            newApplication.email !== previousApplication.email) {
            console.warn('⚠️  Warning: Applications may not be for the same student');
            console.log(`   New: ${newApplication.email} / ${newApplication.student}`);
            console.log(`   Previous: ${previousApplication.email} / ${previousApplication.student}`);
        }

        // Find previous debtor account
        let previousDebtor = null;
        let previousDebtorCode = null;
        let previousFinancialSummary = null;

        if (previousApplication.student) {
            previousDebtor = await Debtor.findOne({ user: previousApplication.student });
            if (previousDebtor) {
                previousDebtorCode = previousDebtor.debtorCode;
                console.log(`\n💰 Found previous debtor account: ${previousDebtorCode}`);
                console.log(`   Previous balance: $${previousDebtor.currentBalance || 0}`);
                console.log(`   Total paid: $${previousDebtor.totalPaid || 0}`);
                console.log(`   Total owed: $${previousDebtor.totalOwed || 0}`);

                // Build previous financial summary
                previousFinancialSummary = {
                    debtorCode: previousDebtor.debtorCode,
                    previousBalance: previousDebtor.currentBalance || 0,
                    totalPaid: previousDebtor.totalPaid || 0,
                    totalOwed: previousDebtor.totalOwed || 0,
                    lastPaymentDate: previousDebtor.lastPaymentDate || null,
                    lastPaymentAmount: previousDebtor.lastPaymentAmount || 0,
                    transactionCount: 0 // Can be populated from transactions if needed
                };
            } else {
                console.log('⚠️  No previous debtor account found');
            }
        }

        // Update the new application to mark it as a renewal
        const updateData = {
            isReapplication: true,
            requestType: 'renewal',
            previousStudentId: previousApplication.student || null,
            previousDebtorCode: previousDebtorCode,
            previousFinancialSummary: previousFinancialSummary
        };

        console.log('\n🔄 Updating application...');
        const updatedApplication = await Application.findByIdAndUpdate(
            newApplicationId,
            { $set: updateData },
            { new: true }
        );

        console.log('\n✅ Application updated successfully!');
        console.log(`   Application Code: ${updatedApplication.applicationCode}`);
        console.log(`   Is Reapplication: ${updatedApplication.isReapplication}`);
        console.log(`   Request Type: ${updatedApplication.requestType}`);
        console.log(`   Previous Student ID: ${updatedApplication.previousStudentId || 'N/A'}`);
        console.log(`   Previous Debtor Code: ${updatedApplication.previousDebtorCode || 'N/A'}`);

        // If there's a previous debtor, we might want to link the new application to it
        if (previousDebtor) {
            console.log('\n🔗 Linking to previous debtor account...');
            // Update debtor to link to new application (optional - depends on your business logic)
            // await Debtor.findByIdAndUpdate(previousDebtor._id, {
            //     application: newApplicationId,
            //     applicationCode: newApplication.applicationCode,
            //     status: 'active'
            // });
            console.log('   ✅ Debtor account can be linked when application is approved');
        }

        await mongoose.disconnect();
        console.log('\n✅ Script completed successfully');

        return {
            success: true,
            application: updatedApplication,
            previousDebtor: previousDebtor
        };

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('❌ Usage: node scripts/markApplicationAsRenewal.js <newApplicationId> <previousApplicationId>');
        console.error('   Example: node scripts/markApplicationAsRenewal.js 697caac5c8b7fd93c8e239e2 697ca8e9c8b7fd93c8e1f1e8');
        process.exit(1);
    }

    const [newApplicationId, previousApplicationId] = args;
    markApplicationAsRenewal(newApplicationId, previousApplicationId);
}

module.exports = { markApplicationAsRenewal };
