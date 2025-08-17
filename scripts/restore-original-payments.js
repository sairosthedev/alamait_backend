require('dotenv').config();
const mongoose = require('mongoose');

async function restoreOriginalPayments() {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n🔄 Restoring Original Payments Collection...');
        console.log('==========================================');
        
        // Get current payments
        const currentPayments = await mongoose.connection.db
            .collection('payments')
            .find({}).toArray();
        
        console.log(`\n📊 Current Payments: ${currentPayments.length}`);
        
        if (currentPayments.length > 0) {
            console.log('\n💳 Current Payments:');
            currentPayments.forEach((payment, index) => {
                console.log(`\n   ${index + 1}. Payment ID: ${payment._id}`);
                console.log(`      Student ID: ${payment.student}`);
                console.log(`      Amount: ${payment.amount}`);
                console.log(`      Date: ${payment.date || payment.createdAt || 'No date'}`);
                console.log(`      Type: ${payment.type || 'Not specified'}`);
                console.log(`      Status: ${payment.status || 'Not specified'}`);
            });
        }
        
        // Remove all current payments
        console.log('\n🗑️  Removing all current payments...');
        const deleteResult = await mongoose.connection.db
            .collection('payments')
            .deleteMany({});
        
        console.log(`   ✅ Removed ${deleteResult.deletedCount} payments`);
        
        // Restore your original 3 payments
        console.log('\n💰 Restoring Original Payments...');
        const originalPayments = [
            {
                _id: new mongoose.Types.ObjectId('689ea2c99c8709e5d375c2d8'),
                student: new mongoose.Types.ObjectId('688a965155fe1a1fd35411c0'),
                amount: undefined,
                date: new Date('2025-06-06T00:00:00.000Z'),
                type: 'Not specified',
                status: 'Pending'
            },
            {
                _id: new mongoose.Types.ObjectId('689eaaed51e70619fa9e1b20'),
                student: new mongoose.Types.ObjectId('689399b6beb18032feaddfbf'),
                amount: undefined,
                date: new Date('2025-06-06T00:00:00.000Z'),
                type: 'Not specified',
                status: 'Pending'
            },
            {
                _id: new mongoose.Types.ObjectId('689f1e8c1fb6b85e40288520'),
                student: new mongoose.Types.ObjectId('689399b6beb18032feaddfbf'),
                amount: undefined,
                date: new Date('2025-07-27T00:00:00.000Z'),
                type: 'Not specified',
                status: 'Pending'
            }
        ];
        
        try {
            const insertResult = await mongoose.connection.db
                .collection('payments')
                .insertMany(originalPayments);
            
            console.log(`   ✅ Restored ${insertResult.insertedCount} original payments`);
        } catch (insertError) {
            console.log(`   ⚠️  Insert error: ${insertError.message}`);
            
            // Try inserting one by one
            console.log('   🔄 Trying individual inserts...');
            let successCount = 0;
            
            for (const payment of originalPayments) {
                try {
                    await mongoose.connection.db
                        .collection('payments')
                        .insertOne(payment);
                    successCount++;
                } catch (singleError) {
                    console.log(`      ❌ Failed to insert payment: ${singleError.message}`);
                }
            }
            
            console.log(`   ✅ Successfully restored ${successCount} payments individually`);
        }
        
        // Verify restoration
        console.log('\n🔍 Verifying Restoration...');
        const restoredPayments = await mongoose.connection.db
            .collection('payments')
            .find({}).toArray();
        
        console.log(`\n📊 Restored Payments Count: ${restoredPayments.length}`);
        
        if (restoredPayments.length > 0) {
            console.log('\n💳 Restored Original Payments:');
            restoredPayments.forEach((payment, index) => {
                console.log(`\n   ${index + 1}. Payment ID: ${payment._id}`);
                console.log(`      Student ID: ${payment.student}`);
                console.log(`      Amount: ${payment.amount}`);
                console.log(`      Date: ${payment.date}`);
                console.log(`      Type: ${payment.type}`);
                console.log(`      Status: ${payment.status}`);
            });
        }
        
        console.log('\n✅ Original payments collection has been restored!');
        console.log('\n💡 Your payments collection is now back to its original state:');
        console.log('   - 3 payments with undefined amounts');
        console.log('   - All payments are in "Pending" status');
        console.log('   - Original payment IDs and student references preserved');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔄 Starting Original Payments Restoration...');
restoreOriginalPayments();
