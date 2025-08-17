const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test the signed leases endpoint to see if room and residence info is now populated
async function testSignedLeasesFix() {
    console.log('🧪 Testing Signed Leases Fix...\n');

    try {
        // Test the admin signed leases endpoint
        console.log('1. Testing GET /api/admin/students/all-signed-leases');
        
        const response = await axios.get(`${BASE_URL}/admin/students/all-signed-leases`);
        
        console.log('✅ Success:', response.status);
        console.log('📊 Response:', response.data.message);
        
        if (response.data.signedLeases && response.data.signedLeases.length > 0) {
            console.log('\n📋 Signed Leases Found:');
            response.data.signedLeases.forEach((lease, index) => {
                console.log(`\n--- Lease ${index + 1} ---`);
                console.log(`Student: ${lease.studentName}`);
                console.log(`Email: ${lease.email}`);
                console.log(`Room: ${lease.currentRoom || 'null'}`);
                console.log(`Residence: ${lease.residence || 'null'}`);
                console.log(`Residence ID: ${lease.residenceId || 'null'}`);
                console.log(`File: ${lease.fileName}`);
                console.log(`Upload Date: ${lease.uploadDate}`);
                
                // Check if Makanaka's data is fixed
                if (lease.email === 'cindypemhiwa@gmail.com') {
                    console.log('\n🎯 MAKANAKA PEMHIWA DATA:');
                    console.log(`Room: ${lease.currentRoom} (should be "M3")`);
                    console.log(`Residence: ${lease.residence} (should be "St Kilda Student House")`);
                    
                    if (lease.currentRoom === 'M3' && lease.residence === 'St Kilda Student House') {
                        console.log('✅ FIX VERIFIED: Room and residence data is now correct!');
                    } else {
                        console.log('❌ FIX NOT WORKING: Room and residence data is still incorrect');
                    }
                }
            });
        } else {
            console.log('❌ No signed leases found');
        }
        
    } catch (error) {
        console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        
        if (error.response?.status === 401) {
            console.log('💡 Note: This endpoint requires admin authentication');
        }
    }
}

// Test the student signed leases endpoint as well
async function testStudentSignedLeases() {
    console.log('\n🧪 Testing Student Signed Leases Endpoint...\n');

    try {
        // This would require authentication, but let's see the structure
        console.log('2. Testing GET /api/student/signed-leases (requires auth)');
        console.log('💡 This endpoint requires student authentication');
        
    } catch (error) {
        console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
    }
}

// Run the tests
async function runTests() {
    console.log('🚀 Starting Signed Lease Fix Verification...\n');
    
    await testSignedLeasesFix();
    await testStudentSignedLeases();
    
    console.log('\n✨ Test completed!');
    console.log('\n📝 Summary:');
    console.log('- The fix should now properly retrieve room and residence information');
    console.log('- It checks User model first, then Application model, then Residence lookup');
    console.log('- Makanaka Pemhiwa should now show Room: M3, Residence: St Kilda Student House');
}

runTests().catch(console.error); 