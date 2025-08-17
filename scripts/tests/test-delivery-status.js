const axios = require('axios');

// Test delivery status and read functionality
async function testDeliveryStatus() {
    const baseURL = 'http://localhost:5000/api';
    
    // You'll need to replace these with actual test data
    const testStudentToken = 'your-student-jwt-token-here';
    const testResidenceId = 'your-residence-id-here';
    
    const headers = {
        'Authorization': `Bearer ${testStudentToken}`,
        'Content-Type': 'application/json'
    };

    console.log('=== TESTING DELIVERY STATUS & READ FUNCTIONALITY ===');

    try {
        // Test 1: Create a message
        console.log('\n1. Creating a test message...');
        const messageData = {
            title: 'Test Message for Delivery Status',
            content: 'This is a test message to check delivery status functionality',
            recipient: 'admin',
            residence: testResidenceId
        };

        let messageId;
        try {
            const response1 = await axios.post(`${baseURL}/student/messages`, messageData, { headers });
            console.log('✅ Message created:', response1.data.data._id);
            messageId = response1.data.data._id;
            console.log('Initial delivery status:', response1.data.data.deliveryStatus);
        } catch (error) {
            console.log('❌ Error creating message:', error.response?.status, error.response?.data?.error || error.message);
            return;
        }

        // Test 2: Get delivery status
        console.log('\n2. Getting delivery status...');
        try {
            const response2 = await axios.get(`${baseURL}/student/messages/${messageId}/delivery-status`, { headers });
            console.log('✅ Delivery status retrieved:', response2.data.deliveryStatus);
        } catch (error) {
            console.log('❌ Error getting delivery status:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 3: Update delivery status to 'delivered'
        console.log('\n3. Updating delivery status to "delivered"...');
        const updateData = {
            status: 'delivered',
            recipientId: 'admin-user-id-here' // Replace with actual admin user ID
        };

        try {
            const response3 = await axios.post(`${baseURL}/student/messages/${messageId}/delivery-status`, updateData, { headers });
            console.log('✅ Delivery status updated:', response3.data.message);
        } catch (error) {
            console.log('❌ Error updating delivery status:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 4: Mark message as read
        console.log('\n4. Marking message as read...');
        try {
            const response4 = await axios.post(`${baseURL}/student/messages/${messageId}/read`, {}, { headers });
            console.log('✅ Message marked as read:', response4.data.message);
        } catch (error) {
            console.log('❌ Error marking message as read:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 5: Get updated delivery status
        console.log('\n5. Getting updated delivery status...');
        try {
            const response5 = await axios.get(`${baseURL}/student/messages/${messageId}/delivery-status`, { headers });
            console.log('✅ Updated delivery status:', response5.data.deliveryStatus);
        } catch (error) {
            console.log('❌ Error getting updated delivery status:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 6: Get messages to see delivery indicators
        console.log('\n6. Getting messages with delivery indicators...');
        try {
            const response6 = await axios.get(`${baseURL}/student/messages`, { headers });
            console.log('✅ Messages retrieved:', response6.data.announcements?.length || 0, 'announcements,', response6.data.discussions?.length || 0, 'discussions');
            
            if (response6.data.discussions?.length > 0) {
                const firstMessage = response6.data.discussions[0];
                console.log('First message delivery indicators:', firstMessage.deliveryIndicators);
            }
        } catch (error) {
            console.log('❌ Error getting messages:', error.response?.status, error.response?.data?.error || error.message);
        }

        console.log('\n=== TEST SUMMARY ===');
        console.log('✅ All tests completed');
        console.log('💡 Check the responses above to verify:');
        console.log('   - Messages can be marked as read');
        console.log('   - Delivery status can be updated');
        console.log('   - Delivery indicators are included in responses');
        console.log('   - Read status is properly tracked');

    } catch (error) {
        console.error('Error testing delivery status:', error);
    }
}

// Run the test
testDeliveryStatus(); 