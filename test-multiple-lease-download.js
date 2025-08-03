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

async function testMultipleLeaseDownload() {
    try {
        console.log('🧪 Testing Multiple Lease Download');
        console.log('==================================\n');

        // Find all leases in the system
        const allLeases = await Lease.find({}).limit(10);
        
        console.log(`📊 Found ${allLeases.length} leases in the system`);

        if (allLeases.length === 0) {
            console.log('⚠️  No leases found in the system');
            return;
        }

        // Display lease information
        console.log('\n📋 Available Leases:');
        allLeases.forEach((lease, index) => {
            console.log(`${index + 1}. ID: ${lease._id}`);
            console.log(`   Student: ${lease.studentName || 'N/A'}`);
            console.log(`   Residence: ${lease.residenceName || 'N/A'}`);
            console.log(`   File: ${lease.originalname || lease.filename || 'N/A'}`);
            console.log(`   Path: ${lease.path ? 'Valid S3 path' : 'No S3 path'}`);
            console.log('');
        });

        // Test with first 3 leases (if available)
        const testLeaseIds = allLeases.slice(0, 3).map(lease => lease._id);
        
        console.log(`🎯 Testing with ${testLeaseIds.length} lease IDs:`);
        testLeaseIds.forEach((id, index) => {
            console.log(`   ${index + 1}. ${id}`);
        });

        // Simulate the request body that would be sent
        const requestBody = {
            leaseIds: testLeaseIds
        };

        console.log('\n📤 Request Body:');
        console.log(JSON.stringify(requestBody, null, 2));

        // Test the API endpoint
        console.log('\n🌐 Testing API Endpoint...');
        console.log('POST /api/lease-downloads/multiple');
        console.log('Body:', JSON.stringify(requestBody));

        // Instructions for manual testing
        console.log('\n📝 Manual Testing Instructions:');
        console.log('1. Use Postman or curl to test the endpoint:');
        console.log(`   curl -X POST http://localhost:5000/api/lease-downloads/multiple \\`);
        console.log(`     -H "Content-Type: application/json" \\`);
        console.log(`     -H "Authorization: Bearer <your-token>" \\`);
        console.log(`     -d '${JSON.stringify(requestBody)}' \\`);
        console.log(`     --output test-download.zip`);

        console.log('\n2. Check the response headers and file count in the ZIP');
        console.log('3. Verify that all selected leases are included');

        // Check for potential issues
        console.log('\n🔍 Potential Issues to Check:');
        
        // Check if leases have valid S3 paths
        const leasesWithValidPaths = allLeases.filter(lease => 
            lease.path && lease.path.startsWith('http')
        );
        
        console.log(`   - Leases with valid S3 paths: ${leasesWithValidPaths.length}/${allLeases.length}`);
        
        if (leasesWithValidPaths.length < allLeases.length) {
            console.log('   ⚠️  Some leases may not have valid S3 paths');
        }

        // Check for duplicate filenames
        const filenames = allLeases.map(lease => lease.originalname || lease.filename).filter(Boolean);
        const uniqueFilenames = [...new Set(filenames)];
        
        console.log(`   - Unique filenames: ${uniqueFilenames.length}/${filenames.length}`);
        
        if (uniqueFilenames.length < filenames.length) {
            console.log('   ⚠️  Some leases may have duplicate filenames (could cause overwrites)');
        }

        // Check lease structure
        console.log('\n📊 Lease Structure Analysis:');
        const sampleLease = allLeases[0];
        if (sampleLease) {
            console.log('Sample lease fields:');
            Object.keys(sampleLease.toObject()).forEach(key => {
                const value = sampleLease[key];
                console.log(`   - ${key}: ${typeof value} ${Array.isArray(value) ? `(${value.length} items)` : ''}`);
            });
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
connectDB().then(() => {
    testMultipleLeaseDownload();
}); 