/**
 * Find the missing admin fee transaction for Fadzai Mhizha
 */

const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Payment = require('../models/Payment');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

async function findMissingAdminTransaction() {
    try {
        console.log('🔍 Finding Missing Admin Fee Transaction\n');
        
        // Look for Fadzai Mhizha transactions
        const fadzaiTransactions = await TransactionEntry.find({
            description: { $regex: /admin/i },
            'entries.accountCode': '1000'
        }).populate('entries');
        
        console.log(`📊 Found ${fadzaiTransactions.length} admin fee transactions`);
        
        // Look for transactions with September dates that might have August payment dates
        const septemberTransactions = await TransactionEntry.find({
            date: { $gte: new Date('2025-09-01'), $lt: new Date('2025-10-01') },
            description: { $regex: /admin/i },
            'entries.accountCode': '1000'
        }).populate('entries');
        
        console.log(`📊 Found ${septemberTransactions.length} September admin fee transactions`);
        
        for (const entry of septemberTransactions) {
            console.log(`\n🔍 Transaction: ${entry.transactionId}`);
            console.log(`   Date: ${entry.date}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Reference: ${entry.reference}`);
            
            // Try to find the payment
            if (entry.reference) {
                try {
                    const payment = await Payment.findById(entry.reference);
                    if (payment) {
                        console.log(`   Payment Date: ${payment.date}`);
                        console.log(`   Payment ID: ${payment.paymentId}`);
                        
                        // Check if this should be in August
                        const paymentDate = new Date(payment.date);
                        if (paymentDate.getMonth() === 7) { // August (0-indexed)
                            console.log(`   ✅ This should be in August!`);
                        }
                    } else {
                        console.log(`   ❌ Payment not found`);
                    }
                } catch (error) {
                    console.log(`   ❌ Error finding payment: ${error.message}`);
                }
            }
        }
        
        // Also check for any transactions with "Fadzai" in the description
        const fadzaiTransactions2 = await TransactionEntry.find({
            description: { $regex: /fadzai/i }
        }).populate('entries');
        
        console.log(`\n📊 Found ${fadzaiTransactions2.length} transactions with "Fadzai" in description`);
        
        for (const entry of fadzaiTransactions2) {
            console.log(`\n🔍 Fadzai Transaction: ${entry.transactionId}`);
            console.log(`   Date: ${entry.date}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Reference: ${entry.reference}`);
        }
        
    } catch (error) {
        console.error('❌ Error finding missing transaction:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the search
findMissingAdminTransaction();


