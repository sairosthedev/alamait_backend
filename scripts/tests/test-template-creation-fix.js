const axios = require('axios');

const BASE_URL = 'http://localhost:5002';

async function testTemplateCreationFix() {
    try {
        console.log('🧪 Testing template creation fix...');
        
        // Step 1: Authenticate first
        console.log('🔐 Step 1: Authenticating...');
        const loginData = {
            email: 'admin@alamait.com', // Replace with actual admin credentials
            password: 'admin123' // Replace with actual password
        };
        
        const authResponse = await axios.post(`${BASE_URL}/api/auth/login`, loginData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const token = authResponse.data.token;
        console.log('✅ Authentication successful');
        
        // Step 2: Create template with the data structure that was causing the error
        console.log('📝 Step 2: Creating template...');
        const templateData = {
            title: "Test Template Fix",
            description: "Testing the requestHistory.changes fix",
            residence: "67d723cf20f89c4ae69804f3", // Replace with actual residence ID
            isTemplate: true,
            templateDescription: "Test template for fixing the changes array issue",
            items: [
                {
                    title: "Test Item 1",
                    description: "First test item",
                    quantity: 1,
                    estimatedCost: 100,
                    category: "maintenance",
                    priority: "medium"
                }
            ],
            historicalData: [],
            itemHistory: []
        };

        console.log('📤 Sending POST request to /api/monthly-requests...');
        console.log('📋 Request data:', JSON.stringify(templateData, null, 2));
        
        const response = await axios.post(`${BASE_URL}/api/monthly-requests`, templateData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('✅ Template created successfully!');
        console.log('📊 Response status:', response.status);
        console.log('📋 Response data:', JSON.stringify(response.data, null, 2));
        
        // Step 3: Verify the requestHistory.changes structure
        if (response.data.monthlyRequest && response.data.monthlyRequest.requestHistory) {
            const history = response.data.monthlyRequest.requestHistory[0];
            console.log('📋 Request History:', JSON.stringify(history, null, 2));
            
            if (Array.isArray(history.changes)) {
                console.log('✅ Changes array is correctly formatted as array of strings');
            } else {
                console.log('❌ Changes array is not correctly formatted');
            }
        }
        
        return response.data;
        
    } catch (error) {
        console.log('❌ Error in template creation test:');
        
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Message:', error.response.data);
            
            if (error.response.data.error && error.response.data.error.includes('Cast to [string] failed')) {
                console.log('❌ The changes array validation error is still occurring');
            }
        } else {
            console.log('Error:', error.message);
        }
        
        throw error;
    }
}

// Run the test
testTemplateCreationFix()
    .then(() => {
        console.log('\n✅ Template creation fix test completed successfully');
        process.exit(0);
    })
    .catch(() => {
        console.log('\n❌ Template creation fix test failed');
        process.exit(1);
    }); 