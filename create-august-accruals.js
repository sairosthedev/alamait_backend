const mongoose = require('mongoose');
require('dotenv').config();

async function createAugustAccruals() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB successfully');

        const TransactionEntry = require('./src/models/TransactionEntry');
        const Application = require('./src/models/Application');
        const Account = require('./src/models/Account');

        const studentId = "68c0a3ffad46285698184f3f";
        const studentName = "Precious Dziva";
        const accrualMonth = 8;
        const accrualYear = 2025;

        console.log(`\n🔧 Creating August 2025 accrual for ${studentName} (${studentId})`);

        // Get the student's application
        const application = await Application.findOne({
            student: studentId
        });

        if (!application) {
            console.log('❌ Application not found for this student');
            return;
        }

        console.log(`📋 Application found:`);
        console.log(`   Name: ${application.firstName} ${application.lastName}`);
        console.log(`   Start Date: ${application.startDate}`);
        console.log(`   End Date: ${application.endDate}`);
        console.log(`   Residence: ${application.residence}`);
        console.log(`   Room: ${application.allocatedRoom}`);

        // Calculate prorated rent for August (since lease starts Aug 10)
        const leaseStartDate = new Date(application.startDate);
        const monthStart = new Date(accrualYear, accrualMonth - 1, 1);
        const monthEnd = new Date(accrualYear, accrualMonth, 0);
        
        // Calculate days in August that the student will be there
        const daysInMonth = monthEnd.getDate();
        const daysFromStart = Math.max(0, monthEnd.getDate() - leaseStartDate.getDate() + 1);
        const proratedDays = Math.min(daysFromStart, daysInMonth);
        
        console.log(`📅 Lease starts: ${leaseStartDate.toDateString()}`);
        console.log(`📅 Month: ${monthStart.toDateString()} to ${monthEnd.toDateString()}`);
        console.log(`📅 Prorated days: ${proratedDays} out of ${daysInMonth}`);

        // Get room pricing (assuming $150/month for now - you can adjust this)
        const monthlyRent = 150; // You can get this from room pricing
        const proratedRent = (monthlyRent / daysInMonth) * proratedDays;
        const adminFee = 0; // Assuming no admin fee for now

        console.log(`💰 Monthly rent: $${monthlyRent}`);
        console.log(`💰 Prorated rent: $${proratedRent.toFixed(2)}`);

        // Get or create student-specific A/R account
        let studentARAccount = await Account.findOne({
            code: `1100-${studentId}`,
            type: 'Asset'
        });

        if (!studentARAccount) {
            studentARAccount = new Account({
                code: `1100-${studentId}`,
                name: `Accounts Receivable - ${studentName}`,
                type: 'Asset',
                category: 'Current Assets',
                description: `Accounts receivable for ${studentName}`,
                isActive: true
            });
            await studentARAccount.save();
            console.log(`✅ Created student A/R account: ${studentARAccount.code}`);
        } else {
            console.log(`✅ Found existing student A/R account: ${studentARAccount.code}`);
        }

        // Get or create rental income account
        let rentalIncomeAccount = await Account.findOne({
            $or: [
                { code: '4001', type: 'Income' },
                { code: '4000', type: 'Income' },
                { name: /rental income/i, type: 'Income' }
            ]
        });

        if (!rentalIncomeAccount) {
            rentalIncomeAccount = new Account({
                code: '4001',
                name: 'Rental Income - School Accommodation',
                type: 'Income',
                category: 'Operating Revenue',
                description: 'Income from student accommodation rentals',
                isActive: true
            });
            await rentalIncomeAccount.save();
            console.log(`✅ Created rental income account: ${rentalIncomeAccount.code}`);
        } else {
            console.log(`✅ Found existing rental income account: ${rentalIncomeAccount.code}`);
        }

        // Create the accrual transaction
        const transactionId = `LEASE_START_${studentId}_${Date.now()}`;
        const totalAmount = proratedRent + adminFee;

        const accrualTransaction = new TransactionEntry({
            transactionId: transactionId,
            date: new Date(accrualYear, accrualMonth - 1, 1), // First day of August
            description: `Lease Start Accrual - ${studentName} - ${accrualMonth}/${accrualYear} (${proratedDays} days)`,
            entries: [
                // Debit: Accounts Receivable - Student
                {
                    accountCode: studentARAccount.code,
                    accountName: studentARAccount.name,
                    accountType: 'Asset',
                    debit: totalAmount,
                    credit: 0,
                    description: `Accounts receivable for ${studentName} - ${accrualMonth}/${accrualYear}`
                },
                // Credit: Rental Income
                {
                    accountCode: rentalIncomeAccount.code,
                    accountName: rentalIncomeAccount.name,
                    accountType: 'Income',
                    debit: 0,
                    credit: totalAmount,
                    description: `Rental income from ${studentName} - ${accrualMonth}/${accrualYear}`
                }
            ],
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            source: 'rental_accrual',
            sourceId: studentId,
            sourceModel: 'Application',
            status: 'posted',
            metadata: {
                studentId: studentId,
                type: 'lease_start',
                accrualMonth: accrualMonth,
                accrualYear: accrualYear,
                applicationId: application._id,
                roomNumber: application.allocatedRoom,
                monthlyRent: monthlyRent,
                proratedRent: proratedRent,
                proratedDays: proratedDays,
                totalDays: daysInMonth,
                residence: application.residence
            },
            createdBy: studentId
        });

        await accrualTransaction.save();
        console.log(`\n✅ Created accrual transaction: ${transactionId}`);
        console.log(`   Total Amount: $${totalAmount.toFixed(2)}`);
        console.log(`   Debit: ${studentARAccount.code} - ${studentARAccount.name}`);
        console.log(`   Credit: ${rentalIncomeAccount.code} - ${rentalIncomeAccount.name}`);

        console.log('\n🎉 August 2025 accrual created successfully!');
        console.log('You can now try creating the negotiated payment again.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

createAugustAccruals();
