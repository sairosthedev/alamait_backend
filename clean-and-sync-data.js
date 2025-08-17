require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');

async function cleanAndSyncData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔗 Connected to MongoDB');

        const db = mongoose.connection.db;
        
        // Step 1: Get all payments
        const payments = await db.collection('payments').find({}).toArray();
        console.log(`📊 Found ${payments.length} payment records`);

        // Step 2: Get all debtors
        const debtors = await db.collection('debtors').find({}).toArray();
        console.log(`📊 Found ${debtors.length} debtor records`);

        let totalProcessed = 0;
        let totalAdminFees = 0;
        let totalRent = 0;
        let totalDeposits = 0;

        // Step 3: Process each payment and sync with debtors
        for (const payment of payments) {
            console.log(`\n🔄 Processing payment for ${payment.paymentId}:`);
            console.log(`   Month: ${payment.paymentMonth}`);
            console.log(`   Admin Fee: $${payment.adminFee}`);
            console.log(`   Rent: $${payment.rentAmount}`);
            console.log(`   Deposit: $${payment.deposit}`);
            console.log(`   Status: ${payment.status}`);

            // Find matching debtor
            const matchingDebtor = debtors.find(d => d.student === payment.student);
            
            if (matchingDebtor) {
                console.log(`   ✅ Found matching debtor: ${matchingDebtor.studentName}`);
            } else {
                console.log(`   ⚠️ No matching debtor found for student: ${payment.student}`);
            }

            // Step 4: Update payment status to "Paid" if it matches debtor data
            if (payment.status === 'Pending') {
                await db.collection('payments').updateOne(
                    { _id: payment._id },
                    { $set: { status: 'Paid' } }
                );
                console.log(`   ✅ Updated payment status to "Paid"`);
            }

            // Step 5: Create transaction entries for August payments
            if (payment.paymentMonth === '2025-08') {
                console.log(`   📝 Creating transaction entries for August 2025...`);

                // Create main payment transaction
                const paymentTransaction = new Transaction({
                    transactionId: payment.paymentId,
                    date: new Date(payment.date),
                    description: `Payment - ${payment.paymentMonth} - Student: ${payment.student}`,
                    type: 'payment',
                    residence: payment.residence,
                    amount: payment.totalAmount,
                    createdBy: '67c023adae5e27657502e887',
                    metadata: {
                        type: 'combined_payment',
                        studentId: payment.student,
                        paymentMonth: payment.paymentMonth,
                        paymentMethod: payment.method,
                        residence: payment.residence
                    }
                });

                await paymentTransaction.save();
                console.log(`   ✅ Created payment transaction: ${paymentTransaction._id}`);

                // Create admin fee transaction entry
                if (payment.adminFee > 0) {
                    const adminFeeEntry = new TransactionEntry({
                        transactionId: `${payment.paymentId}-admin-${Date.now()}`,
                        description: `Admin Fee Payment - ${payment.paymentMonth}`,
                        date: new Date(payment.date),
                        totalDebit: payment.adminFee,
                        totalCredit: payment.adminFee,
                        source: 'payment',
                        sourceModel: 'TransactionEntry',
                        sourceId: paymentTransaction._id,
                        createdBy: '67c023adae5e27657502e887',
                        residence: payment.residence,
                        entries: [
                            {
                                accountCode: '1001', // Bank Account
                                accountName: 'Bank Account',
                                accountType: 'Asset',
                                debit: payment.adminFee,
                                credit: 0,
                                description: `Admin fee payment received - ${payment.paymentMonth}`
                            },
                            {
                                accountCode: '4100', // Administrative Income
                                accountName: 'Administrative Income',
                                accountType: 'Income',
                                debit: 0,
                                credit: payment.adminFee,
                                description: `Admin fee payment received - ${payment.paymentMonth}`
                            }
                        ],
                        metadata: {
                            type: 'admin_fee_payment',
                            studentId: payment.student,
                            paymentMonth: payment.paymentMonth,
                            paymentMethod: payment.method,
                            residence: payment.residence
                        }
                    });

                    await adminFeeEntry.save();
                    totalAdminFees += payment.adminFee;
                    console.log(`   ✅ Created admin fee entry: ${adminFeeEntry._id}`);
                }

                // Create rent payment transaction entry
                if (payment.rentAmount > 0) {
                    const rentPaymentEntry = new TransactionEntry({
                        transactionId: `${payment.paymentId}-rent-${Date.now()}`,
                        description: `Rent Payment - ${payment.paymentMonth}`,
                        date: new Date(payment.date),
                        totalDebit: payment.rentAmount,
                        totalCredit: payment.rentAmount,
                        source: 'payment',
                        sourceModel: 'TransactionEntry',
                        sourceId: paymentTransaction._id,
                        createdBy: '67c023adae5e27657502e887',
                        residence: payment.residence,
                        entries: [
                            {
                                accountCode: '1001', // Bank Account
                                accountName: 'Bank Account',
                                accountType: 'Asset',
                                debit: payment.rentAmount,
                                credit: 0,
                                description: `Rent payment received - ${payment.paymentMonth}`
                            },
                            {
                                accountCode: '1100', // Accounts Receivable
                                accountName: 'Accounts Receivable - Tenants',
                                accountType: 'Asset',
                                debit: 0,
                                credit: payment.rentAmount,
                                description: `Rent payment received - ${payment.paymentMonth}`
                            }
                        ],
                        metadata: {
                            type: 'rent_payment',
                            studentId: payment.student,
                            paymentMonth: payment.paymentMonth,
                            paymentMethod: payment.method,
                            residence: payment.residence
                        }
                    });

                    await rentPaymentEntry.save();
                    totalRent += payment.rentAmount;
                    console.log(`   ✅ Created rent payment entry: ${rentPaymentEntry._id}`);
                }

                // Create deposit transaction entry
                if (payment.deposit > 0) {
                    const depositEntry = new TransactionEntry({
                        transactionId: `${payment.paymentId}-deposit-${Date.now()}`,
                        description: `Security Deposit - ${payment.paymentMonth}`,
                        date: new Date(payment.date),
                        totalDebit: payment.deposit,
                        totalCredit: payment.deposit,
                        source: 'payment',
                        sourceModel: 'TransactionEntry',
                        sourceId: paymentTransaction._id,
                        createdBy: '67c023adae5e27657502e887',
                        residence: payment.residence,
                        entries: [
                            {
                                accountCode: '1001', // Bank Account
                                accountName: 'Bank Account',
                                accountType: 'Asset',
                                debit: payment.deposit,
                                credit: 0,
                                description: `Security deposit received - ${payment.paymentMonth}`
                            },
                            {
                                accountCode: '2020', // Tenant Deposits Held
                                accountName: 'Tenant Deposits Held',
                                accountType: 'Liability',
                                debit: 0,
                                credit: payment.deposit,
                                description: `Security deposit received - ${payment.paymentMonth}`
                            }
                        ],
                        metadata: {
                            type: 'deposit_payment',
                            studentId: payment.student,
                            paymentMonth: payment.paymentMonth,
                            paymentMethod: payment.method,
                            residence: payment.residence
                        }
                    });

                    await depositEntry.save();
                    totalDeposits += payment.deposit;
                    console.log(`   ✅ Created deposit entry: ${depositEntry._id}`);
                }

                totalProcessed++;
            }
        }

        console.log(`\n🎉 Data Cleanup and Sync Complete!`);
        console.log(`📊 Total Payments Processed: ${totalProcessed}`);
        console.log(`📊 Total Admin Fees: $${totalAdminFees}`);
        console.log(`📊 Total Rent: $${totalRent}`);
        console.log(`📊 Total Deposits: $${totalDeposits}`);
        console.log(`📊 Total Amount: $${totalAdminFees + totalRent + totalDeposits}`);

        // Step 6: Verify the sync
        console.log(`\n🔍 Verifying sync...`);
        
        const updatedPayments = await db.collection('payments').find({ status: 'Paid' }).toArray();
        console.log(`📊 Payments with "Paid" status: ${updatedPayments.length}`);
        
        const adminFeeTransactions = await TransactionEntry.find({ 'metadata.type': 'admin_fee_payment' });
        console.log(`📊 Admin fee transaction entries: ${adminFeeTransactions.length}`);
        
        const rentTransactions = await TransactionEntry.find({ 'metadata.type': 'rent_payment' });
        console.log(`📊 Rent payment transaction entries: ${rentTransactions.length}`);

        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error cleaning and syncing data:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

// Run the cleanup and sync
cleanAndSyncData();
