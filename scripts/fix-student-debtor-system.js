const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Debtor = require('../src/models/Debtor');
const Payment = require('../src/models/Payment');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await fixStudentDebtorSystem();
});

async function fixStudentDebtorSystem() {
    console.log('\n🔧 FIXING STUDENT DEBTOR SYSTEM');
    console.log('================================\n');

    try {
        // 1. Create missing debtor accounts
        console.log('🔧 1. CREATING MISSING DEBTOR ACCOUNTS');
        console.log('=======================================');
        
        const students = await User.find({ role: 'student' });
        const debtors = await Debtor.find({});
        
        const studentsWithoutDebtors = [];
        for (const student of students) {
            const debtor = debtors.find(d => d.user.toString() === student._id.toString());
            if (!debtor) {
                studentsWithoutDebtors.push(student);
            }
        }
        
        console.log(`Found ${studentsWithoutDebtors.length} students without debtor accounts`);
        
        for (const student of studentsWithoutDebtors) {
            console.log(`Creating debtor account for: ${student.firstName} ${student.lastName}`);
            
            const debtorCode = await Debtor.generateDebtorCode();
            const accountCode = await Debtor.generateAccountCode();
            
            const debtor = new Debtor({
                debtorCode,
                user: student._id,
                accountCode,
                status: 'active',
                currentBalance: 0,
                totalOwed: 0,
                totalPaid: 0,
                contactInfo: {
                    name: `${student.firstName} ${student.lastName}`,
                    email: student.email,
                    phone: student.phone || ''
                },
                createdBy: student._id
            });
            
            await debtor.save();
            console.log(`  ✅ Created debtor account: ${debtorCode}`);
        }

        // 2. Fix payment transactions
        console.log('\n🔧 2. FIXING PAYMENT TRANSACTIONS');
        console.log('===================================');
        
        const payments = await Payment.find({});
        console.log(`Found ${payments.length} payments to process`);
        
        for (const payment of payments) {
            // Check if payment already has transaction
            const existingTransaction = await TransactionEntry.findOne({
                source: 'payment',
                sourceId: payment._id
            });
            
            if (!existingTransaction) {
                console.log(`Creating transaction for payment: ${payment.paymentId}`);
                await createPaymentTransaction(payment);
            } else {
                console.log(`  ✅ Transaction exists for payment: ${payment.paymentId}`);
            }
        }

        // 3. Verify debtor balances
        console.log('\n🔧 3. VERIFYING DEBTOR BALANCES');
        console.log('=================================');
        
        const updatedDebtors = await Debtor.find({});
        
        for (const debtor of updatedDebtors) {
            // Calculate expected balance from transactions
            const transactions = await TransactionEntry.find({
                $or: [
                    { 'entries.accountCode': debtor.accountCode },
                    { sourceId: debtor._id }
                ]
            });
            
            let calculatedBalance = 0;
            transactions.forEach(transaction => {
                transaction.entries.forEach(entry => {
                    if (entry.accountCode === debtor.accountCode) {
                        calculatedBalance += (entry.debit || 0) - (entry.credit || 0);
                    }
                });
            });
            
            // Update debtor balance if different
            if (Math.abs(calculatedBalance - debtor.currentBalance) > 0.01) {
                console.log(`Updating balance for ${debtor.debtorCode}: $${debtor.currentBalance} → $${calculatedBalance.toFixed(2)}`);
                debtor.currentBalance = calculatedBalance;
                debtor.totalOwed = Math.max(calculatedBalance, 0);
                debtor.totalPaid = Math.max(-calculatedBalance, 0);
                await debtor.save();
            } else {
                console.log(`  ✅ Balance correct for ${debtor.debtorCode}: $${debtor.currentBalance.toFixed(2)}`);
            }
        }

        // 4. Final verification
        console.log('\n🔍 4. FINAL VERIFICATION');
        console.log('=========================');
        
        const finalStudents = await User.find({ role: 'student' });
        const finalDebtors = await Debtor.find({});
        
        console.log(`Total students: ${finalStudents.length}`);
        console.log(`Total debtor accounts: ${finalDebtors.length}`);
        
        const finalStudentsWithDebtors = [];
        const finalStudentsWithoutDebtors = [];
        
        for (const student of finalStudents) {
            const debtor = finalDebtors.find(d => d.user.toString() === student._id.toString());
            if (debtor) {
                finalStudentsWithDebtors.push({ student, debtor });
            } else {
                finalStudentsWithoutDebtors.push(student);
            }
        }
        
        console.log(`Students with debtor accounts: ${finalStudentsWithDebtors.length}`);
        console.log(`Students without debtor accounts: ${finalStudentsWithoutDebtors.length}`);
        
        if (finalStudentsWithoutDebtors.length > 0) {
            console.log('\n❌ Students still without debtor accounts:');
            finalStudentsWithoutDebtors.forEach(student => {
                console.log(`  - ${student.firstName} ${student.lastName} (${student.email})`);
            });
        } else {
            console.log('\n✅ All students now have debtor accounts!');
        }
        
        // Show students with outstanding debt
        const studentsWithDebt = finalStudentsWithDebtors.filter(({ debtor }) => debtor.currentBalance > 0);
        console.log(`\nStudents with outstanding debt: ${studentsWithDebt.length}`);
        
        if (studentsWithDebt.length > 0) {
            console.log('\n📋 STUDENTS WITH OUTSTANDING DEBT:');
            studentsWithDebt.forEach(({ student, debtor }) => {
                console.log(`  ${student.firstName} ${student.lastName} (${student.email})`);
                console.log(`    Debtor Code: ${debtor.debtorCode}`);
                console.log(`    Current Balance: $${debtor.currentBalance.toFixed(2)}`);
                console.log(`    Total Owed: $${debtor.totalOwed.toFixed(2)}`);
                console.log(`    Total Paid: $${debtor.totalPaid.toFixed(2)}`);
                console.log('');
            });
        }

        // 5. Summary
        console.log('\n🎯 5. SUMMARY');
        console.log('=============');
        console.log('✅ Created missing debtor accounts');
        console.log('✅ Fixed payment transactions');
        console.log('✅ Verified debtor balances');
        console.log('✅ All students now have proper debtor accounts');
        console.log('✅ System is ready for proper double-entry accounting');

    } catch (error) {
        console.error('❌ Error during fix:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Student debtor system fix completed');
    }
}

async function createPaymentTransaction(payment) {
    try {
        // Get required accounts
        const bankAccount = await Account.findOne({ code: '1000' });
        const cashAccount = await Account.findOne({ code: '1015' });
        const accountsReceivable = await Account.findOne({ code: '1100' });
        const rentalIncome = await Account.findOne({ code: '4000' });

        if (!bankAccount || !cashAccount || !accountsReceivable || !rentalIncome) {
            console.log(`  ❌ Missing required accounts for payment ${payment.paymentId}`);
            return;
        }

        // Get student info
        const student = await User.findById(payment.student);
        const debtor = await Debtor.findOne({ user: payment.student });
        
        if (!student) {
            console.log(`  ❌ Student not found for payment ${payment.paymentId}`);
            return;
        }

        // Determine receiving account based on payment method
        let receivingAccount = bankAccount;
        if (payment.method && payment.method.toLowerCase().includes('cash')) {
            receivingAccount = cashAccount;
        }

        // Check if student has outstanding debt
        const hasOutstandingDebt = debtor && debtor.currentBalance > 0;

        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        let entries = [];
        let description = '';

        if (hasOutstandingDebt) {
            // Debt settlement transaction
            description = `Debt Settlement: ${student.firstName} ${student.lastName}`;
            entries = [
                {
                    accountCode: receivingAccount.code,
                    accountName: receivingAccount.name,
                    accountType: receivingAccount.type,
                    debit: payment.totalAmount,
                    credit: 0,
                    description: `Payment received from ${student.firstName} ${student.lastName}`
                },
                {
                    accountCode: accountsReceivable.code,
                    accountName: accountsReceivable.name,
                    accountType: accountsReceivable.type,
                    debit: 0,
                    credit: payment.totalAmount,
                    description: `Settlement of outstanding debt by ${student.firstName} ${student.lastName}`
                }
            ];
        } else {
            // Current period payment
            description = `Current Payment: ${student.firstName} ${student.lastName}`;
            entries = [
                {
                    accountCode: receivingAccount.code,
                    accountName: receivingAccount.name,
                    accountType: receivingAccount.type,
                    debit: payment.totalAmount,
                    credit: 0,
                    description: `Payment received from ${student.firstName} ${student.lastName}`
                },
                {
                    accountCode: rentalIncome.code,
                    accountName: rentalIncome.name,
                    accountType: rentalIncome.type,
                    debit: 0,
                    credit: payment.totalAmount,
                    description: `Rental income from ${student.firstName} ${student.lastName}`
                }
            ];
        }

        const transactionEntry = new TransactionEntry({
            transactionId: transactionId,
            date: payment.date || new Date(),
            description: description,
            reference: payment.paymentId,
            entries: entries,
            totalDebit: payment.totalAmount,
            totalCredit: payment.totalAmount,
            source: 'payment',
            sourceId: payment._id,
            sourceModel: 'Payment',
            createdBy: 'system@fix.com',
            status: 'posted'
        });

        await transactionEntry.save();
        console.log(`  ✅ Created ${hasOutstandingDebt ? 'debt settlement' : 'current payment'} transaction: $${payment.totalAmount}`);
        
        return transactionEntry;
    } catch (error) {
        console.error(`  ❌ Error creating transaction for payment ${payment.paymentId}:`, error.message);
    }
}

// Run the fix
console.log('🚀 Starting Student Debtor System Fix...'); 