const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
const ADMIN_TOKEN = 'your-admin-token-here'; // Replace with actual admin token

// Test data for manual student addition
const testStudentData = {
  email: 'test.student@example.com',
  firstName: 'Test',
  lastName: 'Student',
  phone: '+1234567890',
  emergencyContact: {
    name: 'Emergency Contact',
    relationship: 'Parent',
    phone: '+1234567891'
  },
  residenceId: 'your-residence-id-here', // Replace with actual residence ID
  roomNumber: '101',
  startDate: '2024-02-01',
  endDate: '2024-12-31',
  monthlyRent: 750,
  securityDeposit: 500,
  adminFee: 50
};

async function testManualAddStudent() {
  try {
    console.log('Testing manual add student functionality...');
    
    // Test the manual add student endpoint
    const response = await axios.post(`${BASE_URL}/admin/students/manual-add`, testStudentData, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Success! Student added successfully');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Error testing manual add student:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

async function testGetResidences() {
  try {
    console.log('\nTesting get residences endpoint...');
    
    const response = await axios.get(`${BASE_URL}/admin/residences`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    console.log('✅ Success! Residences fetched');
    console.log('Residences:', response.data.data || response.data);
    
    return response.data.data || response.data;
  } catch (error) {
    console.error('❌ Error fetching residences:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

async function testGetRooms(residenceId) {
  try {
    console.log(`\nTesting get rooms for residence ${residenceId}...`);
    
    const response = await axios.get(`${BASE_URL}/admin/residences/${residenceId}/rooms`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    console.log('✅ Success! Rooms fetched');
    console.log('Rooms:', response.data.data || response.data);
    
    return response.data.data || response.data;
  } catch (error) {
    console.error('❌ Error fetching rooms:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

// Main test function
async function runTests() {
  try {
    // First, get residences to find a valid residence ID
    const residences = await testGetResidences();
    
    if (residences && residences.length > 0) {
      const firstResidence = residences[0];
      console.log(`\nUsing residence: ${firstResidence.name} (ID: ${firstResidence._id})`);
      
      // Get rooms for this residence
      const rooms = await testGetRooms(firstResidence._id);
      
      if (rooms && rooms.length > 0) {
        const availableRoom = rooms.find(room => room.status === 'available' || room.status === 'reserved');
        if (availableRoom) {
          console.log(`\nUsing room: ${availableRoom.roomNumber}`);
          
          // Update test data with actual IDs
          testStudentData.residenceId = firstResidence._id;
          testStudentData.roomNumber = availableRoom.roomNumber;
          
          // Test manual add student
          await testManualAddStudent();
        } else {
          console.log('❌ No available rooms found');
        }
      } else {
        console.log('❌ No rooms found for this residence');
      }
    } else {
      console.log('❌ No residences found');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('🚀 Starting manual add student tests...\n');
  runTests().then(() => {
    console.log('\n✨ Tests completed!');
  }).catch((error) => {
    console.error('\n💥 Tests failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  testManualAddStudent,
  testGetResidences,
  testGetRooms,
  runTests
}; 