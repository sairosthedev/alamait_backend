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

async function verifyRentalAccrualStatus() {
    try {
        console.log('\n🔍 VERIFYING RENTAL ACCRUAL STATUS');
        console.log('=' .repeat(70));

        // Import required models
        const Debtor = require('../src/models/Debtor');
        const Application = require('../src/models/Application');
        const TransactionEntry = require('../src/models/TransactionEntry');
        const Transaction = require('../src/models/Transaction');

        // Get all active debtors
        const activeDebtors = await Debtor.find({ 
            status: 'active'
        }).populate('application');

        console.log(`📊 Found ${activeDebtors.length} active debtors`);

        // Get all rental accrual transaction entries
        const rentalAccrualEntries = await TransactionEntry.find({
            source: 'rental_accrual'
        }).sort({ createdAt: -1 });

        console.log(`📋 Found ${rentalAccrualEntries.length} rental accrual entries`);

        // Get all rental accrual transactions
        const rentalTransactions = await Transaction.find({
            type: 'accrual',
            description: { $regex: /lease start/i }
        }).sort({ createdAt: -1 });

        console.log(`💼 Found ${rentalTransactions.length} rental accrual transactions`);

        console.log('\n📋 DETAILED DEBTOR STATUS');
        console.log('-'.repeat(70));

        for (const debtor of activeDebtors) {
            const application = debtor.application;
            
            console.log(`\n👤 ${application?.firstName || 'Unknown'} ${application?.lastName || 'Student'}`);
            console.log(`   Debtor Code: ${debtor.debtorCode}`);
            console.log(`   Application ID: ${application?._id || 'N/A'}`);
            console.log(`   Student ID: ${application?.student || 'N/A'}`);
            console.log(`   Start Date: ${application?.startDate || 'N/A'}`);
            console.log(`   Room: ${application?.allocatedRoom || 'N/A'}`);
            console.log(`   Room Price: $${debtor.roomPrice || 'N/A'}`);
            console.log(`   Total Owed: $${debtor.totalOwed || 'N/A'}`);

            if (application) {
                // Check for rental accrual entries
                const studentEntries = await TransactionEntry.find({
                    $or: [
                        { 'metadata.studentId': application.student },
                        { 'metadata.studentId': application._id },
                        { sourceId: application._id }
                    ]
                });

                console.log(`   📊 Transaction Entries: ${studentEntries.length}`);
                
                if (studentEntries.length > 0) {
                    studentEntries.forEach((entry, index) => {
                        console.log(`      ${index + 1}. ${entry.source} - ${entry.description}`);
                        console.log(`         Date: ${entry.date}`);
                        console.log(`         Total: $${entry.totalDebit || entry.totalCredit || 0}`);
                        console.log(`         Transaction ID: ${entry.transactionId}`);
                    });
                }

                // Check for lease start entries specifically
                const leaseStartEntries = await TransactionEntry.find({
                    'metadata.type': 'lease_start',
                    $or: [
                        { 'metadata.studentId': application.student },
                        { 'metadata.studentId': application._id }
                    ]
                });

                if (leaseStartEntries.length > 0) {
                    console.log(`   ✅ Has lease start entries: ${leaseStartEntries.length}`);
                } else {
                    console.log(`   ❌ Missing lease start entries`);
                }
            }
        }

        console.log('\n📊 RENTAL ACCRUAL ENTRIES SUMMARY');
        console.log('-'.repeat(50));

        if (rentalAccrualEntries.length > 0) {
            rentalAccrualEntries.forEach((entry, index) => {
                console.log(`\n${index + 1}. Transaction ID: ${entry.transactionId}`);
                console.log(`   Description: ${entry.description}`);
                console.log(`   Date: ${entry.date}`);
                console.log(`   Source: ${entry.source}`);
                console.log(`   Total Debit: $${entry.totalDebit || 0}`);
                console.log(`   Total Credit: $${entry.totalCredit || 0}`);
                console.log(`   Created By: ${entry.createdBy}`);
                console.log(`   Student: ${entry.metadata?.studentName || 'N/A'}`);
                console.log(`   Room: ${entry.metadata?.room || 'N/A'}`);
                
                if (entry.metadata?.proratedRent) {
                    console.log(`   Prorated Rent: $${entry.metadata.proratedRent}`);
                }
                if (entry.metadata?.adminFee) {
                    console.log(`   Admin Fee: $${entry.metadata.adminFee}`);
                }
                if (entry.metadata?.securityDeposit) {
                    console.log(`   Security Deposit: $${entry.metadata.securityDeposit}`);
                }
            });
        } else {
            console.log('ℹ️ No rental accrual entries found');
        }

        console.log('\n💼 RENTAL TRANSACTIONS SUMMARY');
        console.log('-'.repeat(50));

        if (rentalTransactions.length > 0) {
            rentalTransactions.forEach((transaction, index) => {
                console.log(`\n${index + 1}. Transaction ID: ${transaction.transactionId}`);
                console.log(`   Description: ${transaction.description}`);
                console.log(`   Date: ${transaction.date}`);
                console.log(`   Type: ${transaction.type}`);
                console.log(`   Amount: $${transaction.amount || 0}`);
                console.log(`   Created By: ${transaction.createdBy}`);
                console.log(`   Entries: ${transaction.entries?.length || 0}`);
            });
        } else {
            console.log('ℹ️ No rental transactions found');
        }

        console.log('\n🎯 SUMMARY');
        console.log('=' .repeat(30));
        console.log(`Active Debtors: ${activeDebtors.length}`);
        console.log(`Rental Accrual Entries: ${rentalAccrualEntries.length}`);
        console.log(`Rental Transactions: ${rentalTransactions.length}`);

        if (activeDebtors.length > 0 && rentalAccrualEntries.length > 0) {
            console.log('✅ Rental accrual system is working and has entries');
        } else if (activeDebtors.length > 0) {
            console.log('⚠️ Active debtors exist but no rental accrual entries found');
        } else {
            console.log('ℹ️ No active debtors in the system');
        }

    } catch (error) {
        console.error('❌ Error verifying rental accrual status:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await verifyRentalAccrualStatus();
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

module.exports = { verifyRentalAccrualStatus };
