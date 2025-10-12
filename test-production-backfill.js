#!/usr/bin/env node

/**
 * PRODUCTION BACKFILL TEST SCRIPT
 * Test backfill with your real production data
 */

const mongoose = require('mongoose');
const RentalAccrualService = require('./src/services/rentalAccrualService');

async function testProductionBackfill() {
    try {
        console.log('🚨 PRODUCTION BACKFILL TEST - Job is at stake!');
        
        // You need to set your MongoDB URI
        const mongoUri = process.env.MONGODB_URI;
        
        if (!mongoUri) {
            console.log('❌ Please set MONGODB_URI environment variable');
            console.log('   Example: MONGODB_URI="mongodb+srv://user:pass@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0" node test-production-backfill.js');
            process.exit(1);
        }
        
        // Connect to MongoDB
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to Production MongoDB');
        
        // Check applications first
        const applications = await mongoose.connection.db
            .collection('applications')
            .find({ status: 'approved', paymentStatus: { $ne: 'cancelled' } })
            .toArray();
        
        console.log(`\n📊 Found ${applications.length} approved applications:`);
        applications.forEach((app, index) => {
            console.log(`   ${index + 1}. ${app.firstName} ${app.lastName} - ${app.allocatedRoom}`);
            console.log(`      Lease: ${new Date(app.startDate).toLocaleDateString()} to ${new Date(app.endDate).toLocaleDateString()}`);
            console.log(`      Residence: ${app.residence}`);
        });
        
        // Run backfill immediately
        console.log('\n🔥 Running URGENT backfill on PRODUCTION data...');
        const result = await RentalAccrualService.backfillMissingAccruals();
        
        console.log('\n✅ PRODUCTION BACKFILL COMPLETED:');
        console.log('   Created:', result.created);
        console.log('   Skipped:', result.skipped);
        console.log('   Errors:', result.errors?.length || 0);
        
        if (result.errors && result.errors.length > 0) {
            console.log('\n⚠️ Errors:', result.errors.slice(0, 5)); // Show first 5 errors
        }
        
        if (result.created > 0) {
            console.log('\n🎉 SUCCESS! BACKFILL CREATED ACCRUALS - YOUR JOB IS SAVED!');
        } else {
            console.log('\n⚠️ No accruals created - check the errors above');
        }
        
    } catch (error) {
        console.error('❌ PRODUCTION BACKFILL FAILED:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run the test
testProductionBackfill();
