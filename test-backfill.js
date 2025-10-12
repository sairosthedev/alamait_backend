#!/usr/bin/env node

/**
 * URGENT BACKFILL TEST SCRIPT
 * Run this to test backfill immediately - Job is at stake!
 */

const mongoose = require('mongoose');
const RentalAccrualService = require('./src/services/rentalAccrualService');

async function testBackfill() {
    try {
        console.log('🚨 URGENT BACKFILL TEST STARTING - Job is at stake!');
        
        // Connect to MongoDB - Use production connection
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://alamait:alamait123@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
        
        // Run backfill immediately
        console.log('🔥 Running URGENT backfill...');
        const result = await RentalAccrualService.backfillMissingAccruals();
        
        console.log('✅ URGENT BACKFILL COMPLETED:');
        console.log('   Created:', result.created);
        console.log('   Skipped:', result.skipped);
        console.log('   Errors:', result.errors?.length || 0);
        
        if (result.errors && result.errors.length > 0) {
            console.log('⚠️ Errors:', result.errors.slice(0, 5)); // Show first 5 errors
        }
        
        console.log('🎉 BACKFILL SUCCESSFUL - Job saved!');
        
    } catch (error) {
        console.error('❌ URGENT BACKFILL FAILED:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the test
testBackfill();
