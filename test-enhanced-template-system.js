const axios = require('axios');

// Test the enhanced template system
async function testEnhancedTemplateSystem() {
    const residenceId = '67d723cf20f89c4ae69804f3'; // Replace with actual residence ID
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Enhanced Template System for Monthly Requests\n');
        
        // 1. Create a template first
        console.log('1️⃣ Creating a template...');
        const templateData = {
            title: 'Monthly Services Template',
            description: 'Template for monthly services',
            residence: residenceId,
            isTemplate: true,
            items: [
                {
                    title: 'WiFi Service',
                    description: 'Monthly WiFi service',
                    estimatedCost: 150,
                    category: 'utilities',
                    priority: 'medium'
                },
                {
                    title: 'Electricity',
                    description: 'Monthly electricity service',
                    estimatedCost: 200,
                    category: 'utilities',
                    priority: 'medium'
                }
            ]
        };
        
        const createTemplateResponse = await axios.post(
            baseUrl,
            templateData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        const templateId = createTemplateResponse.data._id;
        console.log('✅ Template created:', templateId);
        
        // 2. Get template items as table format
        console.log('\n2️⃣ Getting template items as table...');
        const tableResponse = await axios.get(
            `${baseUrl}/templates/${templateId}/table`,
            {
                headers: {
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Template table data:', JSON.stringify(tableResponse.data, null, 2));
        
        // 3. Add a new item to template (Admin action)
        console.log('\n3️⃣ Adding new item to template...');
        const newItemData = {
            title: 'Security Fees',
            description: 'Monthly security service fees',
            estimatedCost: 250,
            category: 'services',
            priority: 'high',
            notes: 'Increased security fees starting next month'
        };
        
        const addItemResponse = await axios.post(
            `${baseUrl}/templates/${templateId}/items`,
            newItemData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Item added to template:', JSON.stringify(addItemResponse.data, null, 2));
        
        // 4. Modify an existing item (Admin action)
        console.log('\n4️⃣ Modifying existing item...');
        const modifyItemResponse = await axios.put(
            `${baseUrl}/templates/${templateId}/items/0`,
            {
                field: 'estimatedCost',
                newValue: 180
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Item modified:', JSON.stringify(modifyItemResponse.data, null, 2));
        
        // 5. Get templates with pending changes (Finance view)
        console.log('\n5️⃣ Getting templates with pending changes...');
        const pendingChangesResponse = await axios.get(
            `${baseUrl}/templates/${residenceId}/pending-changes`,
            {
                headers: {
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Pending changes:', JSON.stringify(pendingChangesResponse.data, null, 2));
        
        // 6. Approve template changes (Finance action)
        if (pendingChangesResponse.data.templates.length > 0) {
            const template = pendingChangesResponse.data.templates[0];
            if (template.templateChanges.length > 0) {
                console.log('\n6️⃣ Approving template changes...');
                const approveResponse = await axios.post(
                    `${baseUrl}/templates/${templateId}/changes/0/approve`,
                    {},
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                        }
                    }
                );
                
                console.log('✅ Changes approved:', JSON.stringify(approveResponse.data, null, 2));
            }
        }
        
        // 7. Create monthly request from updated template
        console.log('\n7️⃣ Creating monthly request from updated template...');
        const createFromTemplateResponse = await axios.post(
            `${baseUrl}/templates/${templateId}`,
            {
                month: 12,
                year: 2024
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Monthly request created from template:', JSON.stringify(createFromTemplateResponse.data, null, 2));
        
        // 8. Test removing an item from template
        console.log('\n8️⃣ Removing item from template...');
        const removeItemResponse = await axios.delete(
            `${baseUrl}/templates/${templateId}/items/1`,
            {
                headers: {
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Item removed:', JSON.stringify(removeItemResponse.data, null, 2));
        
        // 9. Test rejecting a change (Finance action)
        console.log('\n9️⃣ Testing change rejection...');
        const rejectResponse = await axios.post(
            `${baseUrl}/templates/${templateId}/changes/1/reject`,
            {
                reason: 'Cost increase not justified'
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Change rejected:', JSON.stringify(rejectResponse.data, null, 2));
        
        console.log('\n🎉 Enhanced template system test completed!');
        
    } catch (error) {
        console.error('❌ Error during enhanced template system test:', error.response?.data || error.message);
    }
}

// Instructions
console.log('📋 Instructions for Enhanced Template System Test:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test the enhanced template system');
console.log('4. The script will test:');
console.log('   - Template creation with enhanced schema');
console.log('   - Getting template items as table format');
console.log('   - Adding items to templates (Admin)');
console.log('   - Modifying template items (Admin)');
console.log('   - Removing template items (Admin)');
console.log('   - Viewing pending changes (Finance)');
console.log('   - Approving template changes (Finance)');
console.log('   - Rejecting template changes (Finance)');
console.log('   - Creating monthly requests from updated templates');
console.log('5. All changes are effective from next month only');
console.log('6. Changes require finance approval before taking effect\n');

// Uncomment to run the test
// testEnhancedTemplateSystem(); 