#!/usr/bin/env node

/**
 * CREATE TEST APPLICATION SCRIPT
 * Create a test application to prove backfill works
 */

const mongoose = require('mongoose');

async function createTestApplication() {
    try {
        console.log('🧪 CREATING TEST APPLICATION - Proving backfill works!');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        
        // Create a test application
        const testApp = {
            firstName: 'Test',
            lastName: 'Student',
            email: 'test@example.com',
            phone: '1234567890',
            status: 'approved',
            paymentStatus: 'pending',
            startDate: new Date('2025-09-01'), // Started in September
            endDate: new Date('2025-12-31'),   // Ends in December
            allocatedRoom: 'Room 101',
            residence: new mongoose.Types.ObjectId(), // Dummy residence ID
            applicationCode: 'TEST-001',
            student: new mongoose.Types.ObjectId(), // Dummy student ID
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await mongoose.connection.db
            .collection('applications')
            .insertOne(testApp);
        
        console.log(`✅ Test application created: ${result.insertedId}`);
        console.log(`   Name: ${testApp.firstName} ${testApp.lastName}`);
        console.log(`   Status: ${testApp.status}`);
        console.log(`   Lease: ${testApp.startDate.toLocaleDateString()} to ${testApp.endDate.toLocaleDateString()}`);
        
        console.log('\n🎉 NOW RUN BACKFILL - IT WILL WORK!');
        console.log('   The backfill will create accruals for October 2025');
        
    } catch (error) {
        console.error('❌ CREATE TEST APP FAILED:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run the test
createTestApplication();
