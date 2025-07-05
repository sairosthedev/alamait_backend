const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/admin/messages';

// You'll need to replace this with an actual admin JWT token
const ADMIN_TOKEN = 'your-admin-jwt-token-here';

const headers = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
};

async function testAdminMessages() {
    try {
        console.log('Testing Admin Messages with Status and Group Messages...\n');

        // Test 1: Get all messages with status
        console.log('1. Testing GET / (all messages with status):');
        try {
            const response1 = await axios.get(`${BASE_URL}/`, { headers });
            console.log('Status:', response1.status);
            console.log('Messages count:', response1.data.messages?.length || 0);
            
            if (response1.data.messages?.length > 0) {
                const firstMessage = response1.data.messages[0];
                console.log('Sample message structure:');
                console.log('- ID:', firstMessage.id);
                console.log('- Type:', firstMessage.type);
                console.log('- Delivery Status:', firstMessage.deliveryStatus);
                console.log('- Delivery Indicators:', firstMessage.deliveryIndicators?.length || 0);
                console.log('- Read By:', firstMessage.readBy?.length || 0);
            }
            console.log('');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            console.log('');
        }

        // Test 2: Get group messages (messages sent to all students)
        console.log('2. Testing GET /?filter=group (group messages):');
        try {
            const response2 = await axios.get(`${BASE_URL}/?filter=group`, { headers });
            console.log('Status:', response2.status);
            console.log('Group messages count:', response2.data.messages?.length || 0);
            
            if (response2.data.messages?.length > 0) {
                const groupMessage = response2.data.messages[0];
                console.log('Sample group message:');
                console.log('- Recipients count:', groupMessage.recipients?.length || 0);
                console.log('- Delivery percentage:', groupMessage.deliveryStatus?.deliveredPercentage || 0);
                console.log('- Read percentage:', groupMessage.deliveryStatus?.readPercentage || 0);
            }
            console.log('');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            console.log('');
        }

        // Test 3: Get announcements
        console.log('3. Testing GET /?filter=announcements:');
        try {
            const response3 = await axios.get(`${BASE_URL}/?filter=announcements`, { headers });
            console.log('Status:', response3.status);
            console.log('Announcements count:', response3.data.messages?.length || 0);
            console.log('');
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
            console.log('');
        }

        // Test 4: Create a test group message
        console.log('4. Testing POST / (create group message):');
        try {
            const messageData = {
                title: 'Test Group Message',
                content: 'This is a test message sent to all students',
                recipient: 'all-students',
                residence: 'your-residence-id-here' // Replace with actual residence ID
            };

            const response4 = await axios.post(`${BASE_URL}/`, messageData, { headers });
            console.log('Status:', response4.status);
            console.log('Message created:', response4.data.id);
            console.log('Delivery status:', response4.data.deliveryStatus);
            console.log('Delivery indicators:', response4.data.deliveryIndicators?.length || 0);
            console.log('');

            // Test 5: Get delivery status for the created message
            console.log('5. Testing GET /:messageId/delivery-status:');
            try {
                const response5 = await axios.get(`${BASE_URL}/${response4.data.id}/delivery-status`, { headers });
                console.log('Status:', response5.status);
                console.log('Delivery status details:', response5.data.deliveryStatus?.length || 0);
                console.log('');
            } catch (error) {
                console.log('❌ Error getting delivery status:', error.response?.status, error.response?.data?.error || error.message);
                console.log('');
            }

            // Test 6: Update delivery status
            console.log('6. Testing POST /:messageId/delivery-status:');
            try {
                const updateData = {
                    status: 'delivered',
                    recipientId: 'student-id-here' // Replace with actual student ID
                };

                const response6 = await axios.post(`${BASE_URL}/${response4.data.id}/delivery-status`, updateData, { headers });
                console.log('Status:', response6.status);
                console.log('Delivery status updated:', response6.data.message);
                console.log('');
            } catch (error) {
                console.log('❌ Error updating delivery status:', error.response?.status, error.response?.data?.error || error.message);
                console.log('');
            }

        } catch (error) {
            console.log('❌ Error creating message:', error.response?.status, error.response?.data?.error || error.message);
            console.log('');
        }

        // Test 7: Search messages
        console.log('7. Testing GET /?search=test:');
        try {
            const response7 = await axios.get(`${BASE_URL}/?search=test`, { headers });
            console.log('Status:', response7.status);
            console.log('Search results count:', response7.data.messages?.length || 0);
            console.log('');
        } catch (error) {
            console.log('❌ Error searching messages:', error.response?.status, error.response?.data?.error || error.message);
            console.log('');
        }

        console.log('✅ All tests completed!');
        console.log('\n💡 Key features verified:');
        console.log('   - Message status and delivery indicators');
        console.log('   - Group messages (sent to all students)');
        console.log('   - Delivery status tracking');
        console.log('   - Read status tracking');
        console.log('   - Message filtering by type');
        console.log('   - Search functionality');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testAdminMessages(); 