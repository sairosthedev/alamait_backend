const axios = require('axios');

// Test the template functionality
async function testTemplateFunctionality() {
    const residenceId = '67d723cf20f89c4ae69804f3'; // Replace with actual residence ID
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Template Functionality for Monthly Requests\n');
        
        // 1. Get available templates for the residence
        console.log('1️⃣ Getting available templates...');
        const templatesResponse = await axios.get(
            `${baseUrl}/available-templates/${residenceId}`,
            {
                headers: {
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Available templates:', JSON.stringify(templatesResponse.data, null, 2));
        
        // 2. If templates exist, create a monthly request from the first template
        if (templatesResponse.data.templates && templatesResponse.data.templates.length > 0) {
            const firstTemplate = templatesResponse.data.templates[0];
            console.log(`\n2️⃣ Creating monthly request from template: ${firstTemplate.title}`);
            
            const createFromTemplateResponse = await axios.post(
                `${baseUrl}/templates/${firstTemplate.id}`,
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
            
            console.log('✅ Created from template:', JSON.stringify(createFromTemplateResponse.data, null, 2));
        } else {
            console.log('\n2️⃣ No templates available. Creating a template first...');
            
            // 3. Create a template if none exist
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
            
            console.log('✅ Template created:', JSON.stringify(createTemplateResponse.data, null, 2));
            
            // 4. Now create a monthly request from the new template
            console.log('\n3️⃣ Creating monthly request from the new template...');
            const createFromNewTemplateResponse = await axios.post(
                `${baseUrl}/templates/${createTemplateResponse.data._id}`,
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
            
            console.log('✅ Created from new template:', JSON.stringify(createFromNewTemplateResponse.data, null, 2));
        }
        
        // 5. Test creating a monthly request without items (should suggest templates)
        console.log('\n4️⃣ Testing monthly request creation without items (should suggest templates)...');
        try {
            const noItemsResponse = await axios.post(
                baseUrl,
                {
                    title: 'Test Request',
                    description: 'Test description',
                    residence: residenceId,
                    month: 12,
                    year: 2024,
                    isTemplate: false,
                    items: [] // Empty items array
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            console.log('❌ Unexpected success:', noItemsResponse.data);
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('✅ Correctly suggested templates:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('❌ Unexpected error:', error.response?.data || error.message);
            }
        }
        
        console.log('\n🎉 Template functionality test completed!');
        
    } catch (error) {
        console.error('❌ Error during template functionality test:', error.response?.data || error.message);
    }
}

// Instructions
console.log('📋 Instructions:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test template functionality');
console.log('4. The script will:');
console.log('   - Get available templates for the residence');
console.log('   - Create a template if none exist');
console.log('   - Create monthly requests from templates');
console.log('   - Test template suggestions when no items are provided\n');

// Uncomment to run the test
// testTemplateFunctionality(); 