// Test script to identify monthly request validation issues
const axios = require('axios');

// Test different scenarios that could cause 400 errors
const testScenarios = [
    {
        name: 'Complete valid request',
        data: {
            title: 'Test WiFi Service',
            description: 'WiFi service for testing',
            residence: '507f1f77bcf86cd799439011', // This needs to be a real residence ID
            month: 12,
            year: 2024,
            items: [
                {
                    description: 'WiFi Service',
                    quantity: 1,
                    estimatedCost: 150.00,
                    category: 'utilities',
                    isRecurring: true
                }
            ],
            priority: 'medium',
            isTemplate: false
        }
    },
    {
        name: 'Missing title',
        data: {
            description: 'WiFi service for testing',
            residence: '507f1f77bcf86cd799439011',
            month: 12,
            year: 2024,
            items: [
                {
                    description: 'WiFi Service',
                    quantity: 1,
                    estimatedCost: 150.00,
                    category: 'utilities',
                    isRecurring: true
                }
            ],
            priority: 'medium',
            isTemplate: false
        }
    },
    {
        name: 'Missing description',
        data: {
            title: 'Test WiFi Service',
            residence: '507f1f77bcf86cd799439011',
            month: 12,
            year: 2024,
            items: [
                {
                    description: 'WiFi Service',
                    quantity: 1,
                    estimatedCost: 150.00,
                    category: 'utilities',
                    isRecurring: true
                }
            ],
            priority: 'medium',
            isTemplate: false
        }
    },
    {
        name: 'Missing residence',
        data: {
            title: 'Test WiFi Service',
            description: 'WiFi service for testing',
            month: 12,
            year: 2024,
            items: [
                {
                    description: 'WiFi Service',
                    quantity: 1,
                    estimatedCost: 150.00,
                    category: 'utilities',
                    isRecurring: true
                }
            ],
            priority: 'medium',
            isTemplate: false
        }
    },
    {
        name: 'Missing month',
        data: {
            title: 'Test WiFi Service',
            description: 'WiFi service for testing',
            residence: '507f1f77bcf86cd799439011',
            year: 2024,
            items: [
                {
                    description: 'WiFi Service',
                    quantity: 1,
                    estimatedCost: 150.00,
                    category: 'utilities',
                    isRecurring: true
                }
            ],
            priority: 'medium',
            isTemplate: false
        }
    },
    {
        name: 'Missing year',
        data: {
            title: 'Test WiFi Service',
            description: 'WiFi service for testing',
            residence: '507f1f77bcf86cd799439011',
            month: 12,
            items: [
                {
                    description: 'WiFi Service',
                    quantity: 1,
                    estimatedCost: 150.00,
                    category: 'utilities',
                    isRecurring: true
                }
            ],
            priority: 'medium',
            isTemplate: false
        }
    },
    {
        name: 'Invalid month (13)',
        data: {
            title: 'Test WiFi Service',
            description: 'WiFi service for testing',
            residence: '507f1f77bcf86cd799439011',
            month: 13,
            year: 2024,
            items: [
                {
                    description: 'WiFi Service',
                    quantity: 1,
                    estimatedCost: 150.00,
                    category: 'utilities',
                    isRecurring: true
                }
            ],
            priority: 'medium',
            isTemplate: false
        }
    },
    {
        name: 'Invalid year (2019)',
        data: {
            title: 'Test WiFi Service',
            description: 'WiFi service for testing',
            residence: '507f1f77bcf86cd799439011',
            month: 12,
            year: 2019,
            items: [
                {
                    description: 'WiFi Service',
                    quantity: 1,
                    estimatedCost: 150.00,
                    category: 'utilities',
                    isRecurring: true
                }
            ],
            priority: 'medium',
            isTemplate: false
        }
    },
    {
        name: 'Template request (should not require month/year)',
        data: {
            title: 'Test Template',
            description: 'Template for testing',
            residence: '507f1f77bcf86cd799439011',
            items: [
                {
                    description: 'Template Item',
                    quantity: 1,
                    estimatedCost: 100.00,
                    category: 'utilities',
                    isRecurring: true
                }
            ],
            priority: 'medium',
            isTemplate: true
        }
    }
];

async function testValidationScenarios() {
    console.log('🧪 Testing Monthly Request Validation Scenarios\n');
    
    for (const scenario of testScenarios) {
        console.log(`\n--- Testing: ${scenario.name} ---`);
        console.log('Request data:', JSON.stringify(scenario.data, null, 2));
        
        try {
            const response = await axios.post(
                'https://alamait-backend.onrender.com/api/monthly-requests',
                scenario.data,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    },
                    timeout: 10000
                }
            );
            
            console.log(`✅ ${scenario.name} - SUCCESS (${response.status})`);
            console.log('Response:', response.data);
            
        } catch (error) {
            console.log(`❌ ${scenario.name} - FAILED`);
            console.log('Status:', error.response?.status);
            console.log('Error message:', error.response?.data?.message || error.message);
            
            if (error.response?.data) {
                console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
            }
        }
        
        // Wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🧪 Validation testing complete!');
}

// Instructions for running the test
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Replace the residence ID with a real residence ID from your database');
console.log('3. Run this script to test different validation scenarios');
console.log('4. Check the output to identify which validation is failing\n');

// Uncomment the line below to run the tests
// testValidationScenarios(); 