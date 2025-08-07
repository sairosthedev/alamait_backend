// Test Enhanced Debtor System
// This script demonstrates the enhanced debtor functionality

const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

async function testEnhancedDebtor() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const debtorsCollection = db.collection('debtors');
        const usersCollection = db.collection('users');

        console.log('\n🧪 Testing Enhanced Debtor System...');

        // ========================================
        // STEP 1: Create a test user
        // ========================================
        console.log('\n📝 Step 1: Creating test user...');
        
        const testUser = {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@test.com',
            phone: '+1234567890',
            role: 'student',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const userResult = await usersCollection.insertOne(testUser);
        console.log(`✅ Created test user: ${userResult.insertedId}`);

        // ========================================
        // STEP 2: Create a test debtor
        // ========================================
        console.log('\n💰 Step 2: Creating test debtor...');
        
        const testDebtor = {
            debtorCode: 'DR0001',
            user: userResult.insertedId,
            accountCode: 'AR0001',
            status: 'active',
            currentBalance: 0,
            totalOwed: 6000,
            totalPaid: 0,
            creditLimit: 10000,
            paymentTerms: 'monthly',
            overdueAmount: 0,
            daysOverdue: 0,
            residence: null,
            roomNumber: 'Room 101',
            billingPeriod: {
                type: 'monthly',
                duration: {
                    value: 12,
                    unit: 'months'
                },
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-12-31'),
                billingCycle: {
                    frequency: 'monthly',
                    dayOfMonth: 1,
                    gracePeriod: 5
                },
                amount: {
                    monthly: 500,
                    total: 6000,
                    currency: 'USD'
                },
                status: 'active',
                description: 'Monthly rent payment',
                notes: 'Standard monthly billing'
            },
            roomPrice: 500,
            paymentHistory: [],
            monthlyPayments: [],
            transactionEntries: [],
            invoices: [],
            financialSummary: {
                currentPeriod: {
                    month: '2024-12',
                    expectedAmount: 500,
                    paidAmount: 0,
                    outstandingAmount: 500,
                    status: 'unpaid'
                },
                yearToDate: {
                    year: 2024,
                    totalExpected: 6000,
                    totalPaid: 0,
                    totalOutstanding: 6000,
                    paymentCount: 0
                },
                historical: {
                    totalPayments: 0,
                    totalInvoiced: 0,
                    averagePaymentAmount: 0,
                    lastPaymentDate: null,
                    lastInvoiceDate: null
                }
            },
            payments: [],
            contactInfo: {
                name: 'John Doe',
                email: 'john.doe@test.com',
                phone: '+1234567890'
            },
            notes: 'Test debtor for enhanced system',
            createdBy: userResult.insertedId,
            updatedBy: userResult.insertedId,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const debtorResult = await debtorsCollection.insertOne(testDebtor);
        console.log(`✅ Created test debtor: ${debtorResult.insertedId}`);

        // ========================================
        // STEP 3: Add sample payments
        // ========================================
        console.log('\n💳 Step 3: Adding sample payments...');

        const samplePayments = [
            {
                paymentId: 'PAY-2024-001',
                amount: 750,
                allocatedMonth: '2024-01',
                components: {
                    rent: 500,
                    adminFee: 50,
                    deposit: 200,
                    utilities: 0,
                    other: 0
                },
                paymentMethod: 'Ecocash',
                paymentDate: new Date('2024-01-15'),
                status: 'Confirmed',
                originalPayment: new ObjectId(),
                notes: 'January rent payment',
                createdBy: userResult.insertedId,
                createdAt: new Date('2024-01-15')
            },
            {
                paymentId: 'PAY-2024-002',
                amount: 550,
                allocatedMonth: '2024-02',
                components: {
                    rent: 500,
                    adminFee: 50,
                    deposit: 0,
                    utilities: 0,
                    other: 0
                },
                paymentMethod: 'Bank Transfer',
                paymentDate: new Date('2024-02-10'),
                status: 'Confirmed',
                originalPayment: new ObjectId(),
                notes: 'February rent payment',
                createdBy: userResult.insertedId,
                createdAt: new Date('2024-02-10')
            },
            {
                paymentId: 'PAY-2024-003',
                amount: 500,
                allocatedMonth: '2024-03',
                components: {
                    rent: 500,
                    adminFee: 0,
                    deposit: 0,
                    utilities: 0,
                    other: 0
                },
                paymentMethod: 'Cash',
                paymentDate: new Date('2024-03-05'),
                status: 'Confirmed',
                originalPayment: new ObjectId(),
                notes: 'March rent payment',
                createdBy: userResult.insertedId,
                createdAt: new Date('2024-03-05')
            }
        ];

        // Add payments to debtor
        for (const payment of samplePayments) {
            // Add to payment history
            await debtorsCollection.updateOne(
                { _id: debtorResult.insertedId },
                { $push: { paymentHistory: payment } }
            );

            // Update or create monthly payment summary
            const month = payment.allocatedMonth;
            const existingMonth = await debtorsCollection.findOne({
                _id: debtorResult.insertedId,
                'monthlyPayments.month': month
            });

            if (!existingMonth) {
                // Create new monthly payment
                await debtorsCollection.updateOne(
                    { _id: debtorResult.insertedId },
                    {
                        $push: {
                            monthlyPayments: {
                                month,
                                expectedAmount: 500,
                                paidAmount: payment.amount,
                                outstandingAmount: Math.max(0, 500 - payment.amount),
                                status: payment.amount >= 500 ? 'paid' : 'partial',
                                paymentCount: 1,
                                paymentIds: [payment.paymentId],
                                lastPaymentDate: payment.paymentDate,
                                updatedAt: new Date()
                            }
                        }
                    }
                );
            } else {
                // Update existing monthly payment
                await debtorsCollection.updateOne(
                    {
                        _id: debtorResult.insertedId,
                        'monthlyPayments.month': month
                    },
                    {
                        $inc: {
                            'monthlyPayments.$.paidAmount': payment.amount,
                            'monthlyPayments.$.paymentCount': 1
                        },
                        $push: {
                            'monthlyPayments.$.paymentIds': payment.paymentId
                        },
                        $set: {
                            'monthlyPayments.$.lastPaymentDate': payment.paymentDate,
                            'monthlyPayments.$.updatedAt': new Date()
                        }
                    }
                );
            }

            console.log(`✅ Added payment ${payment.paymentId} for ${month}`);
        }

        // ========================================
        // STEP 4: Add sample transaction entries
        // ========================================
        console.log('\n📊 Step 4: Adding sample transaction entries...');

        const sampleTransactions = [
            {
                transactionId: 'TXN1703123456789ABC',
                date: new Date('2024-01-15'),
                description: 'Payment from John Doe - PAY-2024-001',
                reference: 'PAY-2024-001',
                entries: [
                    {
                        accountCode: '1003',
                        accountName: 'Ecocash Wallet',
                        accountType: 'Asset',
                        debit: 750,
                        credit: 0,
                        description: 'Payment received via Ecocash'
                    },
                    {
                        accountCode: 'AR0001',
                        accountName: 'Accounts Receivable - John Doe',
                        accountType: 'Asset',
                        debit: 0,
                        credit: 750,
                        description: 'Payment for 2024-01'
                    }
                ],
                totalDebit: 750,
                totalCredit: 750,
                source: 'payment',
                sourceId: new ObjectId(),
                sourceModel: 'Payment',
                status: 'posted',
                createdBy: 'admin@alamait.com',
                createdAt: new Date('2024-01-15'),
                metadata: {
                    allocatedMonth: '2024-01',
                    paymentMethod: 'Ecocash',
                    components: { rent: 500, adminFee: 50, deposit: 200 }
                }
            }
        ];

        for (const txn of sampleTransactions) {
            await debtorsCollection.updateOne(
                { _id: debtorResult.insertedId },
                { $push: { transactionEntries: txn } }
            );
            console.log(`✅ Added transaction ${txn.transactionId}`);
        }

        // ========================================
        // STEP 5: Update financial summary
        // ========================================
        console.log('\n📈 Step 5: Updating financial summary...');

        const totalPaid = samplePayments.reduce((sum, p) => sum + p.amount, 0);
        const totalPayments = samplePayments.length;
        const averagePaymentAmount = totalPayments > 0 ? totalPaid / totalPayments : 0;

        await debtorsCollection.updateOne(
            { _id: debtorResult.insertedId },
            {
                $set: {
                    totalPaid: totalPaid,
                    currentBalance: Math.max(0, 6000 - totalPaid),
                    lastPaymentDate: samplePayments[samplePayments.length - 1].paymentDate,
                    lastPaymentAmount: samplePayments[samplePayments.length - 1].amount,
                    'financialSummary.historical.totalPayments': totalPayments,
                    'financialSummary.historical.averagePaymentAmount': averagePaymentAmount,
                    'financialSummary.historical.lastPaymentDate': samplePayments[samplePayments.length - 1].paymentDate,
                    'financialSummary.yearToDate.totalPaid': totalPaid,
                    'financialSummary.yearToDate.paymentCount': totalPayments,
                    'financialSummary.yearToDate.totalOutstanding': Math.max(0, 6000 - totalPaid)
                }
            }
        );

        console.log(`✅ Updated financial summary - Total paid: $${totalPaid}`);

        // ========================================
        // STEP 6: Retrieve and display enhanced debtor
        // ========================================
        console.log('\n📋 Step 6: Retrieving enhanced debtor data...');

        const enhancedDebtor = await debtorsCollection.findOne({ _id: debtorResult.insertedId });
        
        console.log('\n🎯 Enhanced Debtor Summary:');
        console.log(`Debtor Code: ${enhancedDebtor.debtorCode}`);
        console.log(`Account Code: ${enhancedDebtor.accountCode}`);
        console.log(`Status: ${enhancedDebtor.status}`);
        console.log(`Total Owed: $${enhancedDebtor.totalOwed}`);
        console.log(`Total Paid: $${enhancedDebtor.totalPaid}`);
        console.log(`Current Balance: $${enhancedDebtor.currentBalance}`);

        console.log('\n💳 Payment History:');
        enhancedDebtor.paymentHistory.forEach(payment => {
            console.log(`  ${payment.allocatedMonth}: $${payment.amount} via ${payment.paymentMethod} (${payment.status})`);
        });

        console.log('\n📅 Monthly Payment Summaries:');
        enhancedDebtor.monthlyPayments.forEach(month => {
            console.log(`  ${month.month}: ${month.status} - $${month.paidAmount}/${month.expectedAmount} (${month.paymentCount} payments)`);
        });

        console.log('\n📊 Transaction Entries:');
        enhancedDebtor.transactionEntries.forEach(txn => {
            console.log(`  ${txn.transactionId}: $${txn.totalDebit} - ${txn.description}`);
        });

        console.log('\n💰 Financial Summary:');
        console.log(`  Current Period: ${enhancedDebtor.financialSummary.currentPeriod.status}`);
        console.log(`  Year to Date: $${enhancedDebtor.financialSummary.yearToDate.totalPaid} paid`);
        console.log(`  Historical: ${enhancedDebtor.financialSummary.historical.totalPayments} payments, avg $${enhancedDebtor.financialSummary.historical.averagePaymentAmount}`);

        // ========================================
        // STEP 7: Test queries
        // ========================================
        console.log('\n🔍 Step 7: Testing enhanced queries...');

        // Query by payment method
        const ecocashPayments = await debtorsCollection.find({
            _id: debtorResult.insertedId,
            'paymentHistory.paymentMethod': 'Ecocash'
        }).toArray();
        console.log(`✅ Found ${ecocashPayments.length} debtors with Ecocash payments`);

        // Query by month
        const januaryPayments = await debtorsCollection.find({
            _id: debtorResult.insertedId,
            'paymentHistory.allocatedMonth': '2024-01'
        }).toArray();
        console.log(`✅ Found ${januaryPayments.length} debtors with January payments`);

        // Query by payment status
        const paidMonths = await debtorsCollection.find({
            _id: debtorResult.insertedId,
            'monthlyPayments.status': 'paid'
        }).toArray();
        console.log(`✅ Found ${paidMonths.length} debtors with paid months`);

        console.log('\n✅ Enhanced Debtor System Test Complete!');
        console.log('\n🎯 Key Features Demonstrated:');
        console.log('   ✅ Payment history with month allocation');
        console.log('   ✅ Monthly payment summaries');
        console.log('   ✅ Transaction entries storage');
        console.log('   ✅ Financial summaries');
        console.log('   ✅ Enhanced queries by payment method, month, status');
        console.log('   ✅ All data stored in single debtor collection');

        return enhancedDebtor;

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run test if called directly
if (require.main === module) {
    testEnhancedDebtor()
        .then(result => {
            console.log('\n🎉 Test completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testEnhancedDebtor };
