const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkPaymentDataLocation() {
    try {
        console.log('🔍 Searching for Payment Data in All Collections...\n');
        
        const db = mongoose.connection.db;
        
        // Get all collection names
        const collections = await db.listCollections().toArray();
        
        // Search for payment-like data in each collection
        for (const collection of collections) {
            const collectionName = collection.name;
            console.log(`\n🔍 Searching in: ${collectionName}`);
            
            try {
                // Look for documents with payment-like fields
                const paymentLikeDocs = await db.collection(collectionName).find({
                    $or: [
                        { paymentId: { $exists: true } },
                        { amount: { $exists: true } },
                        { totalAmount: { $exists: true } },
                        { method: { $exists: true } },
                        { status: { $exists: true } },
                        { paymentMonth: { $exists: true } }
                    ]
                }).limit(3).toArray();
                
                if (paymentLikeDocs.length > 0) {
                    console.log(`  ✅ Found ${paymentLikeDocs.length} payment-like documents`);
                    
                    paymentLikeDocs.forEach((doc, i) => {
                        console.log(`\n    Document ${i + 1}:`);
                        console.log(`      _id: ${doc._id}`);
                        
                        // Show payment-related fields
                        if (doc.paymentId) console.log(`      paymentId: ${doc.paymentId}`);
                        if (doc.amount) console.log(`      amount: ${doc.amount}`);
                        if (doc.totalAmount) console.log(`      totalAmount: ${doc.totalAmount}`);
                        if (doc.method) console.log(`      method: ${doc.method}`);
                        if (doc.status) console.log(`      status: ${doc.status}`);
                        if (doc.paymentMonth) console.log(`      paymentMonth: ${doc.paymentMonth}`);
                        if (doc.date) console.log(`      date: ${doc.date}`);
                        if (doc.residence) console.log(`      residence: ${doc.residence}`);
                        
                        // Show all fields for debugging
                        console.log(`      All fields: ${Object.keys(doc).join(', ')}`);
                    });
                } else {
                    console.log(`  ❌ No payment-like documents found`);
                }
                
            } catch (error) {
                console.log(`  ⚠️ Error searching collection: ${error.message}`);
            }
        }
        
        // Also check if there are any collections with similar names
        console.log('\n🔍 Checking for similar collection names...');
        const similarNames = collections.filter(col => 
            col.name.toLowerCase().includes('payment') || 
            col.name.toLowerCase().includes('pay') ||
            col.name.toLowerCase().includes('transaction')
        );
        
        if (similarNames.length > 0) {
            console.log('  Found similar collections:');
            similarNames.forEach(col => console.log(`    - ${col.name}`));
        }
        
    } catch (error) {
        console.error('❌ Error searching for payment data:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Wait for connection then run
mongoose.connection.once('open', () => {
    checkPaymentDataLocation();
});
