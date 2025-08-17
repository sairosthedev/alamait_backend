require('dotenv').config();
const mongoose = require('mongoose');

async function checkAccrualData() {
    try {
        // Use the same connection method as your server
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            console.log('💡 Your server is running, so it must have access to MongoDB');
            console.log('💡 Let me check what collections exist in your database...');
            
            // Try to connect using the same method as your server
            const uri = 'mongodb+srv://cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority';
            console.log('🔌 Attempting to connect to MongoDB...');
            
            // This will likely fail without credentials, but let's see the error
            try {
                await mongoose.connect(uri);
                console.log('✅ Connected to MongoDB');
            } catch (connError) {
                console.log('❌ Connection failed:', connError.message);
                console.log('\n💡 To check your accrual data, you need to:');
                console.log('   1. Set MONGODB_URI in your environment variables, or');
                console.log('   2. Create a .env file with your MongoDB connection string');
                return;
            }
        } else {
            console.log('🔌 Connecting to MongoDB using MONGODB_URI...');
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✅ Connected to MongoDB');
        }
        
        // Check what collections exist
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\n📚 Available collections:');
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });
        
        // Check applications collection specifically
        if (collections.find(col => col.name === 'applications')) {
            console.log('\n📋 Checking applications collection...');
            
            const totalApplications = await mongoose.connection.db
                .collection('applications')
                .countDocuments();
            console.log(`   Total applications: ${totalApplications}`);
            
            if (totalApplications > 0) {
                // Get a sample application to see the structure
                const sample = await mongoose.connection.db
                    .collection('applications')
                    .findOne();
                
                console.log('\n🔍 Sample application structure:');
                console.log('   Fields:', Object.keys(sample));
                console.log('   Status:', sample.status);
                console.log('   Has lease dates:', !!(sample.leaseStartDate && sample.leaseEndDate));
                console.log('   Payment status:', sample.paymentStatus);
                
                // Check for approved applications
                const approvedCount = await mongoose.connection.db
                    .collection('applications')
                    .countDocuments({ status: 'approved' });
                console.log(`\n✅ Approved applications: ${approvedCount}`);
                
                // Check for applications with lease dates
                const withLeaseDates = await mongoose.connection.db
                    .collection('applications')
                    .countDocuments({
                        leaseStartDate: { $exists: true, $ne: null },
                        leaseEndDate: { $exists: true, $ne: null }
                    });
                console.log(`📅 Applications with lease dates: ${withLeaseDates}`);
                
                // Check current month eligibility
                const now = new Date();
                const currentMonth = now.getMonth() + 1;
                const currentYear = now.getFullYear();
                
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
                
                console.log(`\n🎯 Eligible for ${currentMonth}/${currentYear} accrual: ${eligibleForAccrual.length}`);
                
                if (eligibleForAccrual.length > 0) {
                    console.log('\n👥 Eligible students:');
                    eligibleForAccrual.forEach((student, index) => {
                        console.log(`   ${index + 1}. ${student.firstName || 'N/A'} ${student.lastName || 'N/A'}`);
                        console.log(`      Residence: ${student.residence || 'N/A'}`);
                        console.log(`      Room: ${student.room || 'N/A'}`);
                        console.log(`      Lease: ${student.leaseStartDate?.toDateString() || 'N/A'} to ${student.leaseEndDate?.toDateString() || 'N/A'}`);
                        console.log(`      Payment Status: ${student.paymentStatus || 'N/A'}`);
                        console.log('');
                    });
                }
            }
        } else {
            console.log('\n❌ Applications collection not found');
            console.log('💡 This means your rental accrual system won\'t work');
            console.log('💡 You need to have an applications collection with student data');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Checking Rental Accrual Data Availability...');
console.log('=============================================');
checkAccrualData();
