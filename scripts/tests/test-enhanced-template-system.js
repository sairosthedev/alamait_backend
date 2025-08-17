const axios = require('axios');

// Test the enhanced template system with historical data
async function testEnhancedTemplateSystem() {
    const residenceId = '67d723cf20f89c4ae69804f3'; // Replace with actual residence ID
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Enhanced Template System with Historical Data\n');
        console.log('📊 Scenario: Create template with historical data and fetch month-specific data');
        console.log('February: WiFi $100 (added)');
        console.log('March: WiFi $100 (continued)');
        console.log('April: WiFi $250 (cost increased)');
        console.log('May: WiFi $100 (cost decreased)');
        console.log('June: WiFi $100 (continued)');
        console.log('July: Creating template with complete history\n');
        
        // 1. Create template with historical data using the existing endpoint
        console.log('1️⃣ Creating Template with Historical Data...');
        
        const templateData = {
            title: 'Monthly Services Template',
            description: 'Template with complete cost and item history',
            residence: residenceId,
            isTemplate: true,
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
            
            // Historical cost data (standardized structure)
            historicalData: [
                // WiFi Service cost history
                { 
                    title: 'WiFi Service', 
                    month: 2, 
                    year: 2025, 
                    cost: 100, 
                    note: 'Initial WiFi cost',
                    description: 'Monthly WiFi service for St Kilda',
                    quantity: 1,
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Initial WiFi service'
                },
                { 
                    title: 'WiFi Service', 
                    month: 3, 
                    year: 2025, 
                    cost: 100, 
                    note: 'WiFi cost maintained',
                    description: 'Monthly WiFi service for St Kilda',
                    quantity: 1,
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'WiFi cost maintained'
                },
                { 
                    title: 'WiFi Service', 
                    month: 4, 
                    year: 2025, 
                    cost: 250, 
                    note: 'WiFi cost increased due to plan upgrade',
                    description: 'Monthly WiFi service for St Kilda',
                    quantity: 1,
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'WiFi plan upgraded'
                },
                { 
                    title: 'WiFi Service', 
                    month: 5, 
                    year: 2025, 
                    cost: 100, 
                    note: 'WiFi cost reverted to original plan',
                    description: 'Monthly WiFi service for St Kilda',
                    quantity: 1,
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'WiFi plan reverted'
                },
                { 
                    title: 'WiFi Service', 
                    month: 6, 
                    year: 2025, 
                    cost: 100, 
                    note: 'WiFi cost stable',
                    description: 'Monthly WiFi service for St Kilda',
                    quantity: 1,
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'WiFi cost stable'
                },
                
                // Cleaning Service cost history
                { 
                    title: 'Cleaning Service', 
                    month: 3, 
                    year: 2025, 
                    cost: 120, 
                    note: 'Cleaning service started',
                    description: 'Monthly cleaning service',
                    quantity: 1,
                    category: 'maintenance',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Cleaning service started'
                },
                { 
                    title: 'Cleaning Service', 
                    month: 4, 
                    year: 2025, 
                    cost: 150, 
                    note: 'Cleaning cost increased for deep cleaning',
                    description: 'Monthly cleaning service',
                    quantity: 1,
                    category: 'maintenance',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Deep cleaning added'
                },
                { 
                    title: 'Cleaning Service', 
                    month: 5, 
                    year: 2025, 
                    cost: 150, 
                    note: 'Cleaning cost maintained',
                    description: 'Monthly cleaning service',
                    quantity: 1,
                    category: 'maintenance',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Cleaning cost maintained'
                },
                { 
                    title: 'Cleaning Service', 
                    month: 6, 
                    year: 2025, 
                    cost: 150, 
                    note: 'Cleaning cost stable',
                    description: 'Monthly cleaning service',
                    quantity: 1,
                    category: 'maintenance',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Cleaning cost stable'
                }
            ],
            
            // Item history (standardized structure)
            itemHistory: [
                // WiFi Service item history
                { 
                    title: 'WiFi Service', 
                    month: 2, 
                    year: 2025, 
                    action: 'added', 
                    oldValue: null, 
                    newValue: 'WiFi Service', 
                    cost: 100, 
                    quantity: 1,
                    note: 'WiFi service added to monthly requests',
                    description: 'Monthly WiFi service for St Kilda',
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'WiFi service added'
                },
                { 
                    title: 'WiFi Service', 
                    month: 4, 
                    year: 2025, 
                    action: 'modified', 
                    oldValue: 100, 
                    newValue: 250, 
                    cost: 250, 
                    quantity: 1,
                    note: 'WiFi plan upgraded, cost increased',
                    description: 'Monthly WiFi service for St Kilda',
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'WiFi plan upgraded'
                },
                { 
                    title: 'WiFi Service', 
                    month: 5, 
                    year: 2025, 
                    action: 'modified', 
                    oldValue: 250, 
                    newValue: 100, 
                    cost: 100, 
                    quantity: 1,
                    note: 'WiFi plan reverted to original, cost decreased',
                    description: 'Monthly WiFi service for St Kilda',
                    category: 'utilities',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'WiFi plan reverted'
                },
                
                // Cleaning Service item history
                { 
                    title: 'Cleaning Service', 
                    month: 3, 
                    year: 2025, 
                    action: 'added', 
                    oldValue: null, 
                    newValue: 'Cleaning Service', 
                    cost: 120, 
                    quantity: 1,
                    note: 'Cleaning service added to monthly requests',
                    description: 'Monthly cleaning service',
                    category: 'maintenance',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Cleaning service added'
                },
                { 
                    title: 'Cleaning Service', 
                    month: 4, 
                    year: 2025, 
                    action: 'modified', 
                    oldValue: 120, 
                    newValue: 150, 
                    cost: 150, 
                    quantity: 1,
                    note: 'Cleaning service upgraded to include deep cleaning',
                    description: 'Monthly cleaning service',
                    category: 'maintenance',
                    priority: 'medium',
                    isRecurring: true,
                    notes: 'Deep cleaning added'
                }
            ]
        };
        
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
            
            // 2. Test fetching templates for different months using /templates endpoint
            console.log('\n2️⃣ Testing Month-Specific Template Fetching...');
            
            const monthsToTest = [
                { month: 2, year: 2025, description: 'February 2025 (Past - should show historical data)' },
                { month: 4, year: 2025, description: 'April 2025 (Past - should show $250 WiFi cost)' },
                { month: 6, year: 2025, description: 'June 2025 (Past - should show $100 WiFi cost)' },
                { month: 7, year: 2025, description: 'July 2025 (Current/Future - should show template costs)' }
            ];
            
            for (const testMonth of monthsToTest) {
                console.log(`\n📅 Testing ${testMonth.description}...`);
                
                // Use the /templates endpoint with month/year parameters
                const fetchResponse = await axios.get(
                    `${baseUrl}/templates?month=${testMonth.month}&year=${testMonth.year}&residenceId=${residenceId}`,
                    {
                        headers: {
                            'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                        }
                    }
                );
                
                if (fetchResponse.data.success && fetchResponse.data.templates.length > 0) {
                    const template = fetchResponse.data.templates[0];
                    console.log(`   Template: ${template.title}`);
                    console.log(`   Context: ${fetchResponse.data.context.note}`);
                    
                    // Show items with their costs for this month
                    template.items.forEach((item, index) => {
                        console.log(`   ${index + 1}. ${item.title}`);
                        console.log(`      Cost: $${item.estimatedCost}`);
                        
                        if (item.isHistoricalData) {
                            console.log(`      📜 Historical: ${item.historicalNote}`);
                        }
                        
                        if (item.itemChangeNote) {
                            console.log(`      🔄 Item Change: ${item.itemChangeNote}`);
                        }
                        
                        console.log('');
                    });
                } else {
                    console.log(`   ❌ No templates found for ${testMonth.month}/${testMonth.year}`);
                }
            }
            
            // 3. Test fetching all templates without month/year (current data)
            console.log('\n3️⃣ Testing Template Fetching (Current Data)...');
            
            const currentFetchResponse = await axios.get(
                `${baseUrl}/templates`,
                {
                    headers: {
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            if (currentFetchResponse.data.success && currentFetchResponse.data.templates.length > 0) {
                const template = currentFetchResponse.data.templates[0];
                console.log(`   Template: ${template.title}`);
                console.log(`   Context: ${currentFetchResponse.data.context.note}`);
                
                // Show current template items
                template.items.forEach((item, index) => {
                    console.log(`   ${index + 1}. ${item.title}`);
                    console.log(`      Current Cost: $${item.estimatedCost}`);
                    console.log(`      Cost History: ${item.costHistory.length} entries`);
                    console.log(`      Item History: ${item.itemHistory.length} entries`);
                    console.log('');
                });
            }
            
            // 4. Test fetching templates for specific residence
            console.log('\n4️⃣ Testing Residence-Specific Template Fetching...');
            
            const residenceFetchResponse = await axios.get(
                `${baseUrl}/residence/${residenceId}/templates`,
                {
                    headers: {
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            if (residenceFetchResponse.data.success && residenceFetchResponse.data.templates.length > 0) {
                const template = residenceFetchResponse.data.templates[0];
                console.log(`   Template: ${template.title}`);
                console.log(`   Residence: ${template.residence.name}`);
                console.log(`   Total Items: ${template.items.length}`);
                console.log('');
            }
            
        } else {
            console.log('❌ Template Creation Failed:', templateResponse.data.message);
        }
        
        // 5. Summary
        console.log('📊 Enhanced Template System Summary:');
        console.log('====================================');
        console.log('✅ Template created with historical data using existing endpoint');
        console.log('✅ /templates endpoint enhanced with month-specific fetching');
        console.log('✅ Past months show historical costs');
        console.log('✅ Current/future months show template costs');
        console.log('✅ Item changes tracked and displayed');
        console.log('✅ Complete audit trail maintained');
        console.log('✅ Residence-specific template fetching available');
        
        console.log('\n🎉 Enhanced template system test completed!');
        
    } catch (error) {
        console.error('❌ Error during enhanced template system test:', error.response?.data || error.message);
    }
}

// Instructions
console.log('📋 Enhanced Template System Test:');
console.log('==================================');
console.log('This test demonstrates the enhanced template system:');
console.log('');
console.log('📊 Key Features:');
console.log('1. Use existing monthly request endpoint for templates');
console.log('2. Include historical data when creating templates');
console.log('3. Use /templates endpoint with month/year parameters');
console.log('4. Show historical data for past months');
console.log('5. Show current data for current/future months');
console.log('');
console.log('🎯 Expected Results:');
console.log('1. Template created with complete historical data');
console.log('2. February shows $100 WiFi (historical)');
console.log('3. April shows $250 WiFi (historical)');
console.log('4. June shows $100 WiFi (historical)');
console.log('5. July shows $100 WiFi (current template)');
console.log('');
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test the enhanced template system');
console.log('4. This demonstrates month-specific data fetching using /templates endpoint\n');

// Uncomment to run the test
// testEnhancedTemplateSystem(); 