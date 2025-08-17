const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkMaintenanceCollection() {
    console.log('🔍 Checking Maintenance Collection');
    console.log('=================================');

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

        const totalMaintenance = await maintenanceCollection.countDocuments();
        console.log(`\n📊 Total documents in 'maintenance' collection: ${totalMaintenance}`);

        if (totalMaintenance > 0) {
            console.log('\n📝 Sample maintenance documents:');
            const sampleDocs = await maintenanceCollection.find({}).limit(5).toArray();
            
            sampleDocs.forEach((doc, index) => {
                console.log(`\n  ${index + 1}. Document ID: ${doc._id}`);
                console.log(`     Title: ${doc.title || 'No title'}`);
                console.log(`     Description: ${doc.description || 'No description'}`);
                console.log(`     Status: ${doc.status || 'No status'}`);
                console.log(`     Finance Status: ${doc.financeStatus || 'No finance status'}`);
                console.log(`     Converted To Expense: ${doc.convertedToExpense || 'No convertedToExpense'}`);
                console.log(`     Type: ${doc.type || 'No type'}`);
                console.log(`     Created At: ${doc.createdAt || 'No createdAt'}`);
                console.log(`     Updated At: ${doc.updatedAt || 'No updatedAt'}`);
                
                // Check for approval structure
                if (doc.approval) {
                    console.log(`     Approval: ${JSON.stringify(doc.approval, null, 2)}`);
                }
                
                // Check for items
                if (doc.items && doc.items.length > 0) {
                    console.log(`     Items: ${doc.items.length} items`);
                    doc.items.forEach((item, itemIndex) => {
                        console.log(`       Item ${itemIndex + 1}: ${item.description} - Cost: ${item.totalCost || item.unitCost}`);
                    });
                }
            });

            // Check for water-related maintenance
            const waterMaintenance = await maintenanceCollection.find({
                $or: [
                    { title: { $regex: /water/i } },
                    { description: { $regex: /water/i } }
                ]
            }).toArray();

            if (waterMaintenance.length > 0) {
                console.log(`\n💧 Found ${waterMaintenance.length} water-related maintenance requests:`);
                waterMaintenance.forEach((doc, index) => {
                    console.log(`  ${index + 1}. ID: ${doc._id}`);
                    console.log(`     Title: ${doc.title}`);
                    console.log(`     Status: ${doc.status}`);
                    console.log(`     Finance Status: ${doc.financeStatus}`);
                    console.log(`     Converted: ${doc.convertedToExpense}`);
                });
            }

            // Check for pending maintenance that needs finance approval
            const pendingFinance = await maintenanceCollection.find({
                'financeStatus': 'pending'
            }).toArray();

            console.log(`\n⏳ Maintenance requests pending finance approval: ${pendingFinance.length}`);

            // Check for approved but not converted maintenance
            const approvedNotConverted = await maintenanceCollection.find({
                'financeStatus': 'approved',
                'convertedToExpense': false
            }).toArray();

            console.log(`\n⚠️  Maintenance requests approved by finance but not converted to expense: ${approvedNotConverted.length}`);

        } else {
            console.log('❌ No documents found in maintenance collection');
        }

        await client.close();
        console.log('\n✅ Maintenance collection check completed');

    } catch (error) {
        console.error('❌ Maintenance collection check failed:', error);
    }
}

checkMaintenanceCollection();

