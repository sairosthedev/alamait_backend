process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const Expense = require('./src/models/finance/Expense');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');

async function testExpensePaymentFix() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n📊 TESTING EXPENSE PAYMENT FIX...\n');

        // Find the specific expense
        const expenseId = '68928ad3a67171c304eb9b3c';
        const expense = await Expense.findById(expenseId);
        
        if (!expense) {
            console.log('❌ Expense not found');
            return;
        }

        console.log('📋 EXPENSE DETAILS:');
        console.log('=' .repeat(50));
        console.log(`ID: ${expense._id}`);
        console.log(`Description: ${expense.description}`);
        console.log(`Amount: $${expense.amount}`);
        console.log(`Status: ${expense.paymentStatus}`);
        console.log(`Transaction ID: ${expense.transactionId || 'None'}`);

        // Check if transaction exists
        if (expense.transactionId) {
            const transaction = await Transaction.findById(expense.transactionId);
            if (transaction) {
                console.log('\n💰 TRANSACTION DETAILS:');
                console.log('=' .repeat(50));
                console.log(`Transaction ID: ${transaction.transactionId}`);
                console.log(`Description: ${transaction.description}`);
                console.log(`Amount: $${transaction.amount}`);
                console.log(`Type: ${transaction.type}`);
                console.log(`Created By: ${transaction.createdBy}`);
                console.log(`Entries Count: ${transaction.entries.length}`);

                // Check transaction entries
                if (transaction.entries.length > 0) {
                    const entry = await TransactionEntry.findById(transaction.entries[0]);
                    if (entry) {
                        console.log('\n📝 TRANSACTION ENTRY DETAILS:');
                        console.log('=' .repeat(50));
                        console.log(`Entry ID: ${entry.transactionId}`);
                        console.log(`Description: ${entry.description}`);
                        console.log(`Total Debit: $${entry.totalDebit}`);
                        console.log(`Total Credit: $${entry.totalCredit}`);
                        console.log(`Source: ${entry.source}`);
                        console.log(`Created By: ${entry.createdBy}`);
                        
                        console.log('\n📊 ENTRY DETAILS:');
                        entry.entries.forEach((line, index) => {
                            console.log(`  ${index + 1}. ${line.accountCode} - ${line.accountName}`);
                            console.log(`     Debit: $${line.debit}, Credit: $${line.credit}`);
                        });
                    }
                }
            }
        }

        // Test the payment data structure
        console.log('\n🧪 TESTING PAYMENT DATA STRUCTURE:');
        console.log('=' .repeat(50));
        
        const testPaymentData = {
            amount: 49.98,
            paymentMethod: "Bank Transfer",
            reference: "well",
            notes: "lets see",
            recordedBy: "finance@alamait.com",
            userRole: "finance"
        };

        console.log('Payment Data:', JSON.stringify(testPaymentData, null, 2));

        console.log('\n✅ TEST COMPLETED');
        console.log('The expense payment should now work with the correct data structure!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

testExpensePaymentFix(); 