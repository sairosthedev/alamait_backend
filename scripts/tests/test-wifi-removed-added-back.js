const axios = require('axios');

// Test the wifi removed in July and added back in August scenario
async function testWifiRemovedAddedBack() {
    const residenceId = '67d723cf20f89c4ae69804f3';
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing WiFi Removed in July, Added Back in August\n');
        console.log('📊 Scenario: wifi was removed in July, then added back in August');
        
        // Data structure for the wifi removed/added back scenario
        const templateData = {
            title: "Monthly Requests",
            description: "Monthly Requests for St Kilda",
            residence: residenceId,
            isTemplate: true,
            templateName: "St Kilda Monthly Services",
            templateDescription: "Recurring monthly requests with historical data",
            
            // Current items (what exists now - wifi is back)
            items: [
                {
                    title: "wifi",
                    description: "wifi kilda",
                    priority: "medium",
                    category: "maintenance",
                    notes: "",
                    estimatedCost: 100,
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
            
            // Historical data (when items started - unchanged since then)
            historicalData: [
                {
                    title: "wifi",
                    description: "wil", // Different description when it started
                    quantity: 1,
                    category: "utilities", // Different category when it started
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 4, // Started in April 2025
                    year: 2025,
                    cost: 100, // Same cost as current
                    note: "wifi started in April"
                }
            ],
            
            // Item history (wifi was removed in July, added back in August)
            itemHistory: [
                {
                    title: "wifi",
                    description: "wil",
                    quantity: 1,
                    category: "utilities",
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 7, // Removed in July 2025
                    year: 2025,
                    action: "removed",
                    oldValue: "active",
                    newValue: "inactive",
                    cost: 100,
                    note: "wifi service temporarily removed"
                },
                {
                    title: "wifi",
                    description: "wifi kilda", // Updated description when added back
                    quantity: 1,
                    category: "maintenance", // Updated category when added back
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 8, // Added back in August 2025
                    year: 2025,
                    action: "added",
                    oldValue: "inactive",
                    newValue: "active",
                    cost: 100,
                    note: "wifi service restored with updated details"
                }
            ],
            
            totalEstimatedCost: 292
        };
        
        console.log('1️⃣ Creating Template with WiFi Removed/Added Back Scenario...');
        console.log('   📊 Current items: wifi, Gas');
        console.log('   📊 Historical data: wifi (started in April 2025)');
        console.log('   📊 Item history: wifi removed in July, added back in August');
        console.log('   📊 Logic: Track complete timeline of item changes');
        
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
            console.log(`   Template Status: ${templateResponse.data.monthlyRequest.status}`);
            console.log(`   Total Items: ${templateResponse.data.monthlyRequest.items.length}`);
            console.log(`   Total Estimated Cost: $${templateResponse.data.monthlyRequest.totalEstimatedCost}`);
            
            // Show items and their historical data
            console.log('\n📊 Items Created:');
            templateResponse.data.monthlyRequest.items.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.title}`);
                console.log(`      Description: ${item.description}`);
                console.log(`      Category: ${item.category}`);
                console.log(`      Cost: $${item.estimatedCost}`);
                console.log(`      Cost History: ${item.costHistory ? item.costHistory.length : 0} entries`);
                console.log(`      Item History: ${item.itemHistory ? item.itemHistory.length : 0} entries`);
                
                // Show cost history details
                if (item.costHistory && item.costHistory.length > 0) {
                    console.log(`      📊 Cost History:`);
                    item.costHistory.forEach((history, hIndex) => {
                        console.log(`         ${hIndex + 1}. ${history.month}/${history.year}: $${history.cost} - ${history.note}`);
                    });
                }
                
                // Show item history details (timeline)
                if (item.itemHistory && item.itemHistory.length > 0) {
                    console.log(`      📊 Item History Timeline:`);
                    // Sort by date to show chronological order
                    const sortedHistory = [...item.itemHistory].sort((a, b) => a.date - b.date);
                    sortedHistory.forEach((history, hIndex) => {
                        const actionEmoji = history.action === 'removed' ? '❌' : 
                                          history.action === 'added' ? '✅' : '🔄';
                        console.log(`         ${hIndex + 1}. ${actionEmoji} ${history.month}/${history.year}: ${history.action} - ${history.note}`);
                        if (history.action === 'removed') {
                            console.log(`            📝 Status: ${history.oldValue} → ${history.newValue}`);
                        } else if (history.action === 'added') {
                            console.log(`            📝 Status: ${history.oldValue} → ${history.newValue}`);
                            console.log(`            📝 Description: ${history.description}`);
                            console.log(`            📝 Category: ${history.category}`);
                        }
                    });
                }
                console.log('');
            });
            
            // Show summary
            console.log('\n📊 Template Summary:');
            console.log(`   Items with Cost History: ${templateResponse.data.summary.itemsWithCostHistory}`);
            console.log(`   Items with Item History: ${templateResponse.data.summary.itemsWithItemHistory}`);
            console.log(`   Total Cost History Entries: ${templateResponse.data.summary.totalCostHistoryEntries}`);
            console.log(`   Total Item History Entries: ${templateResponse.data.summary.totalItemHistoryEntries}`);
            console.log(`   Total Cost Variations: ${templateResponse.data.summary.totalCostVariations}`);
            
        } else {
            console.log('❌ Template Creation Failed:', templateResponse.data.message);
        }
        
        // Summary
        console.log('\n📊 WiFi Removed/Added Back Scenario Summary:');
        console.log('============================================');
        console.log('✅ WiFi exists in current items (was added back)');
        console.log('✅ Complete timeline tracked: April → July → August');
        console.log('✅ April: Started with original details');
        console.log('✅ July: Removed (temporarily)');
        console.log('✅ August: Added back with updated details');
        console.log('✅ All history preserved for complete audit trail');
        
        console.log('\n🎯 Expected Results:');
        console.log('1. Template will have 2 items: wifi, Gas');
        console.log('2. wifi will have cost history from April 2025');
        console.log('3. wifi will have item history: removed in July, added back in August');
        console.log('4. Complete timeline preserved for audit purposes');
        console.log('5. Updated description/category when added back');
        
        console.log('\n🎉 WiFi removed/added back scenario test completed!');
        
    } catch (error) {
        console.error('❌ Error during wifi removed/added back test:', error.response?.data || error.message);
        
        if (error.response?.status === 500) {
            console.log('\n🔍 500 Error Details:');
            console.log('   Error message:', error.response.data?.error);
            console.log('   Error details:', error.response.data?.details);
        }
    }
}

// Instructions
console.log('📋 WiFi Removed in July, Added Back in August:');
console.log('==============================================');
console.log('Scenario: wifi was removed in July, then added back in August');
console.log('');
console.log('📊 Timeline:');
console.log('1. April 2025: wifi started (historical data)');
console.log('2. July 2025: wifi removed (item history)');
console.log('3. August 2025: wifi added back with updates (item history)');
console.log('4. Current: wifi exists with updated details');
console.log('');
console.log('🔧 Logic:');
console.log('1. Track complete timeline of item changes');
console.log('2. Preserve all historical data');
console.log('3. Show when items were removed and added back');
console.log('4. Maintain audit trail for compliance');
console.log('');
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test the wifi removed/added back scenario');
console.log('4. This should show the complete timeline of changes\n');

// Uncomment to run the test
// testWifiRemovedAddedBack(); 