// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');

async function fixPaymentAmounts() {
    try {
        console.log('🔧 FIXING PAYMENT AMOUNTS ISSUE');
        console.log('================================');
        
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
        const User = require('../src/models/User');
        
        // ========================================
        // ANALYZE CURRENT PAYMENT DATA
        // ========================================
        console.log('📊 ANALYZING CURRENT PAYMENT DATA');
        console.log('=================================');
        
        const payments = await Payment.find({});
        console.log(`Total Payments Found: ${payments.length}`);
        
        let totalPaymentAmount = 0;
        let paymentsByMethod = {};
        let paymentsByStatus = {};
        let paymentDetails = [];
        
        payments.forEach(payment => {
            const amount = payment.totalAmount || payment.rentAmount || 0;
            totalPaymentAmount += amount;
            
            const method = payment.method || 'Unknown';
            paymentsByMethod[method] = (paymentsByMethod[method] || 0) + amount;
            
            const status = payment.status || 'Unknown';
            paymentsByStatus[status] = (paymentsByStatus[status] || 0) + amount;
            
            paymentDetails.push({
                id: payment._id,
                paymentId: payment.paymentId,
                student: payment.student,
                amount: amount,
                method: method,
                status: status,
                date: payment.date,
                rentAmount: payment.rentAmount,
                adminFee: payment.adminFee,
                deposit: payment.deposit,
                totalAmount: payment.totalAmount,
                residence: payment.residence
            });
        });
        
        console.log(`\n💰 Total Payment Amount: $${totalPaymentAmount.toFixed(2)}`);
        
        console.log('\n💳 Payments by Method:');
        Object.entries(paymentsByMethod)
            .sort(([,a], [,b]) => b - a)
            .forEach(([method, amount]) => {
                console.log(`  - ${method}: $${amount.toFixed(2)}`);
            });
        
        console.log('\n📋 Payments by Status:');
        Object.entries(paymentsByStatus)
            .sort(([,a], [,b]) => b - a)
            .forEach(([status, amount]) => {
                console.log(`  - ${status}: $${amount.toFixed(2)}`);
            });
        
        // ========================================
        // CHECK EXISTING TRANSACTIONS
        // ========================================
        console.log('\n\n🔍 CHECKING EXISTING TRANSACTIONS');
        console.log('==================================');
        
        const existingTransactions = await Transaction.find({ type: 'payment' });
        console.log(`Existing Payment Transactions: ${existingTransactions.length}`);
        
        let existingTransactionAmount = 0;
        existingTransactions.forEach(txn => {
            existingTransactionAmount += txn.amount || 0;
        });
        
        console.log(`Existing Transaction Amount: $${existingTransactionAmount.toFixed(2)}`);
        
        // ========================================
        // CHECK TRANSACTION ENTRIES
        // ========================================
        console.log('\n\n📝 CHECKING TRANSACTION ENTRIES');
        console.log('===============================');
        
        const rentIncomeEntries = await TransactionEntry.find({ 
            'entries.accountCode': '4001' // Rent Income account
        });
        
        console.log(`Rent Income Transaction Entries: ${rentIncomeEntries.length}`);
        
        let totalRentIncome = 0;
        rentIncomeEntries.forEach(entry => {
            totalRentIncome += entry.totalCredit || 0;
        });
        
        console.log(`Total Rent Income in Entries: $${totalRentIncome.toFixed(2)}`);
        
        // ========================================
        // IDENTIFY MISSING TRANSACTIONS
        // ========================================
        console.log('\n\n🔍 IDENTIFYING MISSING TRANSACTIONS');
        console.log('====================================');
        
        const processedPaymentIds = existingTransactions.map(txn => txn.sourceId);
        const missingPayments = payments.filter(payment => 
            !processedPaymentIds.includes(payment._id.toString())
        );
        
        console.log(`Missing Transactions for Payments: ${missingPayments.length}`);
        
        if (missingPayments.length > 0) {
            console.log('\n📋 Missing Payment Details:');
            missingPayments.forEach((payment, index) => {
                console.log(`${index + 1}. Payment ID: ${payment.paymentId}`);
                console.log(`   Amount: $${payment.totalAmount || payment.rentAmount || 0}`);
                console.log(`   Method: ${payment.method}`);
                console.log(`   Date: ${new Date(payment.date).toLocaleDateString()}`);
                console.log(`   Status: ${payment.status}`);
                console.log(`   Residence: ${payment.residence}`);
                console.log('');
            });
        }
        
        // ========================================
        // CREATE MISSING TRANSACTIONS
        // ========================================
        if (missingPayments.length > 0) {
            console.log('\n\n🔧 CREATING MISSING TRANSACTIONS');
            console.log('=================================');
            
            // Get required accounts
            const rentIncomeAccount = await Account.findOne({ code: '4001' });
            const bankAccount = await Account.findOne({ code: '1001' });
            const cashAccount = await Account.findOne({ code: '1002' });
            const ecocashAccount = await Account.findOne({ code: '1003' });
            const innbucksAccount = await Account.findOne({ code: '1004' });
            
            if (!rentIncomeAccount) {
                console.log('❌ Rent Income Account (4001) not found!');
                return;
            }
            
            let createdTransactions = 0;
            let totalCreatedAmount = 0;
            
            for (const payment of missingPayments) {
                try {
                    const amount = payment.totalAmount || payment.rentAmount || 0;
                    if (amount <= 0) {
                        console.log(`⚠️ Skipping payment ${payment.paymentId} - zero amount`);
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
                    
                    // Create transaction with correct schema
                    const transaction = new Transaction({
                        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                        type: 'payment', // Use correct enum value
                        description: `Student Rent Payment - ${payment.paymentId}`,
                        amount: amount,
                        date: payment.date,
                        residence: payment.residence, // Required field
                        residenceName: 'Student Residence', // Optional but helpful
                        createdBy: payment.createdBy || '67c023adae5e27657502e887' // Use a valid user ID
                    });
                    
                    await transaction.save();
                    
                    // Create transaction entry
                    const transactionEntry = new TransactionEntry({
                        transactionId: transaction.transactionId,
                        description: `Student Rent Payment - ${payment.paymentId}`,
                        totalDebit: amount,
                        totalCredit: amount,
                        source: 'payment', // Use correct enum value
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
                    
                    createdTransactions++;
                    totalCreatedAmount += amount;
                    
                    console.log(`✅ Created transaction for payment ${payment.paymentId}: $${amount.toFixed(2)}`);
                    
                } catch (error) {
                    console.error(`❌ Error creating transaction for payment ${payment.paymentId}:`, error.message);
                }
            }
            
            console.log(`\n🎉 Created ${createdTransactions} transactions`);
            console.log(`💰 Total amount processed: $${totalCreatedAmount.toFixed(2)}`);
        }
        
        // ========================================
        // FINAL VERIFICATION
        // ========================================
        console.log('\n\n✅ FINAL VERIFICATION');
        console.log('======================');
        
        const finalTransactions = await Transaction.find({ type: 'payment' });
        const finalEntries = await TransactionEntry.find({ 
            'entries.accountCode': '4001'
        });
        
        let finalTransactionAmount = 0;
        finalTransactions.forEach(txn => {
            finalTransactionAmount += txn.amount || 0;
        });
        
        let finalRentIncome = 0;
        finalEntries.forEach(entry => {
            finalRentIncome += entry.totalCredit || 0;
        });
        
        console.log(`Final Transaction Amount: $${finalTransactionAmount.toFixed(2)}`);
        console.log(`Final Rent Income: $${finalRentIncome.toFixed(2)}`);
        console.log(`Original Payment Amount: $${totalPaymentAmount.toFixed(2)}`);
        
        const difference = Math.abs(finalTransactionAmount - totalPaymentAmount);
        if (difference < 0.01) {
            console.log('✅ All payment amounts are now properly recorded!');
        } else {
            console.log(`⚠️ There's still a difference of $${difference.toFixed(2)}`);
        }
        
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Fix failed:', error.message);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
}

// Run the fix
fixPaymentAmounts(); 