/**
 * Check Database
 * 
 * Simple script to check database connection and available data
 */

const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const Payment = require('./src/models/Payment');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkDatabase() {
    try {
        console.log('🔍 Checking Database');
        console.log('==================\n');

        // Check connection
        console.log('1️⃣ Database Connection:');
        console.log(`   Connected: ${mongoose.connection.readyState === 1 ? '✅ Yes' : '❌ No'}`);
        console.log(`   Database: ${mongoose.connection.name}`);

        // Check TransactionEntry collection
        console.log('\n2️⃣ TransactionEntry Collection:');
        const totalTransactions = await TransactionEntry.countDocuments();
        console.log(`   Total records: ${totalTransactions}`);

        if (totalTransactions > 0) {
            const sampleTransaction = await TransactionEntry.findOne();
            console.log(`   Sample transaction: ${sampleTransaction.transactionId}`);
            console.log(`   Description: ${sampleTransaction.description}`);
            console.log(`   Source: ${sampleTransaction.source}`);
            console.log(`   Type: ${sampleTransaction.type}`);
            console.log(`   Amount: ${sampleTransaction.amount}`);
            console.log(`   Total Debit: ${sampleTransaction.totalDebit}`);
            console.log(`   Total Credit: ${sampleTransaction.totalCredit}`);
        }

        // Check Payment collection
        console.log('\n3️⃣ Payment Collection:');
        const totalPayments = await Payment.countDocuments();
        console.log(`   Total records: ${totalPayments}`);

        if (totalPayments > 0) {
            const samplePayment = await Payment.findOne();
            console.log(`   Sample payment: ${samplePayment.paymentId}`);
            console.log(`   Amount: $${samplePayment.totalAmount}`);
            console.log(`   Student: ${samplePayment.student}`);
            console.log(`   Date: ${samplePayment.date}`);
        }

        // Check for AR transactions specifically
        console.log('\n4️⃣ AR Transactions:');
        const arTransactions = await TransactionEntry.find({
            'entries.accountCode': { $regex: '^1100-' }
        });
        console.log(`   AR transactions found: ${arTransactions.length}`);

        if (arTransactions.length > 0) {
            console.log('   Sample AR transactions:');
            arTransactions.slice(0, 3).forEach((tx, index) => {
                console.log(`   ${index + 1}. ${tx.transactionId} - ${tx.description}`);
                console.log(`      Source: ${tx.source}, Type: ${tx.type}`);
                console.log(`      Amount: ${tx.amount}, Total Debit: ${tx.totalDebit}`);
                tx.entries.forEach(entry => {
                    if (entry.accountCode.startsWith('1100-')) {
                        console.log(`        ${entry.accountCode}: Debit $${entry.debit}, Credit $${entry.credit}`);
                    }
                });
            });
        }

        console.log('\n✅ Database Check Complete!');

    } catch (error) {
        console.error('❌ Database check failed:', error);
        console.error(error.stack);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the check
if (require.main === module) {
    checkDatabase();
}

module.exports = { checkDatabase };

