require('dotenv').config();
const mongoose = require('mongoose');

async function cleanRestorePayments() {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n🧹 Cleaning and Restoring Original Payments...');
        console.log('==============================================');
        
        // Drop the entire payments collection to start fresh
        console.log('\n🗑️  Dropping payments collection...');
        await mongoose.connection.db.dropCollection('payments');
        console.log('   ✅ Payments collection dropped');
        
        // Recreate the payments collection
        console.log('\n🆕 Recreating payments collection...');
        await mongoose.connection.db.createCollection('payments');
        console.log('   ✅ Payments collection recreated');
        
        // Restore your original 3 payments
        console.log('\n💰 Restoring Original Payments...');
        const originalPayments = [
            {
                student: new mongoose.Types.ObjectId('688a965155fe1a1fd35411c0'),
                amount: undefined,
                date: new Date('2025-06-06T00:00:00.000Z'),
                type: 'Not specified',
                status: 'Pending'
            },
            {
                student: new mongoose.Types.ObjectId('689399b6beb18032feaddfbf'),
                amount: undefined,
                date: new Date('2025-06-06T00:00:00.000Z'),
                type: 'Not specified',
                status: 'Pending'
            },
            {
                student: new mongoose.Types.ObjectId('689399b6beb18032feaddfbf'),
                amount: undefined,
                date: new Date('2025-07-27T00:00:00.000Z'),
                type: 'Not specified',
                status: 'Pending'
            }
        ];
        
        const insertResult = await mongoose.connection.db
            .collection('payments')
            .insertMany(originalPayments);
        
        console.log(`   ✅ Restored ${insertResult.insertedCount} original payments`);
        
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
        console.log('   - Clean collection without duplicate key issues');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🧹 Starting Clean Payments Restoration...');
cleanRestorePayments();
