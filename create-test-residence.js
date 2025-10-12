#!/usr/bin/env node

/**
 * CREATE TEST RESIDENCE SCRIPT
 * Create a test residence to make backfill work completely
 */

const mongoose = require('mongoose');

async function createTestResidence() {
    try {
        console.log('🏠 CREATING TEST RESIDENCE - Making backfill work!');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        
        // Create a test residence
        const testResidence = {
            name: 'Test Residence',
            address: '123 Test Street',
            city: 'Test City',
            rooms: [
                {
                    roomNumber: 'Room 101',
                    type: 'Single',
                    price: 500,
                    status: 'available'
                }
            ],
            paymentConfiguration: {
                adminFee: {
                    enabled: true,
                    calculation: 'fixed',
                    amount: 50
                },
                deposit: {
                    enabled: true,
                    calculation: 'one_month_rent'
                },
                rentProration: {
                    enabled: true,
                    policy: 'daily_calculation',
                    dailyRateMethod: 'monthly_rent_calendar_days'
                }
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await mongoose.connection.db
            .collection('residences')
            .insertOne(testResidence);
        
        console.log(`✅ Test residence created: ${result.insertedId}`);
        console.log(`   Name: ${testResidence.name}`);
        console.log(`   Room: ${testResidence.rooms[0].roomNumber} - $${testResidence.rooms[0].price}`);
        
        // Update the test application to use this residence
        await mongoose.connection.db
            .collection('applications')
            .updateOne(
                { applicationCode: 'TEST-001' },
                { $set: { residence: result.insertedId } }
            );
        
        console.log('✅ Updated test application to use test residence');
        
        console.log('\n🎉 NOW BACKFILL WILL WORK COMPLETELY!');
        console.log('   The backfill will create accruals for October 2025');
        
    } catch (error) {
        console.error('❌ CREATE TEST RESIDENCE FAILED:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run the test
createTestResidence();
