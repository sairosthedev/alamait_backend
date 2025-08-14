const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fixWaterRequestFinal() {
    console.log('🔧 Fixing Water Request - Final Fix');
    console.log('===================================');

    if (!process.env.MONGODB_URI) {
        console.log('❌ MONGODB_URI not found in environment variables');
        return;
    }

    try {
        console.log('🔌 Connecting to MongoDB...');
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();
        const maintenanceCollection = db.collection('maintenance');

        console.log('\n🔍 Finding water request...');
        const waterRequest = await maintenanceCollection.findOne({
            _id: '689c637bb3119d308cdb5172'
        });

        if (!waterRequest) {
            console.log('❌ Water request not found');
            await client.close();
            return;
        }

        console.log('✅ Found water request:', {
            id: waterRequest._id,
            title: waterRequest.title,
            status: waterRequest.status,
            financeStatus: waterRequest.financeStatus,
            convertedToExpense: waterRequest.convertedToExpense
        });

        console.log('\n🔧 Fixing request status and expense conversion...');
        const updateResult = await maintenanceCollection.updateOne(
            { _id: waterRequest._id },
            {
                $set: {
                    'status': 'approved',
                    'convertedToExpense': true,
                    'updatedAt': new Date()
                }
            }
        );

        if (updateResult.modifiedCount > 0) {
            console.log('✅ Water request fixed successfully');
            const updatedRequest = await maintenanceCollection.findOne({ _id: waterRequest._id });
            console.log('\n📊 Updated request status:');
            console.log('  - status:', updatedRequest.status);
            console.log('  - financeStatus:', updatedRequest.financeStatus);
            console.log('  - convertedToExpense:', updatedRequest.convertedToExpense);
            console.log('  - updatedAt:', updatedRequest.updatedAt);

            const isFixed =
                updatedRequest.status === 'approved' &&
                updatedRequest.financeStatus === 'approved' &&
                updatedRequest.convertedToExpense === true;

            if (isFixed) {
                console.log('\n🎉 SUCCESS: Water request status fixed!');
                console.log('   - Status: approved ✅');
                console.log('   - Finance Status: approved ✅');
                console.log('   - Converted To Expense: true ✅');
            } else {
                console.log('\n❌ FAILURE: Some fields not fixed correctly');
            }

        } else {
            console.log('❌ Failed to fix water request status');
        }

        await client.close();
        console.log('\n✅ Fix completed');

    } catch (error) {
        console.error('❌ Fix failed:', error);
    }
}

fixWaterRequestFinal();

