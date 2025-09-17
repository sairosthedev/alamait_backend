const axios = require('axios');

async function testForfeitFixes() {
    try {
        console.log('🧪 Testing forfeiture fixes...\n');

        const response = await axios.post('http://localhost:5000/api/finance/transactions/forfeit-student', {
            studentId: '68c814d942bf9ffb8792f0e3',
            reason: 'Testing payment forfeiture and room fixes'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_TOKEN' // Replace with actual token
            }
        });

        console.log('✅ Forfeiture Response:');
        console.log(JSON.stringify(response.data, null, 2));

        // Check specific fixes
        const data = response.data.data;
        
        console.log('\n🔍 Fix Verification:');
        console.log('1. Payment Forfeiture:', data.payments.forfeitureResult ? '✅ CREATED' : '❌ NOT CREATED');
        console.log('2. Room Management:', data.roomAvailability ? '✅ ROOM FREED' : '❌ ROOM NOT FREED');
        console.log('3. Total Payments Forfeited:', data.summary.paymentsForfeited);
        console.log('4. Room Freed:', data.summary.roomFreed);

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testForfeitFixes();


