const axios = require('axios');

// Test the correct timeline logic for cost changes
async function testCorrectTimelineLogic() {
    const residenceId = '67d723cf20f89c4ae69804f3';
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Correct Timeline Logic for Cost Changes\n');
        console.log('📊 Scenario: wifi started in April at $100, removed in July, added back in August at $100, increased to $120 in September');
        
        // Create template with the correct timeline
        const templateData = {
            title: "Monthly Requests",
            description: "Monthly Requests for St Kilda",
            residence: residenceId,
            isTemplate: true,
            templateName: "St Kilda Monthly Services",
            templateDescription: "Recurring monthly requests with correct timeline",
            
            // Current items (what exists now)
            items: [
                {
                    title: "wifi",
                    description: "wifi kilda",
                    priority: "medium",
                    category: "maintenance",
                    notes: "",
                    estimatedCost: 120, // Current cost (increased from 100)
                    quantity: 1,
                    isRecurring: true,
                    tags: []
                },
                {
                    title: "Gas",
                    description: "Gas for St Kilda",
                    priority: "medium",
                    category: "maintenance",
                    notes: "",
                    estimatedCost: 192,
                    quantity: 1,
                    isRecurring: true,
                    tags: []
                }
            ],
            
            // Historical data (when items started)
            historicalData: [
                {
                    title: "wifi",
                    description: "wil",
                    quantity: 1,
                    category: "utilities",
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 4, // Started in April 2025
                    year: 2025,
                    cost: 100, // Original cost
                    note: "wifi started in April at $100"
                }
            ],
            
            // Item history with correct timeline
            itemHistory: [
                {
                    title: "wifi",
                    description: "wil",
                    quantity: 1,
                    category: "utilities",
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 7, // July 2025 - removed
                    year: 2025,
                    action: "removed",
                    oldValue: "active",
                    newValue: "inactive",
                    cost: 100, // Cost was $100 when removed
                    note: "wifi service temporarily removed"
                },
                {
                    title: "wifi",
                    description: "wifi kilda", // Updated description
                    quantity: 1,
                    category: "maintenance", // Updated category
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 8, // August 2025 - added back
                    year: 2025,
                    action: "added",
                    oldValue: "inactive",
                    newValue: "active",
                    cost: 100, // Added back at $100
                    note: "wifi service restored at $100 with updated details"
                },
                {
                    title: "wifi",
                    description: "wifi kilda",
                    quantity: 1,
                    category: "maintenance",
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 9, // September 2025 - cost increased
                    year: 2025,
                    action: "modified",
                    oldValue: "100",
                    newValue: "120",
                    cost: 120, // Cost increased to $120
                    note: "wifi cost increased to $120"
                }
            ],
            
            totalEstimatedCost: 312 // Updated total (120 + 192)
        };
        
        console.log('1️⃣ Creating Template with Correct Timeline...');
        console.log('   📊 Timeline: April ($100) → July (removed) → August ($100) → September ($120)');
        
        const templateResponse = await axios.post(
            baseUrl,
            templateData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        if (templateResponse.data.success) {
            console.log('✅ Template Created Successfully!');
            console.log(`   Template ID: ${templateResponse.data.monthlyRequest._id}`);
            
            // Now test fetching for different months
            const testMonths = [
                { month: 4, year: 2025, expectedCost: 100, description: 'April 2025 - wifi started' },
                { month: 5, year: 2025, expectedCost: 100, description: 'May 2025 - wifi continued' },
                { month: 6, year: 2025, expectedCost: 100, description: 'June 2025 - wifi continued' },
                { month: 7, year: 2025, expectedCost: 0, description: 'July 2025 - wifi removed (inactive)' },
                { month: 8, year: 2025, expectedCost: 100, description: 'August 2025 - wifi added back' },
                { month: 9, year: 2025, expectedCost: 120, description: 'September 2025 - wifi cost increased' },
                { month: 12, year: 2025, expectedCost: 120, description: 'December 2025 - current state' }
            ];
            
            console.log('\n2️⃣ Testing Template Fetching for Different Months...');
            
            for (const testCase of testMonths) {
                console.log(`\n📅 Testing: ${testCase.description}`);
                console.log(`   Expected cost: $${testCase.expectedCost}`);
                
                try {
                    const fetchResponse = await axios.get(
                        `${baseUrl}/residence/${residenceId}/templates?month=${testCase.month}&year=${testCase.year}`,
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                            }
                        }
                    );
                    
                    if (fetchResponse.data.success && fetchResponse.data.templates.length > 0) {
                        const template = fetchResponse.data.templates[0];
                        const wifiItem = template.items.find(item => item.title === 'wifi');
                        
                        if (wifiItem) {
                            console.log(`   ✅ Found wifi item`);
                            console.log(`   📊 Actual cost: $${wifiItem.estimatedCost}`);
                            console.log(`   📊 Status: ${wifiItem.status || 'active'}`);
                            
                            if (wifiItem.status === 'inactive') {
                                console.log(`   📝 Note: ${wifiItem.inactiveNote}`);
                            }
                            
                            if (wifiItem.historicalNote) {
                                console.log(`   📊 History: ${wifiItem.historicalNote}`);
                            }
                            
                            if (wifiItem.itemChangeNote) {
                                console.log(`   🔄 Change: ${wifiItem.itemChangeNote}`);
                            }
                            
                            // Verify the cost matches expectation
                            if (wifiItem.estimatedCost === testCase.expectedCost) {
                                console.log(`   ✅ Cost matches expectation!`);
                            } else {
                                console.log(`   ❌ Cost mismatch! Expected: $${testCase.expectedCost}, Got: $${wifiItem.estimatedCost}`);
                            }
                        } else {
                            console.log(`   ⚠️  wifi item not found`);
                        }
                    } else {
                        console.log(`   ⚠️  No templates found for ${testCase.month}/${testCase.year}`);
                    }
                    
                } catch (error) {
                    console.error(`   ❌ Error fetching for ${testCase.month}/${testCase.year}:`, error.response?.data?.message || error.message);
                }
            }
            
        } else {
            console.log('❌ Template Creation Failed:', templateResponse.data.message);
        }
        
        // Summary
        console.log('\n📊 Correct Timeline Logic Summary:');
        console.log('==================================');
        console.log('✅ April-June 2025: wifi active at $100');
        console.log('❌ July 2025: wifi inactive (removed)');
        console.log('✅ August 2025: wifi active at $100 (added back)');
        console.log('✅ September+ 2025: wifi active at $120 (cost increased)');
        
        console.log('\n🎯 Expected Results:');
        console.log('1. April-June: wifi should be active at $100');
        console.log('2. July: wifi should be inactive with $0 cost');
        console.log('3. August: wifi should be active at $100');
        console.log('4. September+: wifi should be active at $120');
        console.log('5. Cost history should show the most recent cost before each month');
        
        console.log('\n🎉 Correct timeline logic test completed!');
        
    } catch (error) {
        console.error('❌ Error during correct timeline logic test:', error.response?.data || error.message);
    }
}

// Instructions
console.log('📋 Correct Timeline Logic for Cost Changes:');
console.log('===========================================');
console.log('Scenario: wifi started in April at $100, removed in July, added back in August at $100, increased to $120 in September');
console.log('');
console.log('📊 Timeline:');
console.log('1. April 2025: wifi started at $100');
console.log('2. May-June 2025: wifi continued at $100');
console.log('3. July 2025: wifi removed (inactive)');
console.log('4. August 2025: wifi added back at $100');
console.log('5. September 2025: wifi cost increased to $120');
console.log('6. Current: wifi exists at $120');
console.log('');
console.log('🔧 Logic:');
console.log('1. Show most recent cost before requested month');
console.log('2. Inactive items show $0 cost');
console.log('3. Cost changes are tracked chronologically');
console.log('4. Item status reflects the timeline');
console.log('');
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test the correct timeline logic');
console.log('4. Verify that costs match expectations for each month\n');

// Uncomment to run the test
// testCorrectTimelineLogic(); 