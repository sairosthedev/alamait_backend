const axios = require('axios');

async function testFinalForfeit() {
    try {
        console.log('🧪 Testing final forfeiture fixes...\n');

        const response = await axios.post('http://localhost:5000/api/finance/transactions/forfeit-student', {
            studentId: '68c814d942bf9ffb8792f0e3',
            reason: 'Final test - payment amount and room fixes'
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
        
        console.log('\n🔍 Final Verification:');
        console.log('1. Payment Amount:', data.payments.totalAmount, '(should be 50)');
        console.log('2. Payment Forfeiture:', data.payments.forfeitureResult ? '✅ CREATED' : '❌ NOT CREATED');
        console.log('3. Room Management:', data.roomAvailability ? '✅ ROOM FREED' : '❌ ROOM NOT FREED');
        console.log('4. Total Payments Forfeited:', data.summary.paymentsForfeited, '(should be 50)');
        console.log('5. Room Freed:', data.summary.roomFreed);

        if (data.payments.totalAmount === 50 && data.summary.paymentsForfeited === 50) {
            console.log('\n🎉 SUCCESS: Payment amount correctly calculated!');
        } else {
            console.log('\n❌ ISSUE: Payment amount still incorrect');
        }

        if (data.roomAvailability && data.summary.roomFreed) {
            console.log('🎉 SUCCESS: Room successfully freed!');
        } else {
            console.log('❌ ISSUE: Room not freed');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testFinalForfeit();


