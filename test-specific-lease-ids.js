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

async function testSpecificLeaseIds() {
    try {
        console.log('🧪 Testing Specific Lease IDs');
        console.log('=============================\n');

        // The lease IDs from the user's payload
        const testLeaseIds = [
            "686d806b76fac16e629e9bdd",
            "686e7a60913b15e1760d7d58", 
            "686ef7e66f4f0fe746ac6a0b",
            "686f0db06f4f0fe746acb9ed",
            "686fa791991066842501ce5a"
        ];

        console.log(`🎯 Testing ${testLeaseIds.length} specific lease IDs`);

        // Find these specific leases
        const leases = await Lease.find({ _id: { $in: testLeaseIds } });
        
        console.log(`📊 Found ${leases.length} leases in database`);

        if (leases.length === 0) {
            console.log('❌ No leases found with these IDs');
            return;
        }

        // Check each lease
        let validLeases = 0;
        let invalidLeases = 0;

        for (const lease of leases) {
            console.log(`\n📋 Lease: ${lease._id}`);
            console.log(`   Student: ${lease.studentName || 'N/A'}`);
            console.log(`   Residence: ${lease.residenceName || 'N/A'}`);
            console.log(`   Filename: ${lease.originalname || lease.filename || 'N/A'}`);
            console.log(`   Path: ${lease.path || 'No path'}`);
            
            if (lease.path && lease.path.startsWith('http')) {
                console.log(`   ✅ Valid S3 path`);
                validLeases++;
            } else {
                console.log(`   ❌ Invalid or missing S3 path`);
                invalidLeases++;
            }
        }

        console.log(`\n📈 Summary:`);
        console.log(`   Valid leases (with S3 paths): ${validLeases}`);
        console.log(`   Invalid leases (no S3 paths): ${invalidLeases}`);
        console.log(`   Total found: ${leases.length}`);

        // Check which IDs were not found
        const foundIds = leases.map(l => l._id.toString());
        const missingIds = testLeaseIds.filter(id => !foundIds.includes(id));
        
        if (missingIds.length > 0) {
            console.log(`\n⚠️ Missing lease IDs:`);
            missingIds.forEach(id => console.log(`   - ${id}`));
        }

        // Test S3 key extraction
        console.log(`\n🔍 S3 Key Extraction Test:`);
        leases.forEach(lease => {
            if (lease.path && lease.path.startsWith('http')) {
                const urlParts = lease.path.split('/');
                const s3Key = urlParts.slice(3).join('/');
                console.log(`   ${lease._id}: ${s3Key}`);
            }
        });

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
connectDB().then(() => {
    testSpecificLeaseIds();
}); 