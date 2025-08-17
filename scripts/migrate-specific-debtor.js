const mongoose = require('mongoose');
const { EnhancedDebtorService } = require('../src/services/enhancedDebtorService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const specificDebtorData = {
    "_id": "689399b8beb18032feaddfc6",
    "debtorCode": "DR0007",
    "user": "689399b6beb18032feaddfbf",
    "accountCode": "110007",
    "status": "active",
    "currentBalance": 680,
    "totalOwed": 1460,
    "totalPaid": 780,
    "creditLimit": 360,
    "paymentTerms": "monthly",
    "overdueAmount": 680,
    "daysOverdue": 0,
    "lastPaymentAmount": 380,
    "residence": "67d723cf20f89c4ae69804f3",
    "roomNumber": "M5",
    "roomPrice": 180,
    "payments": [],
    "contactInfo": {
        "name": "Kudzai Cindyrella Pemhiwa",
        "email": "kudzaicindyrellapemhiwa@gmail.com",
        "phone": "0786209200"
    },
    "createdBy": "67c023adae5e27657502e887",
    "createdAt": "2025-08-06T18:06:48.925Z",
    "updatedAt": "2025-08-06T21:15:29.472Z",
    "billingPeriod": {
        "type": "custom",
        "duration": {
            "value": 8,
            "unit": "months"
        },
        "startDate": "2025-05-30T00:00:00.000Z",
        "endDate": "2025-12-31T00:00:00.000Z",
        "billingCycle": {
            "frequency": "monthly",
            "dayOfMonth": 1,
            "gracePeriod": 5
        },
        "amount": {
            "monthly": 180,
            "total": 1440,
            "currency": "USD"
        },
        "status": "active",
        "description": "Billing period for DR0007",
        "notes": "Migrated from legacy format: \"8 months\"",
        "autoRenewal": {
            "enabled": false,
            "renewalType": "same_period",
            "customRenewalPeriod": null
        }
    },
    "endDate": "2025-12-31T00:00:00.000Z",
    "startDate": "2025-05-30T00:00:00.000Z",
    "lastPaymentDate": "2025-08-06T21:15:29.470Z",
    "billingPeriodLegacy": "8 months"
};

async function migrateSpecificDebtor() {
    try {
        console.log('🔄 Starting migration of specific debtor...');
        
        // First, let's check if this debtor already exists
        const existingDebtor = await EnhancedDebtorService.getComprehensiveDebtorData(specificDebtorData._id);
        
        if (existingDebtor) {
            console.log('✅ Debtor already exists, updating with enhanced fields...');
            
            // Update the existing debtor with enhanced fields
            const updatedDebtor = await EnhancedDebtorService.updateDebtorWithEnhancedFields(specificDebtorData._id, {
                // Enhanced fields to add
                paymentHistory: [],
                monthlyPayments: [],
                transactionEntries: [],
                invoices: [],
                financialSummary: {
                    currentPeriod: {
                        totalPaid: specificDebtorData.totalPaid || 0,
                        totalOwed: specificDebtorData.totalOwed || 0,
                        outstandingBalance: specificDebtorData.currentBalance || 0,
                        overdueAmount: specificDebtorData.overdueAmount || 0,
                        daysOverdue: specificDebtorData.daysOverdue || 0
                    },
                    yearToDate: {
                        totalPaid: specificDebtorData.totalPaid || 0,
                        totalOwed: specificDebtorData.totalOwed || 0,
                        outstandingBalance: specificDebtorData.currentBalance || 0
                    },
                    historical: {
                        totalPaid: specificDebtorData.totalPaid || 0,
                        totalOwed: specificDebtorData.totalOwed || 0,
                        lastPaymentAmount: specificDebtorData.lastPaymentAmount || 0,
                        lastPaymentDate: specificDebtorData.lastPaymentDate ? new Date(specificDebtorData.lastPaymentDate) : null
                    }
                }
            });
            
            console.log('✅ Successfully updated existing debtor with enhanced fields');
            console.log('📊 Updated debtor summary:');
            console.log(`   - Debtor Code: ${updatedDebtor.debtorCode}`);
            console.log(`   - Name: ${updatedDebtor.contactInfo?.name}`);
            console.log(`   - Current Balance: $${updatedDebtor.currentBalance}`);
            console.log(`   - Total Paid: $${updatedDebtor.totalPaid}`);
            console.log(`   - Payment History Entries: ${updatedDebtor.paymentHistory?.length || 0}`);
            console.log(`   - Transaction Entries: ${updatedDebtor.transactionEntries?.length || 0}`);
            
        } else {
            console.log('🆕 Creating new debtor with enhanced fields...');
            
            // Create a new debtor with the enhanced structure
            const newDebtorData = {
                ...specificDebtorData,
                // Enhanced fields
                paymentHistory: [],
                monthlyPayments: [],
                transactionEntries: [],
                invoices: [],
                financialSummary: {
                    currentPeriod: {
                        totalPaid: specificDebtorData.totalPaid || 0,
                        totalOwed: specificDebtorData.totalOwed || 0,
                        outstandingBalance: specificDebtorData.currentBalance || 0,
                        overdueAmount: specificDebtorData.overdueAmount || 0,
                        daysOverdue: specificDebtorData.daysOverdue || 0
                    },
                    yearToDate: {
                        totalPaid: specificDebtorData.totalPaid || 0,
                        totalOwed: specificDebtorData.totalOwed || 0,
                        outstandingBalance: specificDebtorData.currentBalance || 0
                    },
                    historical: {
                        totalPaid: specificDebtorData.totalPaid || 0,
                        totalOwed: specificDebtorData.totalOwed || 0,
                        lastPaymentAmount: specificDebtorData.lastPaymentAmount || 0,
                        lastPaymentDate: specificDebtorData.lastPaymentDate ? new Date(specificDebtorData.lastPaymentDate) : null
                    }
                }
            };
            
            // Create the debtor using the service
            const newDebtor = await EnhancedDebtorService.createEnhancedDebtor(newDebtorData);
            
            console.log('✅ Successfully created new debtor with enhanced fields');
            console.log('📊 New debtor summary:');
            console.log(`   - Debtor Code: ${newDebtor.debtorCode}`);
            console.log(`   - Name: ${newDebtor.contactInfo?.name}`);
            console.log(`   - Current Balance: $${newDebtor.currentBalance}`);
            console.log(`   - Total Paid: $${newDebtor.totalPaid}`);
        }
        
        // Now let's add some sample payments to demonstrate the enhanced functionality
        console.log('\n💰 Adding sample payments to demonstrate enhanced functionality...');
        
        const samplePayments = [
            {
                amount: 180,
                paymentMethod: 'bank_transfer',
                paymentDate: new Date('2025-06-01'),
                allocatedMonth: '2025-06',
                components: {
                    rent: 180,
                    adminFee: 0,
                    deposit: 0,
                    utilities: 0,
                    other: 0
                },
                status: 'completed',
                notes: 'June rent payment'
            },
            {
                amount: 180,
                paymentMethod: 'cash',
                paymentDate: new Date('2025-07-01'),
                allocatedMonth: '2025-07',
                components: {
                    rent: 180,
                    adminFee: 0,
                    deposit: 0,
                    utilities: 0,
                    other: 0
                },
                status: 'completed',
                notes: 'July rent payment'
            },
            {
                amount: 200,
                paymentMethod: 'mobile_money',
                paymentDate: new Date('2025-08-01'),
                allocatedMonth: '2025-08',
                components: {
                    rent: 180,
                    adminFee: 0,
                    deposit: 0,
                    utilities: 20,
                    other: 0
                },
                status: 'completed',
                notes: 'August rent + utilities'
            }
        ];
        
        // Add each sample payment
        for (const paymentData of samplePayments) {
            await EnhancedDebtorService.addPaymentToDebtor(specificDebtorData._id, paymentData);
            console.log(`   ✅ Added payment: $${paymentData.amount} for ${paymentData.allocatedMonth}`);
        }
        
        // Add a sample transaction entry
        console.log('\n📝 Adding sample transaction entry...');
        const sampleTransactionEntry = {
            transactionId: 'TXN-' + Date.now(),
            date: new Date('2025-08-01'),
            description: 'August rent and utilities payment',
            debitAccount: '110007', // AR account
            creditAccount: '100001', // Cash account
            amount: 200,
            reference: 'Payment for August 2025',
            type: 'payment_received'
        };
        
        await EnhancedDebtorService.addTransactionEntryToDebtor(specificDebtorData._id, sampleTransactionEntry);
        console.log('   ✅ Added transaction entry');
        
        // Get the final enhanced debtor data
        const finalDebtor = await EnhancedDebtorService.getComprehensiveDebtorData(specificDebtorData._id);
        
        console.log('\n🎉 Migration completed successfully!');
        console.log('\n📊 Final Enhanced Debtor Summary:');
        console.log(`   - Debtor Code: ${finalDebtor.debtorCode}`);
        console.log(`   - Name: ${finalDebtor.contactInfo?.name}`);
        console.log(`   - Email: ${finalDebtor.contactInfo?.email}`);
        console.log(`   - Room: ${finalDebtor.roomNumber} ($${finalDebtor.roomPrice}/month)`);
        console.log(`   - Current Balance: $${finalDebtor.currentBalance}`);
        console.log(`   - Total Paid: $${finalDebtor.totalPaid}`);
        console.log(`   - Payment History: ${finalDebtor.paymentHistory?.length || 0} entries`);
        console.log(`   - Monthly Payments: ${finalDebtor.monthlyPayments?.length || 0} months`);
        console.log(`   - Transaction Entries: ${finalDebtor.transactionEntries?.length || 0} entries`);
        console.log(`   - Billing Period: ${finalDebtor.billingPeriod?.startDate} to ${finalDebtor.billingPeriod?.endDate}`);
        
        console.log('\n💰 Payment History:');
        finalDebtor.paymentHistory?.forEach((payment, index) => {
            console.log(`   ${index + 1}. $${payment.amount} - ${payment.allocatedMonth} (${payment.paymentMethod})`);
        });
        
        console.log('\n📅 Monthly Payment Summary:');
        finalDebtor.monthlyPayments?.forEach((month) => {
            console.log(`   ${month.month}: $${month.paidAmount}/${month.expectedAmount} - ${month.status}`);
        });
        
        console.log('\n✅ Specific debtor migration completed with enhanced functionality!');
        
    } catch (error) {
        console.error('❌ Error during migration:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Add missing methods to EnhancedDebtorService if they don't exist
if (!EnhancedDebtorService.updateDebtorWithEnhancedFields) {
    EnhancedDebtorService.updateDebtorWithEnhancedFields = async (debtorId, enhancedFields) => {
        const Debtor = require('../src/models/Debtor');
        return await Debtor.findByIdAndUpdate(debtorId, { $set: enhancedFields }, { new: true });
    };
}

if (!EnhancedDebtorService.createEnhancedDebtor) {
    EnhancedDebtorService.createEnhancedDebtor = async (debtorData) => {
        const Debtor = require('../src/models/Debtor');
        const debtor = new Debtor(debtorData);
        return await debtor.save();
    };
}

if (!EnhancedDebtorService.addTransactionEntryToDebtor) {
    EnhancedDebtorService.addTransactionEntryToDebtor = async (debtorId, transactionEntryData) => {
        const Debtor = require('../src/models/Debtor');
        const debtor = await Debtor.findById(debtorId);
        if (!debtor) throw new Error('Debtor not found');
        
        await debtor.addTransactionEntry(transactionEntryData);
        return await debtor.save();
    };
}

// Run the migration
migrateSpecificDebtor();
