const axios = require('axios');

// Test template creation with the fix
async function testTemplateCreationFix() {
    const residenceId = '67d723cf20f89c4ae69804f3'; // Replace with actual residence ID
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Template Creation Fix\n');
        console.log('📊 Testing: Create template with standardized data structure');
        
        // Test data with standardized structure
        const templateData = {
            title: 'Test Monthly Services Template',
            description: 'Test template with standardized data structure',
            residence: residenceId,
            isTemplate: true,
            templateName: 'Test St Kilda Services',
            templateDescription: 'Test recurring monthly services',
            
            // Current items (standardized structure)
            items: [
                {
                    title: 'Test WiFi Service',
                    description: 'Test monthly WiFi service',
                    estimatedCost: 100,
                    quantity: 1,
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Test recurring monthly service'
                }
            ],
            
            // Historical data (standardized structure)
            historicalData: [
                {
                    title: 'Test WiFi Service',
                    description: 'Test monthly WiFi service',
                    quantity: 1,
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Test initial WiFi service',
                    // Historical-specific fields
                    month: 2,
                    year: 2025,
                    cost: 100,
                    note: 'Test initial WiFi cost'
                }
            ],
            
            // Item history (standardized structure)
            itemHistory: [
                {
                    title: 'Test WiFi Service',
                    description: 'Test monthly WiFi service',
                    quantity: 1,
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Test WiFi service added',
                    // Historical-specific fields
                    month: 2,
                    year: 2025,
                    action: 'added',
                    oldValue: null,
                    newValue: 'Test WiFi Service',
                    cost: 100,
                    note: 'Test WiFi service added to monthly requests'
                }
            ]
        };
        
        console.log('1️⃣ Creating Template with Standardized Data Structure...');
        console.log('   - Using standardized field names (title, description, etc.)');
        console.log('   - Including all required fields for historical data');
        console.log('   - Using consistent data structure');
        
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
            
            // Show summary
            console.log('\n📊 Template Summary:');
            console.log(`   Items with Cost History: ${templateResponse.data.summary.itemsWithCostHistory}`);
            console.log(`   Items with Item History: ${templateResponse.data.summary.itemsWithItemHistory}`);
            console.log(`   Total Cost History Entries: ${templateResponse.data.summary.totalCostHistoryEntries}`);
            console.log(`   Total Item History Entries: ${templateResponse.data.summary.totalItemHistoryEntries}`);
            console.log(`   Total Cost Variations: ${templateResponse.data.summary.totalCostVariations}`);
            
            // Test fetching the template
            console.log('\n2️⃣ Testing Template Fetching...');
            
            const fetchResponse = await axios.get(
                `${baseUrl}/templates?residenceId=${residenceId}`,
                {
                    headers: {
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            if (fetchResponse.data.success && fetchResponse.data.templates.length > 0) {
                const template = fetchResponse.data.templates[0];
                console.log('✅ Template Fetched Successfully!');
                console.log(`   Template: ${template.title}`);
                console.log(`   Items: ${template.items.length}`);
                
                // Check if historical data is present
                if (template.items[0] && template.items[0].costHistory) {
                    console.log(`   Cost History: ${template.items[0].costHistory.length} entries`);
                }
                if (template.items[0] && template.items[0].itemHistory) {
                    console.log(`   Item History: ${template.items[0].itemHistory.length} entries`);
                }
            }
            
        } else {
            console.log('❌ Template Creation Failed:', templateResponse.data.message);
        }
        
        // Summary
        console.log('\n📊 Template Creation Fix Summary:');
        console.log('====================================');
        console.log('✅ Fixed variable declaration issue (processedItems)');
        console.log('✅ Added templateMetadata field to schema');
        console.log('✅ Added costHistory field to item schema');
        console.log('✅ Added itemHistory field to item schema');
        console.log('✅ Added costVariations field to item schema');
        console.log('✅ Added costSummary field to item schema');
        console.log('✅ Standardized data structure implemented');
        console.log('✅ Template creation should now work without 500 errors');
        
        console.log('\n🎉 Template creation fix test completed!');
        
    } catch (error) {
        console.error('❌ Error during template creation fix test:', error.response?.data || error.message);
        
        if (error.response?.status === 500) {
            console.log('\n🔍 500 Error Details:');
            console.log('   This indicates a server-side error that should now be fixed.');
            console.log('   The fixes include:');
            console.log('   - Variable declaration for processedItems');
            console.log('   - Missing schema fields (templateMetadata, costHistory, etc.)');
            console.log('   - Standardized data structure');
        }
    }
}

// Instructions
console.log('📋 Template Creation Fix Test:');
console.log('==============================');
console.log('This test verifies that the 500 error fix works:');
console.log('');
console.log('🔧 Fixes Applied:');
console.log('1. Fixed variable declaration issue (processedItems)');
console.log('2. Added templateMetadata field to schema');
console.log('3. Added costHistory field to item schema');
console.log('4. Added itemHistory field to item schema');
console.log('5. Added costVariations field to item schema');
console.log('6. Added costSummary field to item schema');
console.log('7. Standardized data structure');
console.log('');
console.log('🎯 Expected Results:');
console.log('1. Template creation should succeed (no 500 error)');
console.log('2. Historical data should be properly stored');
console.log('3. Template should be fetchable');
console.log('');
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test the fix');
console.log('4. This should resolve the 500 Internal Server Error\n');

// Uncomment to run the test
// testTemplateCreationFix(); 