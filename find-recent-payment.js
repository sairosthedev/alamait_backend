const mongoose = require('mongoose');

async function findRecentPayment() {
    try {
        // Connect to Atlas database
        const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        
        console.log('🔍 Connecting to Atlas database...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to Atlas database');
        
        const Payment = require('./src/models/Payment');
        const Debtor = require('./src/models/Debtor');
        const Transaction = require('./src/models/Transaction');
        const TransactionEntry = require('./src/models/TransactionEntry');
        const User = require('./src/models/User');
        
        // Check for recent payments
        const paymentCount = await Payment.countDocuments();
        console.log(`\n📊 Database Overview:`);
        console.log(`   Payments: ${paymentCount}`);
        console.log(`   Debtors: ${await Debtor.countDocuments()}`);
        console.log(`   Transactions: ${await Transaction.countDocuments()}`);
        console.log(`   Transaction Entries: ${await TransactionEntry.countDocuments()}`);
        console.log(`   Users: ${await User.countDocuments()}`);
        
        if (paymentCount > 0) {
            // Get the most recent payment
            const recentPayment = await Payment.findOne().sort({ createdAt: -1 });
            console.log(`\n🎯 Most recent payment found:`);
            console.log(`   Payment ID: ${recentPayment.paymentId}`);
            console.log(`   Student ID: ${recentPayment.student}`);
            console.log(`   Amount: $${recentPayment.totalAmount}`);
            console.log(`   Status: ${recentPayment.status}`);
            console.log(`   Created: ${recentPayment.createdAt}`);
            console.log(`   Created By: ${recentPayment.createdBy}`);
            
            // Check if debtor exists for this student
            const debtor = await Debtor.findOne({ user: recentPayment.student });
            if (debtor) {
                console.log(`\n✅ Debtor found:`);
                console.log(`   ID: ${debtor._id}`);
                console.log(`   Code: ${debtor.debtorCode}`);
                console.log(`   Current Balance: $${debtor.currentBalance}`);
                console.log(`   Total Paid: $${debtor.totalPaid}`);
                console.log(`   Payment History Count: ${debtor.paymentHistory.length}`);
                
                // Check if this payment is in the debtor's payment history
                const paymentInHistory = debtor.paymentHistory.find(p => p.paymentId === recentPayment.paymentId);
                if (paymentInHistory) {
                    console.log(`   ✅ Payment ${recentPayment.paymentId} found in debtor payment history`);
                } else {
                    console.log(`   ❌ Payment ${recentPayment.paymentId} NOT found in debtor payment history`);
                }
            } else {
                console.log(`\n❌ No debtor found for student ${recentPayment.student}`);
                
                // Check if the student exists
                const student = await User.findById(recentPayment.student);
                if (student) {
                    console.log(`   Student exists: ${student.firstName} ${student.lastName} (${student.email})`);
                    
                    // Now let's try to create the debtor manually
                    console.log(`\n🏗️ Attempting to create debtor manually...`);
                    try {
                        const { createDebtorForStudent } = require('./src/services/debtorService');
                        
                        const newDebtor = await createDebtorForStudent(student, {
                            residenceId: recentPayment.residence,
                            roomNumber: recentPayment.room,
                            createdBy: recentPayment.createdBy,
                            startDate: recentPayment.date,
                            roomPrice: recentPayment.totalAmount
                        });
                        
                        console.log(`✅ Debtor created successfully:`);
                        console.log(`   ID: ${newDebtor._id}`);
                        console.log(`   Code: ${newDebtor.debtorCode}`);
                        console.log(`   Current Balance: $${newDebtor.currentBalance}`);
                        
                        // Now add the payment to the debtor
                        console.log(`\n💰 Adding payment to debtor...`);
                        await newDebtor.addPayment({
                            paymentId: recentPayment.paymentId,
                            amount: recentPayment.totalAmount,
                            allocatedMonth: recentPayment.paymentMonth,
                            components: {
                                rent: recentPayment.rentAmount || 0,
                                admin: recentPayment.adminFee || 0,
                                deposit: recentPayment.deposit || 0
                            },
                            paymentMethod: recentPayment.method,
                            paymentDate: recentPayment.date,
                            status: 'Confirmed',
                            notes: `Payment ${recentPayment.paymentId} - ${recentPayment.paymentMonth}`,
                            createdBy: recentPayment.createdBy
                        });
                        
                        console.log(`✅ Payment added to debtor successfully`);
                        console.log(`   New Balance: $${newDebtor.currentBalance}`);
                        console.log(`   New Total Paid: $${newDebtor.totalPaid}`);
                        
                    } catch (debtorError) {
                        console.error(`❌ Error creating debtor:`, debtorError);
                        console.error(`   Error details:`, debtorError.message);
                        console.error(`   Stack trace:`, debtorError.stack);
                    }
                } else {
                    console.log(`   ❌ Student not found in User collection`);
                }
            }
            
            // Check transactions
            const transactions = await Transaction.find({ reference: recentPayment._id.toString() });
            console.log(`\n🔍 Transactions found: ${transactions.length}`);
            
            if (transactions.length > 0) {
                transactions.forEach((transaction, index) => {
                    console.log(`   ${index + 1}. Transaction ID: ${transaction.transactionId}`);
                    console.log(`      Created By: ${transaction.createdBy}`);
                    console.log(`      Type: ${transaction.type}`);
                    console.log(`      Description: ${transaction.description}`);
                });
            }
            
            // Check transaction entries
            const transactionEntries = await TransactionEntry.find({ sourceId: recentPayment._id });
            console.log(`\n🔍 Transaction entries found: ${transactionEntries.length}`);
            
            if (transactionEntries.length > 0) {
                transactionEntries.forEach((entry, index) => {
                    console.log(`   ${index + 1}. Entry ID: ${entry._id}`);
                    console.log(`      Transaction ID: ${entry.transactionId}`);
                    console.log(`      Total Debit: $${entry.totalDebit}`);
                    console.log(`      Total Credit: $${entry.totalCredit}`);
                    console.log(`      Source: ${entry.source}`);
                    console.log(`      Created By: ${entry.createdBy}`);
                });
            }
            
        } else {
            console.log(`\n❌ No payments found in database`);
        }
        
    } catch (error) {
        console.error('❌ Error in script:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

findRecentPayment();
