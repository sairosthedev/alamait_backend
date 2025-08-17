const axios = require('axios');

// Test fetching templates for specific months to show inactive items
async function testTemplateFetchingByMonth() {
    const residenceId = '67d723cf20f89c4ae69804f3';
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Template Fetching by Month (Inactive Items)\n');
        console.log('📊 Scenario: Fetch template for different months to show item states');
        
        // Test fetching for different months
        const testMonths = [
            { month: 4, year: 2025, description: 'April 2025 - wifi started' },
            { month: 5, year: 2025, description: 'May 2025 - wifi cost increased' },
            { month: 7, year: 2025, description: 'July 2025 - wifi removed (should be inactive)' },
            { month: 8, year: 2025, description: 'August 2025 - wifi added back' },
            { month: 12, year: 2025, description: 'December 2025 - current state' }
        ];
        
        for (const testCase of testMonths) {
            console.log(`\n📅 Testing: ${testCase.description}`);
            console.log(`   Fetching template for ${testCase.month}/${testCase.year}...`);
            
            try {
                const response = await axios.get(
                    `${baseUrl}/residence/${residenceId}/templates?month=${testCase.month}&year=${testCase.year}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                        }
                    }
                );
                
                if (response.data.success && response.data.templates.length > 0) {
                    const template = response.data.templates[0]; // Get first template
                    console.log(`   ✅ Template found: ${template.title}`);
                    console.log(`   📊 Total items: ${template.items.length}`);
                    
                    // Show items and their states
                    template.items.forEach((item, index) => {
                        console.log(`   ${index + 1}. ${item.title}`);
                        console.log(`      Description: ${item.description}`);
                        console.log(`      Category: ${item.category}`);
                        console.log(`      Cost: $${item.estimatedCost}`);
                        
                        if (item.status === 'inactive') {
                            console.log(`      ❌ Status: INACTIVE`);
                            console.log(`      📝 Note: ${item.inactiveNote}`);
                        } else {
                            console.log(`      ✅ Status: Active`);
                        }
                        
                        if (item.historicalNote) {
                            console.log(`      📊 History: ${item.historicalNote}`);
                        }
                        
                        if (item.itemChangeNote) {
                            console.log(`      🔄 Change: ${item.itemChangeNote}`);
                        }
                        
                        console.log('');
                    });
                    
                    // Show context information
                    if (response.data.context) {
                        console.log(`   📋 Context: ${response.data.context.note}`);
                    }
                    
                } else {
                    console.log(`   ⚠️  No templates found for ${testCase.month}/${testCase.year}`);
                }
                
            } catch (error) {
                console.error(`   ❌ Error fetching for ${testCase.month}/${testCase.year}:`, error.response?.data?.message || error.message);
            }
        }
        
        // Summary
        console.log('\n📊 Template Fetching by Month Summary:');
        console.log('=====================================');
        console.log('✅ April 2025: wifi should be active at $100');
        console.log('✅ May 2025: wifi should be active at $120 (cost increased)');
        console.log('❌ July 2025: wifi should be INACTIVE (removed)');
        console.log('✅ August 2025: wifi should be active at $150 (added back)');
        console.log('✅ December 2025: wifi should be active at $150 (current state)');
        
        console.log('\n🎯 Expected Results:');
        console.log('1. July 2025 should show wifi as inactive with $0 cost');
        console.log('2. Other months should show wifi as active with appropriate costs');
        console.log('3. Historical notes should explain the state changes');
        console.log('4. Item change notes should show what happened in each month');
        
        console.log('\n🎉 Template fetching by month test completed!');
        
    } catch (error) {
        console.error('❌ Error during template fetching by month test:', error.response?.data || error.message);
    }
}

// Instructions
console.log('📋 Template Fetching by Month (Inactive Items):');
console.log('==============================================');
console.log('Scenario: Fetch templates for specific months to show item states');
console.log('');
console.log('📊 Test Cases:');
console.log('1. April 2025: wifi started at $100');
console.log('2. May 2025: wifi cost increased to $120');
console.log('3. July 2025: wifi removed (should show as inactive)');
console.log('4. August 2025: wifi added back at $150');
console.log('5. December 2025: current state');
console.log('');
console.log('🔧 Logic:');
console.log('1. Items removed in past months show as inactive');
console.log('2. Inactive items have $0 cost');
console.log('3. Historical data shows appropriate costs for active items');
console.log('4. Item change notes explain the timeline');
console.log('');
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Ensure you have a template with wifi item history');
console.log('4. Run this script to test month-specific template fetching');
console.log('5. July 2025 should show wifi as inactive\n');

// Uncomment to run the test
// testTemplateFetchingByMonth(); 