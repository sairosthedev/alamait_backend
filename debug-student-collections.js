const mongoose = require('mongoose');
const User = require('./src/models/User');
const Account = require('./src/models/Account');
const StudentAccount = require('./src/models/StudentAccount');
const Debtor = require('./src/models/Debtor');
const Payment = require('./src/models/Payment');
const TransactionEntry = require('./src/models/TransactionEntry');

const ATLAS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_test';

async function debugStudentCollections() {
    try {
        console.log('🔍 Debugging Student-Related Collections');
        console.log('=' .repeat(60));

        // Connect to database
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected to database');

        // Get a sample student
        const sampleStudent = await User.findOne({ role: 'student' });
        if (!sampleStudent) {
            console.log('❌ No students found in database');
            return;
        }

        console.log(`\n👤 Sample Student: ${sampleStudent.email} (${sampleStudent._id})`);
        const studentId = sampleStudent._id;

        // Check different collections for student references
        console.log('\n📊 Collection Analysis:');

        // 1. Account Collection (Chart of Accounts)
        console.log('\n1️⃣ Account Collection (Chart of Accounts):');
        const accounts = await Account.find({}).limit(5);
        console.log(`Total accounts: ${await Account.countDocuments()}`);
        if (accounts.length > 0) {
            console.log('Sample accounts:');
            accounts.forEach((acc, i) => {
                console.log(`  ${i + 1}. ${acc.code} - ${acc.name} (${acc.type})`);
            });
            console.log('🔍 This is the Chart of Accounts - should NOT be deleted with students');
        }

        // 2. StudentAccount Collection
        console.log('\n2️⃣ StudentAccount Collection:');
        const studentAccounts = await StudentAccount.find({ student: studentId });
        console.log(`Student accounts for this student: ${studentAccounts.length}`);
        if (studentAccounts.length > 0) {
            studentAccounts.forEach((acc, i) => {
                console.log(`  ${i + 1}. ${acc.accountCode} - ${acc.accountName} (Balance: ${acc.balance})`);
            });
            console.log('✅ These SHOULD be deleted with the student');
        }

        // 3. Debtor Collection
        console.log('\n3️⃣ Debtor Collection:');
        const debtors = await Debtor.find({ user: studentId });
        console.log(`Debtor records for this student: ${debtors.length}`);
        if (debtors.length > 0) {
            debtors.forEach((debtor, i) => {
                console.log(`  ${i + 1}. ${debtor.debtorCode} - Balance: ${debtor.currentBalance}`);
            });
            console.log('✅ These SHOULD be deleted with the student');
        }

        // 4. Payment Collection
        console.log('\n4️⃣ Payment Collection:');
        const payments = await Payment.find({
            $or: [{ student: studentId }, { user: studentId }]
        });
        console.log(`Payments for this student: ${payments.length}`);
        if (payments.length > 0) {
            payments.slice(0, 3).forEach((payment, i) => {
                console.log(`  ${i + 1}. ${payment.paymentId} - Amount: ${payment.amount}`);
            });
            console.log('✅ These SHOULD be deleted with the student');
        }

        // 5. TransactionEntry Collection
        console.log('\n5️⃣ TransactionEntry Collection:');
        const transactionEntries = await TransactionEntry.find({
            $or: [
                { reference: studentId.toString() },
                { reference: studentId },
                { description: { $regex: sampleStudent.email, $options: 'i' } }
            ]
        });
        console.log(`Transaction entries for this student: ${transactionEntries.length}`);
        if (transactionEntries.length > 0) {
            transactionEntries.slice(0, 3).forEach((entry, i) => {
                console.log(`  ${i + 1}. ${entry.description} (${entry.accountCode}) - Ref: ${entry.reference}`);
            });
            console.log('✅ These SHOULD be deleted with the student');
        }

        // Summary
        console.log('\n📋 SUMMARY:');
        console.log('Account Collection (Chart of Accounts):');
        console.log('  🚫 Should NOT be deleted - these are permanent accounting categories');
        console.log('  📝 Contains entries like "Accounts Receivable", "Cash", "Revenue", etc.');
        
        console.log('\nStudent-Specific Collections:');
        console.log(`  ✅ StudentAccount: ${studentAccounts.length} records`);
        console.log(`  ✅ Debtor: ${debtors.length} records`);
        console.log(`  ✅ Payment: ${payments.length} records`);
        console.log(`  ✅ TransactionEntry: ${transactionEntries.length} records`);

        console.log('\n💡 The "Accounts Receivable" you see is likely in the Account collection');
        console.log('   which is the Chart of Accounts and should remain untouched.');

    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

// Run the debug
if (require.main === module) {
    debugStudentCollections();
}

module.exports = { debugStudentCollections }; 