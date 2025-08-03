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

async function testLeaseDownloadFix() {
    try {
        console.log('🧪 Testing Lease Download Fix');
        console.log('=============================\n');

        // The actual lease IDs from the user
        const testLeaseIds = [
            "686aee46a84c2e4c97bc8dac",
            "688a6fad334889f867344d9d", 
            "688a946c55fe1a1fd353fa9c",
            "688a965355fe1a1fd35411c9"
        ];

        console.log(`🎯 Testing ${testLeaseIds.length} actual lease IDs`);

        // Find these specific leases
        const leases = await Lease.find({ _id: { $in: testLeaseIds } });
        
        console.log(`📊 Found ${leases.length} leases in database`);

        if (leases.length === 0) {
            console.log('❌ No leases found with these IDs');
            return;
        }

        // Check each lease
        let s3Leases = 0;
        let localLeases = 0;
        let invalidLeases = 0;

        console.log('\n📋 Lease Analysis:');
        for (const lease of leases) {
            console.log(`\n   Lease: ${lease._id}`);
            console.log(`   Student: ${lease.studentName}`);
            console.log(`   Residence: ${lease.residenceName}`);
            console.log(`   Filename: ${lease.originalname || lease.filename}`);
            console.log(`   Path: ${lease.path}`);
            
            if (lease.path && lease.path.startsWith('http')) {
                console.log(`   ✅ S3 path (will be fetched from S3)`);
                s3Leases++;
            } else if (lease.path && lease.path.startsWith('/uploads/')) {
                console.log(`   📁 Local path (will be read from filesystem)`);
                localLeases++;
            } else {
                console.log(`   ❌ Invalid or missing path`);
                invalidLeases++;
            }
        }

        console.log(`\n📈 Summary:`);
        console.log(`   S3 leases: ${s3Leases}`);
        console.log(`   Local leases: ${localLeases}`);
        console.log(`   Invalid leases: ${invalidLeases}`);
        console.log(`   Total: ${leases.length}`);

        // Test the path processing logic
        console.log(`\n🔍 Path Processing Test:`);
        for (const lease of leases) {
            if (lease.path) {
                if (lease.path.startsWith('http')) {
                    // S3 path processing
                    const urlParts = lease.path.split('/');
                    const s3Key = urlParts.slice(3).join('/');
                    console.log(`   ${lease._id}: S3 Key = ${s3Key}`);
                } else if (lease.path.startsWith('/uploads/')) {
                    // Local path processing
                    const path = require('path');
                    const localPath = path.join(__dirname, '..', '..', lease.path);
                    console.log(`   ${lease._id}: Local Path = ${localPath}`);
                }
            }
        }

        console.log(`\n✅ Expected Result:`);
        console.log(`   With the fix, all ${s3Leases + localLeases} valid leases should be included in the ZIP`);
        console.log(`   Only ${invalidLeases} leases will be skipped due to missing paths`);

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
connectDB().then(() => {
    testLeaseDownloadFix();
}); 