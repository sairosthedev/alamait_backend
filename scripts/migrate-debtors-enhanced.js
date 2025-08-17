// Enhanced Debtor Migration Script
// This script migrates all existing payments and transactions to the enhanced debtor structure

const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

async function migrateDebtorsEnhanced() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const debtorsCollection = db.collection('debtors');
        const paymentsCollection = db.collection('payments');
        const transactionEntriesCollection = db.collection('transactionentries');
        const usersCollection = db.collection('users');

        console.log('\n🚀 Starting Enhanced Debtor Migration...');

        // ========================================
        // STEP 1: Get all debtors
        // ========================================
        console.log('\n📋 Step 1: Fetching all debtors...');
        const debtors = await debtorsCollection.find({}).toArray();
        console.log(`Found ${debtors.length} debtors to migrate`);

        // ========================================
        // STEP 2: Migrate each debtor
        // ========================================
        const results = {
            total: debtors.length,
            migrated: 0,
            errors: 0,
            errors: []
        };

        for (const debtor of debtors) {
            try {
                console.log(`\n🔄 Migrating debtor: ${debtor.debtorCode || debtor._id}`);

                // ========================================
                // STEP 2A: Get user details
                // ========================================
                const user = await usersCollection.findOne({ _id: new ObjectId(debtor.user) });
                if (!user) {
                    console.log(`⚠️  User not found for debtor ${debtor.debtorCode}, skipping...`);
                    continue;
                }

                // ========================================
                // STEP 2B: Get all payments for this user
                // ========================================
                const payments = await paymentsCollection.find({ 
                    student: new ObjectId(debtor.user) 
                }).sort({ date: 1 }).toArray();

                console.log(`Found ${payments.length} payments for debtor ${debtor.debtorCode}`);

                // ========================================
                // STEP 2C: Initialize enhanced fields
                // ========================================
                const enhancedDebtor = {
                    ...debtor,
                    paymentHistory: [],
                    monthlyPayments: [],
                    transactionEntries: [],
                    invoices: [],
                    financialSummary: {
                        currentPeriod: {
                            month: new Date().toISOString().slice(0, 7),
                            expectedAmount: debtor.billingPeriod?.amount?.monthly || 0,
                            paidAmount: 0,
                            outstandingAmount: debtor.billingPeriod?.amount?.monthly || 0,
                            status: 'unpaid'
                        },
                        yearToDate: {
                            year: new Date().getFullYear(),
                            totalExpected: 0,
                            totalPaid: 0,
                            totalOutstanding: 0,
                            paymentCount: 0
                        },
                        historical: {
                            totalPayments: 0,
                            totalInvoiced: 0,
                            averagePaymentAmount: 0,
                            lastPaymentDate: null,
                            lastInvoiceDate: null
                        }
                    }
                };

                // ========================================
                // STEP 2D: Process payments
                // ========================================
                const monthlyPaymentMap = new Map();

                for (const payment of payments) {
                    // Parse payment components
                    const components = {
                        rent: payment.rentAmount || 0,
                        adminFee: payment.adminFee || 0,
                        deposit: payment.deposit || 0,
                        utilities: 0,
                        other: 0
                    };

                    // Calculate other amount
                    const totalComponents = Object.values(components).reduce((sum, val) => sum + val, 0);
                    components.other = Math.max(0, payment.totalAmount - totalComponents);

                    // Add to payment history
                    enhancedDebtor.paymentHistory.push({
                        paymentId: payment.paymentId,
                        amount: payment.totalAmount,
                        allocatedMonth: payment.paymentMonth,
                        components,
                        paymentMethod: payment.method,
                        paymentDate: payment.date,
                        status: payment.status,
                        originalPayment: payment._id,
                        notes: payment.description,
                        createdBy: payment.createdBy,
                        createdAt: payment.createdAt || new Date()
                    });

                    // Update monthly payment summary
                    const month = payment.paymentMonth;
                    if (!monthlyPaymentMap.has(month)) {
                        monthlyPaymentMap.set(month, {
                            month,
                            expectedAmount: debtor.billingPeriod?.amount?.monthly || 0,
                            paidAmount: 0,
                            outstandingAmount: debtor.billingPeriod?.amount?.monthly || 0,
                            status: 'unpaid',
                            paymentCount: 0,
                            paymentIds: [],
                            lastPaymentDate: null,
                            updatedAt: new Date()
                        });
                    }

                    const monthlyPayment = monthlyPaymentMap.get(month);
                    monthlyPayment.paidAmount += payment.totalAmount;
                    monthlyPayment.outstandingAmount = Math.max(0, monthlyPayment.expectedAmount - monthlyPayment.paidAmount);
                    monthlyPayment.paymentCount += 1;
                    monthlyPayment.paymentIds.push(payment.paymentId);
                    monthlyPayment.lastPaymentDate = payment.date;

                    // Update status
                    if (monthlyPayment.paidAmount >= monthlyPayment.expectedAmount) {
                        monthlyPayment.status = 'paid';
                    } else if (monthlyPayment.paidAmount > 0) {
                        monthlyPayment.status = 'partial';
                    }
                }

                // Convert map to array
                enhancedDebtor.monthlyPayments = Array.from(monthlyPaymentMap.values());

                // ========================================
                // STEP 2E: Get transaction entries
                // ========================================
                const transactionEntries = await transactionEntriesCollection.find({
                    $or: [
                        { 'entries.accountCode': debtor.accountCode },
                        { 'metadata.debtorId': debtor._id },
                        { reference: { $regex: debtor.debtorCode, $options: 'i' } }
                    ]
                }).sort({ date: 1 }).toArray();

                console.log(`Found ${transactionEntries.length} transaction entries for debtor ${debtor.debtorCode}`);

                // Add transaction entries to debtor
                for (const txn of transactionEntries) {
                    enhancedDebtor.transactionEntries.push({
                        transactionId: txn.transactionId,
                        date: txn.date,
                        description: txn.description,
                        reference: txn.reference,
                        entries: txn.entries,
                        totalDebit: txn.totalDebit,
                        totalCredit: txn.totalCredit,
                        source: txn.source,
                        sourceId: txn.sourceId,
                        sourceModel: txn.sourceModel,
                        status: txn.status,
                        createdBy: txn.createdBy,
                        createdAt: txn.createdAt,
                        metadata: txn.metadata || {}
                    });
                }

                // ========================================
                // STEP 2F: Update financial summary
                // ========================================
                const totalPaid = enhancedDebtor.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
                const totalPayments = enhancedDebtor.paymentHistory.length;
                const averagePaymentAmount = totalPayments > 0 ? totalPaid / totalPayments : 0;

                // Update current period
                const currentMonth = new Date().toISOString().slice(0, 7);
                const currentPeriodPayment = enhancedDebtor.monthlyPayments.find(mp => mp.month === currentMonth);
                if (currentPeriodPayment) {
                    enhancedDebtor.financialSummary.currentPeriod = {
                        month: currentMonth,
                        expectedAmount: currentPeriodPayment.expectedAmount,
                        paidAmount: currentPeriodPayment.paidAmount,
                        outstandingAmount: currentPeriodPayment.outstandingAmount,
                        status: currentPeriodPayment.status
                    };
                }

                // Update year to date
                const currentYear = new Date().getFullYear();
                const yearPayments = enhancedDebtor.monthlyPayments.filter(mp => {
                    const [year] = mp.month.split('-');
                    return parseInt(year) === currentYear;
                });

                const yearTotalPaid = yearPayments.reduce((sum, mp) => sum + mp.paidAmount, 0);
                const yearTotalExpected = yearPayments.reduce((sum, mp) => sum + mp.expectedAmount, 0);
                const yearPaymentCount = yearPayments.reduce((sum, mp) => sum + mp.paymentCount, 0);

                enhancedDebtor.financialSummary.yearToDate = {
                    year: currentYear,
                    totalExpected: yearTotalExpected,
                    totalPaid: yearTotalPaid,
                    totalOutstanding: Math.max(0, yearTotalExpected - yearTotalPaid),
                    paymentCount: yearPaymentCount
                };

                // Update historical data
                enhancedDebtor.financialSummary.historical = {
                    totalPayments,
                    totalInvoiced: 0, // Will be updated when invoices are processed
                    averagePaymentAmount,
                    lastPaymentDate: totalPayments > 0 ? enhancedDebtor.paymentHistory[enhancedDebtor.paymentHistory.length - 1].paymentDate : null,
                    lastInvoiceDate: null
                };

                // Update debtor totals
                enhancedDebtor.totalPaid = totalPaid;
                enhancedDebtor.currentBalance = Math.max(0, enhancedDebtor.totalOwed - totalPaid);
                enhancedDebtor.lastPaymentDate = totalPayments > 0 ? enhancedDebtor.paymentHistory[enhancedDebtor.paymentHistory.length - 1].paymentDate : null;
                enhancedDebtor.lastPaymentAmount = totalPayments > 0 ? enhancedDebtor.paymentHistory[enhancedDebtor.paymentHistory.length - 1].amount : 0;

                // ========================================
                // STEP 2G: Update debtor in database
                // ========================================
                await debtorsCollection.updateOne(
                    { _id: debtor._id },
                    { $set: enhancedDebtor }
                );

                console.log(`✅ Successfully migrated debtor ${debtor.debtorCode}`);
                console.log(`   - Payments: ${enhancedDebtor.paymentHistory.length}`);
                console.log(`   - Monthly summaries: ${enhancedDebtor.monthlyPayments.length}`);
                console.log(`   - Transaction entries: ${enhancedDebtor.transactionEntries.length}`);
                console.log(`   - Total paid: $${totalPaid.toFixed(2)}`);

                results.migrated++;

            } catch (error) {
                console.error(`❌ Error migrating debtor ${debtor.debtorCode}:`, error.message);
                results.errors++;
                results.errors.push({
                    debtorCode: debtor.debtorCode,
                    error: error.message
                });
            }
        }

        // ========================================
        // STEP 3: Summary
        // ========================================
        console.log('\n📊 Migration Summary:');
        console.log(`Total debtors: ${results.total}`);
        console.log(`Successfully migrated: ${results.migrated}`);
        console.log(`Errors: ${results.errors}`);

        if (results.errors > 0) {
            console.log('\n❌ Errors encountered:');
            results.errors.forEach(error => {
                console.log(`   - ${error.debtorCode}: ${error.error}`);
            });
        }

        console.log('\n✅ Enhanced Debtor Migration Complete!');
        console.log('\n🎯 What was migrated:');
        console.log('   ✅ Payment history with month allocation');
        console.log('   ✅ Monthly payment summaries');
        console.log('   ✅ Transaction entries');
        console.log('   ✅ Financial summaries');
        console.log('   ✅ Current period tracking');
        console.log('   ✅ Year-to-date statistics');

        return results;

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateDebtorsEnhanced()
        .then(results => {
            console.log('\n🎉 Migration completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateDebtorsEnhanced };
