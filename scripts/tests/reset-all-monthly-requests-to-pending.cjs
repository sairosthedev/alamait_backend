const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');
require('./src/models/Residence');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function resetAllMonthlyRequestsToPending() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔍 Finding all monthly requests...');
        const allRequests = await MonthlyRequest.find({}).populate('residence', 'name');
        
        console.log(`📋 Found ${allRequests.length} total monthly requests`);
        
        if (allRequests.length === 0) {
            console.log('❌ No monthly requests found in database');
            return;
        }

        console.log('\n📊 Current status breakdown:');
        const statusCount = {};
        allRequests.forEach(request => {
            statusCount[request.status] = (statusCount[request.status] || 0) + 1;
        });
        
        Object.entries(statusCount).forEach(([status, count]) => {
            console.log(`   ${status}: ${count}`);
        });

        console.log('\n🔄 Resetting all monthly requests to pending...');
        
        const updateResult = await MonthlyRequest.updateMany(
            {}, // Update all documents
            { 
                status: 'pending',
                $push: {
                    requestHistory: {
                        date: new Date(),
                        action: 'Reset to pending for proper approval',
                        user: null,
                        changes: ['Status reset to pending for proper expense conversion']
                    }
                }
            }
        );

        console.log(`✅ Updated ${updateResult.modifiedCount} monthly requests to pending`);

        // Verify the changes
        console.log('\n🔍 Verifying changes...');
        const updatedRequests = await MonthlyRequest.find({}).populate('residence', 'name');
        
        console.log('\n📊 New status breakdown:');
        const newStatusCount = {};
        updatedRequests.forEach(request => {
            newStatusCount[request.status] = (newStatusCount[request.status] || 0) + 1;
        });
        
        Object.entries(newStatusCount).forEach(([status, count]) => {
            console.log(`   ${status}: ${count}`);
        });

        console.log('\n📋 Updated requests:');
        updatedRequests.forEach((request, index) => {
            console.log(`   ${index + 1}. ${request.title} - Status: ${request.status} - Residence: ${request.residence ? request.residence.name : 'N/A'}`);
        });

        console.log('\n✅ All monthly requests have been reset to pending status');
        console.log('🎯 You can now approve them through the frontend to test the expense conversion');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
resetAllMonthlyRequestsToPending(); 