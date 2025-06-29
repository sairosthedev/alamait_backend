const mongoose = require('mongoose');
require('dotenv').config();

async function testApplications() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Application = require('./src/models/Application');
        
        console.log('\n=== Testing Applications ===');
        
        // Check total applications
        const totalApplications = await Application.countDocuments();
        console.log(`Total applications in database: ${totalApplications}`);
        
        if (totalApplications === 0) {
            console.log('❌ No applications found in database');
            console.log('This is why the stats endpoint returns no data');
            return;
        }
        
        // Get sample applications
        const sampleApplications = await Application.find().limit(3).lean();
        console.log('\nSample applications:');
        sampleApplications.forEach((app, index) => {
            console.log(`  Application ${index + 1}:`);
            console.log(`    ID: ${app._id}`);
            console.log(`    Status: ${app.status}`);
            console.log(`    Request Type: ${app.requestType}`);
            console.log(`    Application Date: ${app.applicationDate}`);
            console.log(`    Email: ${app.email}`);
        });
        
        // Test the stats aggregation
        console.log('\n=== Testing Stats Aggregation ===');
        
        // Test applications by status
        const applicationsByStatus = await Application.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        console.log('Applications by status:', applicationsByStatus);
        
        // Test applications by type
        const applicationsByType = await Application.aggregate([
            { $group: { _id: '$requestType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        console.log('Applications by type:', applicationsByType);
        
        // Test applications by month (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        
        const applicationsByMonth = await Application.aggregate([
            { 
                $match: { 
                    applicationDate: { $gte: twelveMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$applicationDate' },
                        month: { $month: '$applicationDate' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        console.log('Applications by month:', applicationsByMonth);
        
        // Test recent applications
        const recentApplications = await Application.find()
            .sort({ applicationDate: -1 })
            .limit(5)
            .populate('student', 'firstName lastName')
            .lean();
        
        console.log('Recent applications found:', recentApplications.length);
        
        console.log('\n✅ Applications test completed successfully!');

    } catch (error) {
        console.error('❌ Error testing applications:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

testApplications(); 