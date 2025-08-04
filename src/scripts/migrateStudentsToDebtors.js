const mongoose = require('mongoose');
const User = require('../models/User');
const Debtor = require('../models/Debtor');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Account = require('../models/Account');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend';

async function migrateStudentsToDebtors() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        // Get all students
        const students = await User.find({ role: 'student' });
        console.log(`📊 Found ${students.length} students to migrate`);

        let createdCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        for (const student of students) {
            try {
                console.log(`\n👤 Processing student: ${student.firstName} ${student.lastName} (${student.email})`);

                // Check if debtor account already exists
                let debtor = await Debtor.findOne({ user: student._id });
                
                if (debtor) {
                    console.log(`   ⚠️  Debtor account already exists: ${debtor.debtorCode}`);
                    updatedCount++;
                    continue;
                }

                // Create new debtor account
                const debtorCode = await Debtor.generateDebtorCode();
                const accountCode = await Debtor.generateDebtorCode();

                debtor = new Debtor({
                    debtorCode,
                    user: student._id,
                    accountCode,
                    residence: student.residence,
                    roomNumber: student.currentRoom,
                    contactInfo: {
                        name: `${student.firstName} ${student.lastName}`,
                        email: student.email,
                        phone: student.phone
                    },
                    createdBy: student._id // Use student as creator for migration
                });

                // Calculate total owed from invoices
                const invoices = await Invoice.find({ student: student._id });
                let totalOwed = 0;
                
                invoices.forEach(invoice => {
                    totalOwed += invoice.totalAmount || 0;
                });

                // Calculate total paid from payments
                const payments = await Payment.find({ 
                    student: student._id,
                    status: { $in: ['Confirmed', 'Verified'] }
                });
                let totalPaid = 0;
                
                payments.forEach(payment => {
                    totalPaid += payment.totalAmount || 0;
                });

                // Set calculated values
                debtor.totalOwed = totalOwed;
                debtor.totalPaid = totalPaid;
                debtor.calculateBalance();

                await debtor.save();

                // Create corresponding account in chart of accounts
                const account = new Account({
                    code: accountCode,
                    name: `Accounts Receivable - ${student.firstName} ${student.lastName}`,
                    type: 'Asset',
                    description: `Accounts receivable for ${student.firstName} ${student.lastName}`,
                    isActive: true,
                    parentAccount: '1100', // Accounts Receivable - Tenants
                    createdBy: student._id
                });

                await account.save();

                console.log(`   ✅ Created debtor account: ${debtorCode}`);
                console.log(`   💰 Total Owed: $${totalOwed.toFixed(2)}`);
                console.log(`   💳 Total Paid: $${totalPaid.toFixed(2)}`);
                console.log(`   📊 Current Balance: $${debtor.currentBalance.toFixed(2)}`);
                console.log(`   🏦 Account Code: ${accountCode}`);

                createdCount++;

            } catch (error) {
                console.error(`   ❌ Error processing student ${student.email}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📈 Migration Summary:');
        console.log(`   ✅ Created: ${createdCount} debtor accounts`);
        console.log(`   ⚠️  Already existed: ${updatedCount} debtor accounts`);
        console.log(`   ❌ Errors: ${errorCount} students`);
        console.log(`   📊 Total processed: ${students.length} students`);

        // Get summary statistics
        const totalDebtors = await Debtor.countDocuments();
        const totalOwed = await Debtor.aggregate([
            { $group: { _id: null, total: { $sum: '$totalOwed' } } }
        ]);
        const totalPaid = await Debtor.aggregate([
            { $group: { _id: null, total: { $sum: '$totalPaid' } } }
        ]);
        const totalBalance = await Debtor.aggregate([
            { $group: { _id: null, total: { $sum: '$currentBalance' } } }
        ]);

        console.log('\n💰 System Summary:');
        console.log(`   👥 Total Debtors: ${totalDebtors}`);
        console.log(`   💰 Total Owed: $${(totalOwed[0]?.total || 0).toFixed(2)}`);
        console.log(`   💳 Total Paid: $${(totalPaid[0]?.total || 0).toFixed(2)}`);
        console.log(`   📊 Total Balance: $${(totalBalance[0]?.total || 0).toFixed(2)}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateStudentsToDebtors();
}

module.exports = migrateStudentsToDebtors; 