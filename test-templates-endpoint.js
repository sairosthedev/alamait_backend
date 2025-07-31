const axios = require('axios');

// Test the templates endpoint
async function testTemplatesEndpoint() {
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Templates Endpoint\n');
        
        // 1. Test the general templates endpoint
        console.log('1️⃣ Testing GET /api/monthly-requests/templates...');
        const templatesResponse = await axios.get(
            `${baseUrl}/templates`,
            {
                headers: {
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log('✅ Templates response:', JSON.stringify(templatesResponse.data, null, 2));
        
        // 2. Test residence-specific templates endpoint
        if (templatesResponse.data.residences && templatesResponse.data.residences.length > 0) {
            const firstResidence = templatesResponse.data.residences[0];
            console.log(`\n2️⃣ Testing GET /api/monthly-requests/residence/${firstResidence.residence.id}/templates...`);
            
            const residenceTemplatesResponse = await axios.get(
                `${baseUrl}/residence/${firstResidence.residence.id}/templates`,
                {
                    headers: {
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            console.log('✅ Residence templates response:', JSON.stringify(residenceTemplatesResponse.data, null, 2));
            
            // 3. Test template table endpoint
            if (firstResidence.templates && firstResidence.templates.length > 0) {
                const firstTemplate = firstResidence.templates[0];
                console.log(`\n3️⃣ Testing GET /api/monthly-requests/templates/${firstTemplate.id}/table...`);
                
                const tableResponse = await axios.get(
                    `${baseUrl}/templates/${firstTemplate.id}/table`,
                    {
                        headers: {
                            'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                        }
                    }
                );
                
                console.log('✅ Template table response:', JSON.stringify(tableResponse.data, null, 2));
            }
        }
        
        // 4. Test available templates endpoint
        if (templatesResponse.data.residences && templatesResponse.data.residences.length > 0) {
            const firstResidence = templatesResponse.data.residences[0];
            console.log(`\n4️⃣ Testing GET /api/monthly-requests/available-templates/${firstResidence.residence.id}...`);
            
            const availableTemplatesResponse = await axios.get(
                `${baseUrl}/available-templates/${firstResidence.residence.id}`,
                {
                    headers: {
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            console.log('✅ Available templates response:', JSON.stringify(availableTemplatesResponse.data, null, 2));
        }
        
        console.log('\n🎉 Templates endpoint test completed!');
        
    } catch (error) {
        console.error('❌ Error during templates endpoint test:', error.response?.data || error.message);
        
        if (error.response?.status === 500) {
            console.log('\n🔍 Debugging 500 error:');
            console.log('Status:', error.response.status);
            console.log('Headers:', error.response.headers);
            console.log('Data:', error.response.data);
        }
    }
}

// Instructions
console.log('📋 Instructions for Templates Endpoint Test:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Run this script to test the templates endpoints');
console.log('3. The script will test:');
console.log('   - GET /api/monthly-requests/templates (general endpoint)');
console.log('   - GET /api/monthly-requests/residence/:id/templates (residence-specific)');
console.log('   - GET /api/monthly-requests/templates/:id/table (template table)');
console.log('   - GET /api/monthly-requests/available-templates/:id (available templates)');
console.log('4. This will help identify which endpoint is causing the 500 error\n');

// Uncomment to run the test
// testTemplatesEndpoint(); 