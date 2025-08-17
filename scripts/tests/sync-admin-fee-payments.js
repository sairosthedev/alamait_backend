require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');

async function syncAdminFeePayments() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔗 Connected to MongoDB');

        // Get debtors collection
        const db = mongoose.connection.db;
        const debtors = await db.collection('debtors').find({}).toArray();
        
        console.log(`📊 Found ${debtors.length} debtor records`);

        let totalAdminFeesProcessed = 0;
        let totalRentProcessed = 0;
        let totalDepositsProcessed = 0;

        for (const debtor of debtors) {
            if (debtor.totalAdminPaid > 0 || debtor.totalRentPaid > 0 || debtor.totalDepositPaid > 0) {
                console.log(`\n🔄 Processing payments for ${debtor.studentName}:`);
                console.log(`   Admin Fee: $${debtor.totalAdminPaid}`);
                console.log(`   Rent: $${debtor.totalRentPaid}`);
                console.log(`   Deposit: $${debtor.totalDepositPaid}`);

                // Get residence ID from residence name
                let residenceId = null;
                if (debtor.residenceName === 'St Kilda Student House') {
                    residenceId = '67d723cf20f89c4ae69804f3';
                } else if (debtor.residenceName === 'Belvedere Student House') {
                    residenceId = '6847f562e536db246e853f91';
                } else if (debtor.residenceName === '1ACP') {
                    residenceId = '6848258b1149b66fc94a261d';
                } else if (debtor.residenceName === 'Fife Avenue') {
                    residenceId = '6859be80cabd83fabe7761de';
                }

                // Create payment transaction
                const paymentTransaction = new Transaction({
                    transactionId: `PAY-${debtor.paymentHistory[0]?.paymentId || Date.now()}`,
                    date: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt),
                    description: `Combined Payment - ${debtor.studentName} - ${debtor.residenceName}`,
                    type: 'payment',
                    residence: residenceId,
                    amount: debtor.totalPaid,
                    createdBy: '67c023adae5e27657502e887',
                    metadata: {
                        type: 'combined_payment',
                        studentId: debtor.student,
                        studentName: debtor.studentName,
                        paymentMethod: 'Cash', // Default, adjust as needed
                        month: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt).getMonth() + 1,
                        year: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt).getFullYear(),
                        residence: debtor.residenceName
                    }
                });

                await paymentTransaction.save();
                console.log(`   ✅ Created payment transaction: ${paymentTransaction._id}`);

                // Create double-entry transaction for admin fees
                if (debtor.totalAdminPaid > 0) {
                    const adminFeeEntry = new TransactionEntry({
                        transactionId: paymentTransaction._id.toString(),
                        description: `Admin Fee Payment - ${debtor.studentName}`,
                        date: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt),
                        totalDebit: debtor.totalAdminPaid,
                        totalCredit: debtor.totalAdminPaid,
                        source: 'payment',
                        sourceModel: 'TransactionEntry',
                        sourceId: paymentTransaction._id,
                        createdBy: '67c023adae5e27657502e887',
                        residence: residenceId,
                        entries: [
                            {
                                accountCode: '1001', // Bank Account
                                accountName: 'Bank Account',
                                accountType: 'Asset',
                                debit: debtor.totalAdminPaid,
                                credit: 0,
                                description: `Admin fee payment received - ${debtor.studentName}`
                            },
                            {
                                accountCode: '4100', // Administrative Income
                                accountName: 'Administrative Income',
                                accountType: 'Income',
                                debit: 0,
                                credit: debtor.totalAdminPaid,
                                description: `Admin fee payment received - ${debtor.studentName}`
                            }
                        ],
                        metadata: {
                            type: 'admin_fee_payment',
                            studentId: debtor.student,
                            studentName: debtor.studentName,
                            paymentMethod: 'Cash',
                            month: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt).getMonth() + 1,
                            year: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt).getFullYear(),
                            residence: residenceId
                        }
                    });

                    await adminFeeEntry.save();
                    totalAdminFeesProcessed += debtor.totalAdminPaid;
                    console.log(`   ✅ Created admin fee entry: ${adminFeeEntry._id}`);
                }

                // Create double-entry transaction for rent payments
                if (debtor.totalRentPaid > 0) {
                    const rentPaymentEntry = new TransactionEntry({
                        transactionId: paymentTransaction._id.toString(),
                        description: `Rent Payment - ${debtor.studentName}`,
                        date: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt),
                        totalDebit: debtor.totalRentPaid,
                        totalCredit: debtor.totalRentPaid,
                        source: 'payment',
                        sourceModel: 'TransactionEntry',
                        sourceId: paymentTransaction._id,
                        createdBy: '67c023adae5e27657502e887',
                        residence: residenceId,
                        entries: [
                            {
                                accountCode: '1001', // Bank Account
                                accountName: 'Bank Account',
                                accountType: 'Asset',
                                debit: debtor.totalRentPaid,
                                credit: 0,
                                description: `Rent payment received - ${debtor.studentName}`
                            },
                            {
                                accountCode: '1100', // Accounts Receivable
                                accountName: 'Accounts Receivable - Tenants',
                                accountType: 'Asset',
                                debit: 0,
                                credit: debtor.totalRentPaid,
                                description: `Rent payment received - ${debtor.studentName}`
                            }
                        ],
                        metadata: {
                            type: 'rent_payment',
                            studentId: debtor.student,
                            studentName: debtor.studentName,
                            paymentMethod: 'Cash',
                            month: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt).getMonth() + 1,
                            year: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt).getFullYear(),
                            residence: residenceId
                        }
                    });

                    await rentPaymentEntry.save();
                    totalRentProcessed += debtor.totalRentPaid;
                    console.log(`   ✅ Created rent payment entry: ${rentPaymentEntry._id}`);
                }

                // Create double-entry transaction for deposits
                if (debtor.totalDepositPaid > 0) {
                    const depositEntry = new TransactionEntry({
                        transactionId: paymentTransaction._id.toString(),
                        description: `Security Deposit - ${debtor.studentName}`,
                        date: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt),
                        totalDebit: debtor.totalDepositPaid,
                        totalCredit: debtor.totalDepositPaid,
                        source: 'payment',
                        sourceModel: 'TransactionEntry',
                        sourceId: paymentTransaction._id,
                        createdBy: '67c023adae5e27657502e887',
                        residence: residenceId,
                        entries: [
                            {
                                accountCode: '1001', // Bank Account
                                accountName: 'Bank Account',
                                accountType: 'Asset',
                                debit: debtor.totalDepositPaid,
                                credit: 0,
                                description: `Security deposit received - ${debtor.studentName}`
                            },
                            {
                                accountCode: '2020', // Tenant Deposits Held
                                accountName: 'Tenant Deposits Held',
                                accountType: 'Liability',
                                debit: 0,
                                credit: debtor.totalDepositPaid,
                                description: `Security deposit received - ${debtor.studentName}`
                            }
                        ],
                        metadata: {
                            type: 'deposit_payment',
                            studentId: debtor.student,
                            studentName: debtor.studentName,
                            paymentMethod: 'Cash',
                            month: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt).getMonth() + 1,
                            year: new Date(debtor.paymentHistory[0]?.date || debtor.createdAt).getFullYear(),
                            residence: residenceId
                        }
                    });

                    await depositEntry.save();
                    totalDepositsProcessed += debtor.totalDepositPaid;
                    console.log(`   ✅ Created deposit entry: ${depositEntry._id}`);
                }
            }
        }

        console.log(`\n🎉 Sync Complete!`);
        console.log(`📊 Total Admin Fees Processed: $${totalAdminFeesProcessed}`);
        console.log(`📊 Total Rent Processed: $${totalRentProcessed}`);
        console.log(`📊 Total Deposits Processed: $${totalDepositsProcessed}`);
        console.log(`📊 Total Amount Processed: $${totalAdminFeesProcessed + totalRentProcessed + totalDepositsProcessed}`);

        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error syncing payments:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

// Run the sync
syncAdminFeePayments();
