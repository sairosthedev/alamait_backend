const mongoose = require('mongoose');
const Lease = require('./src/models/Lease');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function testLeaseDownloadController() {
    try {
        console.log('🧪 Testing lease download controller...');
        
        // Test 1: Check if controller can be loaded
        const leaseDownloadController = require('./src/controllers/leaseDownloadController');
        console.log('✅ Lease download controller loaded successfully');
        
        // Test 2: Check if all functions exist
        const functions = [
            'downloadLease',
            'downloadMultipleLeases', 
            'downloadResidenceLeases',
            'downloadAllLeases'
        ];
        
        functions.forEach(funcName => {
            if (typeof leaseDownloadController[funcName] === 'function') {
                console.log(`✅ ${funcName} function exists`);
            } else {
                console.log(`❌ ${funcName} function missing`);
            }
        });
        
        // Test 3: Check if routes can be loaded
        const leaseDownloadRoutes = require('./src/routes/leaseDownloadRoutes');
        console.log('✅ Lease download routes loaded successfully');
        
        // Test 4: Check if we have any leases in the database
        const leaseCount = await Lease.countDocuments();
        console.log(`📊 Found ${leaseCount} leases in database`);
        
        if (leaseCount > 0) {
            // Test 5: Get a sample lease to check structure
            const sampleLease = await Lease.findOne().lean();
            console.log('📄 Sample lease structure:');
            console.log('- ID:', sampleLease._id);
            console.log('- Student Name:', sampleLease.studentName);
            console.log('- Residence Name:', sampleLease.residenceName);
            console.log('- Filename:', sampleLease.filename);
            console.log('- Path:', sampleLease.path ? 'Has S3 path' : 'No S3 path');
            console.log('- Original Name:', sampleLease.originalname);
        }
        
        console.log('\n🎉 All lease download tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testLeaseDownloadController(); 