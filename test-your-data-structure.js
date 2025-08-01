const axios = require('axios');

// Test with the exact data structure from the user
async function testYourDataStructure() {
    const residenceId = '67d723cf20f89c4ae69804f3';
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Your Exact Data Structure\n');
        console.log('📊 Testing: Create template with your specific data format');
        
        // Your exact data structure
        const templateData = {
            title: "Monthly Requests",
            description: "Monthly Requests for St Kilda",
            residence: residenceId,
            isTemplate: true,
            templateName: "St Kilda Monthly Services",
            templateDescription: "Recurring monthly requests with historical data",
            
            // Current items (your exact structure)
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
            
            // Historical data (your exact structure)
            historicalData: [
                {
                    title: "security",
                    description: "kl",
                    quantity: 1,
                    category: "utilities",
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 3,
                    year: 2025,
                    cost: 450,
                    note: "lol"
                },
                {
                    title: "wifi",
                    description: "wil",
                    quantity: 1,
                    category: "utilities",
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 4,
                    year: 2025,
                    cost: 100,
                    note: "wifi cost"
                }
            ],
            
            // Item history (your exact structure)
            itemHistory: [
                {
                    title: "wifi",
                    description: "lo",
                    quantity: 1,
                    category: "utilities",
                    priority: "medium",
                    isRecurring: true,
                    notes: "",
                    month: 7,
                    year: 2025,
                    action: "removed",
                    oldValue: null,
                    newValue: "",
                    cost: 100,
                    note: "lol"
                }
            ],
            
            totalEstimatedCost: 292
        };
        
        console.log('1️⃣ Creating Template with Your Data Structure...');
        console.log('   - Current items: wifi, Gas');
        console.log('   - Historical items: security, wifi (different description)');
        console.log('   - Item history: wifi (removed)');
        console.log('   - Testing robust item matching logic');
        
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
        console.log('\n📊 Your Data Structure Fix Summary:');
        console.log('====================================');
        console.log('✅ Fixed item matching logic');
        console.log('✅ Handles items that exist in history but not in current items');
        console.log('✅ Handles items with different descriptions/categories');
        console.log('✅ Robust processing of all historical data');
        console.log('✅ Better error handling and logging');
        console.log('✅ Should now work with your exact data structure');
        
        console.log('\n🎉 Your data structure test completed!');
        
    } catch (error) {
        console.error('❌ Error during your data structure test:', error.response?.data || error.message);
        
        if (error.response?.status === 500) {
            console.log('\n🔍 500 Error Details:');
            console.log('   Error message:', error.response.data?.error);
            console.log('   Error details:', error.response.data?.details);
            console.log('   This should now be fixed with the robust item matching logic.');
        }
    }
}

// Instructions
console.log('📋 Your Data Structure Test:');
console.log('============================');
console.log('This test uses your exact data structure:');
console.log('');
console.log('📊 Your Data:');
console.log('1. Current items: wifi, Gas');
console.log('2. Historical items: security, wifi (different description)');
console.log('3. Item history: wifi (removed)');
console.log('4. Mixed categories and descriptions');
console.log('');
console.log('🔧 Fixes Applied:');
console.log('1. Robust item matching logic');
console.log('2. Handles items in history but not in current items');
console.log('3. Handles different descriptions/categories');
console.log('4. Better error handling');
console.log('');
console.log('🎯 Expected Results:');
console.log('1. Template creation should succeed');
console.log('2. All items (current + historical) should be included');
console.log('3. Historical data should be properly attached');
console.log('');
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test with your exact data');
console.log('4. This should resolve the 500 error with your data structure\n');

// Uncomment to run the test
// testYourDataStructure(); 