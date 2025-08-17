const axios = require('axios');

// Test message edit and delete functionality
async function testMessageEditDelete() {
    const baseURL = 'http://localhost:5000/api';
    
    // You'll need to replace these with actual test data
    const testStudentToken = 'your-student-jwt-token-here';
    const testResidenceId = 'your-residence-id-here';
    
    const headers = {
        'Authorization': `Bearer ${testStudentToken}`,
        'Content-Type': 'application/json'
    };

    console.log('=== TESTING MESSAGE EDIT & DELETE FUNCTIONALITY ===');

    try {
        // Test 1: Create a message
        console.log('\n1. Creating a test message...');
        const messageData = {
            title: 'Test Message for Edit/Delete',
            content: 'This is a test message that will be edited and deleted',
            recipient: 'admin',
            residence: testResidenceId
        };

        let messageId;
        try {
            const response1 = await axios.post(`${baseURL}/student/messages`, messageData, { headers });
            console.log('✅ Message created:', response1.data.data._id);
            messageId = response1.data.data._id;
        } catch (error) {
            console.log('❌ Error creating message:', error.response?.status, error.response?.data?.error || error.message);
            return;
        }

        // Test 2: Edit the message
        console.log('\n2. Editing the message...');
        const editData = {
            title: 'Updated Test Message',
            content: 'This message has been edited successfully'
        };

        try {
            const response2 = await axios.put(`${baseURL}/student/messages/${messageId}`, editData, { headers });
            console.log('✅ Message edited:', response2.data.message);
            console.log('Is edited:', response2.data.data.isEdited);
            console.log('Edited at:', response2.data.data.editedAt);
        } catch (error) {
            console.log('❌ Error editing message:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 3: Add a reply
        console.log('\n3. Adding a reply...');
        const replyData = {
            content: 'This is a test reply that will be edited and deleted'
        };

        let replyId;
        try {
            const response3 = await axios.post(`${baseURL}/student/messages/${messageId}/reply`, replyData, { headers });
            console.log('✅ Reply added:', response3.data._id);
            replyId = response3.data._id;
        } catch (error) {
            console.log('❌ Error adding reply:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 4: Edit the reply
        if (replyId) {
            console.log('\n4. Editing the reply...');
            const editReplyData = {
                content: 'This reply has been edited successfully'
            };

            try {
                const response4 = await axios.put(`${baseURL}/student/messages/${messageId}/reply/${replyId}`, editReplyData, { headers });
                console.log('✅ Reply edited:', response4.data.message);
                console.log('Is edited:', response4.data.data.isEdited);
                console.log('Edited at:', response4.data.data.editedAt);
            } catch (error) {
                console.log('❌ Error editing reply:', error.response?.status, error.response?.data?.error || error.message);
            }
        }

        // Test 5: Delete the reply
        if (replyId) {
            console.log('\n5. Deleting the reply...');
            try {
                const response5 = await axios.delete(`${baseURL}/student/messages/${messageId}/reply/${replyId}`, { headers });
                console.log('✅ Reply deleted:', response5.data.message);
            } catch (error) {
                console.log('❌ Error deleting reply:', error.response?.status, error.response?.data?.error || error.message);
            }
        }

        // Test 6: Delete the message
        console.log('\n6. Deleting the message...');
        try {
            const response6 = await axios.delete(`${baseURL}/student/messages/${messageId}`, { headers });
            console.log('✅ Message deleted:', response6.data.message);
        } catch (error) {
            console.log('❌ Error deleting message:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 7: Test unauthorized edit (should fail)
        console.log('\n7. Testing unauthorized edit (should fail)...');
        try {
            const response7 = await axios.put(`${baseURL}/student/messages/${messageId}`, editData, { headers });
            console.log('❌ Unauthorized edit should have failed');
        } catch (error) {
            if (error.response?.status === 404) {
                console.log('✅ Unauthorized edit correctly failed (message not found)');
            } else {
                console.log('❌ Unexpected error:', error.response?.status, error.response?.data?.error || error.message);
            }
        }

        console.log('\n=== TEST SUMMARY ===');
        console.log('✅ All tests completed');
        console.log('💡 Check the responses above to verify:');
        console.log('   - Messages can be edited within 24 hours');
        console.log('   - Replies can be edited within 24 hours');
        console.log('   - Messages and replies can be deleted');
        console.log('   - Edit indicators (isEdited, editedAt) are included');
        console.log('   - Unauthorized operations are properly blocked');

    } catch (error) {
        console.error('Error testing message edit/delete:', error);
    }
}

// Run the test
testMessageEditDelete(); 