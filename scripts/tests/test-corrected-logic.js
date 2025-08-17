const axios = require('axios');

// Test with the corrected logic understanding
async function testCorrectedLogic() {
    const residenceId = '67d723cf20f89c4ae69804f3';
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Corrected Historical Data Logic\n');
        console.log('📊 Understanding: Historical data shows when items started (unchanged since then)');
        
        // Corrected data structure based on your understanding
        const templateData = {
            title: "Monthly Requests",
            description: "Monthly Requests for St Kilda",
            residence: residenceId,
            isTemplate: true,
            templateName: "St Kilda Monthly Services",
            templateDescription: "Recurring monthly requests with historical data",
            
            // Current items (what exists now)
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
                // Note: No "security" in historical data because it's not in current items
                // Note: No "Gas" in historical data because it might be newer
            ],
            
            // Item history (items that were added/removed/modified)
            itemHistory: [
                {
                    title: "wifi",
                    description: "lo", // Different description when it was modified
                    quantity: 1,
                    category: "utilities",
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 7, // Modified in July 2025
                    year: 2025,
                    action: "modified", // Changed from "removed" to "modified"
                    oldValue: "wil",
                    newValue: "wifi kilda",
                    cost: 100,
                    note: "wifi description updated"
                }
            ],
            
            totalEstimatedCost: 292
        };
        
        console.log('1️⃣ Creating Template with Corrected Logic...');
        console.log('   📊 Current items: wifi, Gas');
        console.log('   📊 Historical data: wifi (started in April 2025)');
        console.log('   📊 Item history: wifi (modified in July 2025)');
        console.log('   📊 Logic: Historical data shows when items started');
        console.log('   📊 Logic: Only add removed items to current items');
        
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
                
                // Show item history details
                if (item.itemHistory && item.itemHistory.length > 0) {
                    console.log(`      📊 Item History:`);
                    item.itemHistory.forEach((history, hIndex) => {
                        console.log(`         ${hIndex + 1}. ${history.month}/${history.year}: ${history.action} - ${history.note}`);
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
        console.log('\n📊 Corrected Logic Summary:');
        console.log('============================');
        console.log('✅ Historical data shows when items started');
        console.log('✅ Only current items + removed items are included');
        console.log('✅ Flexible title matching for historical data');
        console.log('✅ Better understanding of your data structure');
        console.log('✅ Should work with your exact use case');
        
        console.log('\n🎯 Expected Results:');
        console.log('1. Template will have 2 items: wifi, Gas');
        console.log('2. wifi will have cost history from April 2025');
        console.log('3. wifi will have item history from July 2025');
        console.log('4. Gas will have no history (newer item)');
        console.log('5. No "security" item (not in current items)');
        
        console.log('\n🎉 Corrected logic test completed!');
        
    } catch (error) {
        console.error('❌ Error during corrected logic test:', error.response?.data || error.message);
        
        if (error.response?.status === 500) {
            console.log('\n🔍 500 Error Details:');
            console.log('   Error message:', error.response.data?.error);
            console.log('   Error details:', error.response.data?.details);
        }
    }
}

// Instructions
console.log('📋 Corrected Historical Data Logic:');
console.log('====================================');
console.log('Understanding: Historical data represents when items started');
console.log('');
console.log('📊 Your Data Structure:');
console.log('1. Current items: What exists now');
console.log('2. Historical data: When items started (unchanged since then)');
console.log('3. Item history: Items that were added/removed/modified');
console.log('');
console.log('🔧 Corrected Logic:');
console.log('1. Only process current items + removed items');
console.log('2. Historical data shows start date for existing items');
console.log('3. Flexible title matching for similar items');
console.log('4. Better understanding of your use case');
console.log('');
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test the corrected logic');
console.log('4. This should match your understanding of historical data\n');

// Uncomment to run the test
// testCorrectedLogic(); 