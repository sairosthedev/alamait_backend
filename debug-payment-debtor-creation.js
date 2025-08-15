const mongoose = require('mongoose');

// Try different database names
const databases = [
    'mongodb://localhost:27017/alamait',
    'mongodb://localhost:27017/alamait_backend',
    'mongodb://localhost:27017/test'
];

async function checkDatabase(uri) {
    try {
        console.log(`\n🔍 Trying database: ${uri}`);
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        const db = mongoose.connection;
        console.log(`✅ Connected to: ${db.name}`);
        
        // Check collections
        const collections = await db.db.listCollections().toArray();
        console.log(`   Collections found: ${collections.length}`);
        collections.forEach(col => {
            console.log(`     - ${col.name}`);
        });
        
        // Check if payments collection exists and has data
        if (collections.some(col => col.name === 'payments')) {
            const Payment = require('./src/models/Payment');
            const count = await Payment.countDocuments();
            console.log(`   Payments collection has ${count} documents`);
            
            if (count > 0) {
                // Get the most recent payment
                const latestPayment = await Payment.findOne().sort({ createdAt: -1 });
                console.log(`   Latest payment: ${latestPayment.paymentId} - $${latestPayment.totalAmount}`);
            }
        }
        
        await mongoose.disconnect();
        return true;
    } catch (error) {
        console.log(`❌ Failed to connect to ${uri}: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🔍 Checking available databases...');
    
    for (const uri of databases) {
        await checkDatabase(uri);
    }
    
    // Now try to find the specific payment
    console.log('\n🔍 Looking for specific payment: PAY-1755226825185');
    
    for (const uri of databases) {
        try {
            await mongoose.connect(uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            
            const Payment = require('./src/models/Payment');
            const payment = await Payment.findOne({ paymentId: 'PAY-1755226825185' });
            
            if (payment) {
                console.log(`✅ Payment found in ${uri}!`);
                console.log(`   ID: ${payment._id}`);
                console.log(`   Student: ${payment.student}`);
                console.log(`   Amount: $${payment.totalAmount}`);
                console.log(`   Status: ${payment.status}`);
                console.log(`   Created: ${payment.createdAt}`);
                
                // Now check for debtor and transactions
                const Debtor = require('./src/models/Debtor');
                const Transaction = require('./src/models/Transaction');
                const TransactionEntry = require('./src/models/TransactionEntry');
                
                const debtor = await Debtor.findOne({ user: payment.student });
                if (debtor) {
                    console.log('✅ Debtor found:');
                    console.log(`   ID: ${debtor._id}`);
                    console.log(`   Code: ${debtor.debtorCode}`);
                    console.log(`   Current Balance: $${debtor.currentBalance}`);
                    console.log(`   Total Paid: $${debtor.totalPaid}`);
                } else {
                    console.log('❌ No debtor found for this student');
                }
                
                const transactions = await Transaction.find({ reference: payment._id.toString() });
                console.log(`   Transactions found: ${transactions.length}`);
                
                const transactionEntries = await TransactionEntry.find({ sourceId: payment._id });
                console.log(`   Transaction entries found: ${transactionEntries.length}`);
                
                await mongoose.disconnect();
                return;
            }
            
            await mongoose.disconnect();
        } catch (error) {
            console.log(`❌ Error checking ${uri}: ${error.message}`);
        }
    }
    
    console.log('❌ Payment not found in any database');
}

main().catch(console.error);
