require('dotenv').config();
const mongoose = require('mongoose');

async function mapPaymentsToDebtors() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Mapping Payments to Debtors...');
        console.log('==================================');

        // Get all debtors
        const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        console.log(`📊 Found ${debtors.length} debtors`);

        // Get all payments
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        console.log(`💰 Found ${payments.length} payments`);

        let updatedCount = 0;
        let errors = [];

        for (const debtor of debtors) {
            try {
                console.log(`\n👤 Processing: ${debtor.contactInfo?.name || 'Unknown'} (${debtor.debtorCode})`);
                console.log(`   User ID: ${debtor.user}`);
                console.log(`   Current Total Paid: $${debtor.totalPaid || 0}`);
                console.log(`   Current Balance: $${debtor.currentBalance || 0}`);

                // Find payments for this debtor's user
                const debtorPayments = payments.filter(payment => 
                    payment.student && payment.student.toString() === debtor.user.toString()
                );

                console.log(`   📄 Found ${debtorPayments.length} payments for this debtor`);

                if (debtorPayments.length > 0) {
                    // Calculate total paid from actual payments
                    let totalPaid = 0;
                    const paymentDetails = [];

                    debtorPayments.forEach(payment => {
                        let paymentAmount = 0;
                        
                        // Sum up all payment amounts
                        if (payment.rentAmount && payment.rentAmount > 0) paymentAmount += payment.rentAmount;
                        if (payment.rent && payment.rent > 0) paymentAmount += payment.rent;
                        if (payment.adminFee && payment.adminFee > 0) paymentAmount += payment.adminFee;
                        if (payment.deposit && payment.deposit > 0) paymentAmount += payment.deposit;
                        if (payment.amount && payment.amount > 0) paymentAmount += payment.amount;

                        if (paymentAmount > 0) {
                            totalPaid += paymentAmount;
                            paymentDetails.push({
                                paymentId: payment._id,
                                amount: paymentAmount,
                                date: payment.paymentDate || payment.createdAt,
                                status: payment.status,
                                type: payment.paymentType || 'rent'
                            });
                        }
                    });

                    // Calculate new current balance
                    const newCurrentBalance = Math.max((debtor.totalOwed || 0) - totalPaid, 0);
                    const newOverdueAmount = newCurrentBalance > 0 ? newCurrentBalance : 0;

                    // Determine new status
                    let newStatus = 'active';
                    if (newCurrentBalance === 0) {
                        newStatus = 'paid';
                    } else if (newCurrentBalance > 0 && debtor.endDate && new Date(debtor.endDate) < new Date()) {
                        newStatus = 'overdue';
                    }

                    console.log(`   💰 Payment Summary:`);
                    console.log(`      Total Paid: $${totalPaid}`);
                    console.log(`      New Balance: $${newCurrentBalance}`);
                    console.log(`      New Status: ${newStatus}`);

                    // Update debtor with payment information
                    await mongoose.connection.db.collection('debtors').updateOne(
                        { _id: debtor._id },
                        { 
                            $set: { 
                                totalPaid: totalPaid,
                                currentBalance: newCurrentBalance,
                                overdueAmount: newOverdueAmount,
                                status: newStatus,
                                payments: paymentDetails.map(p => p.paymentId),
                                lastPaymentDate: paymentDetails.length > 0 ? 
                                    new Date(Math.max(...paymentDetails.map(p => new Date(p.date)))) : null,
                                lastPaymentAmount: paymentDetails.length > 0 ? 
                                    paymentDetails[paymentDetails.length - 1].amount : 0,
                                updatedAt: new Date()
                            }
                        }
                    );

                    updatedCount++;
                    console.log(`   ✅ Updated successfully with payment data`);

                } else {
                    console.log(`   ⚠️  No payments found for this debtor`);
                }

            } catch (error) {
                console.error(`   ❌ Error processing debtor ${debtor.debtorCode}:`, error.message);
                errors.push({ debtorCode: debtor.debtorCode, error: error.message });
            }
        }

        console.log('\n🎉 Summary:');
        console.log('===========');
        console.log(`✅ Successfully updated ${updatedCount} debtors with payment data`);
        if (errors.length > 0) {
            console.log(`❌ ${errors.length} errors occurred`);
            errors.forEach(error => {
                console.log(`   - ${error.debtorCode}: ${error.error}`);
            });
        }

        // Show final state
        console.log('\n🔍 Final Debtor Status with Payments:');
        console.log('======================================');
        const finalDebtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        finalDebtors.forEach((debtor, index) => {
            console.log(`\n${index + 1}. ${debtor.contactInfo?.name || 'Unknown'} (${debtor.debtorCode})`);
            console.log(`   Room: ${debtor.roomNumber || 'N/A'} - $${debtor.roomPrice || 'N/A'}/month`);
            console.log(`   Total Owed: $${debtor.totalOwed || 'N/A'}`);
            console.log(`   Total Paid: $${debtor.totalPaid || 'N/A'}`);
            console.log(`   Current Balance: $${debtor.currentBalance || 'N/A'}`);
            console.log(`   Status: ${debtor.status || 'N/A'}`);
            console.log(`   Payments: ${debtor.payments ? debtor.payments.length : 0} payment(s)`);
            if (debtor.lastPaymentDate) {
                console.log(`   Last Payment: $${debtor.lastPaymentAmount || 'N/A'} on ${debtor.lastPaymentDate}`);
            }
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Payment to Debtor Mapping...');
mapPaymentsToDebtors();
