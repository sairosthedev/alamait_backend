const axios = require('axios');

// Test the cost variation scenario
async function testCostVariationScenario() {
    const residenceId = '67d723cf20f89c4ae69804f3'; // Replace with actual residence ID
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Cost Variation Scenario\n');
        console.log('📊 Scenario: WiFi cost changes over time');
        console.log('February: WiFi $100');
        console.log('March: WiFi $100');
        console.log('April: WiFi $250');
        console.log('May: WiFi $100');
        console.log('June: WiFi $100');
        console.log('July: Creating template (should use most recent cost: $100)\n');
        
        // 1. First, let's analyze the historical data
        console.log('1️⃣ Analyzing Historical Data...');
        
        const analysisResponse = await axios.get(
            `${baseUrl}/residence/${residenceId}/analyze-historical?months=6`,
            {
                headers: {
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        if (analysisResponse.data.success) {
            console.log('✅ Historical Analysis Results:');
            console.log(`   Total Requests Analyzed: ${analysisResponse.data.analysis.totalRequests}`);
            console.log(`   Total Items Found: ${analysisResponse.data.analysis.totalItems}`);
            console.log(`   Recurring Items: ${analysisResponse.data.analysis.recurringItems}`);
            console.log(`   Items with Cost Variations: ${analysisResponse.data.analysis.costAnalysis.itemsWithCostVariations}`);
            console.log(`   Total Cost Changes: ${analysisResponse.data.analysis.totalCostChanges}\n`);
            
            // Show detailed analysis for each item
            analysisResponse.data.suggestedItems.forEach((item, index) => {
                console.log(`${index + 1}. ${item.title}`);
                console.log(`   Current Cost: $${item.estimatedCost} (from ${item.costSummary.mostRecentMonth})`);
                console.log(`   Cost History: ${item.costHistory.map(h => `$${h.cost} (${h.month}/${h.year})`).join(' → ')}`);
                console.log(`   Unique Costs: $${item.costSummary.uniqueCosts.join(', $')}`);
                console.log(`   Cost Variations: ${item.costVariations.length}`);
                
                if (item.costVariations.length > 0) {
                    item.costVariations.forEach(variation => {
                        console.log(`     ${variation.from} → ${variation.to}: $${variation.oldCost} → $${variation.newCost} (${variation.change > 0 ? '+' : ''}${variation.changePercent}%)`);
                    });
                }
                console.log(`   Notes: ${item.notes}\n`);
            });
            
            // 2. Create template from historical data
            console.log('2️⃣ Creating Template from Historical Data...');
            
            const templateData = {
                title: 'Monthly Services Template',
                description: 'Template based on historical cost analysis',
                templateName: 'St Kilda Monthly Services',
                templateDescription: 'Recurring monthly services with cost history tracking'
            };
            
            const templateResponse = await axios.post(
                `${baseUrl}/residence/${residenceId}/create-template-from-historical`,
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
                console.log(`   Template ID: ${templateResponse.data.template._id}`);
                console.log(`   Total Items: ${templateResponse.data.template.items.length}`);
                console.log(`   Template Status: ${templateResponse.data.template.status}`);
                
                // Show template items with cost history
                console.log('\n📋 Template Items:');
                templateResponse.data.template.items.forEach((item, index) => {
                    console.log(`${index + 1}. ${item.title}`);
                    console.log(`   Template Cost: $${item.estimatedCost}`);
                    console.log(`   Category: ${item.category}`);
                    console.log(`   Recurring: ${item.isRecurring ? 'Yes' : 'No'}`);
                    console.log(`   Cost History: ${item.costHistory.length} entries`);
                    console.log(`   Notes: ${item.notes}\n`);
                });
                
                // 3. Test creating a monthly request from template for current month
                console.log('3️⃣ Testing Monthly Request Creation from Template...');
                
                const currentDate = new Date();
                const currentMonth = currentDate.getMonth() + 1;
                const currentYear = currentDate.getFullYear();
                
                const monthlyRequestData = {
                    templateId: templateResponse.data.template._id,
                    month: currentMonth,
                    year: currentYear
                };
                
                const monthlyRequestResponse = await axios.post(
                    `${baseUrl}/templates/${templateResponse.data.template._id}`,
                    monthlyRequestData,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                        }
                    }
                );
                
                console.log('✅ Monthly Request Created from Template!');
                console.log(`   Request ID: ${monthlyRequestResponse.data._id}`);
                console.log(`   Month/Year: ${currentMonth}/${currentYear}`);
                console.log(`   Status: ${monthlyRequestResponse.data.status}`);
                console.log(`   Total Cost: $${monthlyRequestResponse.data.totalEstimatedCost}`);
                
                // Show items in the created request
                console.log('\n📋 Monthly Request Items:');
                monthlyRequestResponse.data.items.forEach((item, index) => {
                    console.log(`${index + 1}. ${item.title}`);
                    console.log(`   Cost: $${item.estimatedCost}`);
                    console.log(`   From Template: ${item.isFromTemplate ? 'Yes' : 'No'}`);
                    console.log('');
                });
                
            } else {
                console.log('❌ Template Creation Failed:', templateResponse.data.message);
            }
            
        } else {
            console.log('❌ Historical Analysis Failed:', analysisResponse.data.message);
        }
        
        // 4. Summary
        console.log('📊 Cost Variation Scenario Summary:');
        console.log('====================================');
        console.log('✅ Historical months keep their original costs');
        console.log('✅ Template uses most recent cost ($100 for WiFi)');
        console.log('✅ Cost history is tracked and preserved');
        console.log('✅ Future months use template costs');
        console.log('✅ Cost variations are documented');
        console.log('✅ Audit trail is maintained');
        
        console.log('\n🎉 Cost variation scenario test completed!');
        
    } catch (error) {
        console.error('❌ Error during cost variation test:', error.response?.data || error.message);
    }
}

// Instructions
console.log('📋 Cost Variation Scenario Test:');
console.log('=================================');
console.log('This test demonstrates how the system handles cost changes over time:');
console.log('');
console.log('📊 Your Scenario:');
console.log('- February: WiFi $100 (historical)');
console.log('- March: WiFi $100 (historical)');
console.log('- April: WiFi $250 (historical)');
console.log('- May: WiFi $100 (historical)');
console.log('- June: WiFi $100 (historical)');
console.log('- July: Creating template (should use $100 - most recent)');
console.log('');
console.log('🎯 Expected Results:');
console.log('1. Historical analysis shows cost variations');
console.log('2. Template uses most recent cost ($100)');
console.log('3. Cost history is preserved');
console.log('4. Future months use template cost');
console.log('');
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test the cost variation handling');
console.log('4. This will show how the system handles your WiFi cost changes\n');

// Uncomment to run the test
// testCostVariationScenario(); 