// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');

async function cleanupAndRecreatePayments() {
    try {
        console.log('🧹 CLEANUP AND RECREATE PAYMENTS');
        console.log('=================================');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        
        console.log('✅ Connected to MongoDB\n');
        
        // Load models
        const Payment = require('../src/models/Payment');
        const Transaction = require('../src/models/Transaction');
        const TransactionEntry = require('../src/models/TransactionEntry');
        const Account = require('../src/models/Account');
        
        // ========================================
        // GET PAYMENT DATA
        // ========================================
        console.log('📊 GETTING PAYMENT DATA');
        console.log('========================');
        
        const payments = await Payment.find({});
        console.log(`Total Payments: ${payments.length}`);
        
        let totalPaymentAmount = 0;
        payments.forEach(payment => {
            totalPaymentAmount += payment.totalAmount || payment.rentAmount || 0;
        });
        
        console.log(`Total Payment Amount: $${totalPaymentAmount.toFixed(2)}`);
        
        // ========================================
        // CLEAN UP OLD PAYMENT ENTRIES
        // ========================================
        console.log('\n\n🗑️ CLEANING UP OLD PAYMENT ENTRIES');
        console.log('=====================================');
        
        // Delete all payment entries that don't match our actual payments
        const oldPaymentEntries = await TransactionEntry.find({ 
            source: 'payment',
            description: { 
                $nin: [
                    'Student Rent Payment - PAY-1753480105884',
                    'Student Rent Payment - PAY-1753480910641',
                    'Student Rent Payment - PAY-1753834604519',
                    'Student Rent Payment - PAY-1753834934534',
                    'Student Rent Payment - PAY-1753835220318',
                    'Student Rent Payment - PAY-1753915089361'
                ]
            }
        });
        
        console.log(`Found ${oldPaymentEntries.length} old payment entries to delete`);
        
        if (oldPaymentEntries.length > 0) {
            const deleteResult = await TransactionEntry.deleteMany({
                _id: { $in: oldPaymentEntries.map(e => e._id) }
            });
            console.log(`Deleted ${deleteResult.deletedCount} old payment entries`);
        }
        
        // ========================================
        // GET REQUIRED ACCOUNTS
        // ========================================
        console.log('\n\n🏦 GETTING REQUIRED ACCOUNTS');
        console.log('=============================');
        
        const rentIncomeAccount = await Account.findOne({ code: '4001' });
        const bankAccount = await Account.findOne({ code: '1001' });
        const cashAccount = await Account.findOne({ code: '1002' });
        const ecocashAccount = await Account.findOne({ code: '1003' });
        const innbucksAccount = await Account.findOne({ code: '1004' });
        
        if (!rentIncomeAccount) {
            console.log('❌ Rent Income Account (4001) not found!');
            return;
        }
        
        console.log('✅ All required accounts found');
        
        // ========================================
        // RECREATE PAYMENT ENTRIES
        // ========================================
        console.log('\n\n🔧 RECREATING PAYMENT ENTRIES');
        console.log('==============================');
        
        let createdEntries = 0;
        let totalCreatedAmount = 0;
        
        for (const payment of payments) {
            try {
                const amount = payment.totalAmount || payment.rentAmount || 0;
                if (amount <= 0) {
                    console.log(`⚠️ Skipping payment ${payment.paymentId} - zero amount`);
                    continue;
                }
                
                // Check if entry already exists
                const existingEntry = await TransactionEntry.findOne({
                    description: `Student Rent Payment - ${payment.paymentId}`
                });
                
                if (existingEntry) {
                    console.log(`✅ Entry already exists for ${payment.paymentId}`);
                    continue;
                }
                
                // Determine payment method account
                let paymentMethodAccount;
                switch (payment.method?.toLowerCase()) {
                    case 'cash':
                        paymentMethodAccount = cashAccount;
                        break;
                    case 'ecocash':
                        paymentMethodAccount = ecocashAccount;
                        break;
                    case 'innbucks':
                        paymentMethodAccount = innbucksAccount;
                        break;
                    case 'bank transfer':
                    case 'bank':
                        paymentMethodAccount = bankAccount;
                        break;
                    default:
                        paymentMethodAccount = bankAccount; // Default to bank
                }
                
                if (!paymentMethodAccount) {
                    console.log(`⚠️ Payment method account not found for ${payment.method}, using bank account`);
                    paymentMethodAccount = bankAccount;
                }
                
                // Find the corresponding transaction
                const transaction = await Transaction.findOne({
                    description: `Student Rent Payment - ${payment.paymentId}`
                });
                
                if (!transaction) {
                    console.log(`⚠️ No transaction found for payment ${payment.paymentId}`);
                    continue;
                }
                
                // Create transaction entry
                const transactionEntry = new TransactionEntry({
                    transactionId: transaction.transactionId,
                    description: `Student Rent Payment - ${payment.paymentId}`,
                    totalDebit: amount,
                    totalCredit: amount,
                    source: 'payment',
                    sourceId: payment._id,
                    sourceModel: 'Payment',
                    status: 'posted',
                    date: payment.date,
                    createdBy: payment.createdBy || '67c023adae5e27657502e887',
                    entries: [
                        {
                            accountCode: paymentMethodAccount.code,
                            accountName: paymentMethodAccount.name,
                            debit: amount,
                            credit: 0
                        },
                        {
                            accountCode: rentIncomeAccount.code,
                            accountName: rentIncomeAccount.name,
                            debit: 0,
                            credit: amount
                        }
                    ],
                    metadata: {
                        paymentId: payment.paymentId,
                        studentId: payment.student,
                        residenceId: payment.residence,
                        room: payment.room,
                        rentAmount: payment.rentAmount,
                        adminFee: payment.adminFee,
                        deposit: payment.deposit,
                        paymentMethod: payment.method,
                        paymentStatus: payment.status
                    }
                });
                
                await transactionEntry.save();
                
                // Update transaction with entry reference
                transaction.entries.push(transactionEntry._id);
                await transaction.save();
                
                createdEntries++;
                totalCreatedAmount += amount;
                
                console.log(`✅ Created entry for payment ${payment.paymentId}: $${amount.toFixed(2)}`);
                
            } catch (error) {
                console.error(`❌ Error creating entry for payment ${payment.paymentId}:`, error.message);
            }
        }
        
        console.log(`\n🎉 Created ${createdEntries} payment entries`);
        console.log(`💰 Total amount processed: $${totalCreatedAmount.toFixed(2)}`);
        
        // ========================================
        // FINAL VERIFICATION
        // ========================================
        console.log('\n\n✅ FINAL VERIFICATION');
        console.log('======================');
        
        const finalPaymentEntries = await TransactionEntry.find({ source: 'payment' });
        console.log(`Final Payment Entries: ${finalPaymentEntries.length}`);
        
        let totalEntryAmount = 0;
        finalPaymentEntries.forEach(entry => {
            totalEntryAmount += entry.totalCredit || 0;
        });
        
        console.log(`Final Entry Amount: $${totalEntryAmount.toFixed(2)}`);
        console.log(`Payment Amount: $${totalPaymentAmount.toFixed(2)}`);
        
        const difference = Math.abs(totalEntryAmount - totalPaymentAmount);
        console.log(`Difference: $${difference.toFixed(2)}`);
        
        if (difference < 0.01) {
            console.log('✅ SUCCESS! Payment entries are now perfectly balanced!');
        } else {
            console.log('⚠️ There are still discrepancies.');
        }
        
        // ========================================
        // SHOW FINAL PAYMENT ENTRIES
        // ========================================
        console.log('\n\n📋 FINAL PAYMENT ENTRIES');
        console.log('=========================');
        
        finalPaymentEntries.forEach((entry, index) => {
            console.log(`${index + 1}. ${entry.description}`);
            console.log(`   Amount: $${entry.totalCredit}`);
            console.log(`   Date: ${new Date(entry.date).toLocaleDateString()}`);
            console.log(`   Status: ${entry.status}`);
            console.log('');
        });
        
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
}

// Run the cleanup and recreation
cleanupAndRecreatePayments(); 