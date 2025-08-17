const axios = require('axios');

// Test student message functionality
async function testStudentMessages() {
    const baseURL = 'http://localhost:5000/api';
    
    // You'll need to replace these with actual test data
    const testStudentToken = 'your-student-jwt-token-here';
    const testResidenceId = 'your-residence-id-here';
    
    const headers = {
        'Authorization': `Bearer ${testStudentToken}`,
        'Content-Type': 'application/json'
    };

    console.log('=== TESTING STUDENT MESSAGE FUNCTIONALITY ===');

    try {
        // Test 1: Create a message sent to all-students (should be announcement)
        console.log('\n1. Testing message to all-students (should be announcement)...');
        const announcementData = {
            title: 'Test Announcement',
            content: 'This is a test announcement sent to all students',
            recipient: 'all-students',
            residence: testResidenceId
        };

        try {
            const response1 = await axios.post(`${baseURL}/student/messages`, announcementData, { headers });
            console.log('✅ Success:', response1.data);
            console.log('Message type:', response1.data.data.type);
            console.log('Author details included:', !!response1.data.data.author.firstName);
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 2: Create a message sent to admin (should be discussion)
        console.log('\n2. Testing message to admin (should be discussion)...');
        const discussionData = {
            title: 'Test Discussion',
            content: 'This is a test discussion sent to admin',
            recipient: 'admin',
            residence: testResidenceId
        };

        try {
            const response2 = await axios.post(`${baseURL}/student/messages`, discussionData, { headers });
            console.log('✅ Success:', response2.data);
            console.log('Message type:', response2.data.data.type);
            console.log('Author details included:', !!response2.data.data.author.firstName);
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 3: Get messages to verify formatting
        console.log('\n3. Testing get messages to verify formatting...');
        try {
            const response3 = await axios.get(`${baseURL}/student/messages`, { headers });
            console.log('✅ Success:', response3.data);
            console.log('Announcements count:', response3.data.announcements?.length || 0);
            console.log('Discussions count:', response3.data.discussions?.length || 0);
            
            // Check if user details are included
            if (response3.data.announcements?.length > 0) {
                const firstAnnouncement = response3.data.announcements[0];
                console.log('First announcement author details:', {
                    hasFirstName: !!firstAnnouncement.author?.firstName,
                    hasLastName: !!firstAnnouncement.author?.lastName,
                    hasEmail: !!firstAnnouncement.author?.email,
                    hasRole: !!firstAnnouncement.author?.role
                });
            }
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.error || error.message);
        }

        console.log('\n=== TEST SUMMARY ===');
        console.log('✅ All tests completed');
        console.log('💡 Check the responses above to verify:');
        console.log('   - Messages to all-students are type "announcement"');
        console.log('   - Messages to admin are type "discussion"');
        console.log('   - User details (firstName, lastName, email, role) are included');

    } catch (error) {
        console.error('Error testing student messages:', error);
    }
}

// Run the test
testStudentMessages(); 