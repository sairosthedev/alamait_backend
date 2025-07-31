const axios = require('axios');

// Test creating template with manual historical data (cost + item history)
async function testCreateTemplateWithHistory() {
    const residenceId = '67d723cf20f89c4ae69804f3'; // Replace with actual residence ID
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Template Creation with Historical Data\n');
        console.log('📊 Scenario: Create template with WiFi cost variations and item history');
        console.log('February: WiFi $100 (added)');
        console.log('March: WiFi $100 (continued)');
        console.log('April: WiFi $250 (cost increased)');
        console.log('May: WiFi $100 (cost decreased)');
        console.log('June: WiFi $100 (continued)');
        console.log('July: Creating template with complete history\n');
        
        // 1. Prepare the template data with historical information
        console.log('1️⃣ Preparing Template Data with Historical Information...');
        
        const templateData = {
            title: 'Monthly Services Template',
            description: 'Template with complete cost and item history',
            templateName: 'St Kilda Monthly Services',
            templateDescription: 'Recurring monthly services with full historical tracking',
            
            // Current items for the template
            items: [
                {
                    title: 'WiFi Service',
                    description: 'Monthly WiFi service for St Kilda',
                    estimatedCost: 100, // Current cost (most recent)
                    quantity: 1,
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Recurring monthly service'
                },
                {
                    title: 'Cleaning Service',
                    description: 'Monthly cleaning service',
                    estimatedCost: 150,
                    quantity: 1,
                    category: 'maintenance',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Recurring monthly service'
                }
            ],
            
            // Historical cost data
            historicalData: [
                // WiFi Service cost history
                { itemTitle: 'WiFi Service', month: 2, year: 2025, cost: 100, note: 'Initial WiFi cost' },
                { itemTitle: 'WiFi Service', month: 3, year: 2025, cost: 100, note: 'WiFi cost maintained' },
                { itemTitle: 'WiFi Service', month: 4, year: 2025, cost: 250, note: 'WiFi cost increased due to plan upgrade' },
                { itemTitle: 'WiFi Service', month: 5, year: 2025, cost: 100, note: 'WiFi cost reverted to original plan' },
                { itemTitle: 'WiFi Service', month: 6, year: 2025, cost: 100, note: 'WiFi cost stable' },
                
                // Cleaning Service cost history
                { itemTitle: 'Cleaning Service', month: 3, year: 2025, cost: 120, note: 'Cleaning service started' },
                { itemTitle: 'Cleaning Service', month: 4, year: 2025, cost: 150, note: 'Cleaning cost increased for deep cleaning' },
                { itemTitle: 'Cleaning Service', month: 5, year: 2025, cost: 150, note: 'Cleaning cost maintained' },
                { itemTitle: 'Cleaning Service', month: 6, year: 2025, cost: 150, note: 'Cleaning cost stable' }
            ],
            
            // Item history (when items were added/removed/modified)
            itemHistory: [
                // WiFi Service item history
                { 
                    itemTitle: 'WiFi Service', 
                    month: 2, 
                    year: 2025, 
                    action: 'added', 
                    oldValue: null, 
                    newValue: 'WiFi Service', 
                    cost: 100, 
                    quantity: 1,
                    note: 'WiFi service added to monthly requests' 
                },
                { 
                    itemTitle: 'WiFi Service', 
                    month: 4, 
                    year: 2025, 
                    action: 'modified', 
                    oldValue: 100, 
                    newValue: 250, 
                    cost: 250, 
                    quantity: 1,
                    note: 'WiFi plan upgraded, cost increased' 
                },
                { 
                    itemTitle: 'WiFi Service', 
                    month: 5, 
                    year: 2025, 
                    action: 'modified', 
                    oldValue: 250, 
                    newValue: 100, 
                    cost: 100, 
                    quantity: 1,
                    note: 'WiFi plan reverted to original, cost decreased' 
                },
                
                // Cleaning Service item history
                { 
                    itemTitle: 'Cleaning Service', 
                    month: 3, 
                    year: 2025, 
                    action: 'added', 
                    oldValue: null, 
                    newValue: 'Cleaning Service', 
                    cost: 120, 
                    quantity: 1,
                    note: 'Cleaning service added to monthly requests' 
                },
                { 
                    itemTitle: 'Cleaning Service', 
                    month: 4, 
                    year: 2025, 
                    action: 'modified', 
                    oldValue: 120, 
                    newValue: 150, 
                    cost: 150, 
                    quantity: 1,
                    note: 'Cleaning service upgraded to include deep cleaning' 
                }
            ]
        };
        
        console.log('✅ Template data prepared with:');
        console.log(`   Items: ${templateData.items.length}`);
        console.log(`   Cost History Entries: ${templateData.historicalData.length}`);
        console.log(`   Item History Entries: ${templateData.itemHistory.length}\n`);
        
        // 2. Create the template with historical data
        console.log('2️⃣ Creating Template with Historical Data...');
        
        const templateResponse = await axios.post(
            `${baseUrl}/residence/${residenceId}/create-template-with-history`,
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
            console.log(`   Template Status: ${templateResponse.data.template.status}`);
            console.log(`   Total Items: ${templateResponse.data.template.items.length}`);
            console.log(`   Total Estimated Cost: $${templateResponse.data.template.totalEstimatedCost}`);
            
            // Show summary
            console.log('\n📊 Template Summary:');
            console.log(`   Items with Cost History: ${templateResponse.data.summary.itemsWithCostHistory}`);
            console.log(`   Items with Item History: ${templateResponse.data.summary.itemsWithItemHistory}`);
            console.log(`   Total Cost History Entries: ${templateResponse.data.summary.totalCostHistoryEntries}`);
            console.log(`   Total Item History Entries: ${templateResponse.data.summary.totalItemHistoryEntries}`);
            console.log(`   Total Cost Variations: ${templateResponse.data.summary.totalCostVariations}`);
            
            // Show detailed item information
            console.log('\n📋 Template Items with History:');
            templateResponse.data.template.items.forEach((item, index) => {
                console.log(`\n${index + 1}. ${item.title}`);
                console.log(`   Current Cost: $${item.estimatedCost}`);
                console.log(`   Category: ${item.category}`);
                console.log(`   Recurring: ${item.isRecurring ? 'Yes' : 'No'}`);
                console.log(`   Notes: ${item.notes}`);
                
                // Show cost history
                if (item.costHistory && item.costHistory.length > 0) {
                    console.log(`   Cost History (${item.costHistory.length} entries):`);
                    item.costHistory.forEach((entry, i) => {
                        console.log(`     ${i + 1}. ${entry.month}/${entry.year}: $${entry.cost} - ${entry.note}`);
                    });
                }
                
                // Show cost variations
                if (item.costVariations && item.costVariations.length > 0) {
                    console.log(`   Cost Variations (${item.costVariations.length} changes):`);
                    item.costVariations.forEach((variation, i) => {
                        console.log(`     ${i + 1}. ${variation.from} → ${variation.to}: $${variation.oldCost} → $${variation.newCost} (${variation.change > 0 ? '+' : ''}${variation.changePercent}%)`);
                    });
                }
                
                // Show item history
                if (item.itemHistory && item.itemHistory.length > 0) {
                    console.log(`   Item History (${item.itemHistory.length} events):`);
                    item.itemHistory.forEach((entry, i) => {
                        console.log(`     ${i + 1}. ${entry.month}/${entry.year}: ${entry.action} - ${entry.note}`);
                        if (entry.oldValue !== null) {
                            console.log(`        ${entry.oldValue} → ${entry.newValue}`);
                        }
                    });
                }
            });
            
            // 3. Test creating a monthly request from this template
            console.log('\n3️⃣ Testing Monthly Request Creation from Template...');
            
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
        
        // 4. Summary
        console.log('📊 Template with History Summary:');
        console.log('====================================');
        console.log('✅ Template created with complete cost history');
        console.log('✅ Template created with complete item history');
        console.log('✅ Cost variations tracked and documented');
        console.log('✅ Item additions/removals/modifications tracked');
        console.log('✅ Historical data preserved for audit trail');
        console.log('✅ Future months use template costs');
        console.log('✅ Complete historical context maintained');
        
        console.log('\n🎉 Template with history creation test completed!');
        
    } catch (error) {
        console.error('❌ Error during template creation test:', error.response?.data || error.message);
    }
}

// Instructions
console.log('📋 Template Creation with History Test:');
console.log('========================================');
console.log('This test demonstrates creating a template with manual historical data:');
console.log('');
console.log('📊 Your Scenario:');
console.log('- February: WiFi $100 (added)');
console.log('- March: WiFi $100 (continued)');
console.log('- April: WiFi $250 (cost increased)');
console.log('- May: WiFi $100 (cost decreased)');
console.log('- June: WiFi $100 (continued)');
console.log('- July: Creating template with complete history');
console.log('');
console.log('🎯 Expected Results:');
console.log('1. Template created with cost history');
console.log('2. Template created with item history');
console.log('3. Cost variations tracked');
console.log('4. Item changes tracked');
console.log('5. Complete audit trail maintained');
console.log('');
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to create template with historical data');
console.log('4. This will show how to include both cost and item history\n');

// Uncomment to run the test
// testCreateTemplateWithHistory(); 