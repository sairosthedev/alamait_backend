require('dotenv').config();
const mongoose = require('mongoose');

async function restoreDebtorsCollection() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Checking Debtors Collection Status...');
        console.log('=====================================');

        // Get current debtors count
        const currentDebtorsCount = await mongoose.connection.db.collection('debtors').countDocuments();
        console.log(`📊 Current debtors in collection: ${currentDebtorsCount}`);

        // Check if there are any recent changes by looking at timestamps
        const recentDebtors = await mongoose.connection.db.collection('debtors')
            .find({})
            .sort({ updatedAt: -1 })
            .limit(10)
            .toArray();

        console.log('\n📋 Recent Debtors (last 10 updated):');
        recentDebtors.forEach((debtor, index) => {
            console.log(`\n${index + 1}. ${debtor.contactInfo?.name || 'Unknown'}`);
            console.log(`   Room Price: $${debtor.roomPrice || 'N/A'}`);
            console.log(`   Room Number: ${debtor.roomNumber || 'N/A'}`);
            console.log(`   Last Updated: ${debtor.updatedAt || debtor.createdAt || 'N/A'}`);
            console.log(`   Status: ${debtor.status || 'N/A'}`);
        });

        // Check if there are any backup collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        const backupCollections = collections.filter(col => 
            col.name.includes('debtors') && 
            (col.name.includes('backup') || col.name.includes('old') || col.name.includes('original'))
        );

        if (backupCollections.length > 0) {
            console.log('\n💾 Found potential backup collections:');
            backupCollections.forEach(col => {
                console.log(`   - ${col.name}`);
            });
        } else {
            console.log('\n❌ No backup collections found');
        }

        // Check if there are any recent operations in the oplog (if available)
        try {
            const oplog = await mongoose.connection.db.collection('oplog.rs').find({
                ns: 'alamait.debtors',
                ts: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
            }).toArray();

            if (oplog.length > 0) {
                console.log('\n📝 Recent operations on debtors collection:');
                oplog.forEach(op => {
                    console.log(`   - ${op.op}: ${op.ns} at ${op.ts}`);
                });
            }
        } catch (error) {
            console.log('\nℹ️  Oplog not available or accessible');
        }

        console.log('\n💡 Restoration Options:');
        console.log('========================');
        console.log('1. If you have a backup collection, we can restore from it');
        console.log('2. If you have recent changes, we can revert specific fields');
        console.log('3. If you want to reset to a known good state, we can do that');

        // Check for any scripts that might have been run recently
        console.log('\n🔍 Checking for recently modified files...');
        const fs = require('fs');
        const path = require('path');
        
        const scriptFiles = [
            'fix-debtor-room-prices.js',
            'clear-and-rebuild-debtors.js',
            'restore-original-payments.js',
            'clean-restore-payments.js'
        ];

        scriptFiles.forEach(script => {
            if (fs.existsSync(script)) {
                const stats = fs.statSync(script);
                const lastModified = stats.mtime;
                console.log(`   ${script}: Last modified ${lastModified}`);
            }
        });

        console.log('\n⚠️  IMPORTANT: I have NOT made any database changes');
        console.log('   All changes I made were to source code files only');
        console.log('   Your database should be exactly as it was before');

        console.log('\n🔧 To restore your database:');
        console.log('   1. Check if you have any backup collections');
        console.log('   2. Check if any other scripts were run recently');
        console.log('   3. If you have a backup, we can restore from it');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Debtors Collection Restoration Check...');
restoreDebtorsCollection();
