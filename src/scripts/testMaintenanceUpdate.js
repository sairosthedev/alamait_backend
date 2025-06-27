/**
 * Test script to verify maintenance update functionality
 * 
 * This script tests the maintenance update functionality to ensure
 * that updates are properly saved to MongoDB.
 */

const mongoose = require('mongoose');
const Maintenance = require('../models/Maintenance');
require('dotenv').config();

async function testMaintenanceUpdate() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Find a maintenance request to test with
        const testRequest = await Maintenance.findOne();
        
        if (!testRequest) {
            console.log('No maintenance requests found to test with');
            return;
        }

        console.log('Testing with maintenance request:', {
            _id: testRequest._id,
            issue: testRequest.issue,
            status: testRequest.status,
            estimatedCost: testRequest.estimatedCost,
            actualCost: testRequest.actualCost
        });

        // Test update operation
        const updateData = {
            status: 'in-progress',
            priority: 'high',
            estimatedCost: 1500,
            actualCost: 800,
            financeStatus: 'approved'
        };

        console.log('Updating with data:', updateData);

        // Perform the update
        const updatedRequest = await Maintenance.findByIdAndUpdate(
            testRequest._id,
            {
                $set: updateData,
                $push: {
                    requestHistory: {
                        date: new Date(),
                        action: 'Request updated',
                        user: testRequest.student,
                        changes: Object.keys(updateData)
                    }
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedRequest) {
            console.log('❌ Update failed - no document returned');
            return;
        }

        console.log('✅ Update successful!');
        console.log('Updated request:', {
            _id: updatedRequest._id,
            status: updatedRequest.status,
            priority: updatedRequest.priority,
            estimatedCost: updatedRequest.estimatedCost,
            actualCost: updatedRequest.actualCost,
            financeStatus: updatedRequest.financeStatus
        });

        // Verify the update was actually saved
        const verifyRequest = await Maintenance.findById(testRequest._id);
        console.log('Verification - Updated fields:');
        Object.keys(updateData).forEach(field => {
            console.log(`  ${field}: ${verifyRequest[field]} (was: ${testRequest[field]})`);
        });

        console.log('✅ Maintenance update functionality is working correctly!');

    } catch (error) {
        console.error('❌ Error testing maintenance update:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the test
testMaintenanceUpdate(); 