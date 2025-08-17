const axios = require('axios');

// Test data that matches what the frontend is sending (missing quantity field)
const templateData = {
    title: 'Monthly Requests',
    description: 'Monthly Requests St Kilda',
    residence: '67d723cf20f89c4ae69804f3',
    isTemplate: true,
    items: [
        {
            title: 'Gas',
            description: 'Gas for St Kilda',
            priority: 'medium',
            category: 'maintenance',
            notes: '',
            estimatedCost: 192,
            tags: []
        },
        {
            title: 'wifi',
            description: 'wifi kilda',
            priority: 'medium',
            category: 'maintenance',
            notes: '',
            estimatedCost: 150,
            tags: []
        }
    ],
    totalEstimatedCost: 342
};

async function testTemplateQuantityFix() {
    try {
        console.log('🧪 Testing Template Creation with Missing Quantity Fields...\n');
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
        
        // Check if the items have quantity fields
        if (response.data.items) {
            console.log('\n📋 Items with quantity fields:');
            response.data.items.forEach((item, index) => {
                console.log(`  Item ${index + 1}: ${item.title}`);
                console.log(`    Quantity: ${item.quantity}`);
                console.log(`    Estimated Cost: ${item.estimatedCost}`);
                console.log(`    Category: ${item.category}`);
            });
        }
        
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
console.log('3. Run this script to test template creation with missing quantity fields');
console.log('4. Check if the backend automatically adds quantity=1 to items\n');

// Uncomment to run the test
// testTemplateQuantityFix(); 