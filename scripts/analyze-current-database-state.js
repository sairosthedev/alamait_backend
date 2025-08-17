/**
 * 🔍 Quick Database State Analysis
 * 
 * Run this script first to see what needs to be fixed
 * before running the main GAAP compliance fix script.
 * 
 * This script analyzes your REAL data from applications and payments
 * to understand how to link transactions to residences.
 */

const mongoose = require('mongoose');
const Transaction = require('../src/models/Transaction');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

async function analyzeCurrentState() {
    try {
        console.log('🔍 Analyzing Current Database State...\n');

        // Basic counts
        const totalTransactions = await Transaction.countDocuments();
        const totalTransactionEntries = await TransactionEntry.countDocuments();
        const totalAccounts = await Account.countDocuments();

        console.log('📊 Basic Counts:');
        console.log(`   Transactions: ${totalTransactions}`);
        console.log(`   Transaction Entries: ${totalTransactionEntries}`);
        console.log(`   Accounts: ${totalAccounts}`);

        // Check for unbalanced transactions
        const unbalancedEntries = await TransactionEntry.find({
            $expr: {
                $ne: ['$totalDebit', '$totalCredit']
            }
        });

        console.log(`\n⚠️  Unbalanced Transactions: ${unbalancedEntries.length}`);
        if (unbalancedEntries.length > 0) {
            console.log('   Sample unbalanced transactions:');
            unbalancedEntries.slice(0, 3).forEach((entry, index) => {
                console.log(`   ${index + 1}. ${entry.transactionId}: Debit $${entry.totalDebit}, Credit $${entry.totalCredit}`);
            });
        }

        // Check for missing residence info
        const missingResidence = await TransactionEntry.find({
            $or: [
                { residence: { $exists: false } },
                { residence: null },
                { 'metadata.residenceId': { $exists: false } }
            ]
        });

        console.log(`\n⚠️  Missing Residence Info: ${missingResidence.length}`);
        if (missingResidence.length > 0) {
            console.log('   Sample transactions missing residence:');
            missingResidence.slice(0, 3).forEach((entry, index) => {
                console.log(`   ${index + 1}. ${entry.transactionId}: ${entry.description}`);
                console.log(`      Metadata:`, entry.metadata);
            });
        }

        // Check for invalid account codes
        const invalidAccountCodes = await TransactionEntry.find({
            'entries.accountCode': { $exists: false }
        });

        console.log(`\n⚠️  Invalid Account Codes: ${invalidAccountCodes.length}`);

        // Check for missing accrual entries
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const currentAccruals = await TransactionEntry.find({
            'metadata.type': 'rent_accrual',
            'metadata.accrualMonth': currentMonth,
            'metadata.accrualYear': currentYear
        });

        console.log(`\n📊 Current Month Accruals (${currentMonth}/${currentYear}): ${currentAccruals.length}`);

        // Check for recent payments
        const recentPayments = await TransactionEntry.find({
            'metadata.type': 'rent_payment',
            date: { $gte: new Date(currentYear, currentMonth - 1, 1) }
        });

        console.log(`📊 Recent Payments (${currentMonth}/${currentYear}): ${recentPayments.length}`);

        // Analyze real data from applications and payments
        console.log('\n🔍 Analyzing Real Data Sources...');
        
        try {
            // Check applications collection
            const applications = await mongoose.connection.db
                .collection('applications')
                .find({}).limit(5).toArray();
            
            console.log(`📊 Applications Collection: ${applications.length} sample records`);
            if (applications.length > 0) {
                console.log('   Sample application:');
                const sampleApp = applications[0];
                console.log(`      Student: ${sampleApp.firstName} ${sampleApp.lastName}`);
                console.log(`      Residence: ${sampleApp.residence ? sampleApp.residence : 'Not set'}`);
                console.log(`      Room: ${sampleApp.allocatedRoom || sampleApp.preferredRoom || 'Not set'}`);
                console.log(`      Status: ${sampleApp.status}`);
            }

            // Check payments collection
            const payments = await mongoose.connection.db
                .collection('payments')
                .find({}).limit(5).toArray();
            
            console.log(`📊 Payments Collection: ${payments.length} sample records`);
            if (payments.length > 0) {
                console.log('   Sample payment:');
                const samplePayment = payments[0];
                console.log(`      Payment ID: ${samplePayment._id}`);
                console.log(`      Student: ${samplePayment.student || 'Not linked'}`);
                console.log(`      Amount: $${samplePayment.amount || 'Not set'}`);
                console.log(`      Method: ${samplePayment.method || 'Not set'}`);
            }

            // Check residences collection
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).limit(5).toArray();
            
            console.log(`📊 Residences Collection: ${residences.length} sample records`);
            if (residences.length > 0) {
                console.log('   Sample residence:');
                const sampleResidence = residences[0];
                console.log(`      Name: ${sampleResidence.name}`);
                console.log(`      Rooms: ${sampleResidence.rooms ? sampleResidence.rooms.length : 0} rooms`);
                if (sampleResidence.rooms && sampleResidence.rooms.length > 0) {
                    console.log(`      Sample Room: ${sampleResidence.rooms[0].roomNumber || sampleResidence.rooms[0].name}`);
                }
            }

        } catch (error) {
            console.warn(`⚠️  Could not analyze some collections:`, error.message);
        }

        // Summary
        console.log('\n📋 Summary:');
        console.log('=====================================');
        
        if (unbalancedEntries.length === 0 && missingResidence.length === 0 && invalidAccountCodes.length === 0) {
            console.log('✅ Your database is already GAAP compliant!');
        } else {
            console.log('⚠️  Issues found that need fixing:');
            if (unbalancedEntries.length > 0) {
                console.log(`   • ${unbalancedEntries.length} unbalanced transactions`);
            }
            if (missingResidence.length > 0) {
                console.log(`   • ${missingResidence.length} missing residence info`);
                console.log(`   💡 The fix script will link these to real residences from applications/payments`);
            }
            if (invalidAccountCodes.length > 0) {
                console.log(`   • ${invalidAccountCodes.length} invalid account codes`);
            }
            console.log('\n💡 Run the fix script: node fix-database-gaap-compliance.js');
        }

        // Sample of recent transactions
        console.log('\n📋 Recent Transactions Sample:');
        const recentTransactions = await TransactionEntry.find({})
            .sort({ date: -1 })
            .limit(5);

        recentTransactions.forEach((txn, index) => {
            console.log(`   ${index + 1}. ${txn.transactionId}: ${txn.description}`);
            console.log(`      Date: ${txn.date.toDateString()}, Amount: $${txn.totalDebit}`);
            console.log(`      Balanced: ${txn.totalDebit === txn.totalCredit ? '✅' : '❌'}`);
            console.log(`      Residence: ${txn.residence ? '✅' : '❌'}`);
            if (txn.metadata) {
                console.log(`      Metadata:`, Object.keys(txn.metadata).join(', ') || 'None');
            }
        });

        // Show linking strategy
        if (missingResidence.length > 0) {
            console.log('\n🔗 Residence Linking Strategy:');
            console.log('The fix script will use these methods to link transactions to residences:');
            console.log('   1. Student ID in metadata → Look up in applications collection');
            console.log('   2. Payment ID in metadata → Look up payment → student → application → residence');
            console.log('   3. Room number in description → Match to residence with that room');
            console.log('   4. Fallback → Use default residence for unmatched transactions');
        }

    } catch (error) {
        console.error('❌ Error analyzing database:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the analysis
if (require.main === module) {
    analyzeCurrentState().catch(console.error);
}

module.exports = { analyzeCurrentState };
