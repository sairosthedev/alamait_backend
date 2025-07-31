const axios = require('axios');

// Test data that matches what the frontend is sending
const templateData = {
    title: 'Monthly Requests',
    description: 'Monthly Requests St Kilda',
    residence: '67d723cf20f89c4ae69804f3',
    year: 2025, // This shouldn't be sent for templates but frontend is sending it
    isTemplate: true,
    templateRequests: [ // Frontend is using 'templateRequests' instead of 'items'
        {
            category: 'maintenance',
            description: 'Gas for St Kilda',
            estimatedCost: 192,
            id: 1753968099246,
            notes: '',
            priority: 'medium',
            tags: [],
            title: 'Gas'
        },
        {
            category: 'maintenance',
            description: 'wifi kilda',
            estimatedCost: 100,
            id: 1753968179551,
            notes: '',
            priority: 'medium',
            tags: [],
            title: 'wifi'
        }
    ],
    totalEstimatedCost: 292
};

async function testTemplateCreation() {
    try {
        console.log('🧪 Testing Template Creation with Frontend Data Format...\n');
        console.log('Request data:', JSON.stringify(templateData, null, 2));
        
        const response = await axios.post(
            'https://alamait-backend.onrender.com/api/monthly-requests',
            templateData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                },
                timeout: 10000
            }
        );
        
        console.log('✅ Template creation SUCCESS!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('❌ Template creation FAILED');
        console.log('Status:', error.response?.status);
        console.log('Error message:', error.response?.data?.message || error.message);
        
        if (error.response?.data) {
            console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Instructions
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test template creation');
console.log('4. Check if the field mapping fix works\n');

// Uncomment to run the test
// testTemplateCreation(); 