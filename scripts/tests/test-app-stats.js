const mongoose = require('mongoose');
require('dotenv').config();

async function testApplicationStats() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Application = require('./src/models/Application');
        
        console.log('\n=== Testing Application Stats Logic ===');
        
        // Simulate the getApplicationStats function
        const filter = {};
        
        // Get total applications
        const totalApplications = await Application.countDocuments(filter);
        console.log('Total applications:', totalApplications);
        
        // Get applications by status
        const applicationsByStatus = await Application.aggregate([
            { $match: filter },
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        console.log('Applications by status:', applicationsByStatus);
        
        // Get applications by type
        const applicationsByType = await Application.aggregate([
            { $match: filter },
            { $group: { _id: '$requestType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        console.log('Applications by type:', applicationsByType);

        // Get applications by month (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        
        const applicationsByMonth = await Application.aggregate([
            { 
                $match: { 
                    ...filter,
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

        // Get recent applications (last 5) - without population
        const recentApplications = await Application.find(filter)
            .sort({ applicationDate: -1 })
            .limit(5)
            .lean();

        console.log('Recent applications found:', recentApplications.length);

        const formattedRecentApplications = recentApplications.map(app => ({
            id: app._id,
            studentName: app.firstName && app.lastName ? `${app.firstName} ${app.lastName}` : 'N/A',
            requestType: app.requestType,
            status: app.status,
            applicationDate: app.applicationDate ? app.applicationDate.toISOString().split('T')[0] : null
        }));

        console.log('Formatted recent applications:', formattedRecentApplications);

        const response = {
            totalApplications,
            applicationsByStatus,
            applicationsByType,
            applicationsByMonth,
            recentApplications: formattedRecentApplications
        };

        console.log('\n=== Final Response ===');
        console.log('Response structure:', {
            totalApplications: response.totalApplications,
            applicationsByStatusCount: response.applicationsByStatus.length,
            applicationsByTypeCount: response.applicationsByType.length,
            applicationsByMonthCount: response.applicationsByMonth.length,
            recentApplicationsCount: response.recentApplications.length
        });

        console.log('\n✅ Application stats test completed successfully!');
        console.log('The endpoint should now work correctly.');

    } catch (error) {
        console.error('❌ Error testing application stats:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

testApplicationStats(); 