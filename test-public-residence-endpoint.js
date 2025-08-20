const axios = require('axios');
require('dotenv').config();

// Test the public residence endpoint
async function testPublicResidenceEndpoint() {
    try {
        console.log('🔍 TESTING PUBLIC RESIDENCE ENDPOINT');
        console.log('=====================================\n');
        
        // Test the public residence endpoint
        const baseURL = process.env.API_BASE_URL || 'http://localhost:5000';
        const response = await axios.get(`${baseURL}/api/residences`);
        
        console.log('✅ Public residence endpoint response received');
        console.log('Response status:', response.status);
        console.log('Response structure:', Object.keys(response.data));
        
        const residences = response.data.data || response.data || [];
        console.log(`📊 Found ${residences.length} residences from public endpoint`);
        
        residences.forEach((residence, index) => {
            console.log(`\n🏠 Residence ${index + 1}: ${residence.name} (${residence._id})`);
            console.log(`   Total rooms: ${residence.rooms ? residence.rooms.length : 0}`);
            
            if (residence.rooms && Array.isArray(residence.rooms)) {
                let availableCount = 0;
                let occupiedCount = 0;
                let otherCount = 0;
                
                residence.rooms.forEach(room => {
                    const status = room.status || 'no-status';
                    console.log(`   - Room ${room.roomNumber}: ${status} (${room.type || 'no-type'}) - $${room.price || 'no-price'}`);
                    
                    switch (status.toLowerCase()) {
                        case 'available':
                            availableCount++;
                            break;
                        case 'occupied':
                            occupiedCount++;
                            break;
                        default:
                            otherCount++;
                    }
                });
                
                console.log(`   📈 Room status summary: ${availableCount} available, ${occupiedCount} occupied, ${otherCount} other`);
            } else {
                console.log('   ⚠️  No rooms array found');
            }
        });
        
        console.log('\n✅ Public residence endpoint test completed');
        
    } catch (error) {
        console.error('❌ Error testing public residence endpoint:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Test the admin residence endpoint for comparison
async function testAdminResidenceEndpoint() {
    try {
        console.log('\n🔍 TESTING ADMIN RESIDENCE ENDPOINT (FOR COMPARISON)');
        console.log('=====================================================\n');
        
        const baseURL = process.env.API_BASE_URL || 'http://localhost:5000';
        
        // Note: This might require authentication, so we'll just test the structure
        const response = await axios.get(`${baseURL}/api/admin/residences`);
        
        console.log('✅ Admin residence endpoint response received');
        console.log('Response status:', response.status);
        
        const residences = response.data.data || response.data || [];
        console.log(`📊 Found ${residences.length} residences from admin endpoint`);
        
        // Just show the first residence for comparison
        if (residences.length > 0) {
            const firstResidence = residences[0];
            console.log(`\n🏠 First residence: ${firstResidence.name}`);
            console.log(`   Total rooms: ${firstResidence.rooms ? firstResidence.rooms.length : 0}`);
            
            if (firstResidence.rooms && firstResidence.rooms.length > 0) {
                console.log('   Sample room:', firstResidence.rooms[0]);
            }
        }
        
    } catch (error) {
        console.error('❌ Error testing admin residence endpoint:', error.message);
        console.log('   (This is expected if authentication is required)');
    }
}

async function main() {
    console.log('🚀 Starting residence endpoint comparison test\n');
    
    await testPublicResidenceEndpoint();
    await testAdminResidenceEndpoint();
    
    console.log('\n🎯 SUMMARY');
    console.log('==========');
    console.log('The public residence endpoint should show the same room statuses');
    console.log('as the landing page, which should be more accurate than the admin endpoint.');
    console.log('\nIf the public endpoint shows different statuses than expected,');
    console.log('the issue might be in the database data itself.');
}

main().catch(console.error); 