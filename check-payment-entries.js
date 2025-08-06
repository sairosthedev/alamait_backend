// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');

async function checkPaymentEntries() {
    try {
        console.log('🔍 CHECKING PAYMENT ENTRIES');
        console.log('===========================');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        
        console.log('✅ Connected to MongoDB\n');
        
        // Load models
        const Payment = require('./src/models/Payment');
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        // ========================================
        // GET PAYMENT DATA
        // ========================================
        console.log('📊 PAYMENT DATA');
        console.log('===============');
        
        const payments = await Payment.find({});
        let totalPaymentAmount = 0;
        payments.forEach(payment => {
            totalPaymentAmount += payment.totalAmount || payment.rentAmount || 0;
        });
        
        console.log(`Total Payments: ${payments.length}`);
        console.log(`Total Payment Amount: $${totalPaymentAmount.toFixed(2)}`);
        
        // ========================================
        // GET PAYMENT ENTRIES
        // ========================================
        console.log('\n\n💳 PAYMENT ENTRIES');
        console.log('==================');
        
        const paymentEntries = await TransactionEntry.find({ source: 'payment' });
        console.log(`Payment Entries: ${paymentEntries.length}`);
        
        // Group entries by description
        const entriesByDescription = {};
        paymentEntries.forEach(entry => {
            const description = entry.description || '';
            if (!entriesByDescription[description]) {
                entriesByDescription[description] = [];
            }
            entriesByDescription[description].push(entry);
        });
        
        // ========================================
        // IDENTIFY DUPLICATE ENTRIES
        // ========================================
        console.log('\n\n🔍 DUPLICATE PAYMENT ENTRIES');
        console.log('=============================');
        
        const duplicateEntries = Object.entries(entriesByDescription)
            .filter(([description, entries]) => entries.length > 1);
        
        console.log(`Duplicate Entry Groups: ${duplicateEntries.length}`);
        
        let entriesToDelete = [];
        
        duplicateEntries.forEach(([description, entries]) => {
            console.log(`\nDescription: ${description}`);
            console.log(`Entries: ${entries.length}`);
            
            // Keep the first entry, delete the rest
            const toKeep = entries[0];
            const toDelete = entries.slice(1);
            
            console.log(`Keeping: ${toKeep._id} (${toKeep.totalCredit})`);
            
            toDelete.forEach(entry => {
                console.log(`Deleting: ${entry._id} (${entry.totalCredit})`);
                entriesToDelete.push(entry._id);
            });
        });
        
        // ========================================
        // DELETE DUPLICATE ENTRIES
        // ========================================
        if (entriesToDelete.length > 0) {
            console.log('\n\n🗑️ DELETING DUPLICATE ENTRIES');
            console.log('==============================');
            
            console.log(`Entries to delete: ${entriesToDelete.length}`);
            
            const result = await TransactionEntry.deleteMany({
                _id: { $in: entriesToDelete }
            });
            
            console.log(`Deleted ${result.deletedCount} duplicate entries`);
        } else {
            console.log('\n\n✅ No duplicate entries found');
        }
        
        // ========================================
        // VERIFY CLEANUP
        // ========================================
        console.log('\n\n✅ VERIFYING CLEANUP');
        console.log('====================');
        
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
            console.log('✅ Payment entries are now balanced!');
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
        console.error('❌ Check failed:', error.message);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
}

// Run the check
checkPaymentEntries(); 