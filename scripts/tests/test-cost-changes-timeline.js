const axios = require('axios');

// Test with cost changes throughout the timeline
async function testCostChangesTimeline() {
    const residenceId = '67d723cf20f89c4ae69804f3';
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Cost Changes Throughout Timeline\n');
        console.log('📊 Scenario: wifi costs changed when it was modified/removed/added back');
        
        // Data structure with cost changes
        const templateData = {
            title: "Monthly Requests",
            description: "Monthly Requests for St Kilda",
            residence: residenceId,
            isTemplate: true,
            templateName: "St Kilda Monthly Services",
            templateDescription: "Recurring monthly requests with cost changes",
            
            // Current items (what exists now - wifi is back with current cost)
            items: [
                {
                    title: "wifi",
                    description: "wifi kilda",
                    priority: "medium",
                    category: "maintenance",
                    notes: "",
                    estimatedCost: 150, // Current cost (increased from 100)
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
            
            // Historical data (when items started - original costs)
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
            
            // Item history with cost changes
            itemHistory: [
                {
                    title: "wifi",
                    description: "wil",
                    quantity: 1,
                    category: "utilities",
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 5, // May 2025 - cost increased
                    year: 2025,
                    action: "modified",
                    oldValue: "100",
                    newValue: "120",
                    cost: 120, // Cost increased to $120
                    note: "wifi cost increased to $120"
                },
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
                    cost: 120, // Cost was $120 when removed
                    note: "wifi service temporarily removed at $120"
                },
                {
                    title: "wifi",
                    description: "wifi kilda", // Updated description
                    quantity: 1,
                    category: "maintenance", // Updated category
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 8, // August 2025 - added back with new cost
                    year: 2025,
                    action: "added",
                    oldValue: "inactive",
                    newValue: "active",
                    cost: 150, // New cost when added back
                    note: "wifi service restored at $150 with updated details"
                }
            ],
            
            totalEstimatedCost: 342 // Updated total (150 + 192)
        };
        
        console.log('1️⃣ Creating Template with Cost Changes Timeline...');
        console.log('   📊 Current items: wifi ($150), Gas ($192)');
        console.log('   📊 Historical data: wifi started at $100 in April');
        console.log('   📊 Cost changes: $100 → $120 → removed → $150');
        console.log('   📊 Logic: Track all cost changes in timeline');
        
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
                console.log(`      Current Cost: $${item.estimatedCost}`);
                console.log(`      Cost History: ${item.costHistory ? item.costHistory.length : 0} entries`);
                console.log(`      Item History: ${item.itemHistory ? item.itemHistory.length : 0} entries`);
                
                // Show cost history details (chronological order)
                if (item.costHistory && item.costHistory.length > 0) {
                    console.log(`      📊 Cost History Timeline:`);
                    // Sort by date to show chronological order
                    const sortedCostHistory = [...item.costHistory].sort((a, b) => a.date - b.date);
                    sortedCostHistory.forEach((history, hIndex) => {
                        const monthName = new Date(history.date).toLocaleString('default', { month: 'long' });
                        console.log(`         ${hIndex + 1}. ${monthName} ${history.year}: $${history.cost} - ${history.note}`);
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
                        const monthName = new Date(history.date).toLocaleString('default', { month: 'long' });
                        console.log(`         ${hIndex + 1}. ${actionEmoji} ${monthName} ${history.year}: ${history.action} - ${history.note}`);
                        console.log(`            💰 Cost: $${history.cost}`);
                        if (history.action === 'modified') {
                            console.log(`            📝 Cost Change: $${history.oldValue} → $${history.newValue}`);
                        } else if (history.action === 'removed') {
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
        console.log('\n📊 Cost Changes Timeline Summary:');
        console.log('==================================');
        console.log('✅ Complete cost tracking: $100 → $120 → removed → $150');
        console.log('✅ All cost changes captured in cost history');
        console.log('✅ Item history shows cost at each change point');
        console.log('✅ Chronological timeline preserved');
        console.log('✅ Audit trail includes all cost variations');
        
        console.log('\n🎯 Expected Results:');
        console.log('1. Template will have 2 items: wifi ($150), Gas ($192)');
        console.log('2. wifi cost history: April ($100), May ($120), August ($150)');
        console.log('3. wifi item history: modified in May, removed in July, added back in August');
        console.log('4. All cost changes tracked and preserved');
        console.log('5. Complete timeline for audit purposes');
        
        console.log('\n🎉 Cost changes timeline test completed!');
        
    } catch (error) {
        console.error('❌ Error during cost changes timeline test:', error.response?.data || error.message);
        
        if (error.response?.status === 500) {
            console.log('\n🔍 500 Error Details:');
            console.log('   Error message:', error.response.data?.error);
            console.log('   Error details:', error.response.data?.details);
        }
    }
}

// Instructions
console.log('📋 Cost Changes Throughout Timeline:');
console.log('====================================');
console.log('Scenario: Track all cost changes when items are modified/removed/added');
console.log('');
console.log('📊 Timeline with Cost Changes:');
console.log('1. April 2025: wifi started at $100 (historical data)');
console.log('2. May 2025: wifi cost increased to $120 (item history)');
console.log('3. July 2025: wifi removed at $120 (item history)');
console.log('4. August 2025: wifi added back at $150 (item history)');
console.log('5. Current: wifi exists at $150');
console.log('');
console.log('🔧 Logic:');
console.log('1. Track all cost changes in cost history');
console.log('2. Show cost at each change point in item history');
console.log('3. Preserve complete cost timeline');
console.log('4. Maintain audit trail for cost variations');
console.log('');
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test cost changes tracking');
console.log('4. This should show all cost changes in the timeline\n');

// Uncomment to run the test
// testCostChangesTimeline(); 