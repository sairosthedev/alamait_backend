require('dotenv').config();
const mongoose = require('mongoose');

async function updateAccountingForPayments() {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n🔄 Updating Accounting Records for Payments...');
        console.log('==============================================');
        
        // Get all payments
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        console.log(`💰 Found ${payments.length} payments to process`);
        
        // Get all debtors
        const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        console.log(`💳 Found ${debtors.length} existing debtors`);
        
        // Get accounts for proper double-entry
        const accounts = await mongoose.connection.db.collection('accounts').find({}).toArray();
        const accountMap = {};
        accounts.forEach(account => {
            accountMap[account.code] = account;
        });
        
        // Find required accounts
        const bankAccount = accountMap['1001'] || accountMap['1002']; // Bank Account or Cash on Hand
        const rentIncomeAccount = accountMap['4000']; // Rental Income - Residential
        const adminIncomeAccount = accountMap['4020']; // Other Income (for admin fees)
        const depositLiabilityAccount = accountMap['2020']; // Tenant Deposits Held
        
        if (!bankAccount || !rentIncomeAccount || !adminIncomeAccount || !depositLiabilityAccount) {
            console.log('❌ Required accounts not found. Please ensure chart of accounts is set up.');
            return;
        }
        
        console.log('\n📊 Processing Payments...');
        let transactionsCreated = 0;
        let transactionEntriesCreated = 0;
        let debtorsUpdated = 0;
        
        for (const payment of payments) {
            try {
                // Check if transaction already exists for this payment
                const existingTransaction = await mongoose.connection.db
                    .collection('transactions')
                    .findOne({ 'metadata.paymentId': payment.paymentId });
                
                if (existingTransaction) {
                    console.log(`   ⏭️  Transaction already exists for payment ${payment.paymentId}`);
                    continue;
                }
                
                // Create transaction
                const transaction = {
                    transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                    date: new Date(payment.date),
                    description: `Payment received from ${payment.description}`,
                    reference: payment._id.toString(),
                    residence: payment.residence,
                    type: 'payment',
                    amount: payment.totalAmount,
                    entries: [],
                    createdBy: payment.createdBy || 'system',
                    metadata: {
                        paymentId: payment.paymentId,
                        studentId: payment.student,
                        paymentType: 'student_payment'
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                // Create transaction entry
                const transactionEntry = {
                    transactionId: transaction.transactionId,
                    date: new Date(payment.date),
                    description: `Payment: ${payment.description}`,
                    reference: payment._id.toString(),
                    entries: [],
                    totalDebit: 0,
                    totalCredit: 0,
                    source: 'payment',
                    sourceId: payment._id,
                    sourceModel: 'Payment',
                    residence: payment.residence,
                    createdBy: payment.createdBy || 'system',
                    status: 'posted',
                    metadata: {
                        paymentId: payment.paymentId,
                        studentId: payment.student,
                        paymentType: 'student_payment'
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                // Calculate amounts by type
                let totalDebit = 0;
                let totalCredit = 0;
                
                if (payment.payments && Array.isArray(payment.payments)) {
                    payment.payments.forEach(subPayment => {
                        if (subPayment.type === 'rent') {
                            // Debit: Bank/Cash (money received)
                            transactionEntry.entries.push({
                                accountCode: bankAccount.code,
                                accountName: bankAccount.name,
                                accountType: bankAccount.type,
                                debit: subPayment.amount,
                                credit: 0,
                                description: `Rent payment received - ${subPayment.amount}`
                            });
                            
                            // Credit: Rent Income
                            transactionEntry.entries.push({
                                accountCode: rentIncomeAccount.code,
                                accountName: rentIncomeAccount.name,
                                accountType: rentIncomeAccount.type,
                                debit: 0,
                                credit: subPayment.amount,
                                description: `Rent income from student`
                            });
                            
                            totalDebit += subPayment.amount;
                            totalCredit += subPayment.amount;
                            
                        } else if (subPayment.type === 'admin') {
                            // Debit: Bank/Cash (money received)
                            transactionEntry.entries.push({
                                accountCode: bankAccount.code,
                                accountName: bankAccount.name,
                                accountType: bankAccount.type,
                                debit: subPayment.amount,
                                credit: 0,
                                description: `Admin fee received - ${subPayment.amount}`
                            });
                            
                            // Credit: Admin Income
                            transactionEntry.entries.push({
                                accountCode: adminIncomeAccount.code,
                                accountName: adminIncomeAccount.name,
                                accountType: adminIncomeAccount.type,
                                debit: 0,
                                credit: subPayment.amount,
                                description: `Admin fee income from student`
                            });
                            
                            totalDebit += subPayment.amount;
                            totalCredit += subPayment.amount;
                            
                        } else if (subPayment.type === 'deposit') {
                            // Debit: Bank/Cash (money received)
                            transactionEntry.entries.push({
                                accountCode: bankAccount.code,
                                accountName: bankAccount.name,
                                accountType: bankAccount.type,
                                debit: subPayment.amount,
                                credit: 0,
                                description: `Deposit received - ${subPayment.amount}`
                            });
                            
                            // Credit: Security Deposits (Liability)
                            transactionEntry.entries.push({
                                accountCode: depositLiabilityAccount.code,
                                accountName: depositLiabilityAccount.name,
                                accountType: depositLiabilityAccount.type,
                                debit: 0,
                                credit: subPayment.amount,
                                description: `Security deposit received from student`
                            });
                            
                            totalDebit += subPayment.amount;
                            totalCredit += subPayment.amount;
                        }
                    });
                }
                
                // Update totals
                transactionEntry.totalDebit = totalDebit;
                transactionEntry.totalCredit = totalCredit;
                
                // Save transaction entry
                const savedEntry = await mongoose.connection.db
                    .collection('transactionentries')
                    .insertOne(transactionEntry);
                
                // Update transaction with entry reference
                transaction.entries = [savedEntry.insertedId];
                
                // Save transaction
                await mongoose.connection.db
                    .collection('transactions')
                    .insertOne(transaction);
                
                // Update debtor record
                const debtor = debtors.find(d => d.user && d.user.toString() === payment.student.toString());
                if (debtor) {
                    // Update debtor with payment information
                    await mongoose.connection.db
                        .collection('debtors')
                        .updateOne(
                            { _id: debtor._id },
                            {
                                $inc: {
                                    totalPaid: payment.totalAmount,
                                    'financialSummary.yearToDate.totalPaid': payment.totalAmount,
                                    'financialSummary.yearToDate.paymentCount': 1
                                },
                                $set: {
                                    lastPaymentDate: new Date(payment.date),
                                    lastPaymentAmount: payment.totalAmount,
                                    'financialSummary.currentPeriod.paidAmount': payment.totalAmount,
                                    'financialSummary.currentPeriod.status': 'paid',
                                    'financialSummary.historical.lastPaymentDate': new Date(payment.date),
                                    updatedAt: new Date()
                                },
                                $push: {
                                    paymentHistory: {
                                        date: new Date(payment.date),
                                        amount: payment.totalAmount,
                                        type: 'payment',
                                        reference: payment.paymentId,
                                        description: payment.description
                                    },
                                    monthlyPayments: {
                                        month: payment.paymentMonth,
                                        amount: payment.totalAmount,
                                        date: new Date(payment.date)
                                    }
                                }
                            }
                        );
                    
                    debtorsUpdated++;
                }
                
                transactionsCreated++;
                transactionEntriesCreated++;
                
                console.log(`   ✅ Processed payment ${payment.paymentId}: $${payment.totalAmount}`);
                
            } catch (error) {
                console.log(`   ❌ Error processing payment ${payment.paymentId}:`, error.message);
            }
        }
        
        console.log('\n📊 Accounting Update Summary:');
        console.log('=============================');
        console.log(`💰 Payments Processed: ${payments.length}`);
        console.log(`📝 Transactions Created: ${transactionsCreated}`);
        console.log(`📋 Transaction Entries Created: ${transactionEntriesCreated}`);
        console.log(`💳 Debtors Updated: ${debtorsUpdated}`);
        
        if (transactionsCreated > 0) {
            console.log('\n✅ All payments now have proper accounting records!');
            console.log('   - Double-entry transactions created');
            console.log('   - Debtor records updated with payment history');
            console.log('   - Proper account debits and credits recorded');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔄 Starting Accounting Update for Payments...');
updateAccountingForPayments();
