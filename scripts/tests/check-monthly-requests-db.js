const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://cluster0.ulvve.mongodb.net/test';

async function checkMonthlyRequests() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get the MonthlyRequest model
        const MonthlyRequest = require('./src/models/MonthlyRequest');

        // Check total count
        const totalCount = await MonthlyRequest.countDocuments();
        console.log(`📊 Total monthly requests in database: ${totalCount}`);

        if (totalCount > 0) {
            // Get a few sample requests
            const sampleRequests = await MonthlyRequest.find().limit(5).lean();
            console.log('\n📋 Sample monthly requests:');
            sampleRequests.forEach((request, index) => {
                console.log(`${index + 1}. ID: ${request._id}`);
                console.log(`   Title: ${request.title}`);
                console.log(`   Residence: ${request.residence}`);
                console.log(`   Month/Year: ${request.month}/${request.year}`);
                console.log(`   Status: ${request.status}`);
                console.log(`   Items count: ${request.items?.length || 0}`);
                console.log(`   Is Template: ${request.isTemplate}`);
                console.log('---');
            });
        } else {
            console.log('❌ No monthly requests found in database');
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

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

checkMonthlyRequests(); 