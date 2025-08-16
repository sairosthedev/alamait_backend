require('dotenv').config();
const mongoose = require('mongoose');

async function checkStudentAccrualData() {
    try {
        // Connect to MongoDB Atlas
        const uri = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority`;
        
        console.log('🔌 Connecting to MongoDB Atlas...');
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB Atlas');
        
        // Get current month/year
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        console.log(`\n📅 Checking data for ${currentMonth}/${currentYear}`);
        console.log('=====================================');
        
        // Check total applications
        const totalApplications = await mongoose.connection.db
            .collection('applications')
            .countDocuments();
        console.log(`📊 Total applications: ${totalApplications}`);
        
        // Check applications by status
        const statusCounts = await mongoose.connection.db
            .collection('applications')
            .aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]).toArray();
        
        console.log('\n📋 Applications by status:');
        statusCounts.forEach(status => {
            console.log(`   ${status._id || 'No Status'}: ${status.count}`);
        });
        
        // Check applications with lease dates
        const withLeaseDates = await mongoose.connection.db
            .collection('applications')
            .countDocuments({
                leaseStartDate: { $exists: true, $ne: null },
                leaseEndDate: { $exists: true, $ne: null }
            });
        console.log(`\n📅 Applications with lease dates: ${withLeaseDates}`);
        
        // Check applications eligible for current month accrual
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 0);
        
        const eligibleForAccrual = await mongoose.connection.db
            .collection('applications')
            .find({
                status: 'approved',
                leaseStartDate: { $lte: endDate },
                leaseEndDate: { $gte: startDate },
                paymentStatus: { $ne: 'cancelled' }
            }).toArray();
        
        console.log(`\n✅ Eligible for ${currentMonth}/${currentYear} accrual: ${eligibleForAccrual.length}`);
        
        if (eligibleForAccrual.length > 0) {
            console.log('\n👥 Eligible students:');
            eligibleForAccrual.forEach((student, index) => {
                console.log(`   ${index + 1}. ${student.firstName} ${student.lastName}`);
                console.log(`      Residence: ${student.residence || 'N/A'}`);
                console.log(`      Room: ${student.room || 'N/A'}`);
                console.log(`      Lease: ${student.leaseStartDate?.toDateString()} to ${student.leaseEndDate?.toDateString()}`);
                console.log(`      Payment Status: ${student.paymentStatus || 'N/A'}`);
                console.log('');
            });
        }
        
        // Check payment status distribution
        const paymentStatusCounts = await mongoose.connection.db
            .collection('applications')
            .aggregate([
                { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]).toArray();
        
        console.log('\n💰 Payment status distribution:');
        paymentStatusCounts.forEach(status => {
            console.log(`   ${status._id || 'No Payment Status'}: ${status.count}`);
        });
        
        // Check for sample data structure
        if (eligibleForAccrual.length > 0) {
            const sample = eligibleForAccrual[0];
            console.log('\n🔍 Sample application structure:');
            console.log(JSON.stringify(sample, null, 2));
        }
        
        console.log('\n💡 Recommendations:');
        if (eligibleForAccrual.length === 0) {
            console.log('   ❌ No students eligible for accrual. Check:');
            console.log('      - Application status is "approved"');
            console.log('      - Lease dates are set and valid');
            console.log('      - Payment status is not "cancelled"');
        } else {
            console.log('   ✅ Students found for accrual!');
            console.log('   💡 You can now create monthly accruals.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Check if environment variables are set
if (!process.env.MONGODB_USERNAME || !process.env.MONGODB_PASSWORD) {
    console.log('❌ Please set MONGODB_USERNAME and MONGODB_PASSWORD environment variables');
    console.log('💡 Or create a .env file with your MongoDB Atlas credentials');
    process.exit(1);
}

checkStudentAccrualData();
