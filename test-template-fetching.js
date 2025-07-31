const axios = require('axios');

// Test the automatic template fetching functionality
async function testTemplateFetching() {
    const residenceId = '67d723cf20f89c4ae69804f3'; // Replace with actual residence ID
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Automatic Template Fetching for Residence Selection\n');
        
        // 1. Get templates for residence selection
        console.log('1️⃣ Getting templates for residence selection...');
        const templatesResponse = await axios.get(
            `${baseUrl}/residence/${residenceId}/templates`,
            {
                headers: {
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Templates for residence:', JSON.stringify(templatesResponse.data, null, 2));
        
        // 2. If templates exist, test creating monthly request without items (should auto-use template)
        if (templatesResponse.data.templates && templatesResponse.data.templates.length > 0) {
            console.log('\n2️⃣ Testing automatic template usage when creating monthly request without items...');
            
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();
            
            const monthlyRequestData = {
                title: 'Monthly Request',
                description: 'Monthly request',
                residence: residenceId,
                month: currentMonth,
                year: currentYear,
                isTemplate: false,
                items: [] // Empty items array - should auto-use template
            };
            
            const createResponse = await axios.post(
                baseUrl,
                monthlyRequestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            console.log('✅ Auto-created monthly request from template:', JSON.stringify(createResponse.data, null, 2));
            
            // 3. Test creating monthly request for different months using template
            console.log('\n3️⃣ Testing template usage for different months...');
            
            const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
            const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
            
            const nextMonthRequestData = {
                title: 'Next Month Request',
                description: 'Next month request',
                residence: residenceId,
                month: nextMonth,
                year: nextYear,
                isTemplate: false,
                items: [] // Should auto-use template
            };
            
            const nextMonthResponse = await axios.post(
                baseUrl,
                nextMonthRequestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            console.log('✅ Auto-created next month request from template:', JSON.stringify(nextMonthResponse.data, null, 2));
            
        } else {
            console.log('\n2️⃣ No templates found. Creating a template first...');
            
            // Create a template
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
                    },
                    {
                        title: 'Cleaning Service',
                        description: 'Monthly cleaning service',
                        estimatedCost: 300,
                        category: 'services',
                        priority: 'high'
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
            
            console.log('✅ Template created:', JSON.stringify(createTemplateResponse.data, null, 2));
            
            // Now test the automatic template usage
            console.log('\n3️⃣ Testing automatic template usage after creating template...');
            
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();
            
            const monthlyRequestData = {
                title: 'Monthly Request',
                description: 'Monthly request',
                residence: residenceId,
                month: currentMonth,
                year: currentYear,
                isTemplate: false,
                items: [] // Should now auto-use the created template
            };
            
            const createResponse = await axios.post(
                baseUrl,
                monthlyRequestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            console.log('✅ Auto-created monthly request from new template:', JSON.stringify(createResponse.data, null, 2));
        }
        
        // 4. Test the template table format
        console.log('\n4️⃣ Testing template table format...');
        
        if (templatesResponse.data.templates && templatesResponse.data.templates.length > 0) {
            const firstTemplate = templatesResponse.data.templates[0];
            
            const tableResponse = await axios.get(
                `${baseUrl}/templates/${firstTemplate.id}/table`,
                {
                    headers: {
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            console.log('✅ Template table format:', JSON.stringify(tableResponse.data, null, 2));
        }
        
        // 5. Test creating monthly request with manual items (should not use template)
        console.log('\n5️⃣ Testing monthly request creation with manual items (should not auto-use template)...');
        
        const manualRequestData = {
            title: 'Manual Monthly Request',
            description: 'Manual monthly request with custom items',
            residence: residenceId,
            month: currentMonth,
            year: currentYear,
            isTemplate: false,
            items: [
                {
                    title: 'Custom Service',
                    description: 'Custom service for this month only',
                    estimatedCost: 100,
                    category: 'other',
                    priority: 'low'
                }
            ]
        };
        
        const manualResponse = await axios.post(
            baseUrl,
            manualRequestData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Manual monthly request created:', JSON.stringify(manualResponse.data, null, 2));
        
        console.log('\n🎉 Template fetching and auto-usage test completed!');
        
    } catch (error) {
        console.error('❌ Error during template fetching test:', error.response?.data || error.message);
    }
}

// Instructions
console.log('📋 Instructions for Template Fetching Test:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test automatic template fetching');
console.log('4. The script will test:');
console.log('   - Getting templates when selecting a residence');
console.log('   - Automatic template usage when creating monthly requests without items');
console.log('   - Template usage for different months');
console.log('   - Template table format display');
console.log('   - Manual monthly request creation (should not auto-use template)');
console.log('5. Templates should be automatically used for recurring monthly requests');
console.log('6. When no items are provided, the system should auto-use the first available template\n');

// Uncomment to run the test
// testTemplateFetching(); 