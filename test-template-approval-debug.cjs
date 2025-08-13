const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');
const Expense = require('./src/models/finance/Expense');
require('./src/models/Residence');
const axios = require('axios');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testTemplateApprovalDebug() {
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

        // Find a template request that's pending for August 2025
        console.log('🔍 Finding a template request for August 2025...');
        const templateRequest = await MonthlyRequest.findOne({
            isTemplate: true,
            'monthlyApprovals.month': 8,
            'monthlyApprovals.year': 2025,
            'monthlyApprovals.status': 'pending'
        }).populate('residence', 'name');

        if (!templateRequest) {
            console.log('❌ No pending template found for August 2025');
            return;
        }

        console.log('📋 Found template request:');
        console.log(`   ID: ${templateRequest._id}`);
        console.log(`   Title: ${templateRequest.title}`);
        console.log(`   Residence: ${templateRequest.residence?.name}`);
        console.log(`   Status: ${templateRequest.status}`);

        // Check current monthly approval status
        const augustApproval = templateRequest.monthlyApprovals.find(
            a => a.month === 8 && a.year === 2025
        );
        console.log(`📅 August 2025 approval status: ${augustApproval?.status || 'not found'}`);

        // Approve the template for August 2025
        console.log('✅ Approving template for August 2025...');
        const approvalResponse = await axios.post(
            `http://localhost:5000/api/monthly-requests/${templateRequest._id}/approve-month`,
            {
                month: 8,
                year: 2025,
                approved: true,
                status: 'approved',
                notes: 'Debug test approval'
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('📋 Approval response:', approvalResponse.data);

        // Check the updated template
        console.log('🔍 Checking updated template...');
        const updatedTemplate = await MonthlyRequest.findById(templateRequest._id);
        const updatedAugustApproval = updatedTemplate.monthlyApprovals.find(
            a => a.month === 8 && a.year === 2025
        );
        console.log(`📅 Updated August 2025 approval status: ${updatedAugustApproval?.status}`);
        console.log(`📅 Updated August 2025 approval notes: ${updatedAugustApproval?.notes}`);
        console.log(`📅 Updated August 2025 approved by: ${updatedAugustApproval?.approvedByEmail}`);

        // Check for expenses
        console.log('💰 Checking for expenses...');
        const expenses = await Expense.find({ monthlyRequestId: templateRequest._id });
        console.log(`📋 Found ${expenses.length} expenses for this template`);

        expenses.forEach((expense, index) => {
            console.log(`   ${index + 1}. ${expense.title || 'No title'} - $${expense.amount} (${expense.category})`);
        });

        console.log('✅ Debug test completed');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

testTemplateApprovalDebug(); 