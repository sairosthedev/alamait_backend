const axios = require('axios');

const BASE_URL = 'http://localhost:5002';

async function testTemplateCreationWithAuth() {
    try {
        console.log('🧪 Testing template creation with authentication...');
        
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
        
        // Step 2: Create template
        console.log('📝 Step 2: Creating template...');
        const templateData = {
            title: "Test Template",
            description: "A test template for monthly requests",
            residence: "67d723cf20f89c4ae69804f3", // Replace with actual residence ID
            isTemplate: true, // This is the key field!
            items: [
                {
                    title: "Test Item 1",
                    description: "First test item",
                    quantity: 1,
                    estimatedCost: 100,
                    category: "maintenance",
                    priority: "medium"
                },
                {
                    title: "Test Item 2", 
                    description: "Second test item",
                    quantity: 2,
                    estimatedCost: 50,
                    category: "utilities",
                    priority: "low"
                }
            ]
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
        
        return response.data;
        
    } catch (error) {
        console.log('❌ Error in template creation test:');
        
        if (error.code === 'ECONNREFUSED') {
            console.log('🔌 Connection refused - server might not be running on port 5002');
            console.log('💡 Try starting the server with: npm start');
        } else if (error.code === 'ENOTFOUND') {
            console.log('🌐 Could not connect to localhost:5002');
        } else if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Message:', error.response.data);
            
            if (error.response.status === 401) {
                console.log('🔐 Authentication failed - check your credentials');
            } else if (error.response.status === 404) {
                console.log('🔍 Endpoint not found - check the route');
            }
        } else {
            console.log('Error:', error.message);
        }
        
        throw error;
    }
}

// Run the test
testTemplateCreationWithAuth()
    .then(() => {
        console.log('\n✅ Template creation test completed successfully');
        process.exit(0);
    })
    .catch(() => {
        console.log('\n❌ Template creation test failed');
        process.exit(1);
    }); 