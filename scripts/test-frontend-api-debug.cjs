const mongoose = require('mongoose');
const MonthlyRequest = require('../src/models/MonthlyRequest');
require('../src/models/Residence');
const axios = require('axios');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testFrontendApiDebug() {
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

        // Test the templates endpoint (what frontend calls)
        console.log('🔍 Testing /monthly-requests/templates endpoint...');
        const templatesResponse = await axios.get('http://localhost:5000/api/monthly-requests/templates', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📋 Templates response structure:', Object.keys(templatesResponse.data));
        
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
            
            const augustApproval = stKildaTemplate.monthlyApprovals?.find(
                a => a.month === 8 && a.year === 2025
            );
            console.log(`   August 2025 approval status: ${augustApproval?.status || 'not found'}`);
        }

        // Test the approvals endpoint
        console.log('🔍 Testing /monthly-requests/approvals endpoint...');
        const approvalsResponse = await axios.get('http://localhost:5000/api/monthly-requests/approvals', {
            params: {
                month: 8,
                year: 2025
            },
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📋 Approvals response structure:', Object.keys(approvalsResponse.data));
        console.log('📋 Approvals data:', approvalsResponse.data);

        // Test the monthly requests endpoint
        console.log('🔍 Testing /monthly-requests endpoint...');
        const monthlyRequestsResponse = await axios.get('http://localhost:5000/api/monthly-requests', {
            params: {
                month: 8,
                year: 2025,
                isTemplate: false
            },
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📋 Monthly requests response structure:', Object.keys(monthlyRequestsResponse.data));
        console.log('📋 Monthly requests count:', monthlyRequestsResponse.data?.length || 0);

        console.log('✅ Frontend API debug completed');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

testFrontendApiDebug(); 