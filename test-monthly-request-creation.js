const axios = require('axios');

// Test data for creating a monthly request
const testData = {
    title: "Test WiFi Service",
    description: "WiFi service for testing",
    residence: "507f1f77bcf86cd799439011", // This will need to be a real residence ID
    month: 12,
    year: 2024,
    items: [
        {
            description: "WiFi Service",
            quantity: 1,
            estimatedCost: 150.00,
            purpose: "Monthly WiFi service",
            category: "utilities",
            isRecurring: true
        }
    ],
    priority: "medium",
    notes: "Test monthly request",
    isTemplate: false
};

async function testMonthlyRequestCreation() {
    try {
        console.log('Testing monthly request creation...');
        console.log('Request data:', JSON.stringify(testData, null, 2));
        
        const response = await axios.post(
            'https://alamait-backend.onrender.com/api/monthly-requests',
            testData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // You'll need to replace this with a real token
                }
            }
        );
        
        console.log('✅ Success! Response:', response.data);
    } catch (error) {
        console.error('❌ Error creating monthly request:');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Response Data:', error.response?.data);
        console.error('Request Data:', error.config?.data);
        console.error('Headers:', error.config?.headers);
    }
}

// Run the test
testMonthlyRequestCreation(); 