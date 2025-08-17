const mongoose = require('mongoose');
const Lease = require('./src/models/Lease');

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function checkActualLeases() {
    try {
        console.log('🔍 Checking Actual Leases in Database');
        console.log('=====================================\n');

        // Find all leases
        const allLeases = await Lease.find({}).limit(10);
        
        console.log(`📊 Found ${allLeases.length} leases in database`);

        if (allLeases.length === 0) {
            console.log('❌ No leases found in database');
            return;
        }

        console.log('\n📋 Available Leases:');
        allLeases.forEach((lease, index) => {
            console.log(`\n${index + 1}. ID: ${lease._id}`);
            console.log(`   Student: ${lease.studentName || 'N/A'}`);
            console.log(`   Residence: ${lease.residenceName || 'N/A'}`);
            console.log(`   Filename: ${lease.originalname || lease.filename || 'N/A'}`);
            console.log(`   Path: ${lease.path || 'No path'}`);
            
            if (lease.path && lease.path.startsWith('http')) {
                console.log(`   ✅ S3 path`);
            } else if (lease.path && lease.path.startsWith('/uploads/')) {
                console.log(`   📁 Local path`);
            } else {
                console.log(`   ❌ Invalid path`);
            }
        });

        // Count by path type
        const s3Leases = allLeases.filter(l => l.path && l.path.startsWith('http')).length;
        const localLeases = allLeases.filter(l => l.path && l.path.startsWith('/uploads/')).length;
        const invalidLeases = allLeases.filter(l => !l.path || (!l.path.startsWith('http') && !l.path.startsWith('/uploads/'))).length;

        console.log(`\n📈 Summary:`);
        console.log(`   S3 leases: ${s3Leases}`);
        console.log(`   Local leases: ${localLeases}`);
        console.log(`   Invalid leases: ${invalidLeases}`);
        console.log(`   Total: ${allLeases.length}`);

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
connectDB().then(() => {
    checkActualLeases();
}); 