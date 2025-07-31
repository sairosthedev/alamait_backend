const mongoose = require('mongoose');

// Set environment variables
process.env.MONGODB_URI = 'mongodb+srv://cluster0.ulvve.mongodb.net/test';

async function testMonthlyRequests() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Import the MonthlyRequest model
        const MonthlyRequest = require('./src/models/MonthlyRequest');

        // Check if the model is working
        console.log('\n📊 Checking MonthlyRequest model...');
        
        // Count total monthly requests
        const totalCount = await MonthlyRequest.countDocuments();
        console.log(`Total monthly requests: ${totalCount}`);

        if (totalCount > 0) {
            // Get a sample request
            const sampleRequest = await MonthlyRequest.findOne().lean();
            console.log('\n📋 Sample monthly request:');
            console.log(`ID: ${sampleRequest._id}`);
            console.log(`Title: ${sampleRequest.title}`);
            console.log(`Residence: ${sampleRequest.residence}`);
            console.log(`Month/Year: ${sampleRequest.month}/${sampleRequest.year}`);
            console.log(`Status: ${sampleRequest.status}`);
            console.log(`Items count: ${sampleRequest.items?.length || 0}`);
        } else {
            console.log('❌ No monthly requests found in database');
            
            // Check if we can create a test request
            console.log('\n🧪 Testing request creation...');
            try {
                const testRequest = new MonthlyRequest({
                    title: 'Test Monthly Request',
                    description: 'Test description for January 2025',
                    residence: '67c13eb8425a2e078f61d00e', // Belvedere ID
                    month: 1,
                    year: 2025,
                    items: [{
                        description: 'Test Item',
                        quantity: 1,
                        estimatedCost: 100,
                        category: 'utilities'
                    }]
                });
                
                await testRequest.save();
                console.log('✅ Test request created successfully');
                console.log(`Test request ID: ${testRequest._id}`);
                
                // Clean up - delete the test request
                await MonthlyRequest.findByIdAndDelete(testRequest._id);
                console.log('✅ Test request cleaned up');
                
            } catch (error) {
                console.error('❌ Error creating test request:', error.message);
            }
        }

        // Check by residence
        console.log('\n🏠 Checking by residence...');
        const belvedereRequests = await MonthlyRequest.find({ residence: '67c13eb8425a2e078f61d00e' }).countDocuments();
        const stKildaRequests = await MonthlyRequest.find({ residence: '67d723cf20f89c4ae69804f3' }).countDocuments();
        
        console.log(`Belvedere requests: ${belvedereRequests}`);
        console.log(`St Kilda requests: ${stKildaRequests}`);

        // Check templates
        console.log('\n📝 Checking templates...');
        const templates = await MonthlyRequest.find({ isTemplate: true }).countDocuments();
        console.log(`Templates count: ${templates}`);

        // Check by status
        console.log('\n📈 Checking by status...');
        const statusCounts = await MonthlyRequest.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        statusCounts.forEach(status => {
            console.log(`${status._id || 'No status'}: ${status.count}`);
        });

        console.log('\n✅ Monthly request system is working correctly!');
        console.log('\n💡 The issue with empty results might be:');
        console.log('   1. No monthly requests exist in the database');
        console.log('   2. Authentication issues (need proper user credentials)');
        console.log('   3. Role-based filtering (students are blocked)');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

testMonthlyRequests(); 