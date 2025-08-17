const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');
require('./src/models/Residence');
const axios = require('axios');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testTemplateStatusDisplay() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Login to get token
        console.log('🔐 Logging in to get authentication token...');
        const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'finance@alamait.com',
            password: '12345678'
        });
        
        if (!loginResponse.data.token) {
            throw new Error('No token received');
        }
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful! Token received');

        // Test the templates endpoint
        console.log('🔍 Testing /monthly-requests/templates endpoint...');
        const templatesResponse = await axios.get('http://localhost:5000/api/monthly-requests/templates', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Find the St Kilda template
        let templates = [];
        if (templatesResponse.data.templates) {
            templates = templatesResponse.data.templates;
        } else if (templatesResponse.data.residences) {
            templates = templatesResponse.data.residences.flatMap(residenceData => 
                residenceData.templates || []
            );
        } else if (Array.isArray(templatesResponse.data)) {
            templates = templatesResponse.data;
        }

        const stKildaTemplate = templates.find(t => t.title === 'St Kilda Monthly Requests');
        if (stKildaTemplate) {
            console.log('📋 St Kilda template found in API response:');
            console.log(`   ID: ${stKildaTemplate._id}`);
            console.log(`   Status: ${stKildaTemplate.status}`);
            console.log(`   Monthly Approvals: ${stKildaTemplate.monthlyApprovals?.length || 0}`);
            
            // Check August 2025 approval
            const augustApproval = stKildaTemplate.monthlyApprovals?.find(
                a => a.month === 8 && a.year === 2025
            );
            console.log(`   August 2025 approval status: ${augustApproval?.status || 'not found'}`);
            console.log(`   August 2025 approval notes: ${augustApproval?.notes || 'N/A'}`);
            console.log(`   August 2025 approved by: ${augustApproval?.approvedByEmail || 'N/A'}`);
            
            // Simulate the frontend logic
            console.log('\n🔍 Simulating frontend logic:');
            const selectedMonth = 8;
            const selectedYear = 2025;
            
            // Simulate getFinanceStatusForMonth
            const monthlyApproval = stKildaTemplate.monthlyApprovals?.find(
                approval => approval.month === selectedMonth && approval.year === selectedYear
            );
            
            let monthlyStatus = 'pending';
            if (monthlyApproval) {
                monthlyStatus = monthlyApproval.status;
            }
            
            console.log(`   Frontend calculated status: ${monthlyStatus}`);
            console.log(`   Should show: Monthly ${monthlyStatus.charAt(0).toUpperCase() + monthlyStatus.slice(1)}`);
            
            if (monthlyStatus === 'approved') {
                console.log('   ✅ Template should show as "Monthly Approved" in UI');
            } else {
                console.log('   ❌ Template is not showing as approved in UI');
            }
        } else {
            console.log('❌ St Kilda template not found in API response');
        }

        console.log('✅ Template status display test completed');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

testTemplateStatusDisplay(); 