require('dotenv').config();
const mongoose = require('mongoose');

async function mapPaymentsToDebtorsDetailed() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Mapping Detailed Payments to Debtors...');
        console.log('==========================================');

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
                console.log(`   Room: ${debtor.roomNumber || 'N/A'} - ${debtor.roomPrice || 'N/A'}/month`);
                console.log(`   Current Total Paid: $${debtor.totalPaid || 0}`);
                console.log(`   Current Balance: $${debtor.currentBalance || 0}`);

                // Find payments for this debtor using multiple methods
                let debtorPayments = [];

                // Method 1: Try to find payments by email (most reliable)
                const paymentsByEmail = payments.filter(payment => 
                    payment.email && 
                    debtor.contactInfo?.email && 
                    payment.email.toLowerCase() === debtor.contactInfo.email.toLowerCase()
                );

                // Method 2: Try to find payments by student ID
                const paymentsByStudent = payments.filter(payment => 
                    payment.student && 
                    payment.student.toString() === debtor.user.toString()
                );

                // Method 3: Try to find payments by user ID
                const paymentsByUser = payments.filter(payment => 
                    payment.user && 
                    payment.user.toString() === debtor.user.toString()
                );

                // Method 4: Try to find payments by room number and residence
                const paymentsByRoom = payments.filter(payment => 
                    payment.room && 
                    payment.room === debtor.roomNumber &&
                    payment.residence && 
                    payment.residence.toString() === (debtor.residence || '').toString()
                );

                // Combine all found payments and remove duplicates
                const allFoundPayments = [...paymentsByEmail, ...paymentsByStudent, ...paymentsByUser, ...paymentsByRoom];
                const uniquePayments = allFoundPayments.filter((payment, index, self) => 
                    index === self.findIndex(p => p._id.toString() === payment._id.toString())
                );

                console.log(`   📄 Payment Search Results:`);
                console.log(`      By Email: ${paymentsByEmail.length}`);
                console.log(`      By Student ID: ${paymentsByStudent.length}`);
                console.log(`      By User ID: ${paymentsByUser.length}`);
                console.log(`      By Room: ${paymentsByRoom.length}`);
                console.log(`      Total Unique: ${uniquePayments.length}`);

                if (uniquePayments.length > 0) {
                    // Calculate detailed payment breakdown
                    let totalRentPaid = 0;
                    let totalAdminFeePaid = 0;
                    let totalDepositPaid = 0;
                    let totalAmountPaid = 0;
                    const paymentDetails = [];

                    uniquePayments.forEach(payment => {
                        // Get room type from payment or debtor
                        const roomType = payment.roomType || 
                                       (debtor.residence && debtor.roomNumber ? 'assigned' : 'unassigned');

                        // Calculate payment amounts
                        const rentAmount = payment.rentAmount || payment.rent || 0;
                        const adminFee = payment.adminFee || 0;
                        const deposit = payment.deposit || 0;
                        const totalAmount = payment.totalAmount || payment.amount || 0;

                        // Sum up totals
                        totalRentPaid += rentAmount;
                        totalAdminFeePaid += adminFee;
                        totalDepositPaid += deposit;
                        totalAmountPaid += totalAmount;

                        // Create detailed payment record
                        paymentDetails.push({
                            paymentId: payment._id,
                            paymentIdString: payment.paymentId || payment._id.toString(),
                            roomType: roomType,
                            rentAmount: rentAmount,
                            adminFee: adminFee,
                            deposit: deposit,
                            totalAmount: totalAmount,
                            date: payment.date || payment.paymentDate || payment.createdAt,
                            status: payment.status || 'unknown',
                            method: payment.method || 'unknown',
                            description: payment.description || `Payment for ${roomType}`,
                            month: payment.paymentMonth || 'unknown'
                        });
                    });

                    // Calculate new current balance
                    const newCurrentBalance = Math.max((debtor.totalOwed || 0) - totalAmountPaid, 0);
                    const newOverdueAmount = newCurrentBalance > 0 ? newCurrentBalance : 0;

                    // Determine new status
                    let newStatus = 'active';
                    if (newCurrentBalance === 0) {
                        newStatus = 'paid';
                    } else if (newCurrentBalance > 0 && debtor.endDate && new Date(debtor.endDate) < new Date()) {
                        newStatus = 'overdue';
                    }

                    console.log(`   💰 Payment Breakdown:`);
                    console.log(`      Rent Paid: $${totalRentPaid}`);
                    console.log(`      Admin Fees Paid: $${totalAdminFeePaid}`);
                    console.log(`      Deposits Paid: $${totalDepositPaid}`);
                    console.log(`      Total Paid: $${totalAmountPaid}`);
                    console.log(`      New Balance: $${newCurrentBalance}`);
                    console.log(`      New Status: ${newStatus}`);

                    // Update debtor with detailed payment information
                    await mongoose.connection.db.collection('debtors').updateOne(
                        { _id: debtor._id },
                        { 
                            $set: { 
                                totalPaid: totalAmountPaid,
                                currentBalance: newCurrentBalance,
                                overdueAmount: newOverdueAmount,
                                status: newStatus,
                                payments: paymentDetails.map(p => p.paymentId),
                                lastPaymentDate: paymentDetails.length > 0 ? 
                                    new Date(Math.max(...paymentDetails.map(p => new Date(p.date)))) : null,
                                lastPaymentAmount: paymentDetails.length > 0 ? 
                                    paymentDetails[paymentDetails.length - 1].totalAmount : 0,
                                paymentHistory: paymentDetails,
                                updatedAt: new Date()
                            }
                        }
                    );

                    updatedCount++;
                    console.log(`   ✅ Updated successfully with detailed payment data`);

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
        console.log(`✅ Successfully updated ${updatedCount} debtors with detailed payment data`);
        if (errors.length > 0) {
            console.log(`❌ ${errors.length} errors occurred`);
            errors.forEach(error => {
                console.log(`   - ${error.debtorCode}: ${error.error}`);
            });
        }

        // Show final state with detailed payment information
        console.log('\n🔍 Final Debtor Status with Detailed Payments:');
        console.log('================================================');
        const finalDebtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        finalDebtors.forEach((debtor, index) => {
            console.log(`\n${index + 1}. ${debtor.contactInfo?.name || 'Unknown'} (${debtor.debtorCode})`);
            console.log(`   Room: ${debtor.roomNumber || 'N/A'} - $${debtor.roomPrice || 'N/A'}/month`);
            console.log(`   Total Owed: $${debtor.totalOwed || 'N/A'}`);
            console.log(`   Total Paid: $${debtor.totalPaid || 'N/A'}`);
            console.log(`   Current Balance: $${debtor.currentBalance || 'N/A'}`);
            console.log(`   Status: ${debtor.status || 'N/A'}`);
            console.log(`   Payments: ${debtor.payments ? debtor.payments.length : 0} payment(s)`);
            
            if (debtor.paymentHistory && debtor.paymentHistory.length > 0) {
                console.log(`   📄 Payment Details:`);
                debtor.paymentHistory.forEach((payment, pIndex) => {
                    console.log(`      ${pIndex + 1}. ${payment.roomType || 'Unknown Type'}`);
                    console.log(`         Rent: $${payment.rentAmount || 0}`);
                    console.log(`         Admin Fee: $${payment.adminFee || 0}`);
                    console.log(`         Deposit: $${payment.deposit || 0}`);
                    console.log(`         Total: $${payment.totalAmount || 0}`);
                    console.log(`         Date: ${payment.date || 'N/A'}`);
                    console.log(`         Status: ${payment.status || 'N/A'}`);
                });
            }
            
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

console.log('🔍 Starting Detailed Payment to Debtor Mapping...');
mapPaymentsToDebtorsDetailed();
