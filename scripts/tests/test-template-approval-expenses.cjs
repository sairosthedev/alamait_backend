const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');
const Expense = require('./src/models/finance/Expense');
require('./src/models/Residence');
const axios = require('axios');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testTemplateApprovalExpenses() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Step 1: Login to get a valid token
        console.log('\n🔐 Logging in to get authentication token...');
        
        const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'finance@alamait.com',
            password: '12345678'
        });

        if (!loginResponse.data.token) {
            console.log('❌ Login failed - no token received');
            return;
        }

        const token = loginResponse.data.token;
        console.log('✅ Login successful! Token received');

        // Step 2: Find a template request that hasn't been approved for the current month
        console.log('\n🔍 Finding a template request for approval...');
        const templateRequest = await MonthlyRequest.findOne({ 
            isTemplate: true,
            status: 'pending'
        }).populate('residence', 'name');
        
        if (!templateRequest) {
            console.log('❌ No pending template requests found');
            return;
        }

        console.log(`📋 Found template request:`);
        console.log(`   ID: ${templateRequest._id}`);
        console.log(`   Title: ${templateRequest.title}`);
        console.log(`   Status: ${templateRequest.status}`);
        console.log(`   Residence: ${templateRequest.residence ? templateRequest.residence.name : 'N/A'}`);

        // Check if this template already has an approval for September 2025
        const existingApproval = templateRequest.monthlyApprovals?.find(
            approval => approval.month === 9 && approval.year === 2025
        );

        if (existingApproval && existingApproval.status === 'approved') {
            console.log('⚠️  Template already approved for August 2025');
            console.log('   Checking for expenses...');
            
            // Check if expenses exist for this template
            const expenses = await Expense.find({ 
                monthlyRequestId: templateRequest._id 
            });
            
            console.log(`📋 Found ${expenses.length} expenses for this template:`);
            expenses.forEach((expense, index) => {
                console.log(`   ${index + 1}. ${expense.title || 'No title'} - $${expense.amount} (${expense.category})`);
            });
            
            return;
        }

        // Step 3: Approve the template for September 2025
        console.log('\n🔄 Approving template for September 2025...');
        
        const approvalResponse = await axios.post(
            `http://localhost:5000/api/monthly-requests/${templateRequest._id}/approve-month`,
            {
                month: 9,
                year: 2025,
                approved: true,
                status: 'approved',
                notes: 'Template approved by Finance for September 2025 - Test'
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        console.log('\n✅ Template approval successful!');
        console.log(`📤 Response Status: ${approvalResponse.status}`);
        console.log(`📤 Response Message: ${approvalResponse.data.message}`);

        // Step 4: Wait a moment for expense creation
        console.log('\n⏳ Waiting for expense creation...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 5: Check if expenses were created
        console.log('\n🔍 Checking for created expenses...');
        const expenses = await Expense.find({ 
            monthlyRequestId: templateRequest._id 
        });

        console.log(`📋 Found ${expenses.length} expenses for this template:`);
        expenses.forEach((expense, index) => {
            console.log(`   ${index + 1}. ${expense.title || 'No title'} - $${expense.amount} (${expense.category})`);
        });

        // Step 6: Verify the template approval status
        console.log('\n🔍 Verifying template approval status...');
        const updatedTemplate = await MonthlyRequest.findById(templateRequest._id);
        const septemberApproval = updatedTemplate.monthlyApprovals?.find(
            approval => approval.month === 9 && approval.year === 2025
        );

        if (septemberApproval) {
            console.log(`📋 September 2025 approval status: ${septemberApproval.status}`);
            console.log(`📋 Approved by: ${septemberApproval.approvedByEmail}`);
            console.log(`📋 Approved at: ${septemberApproval.approvedAt}`);
        } else {
            console.log('❌ September 2025 approval not found');
        }

        if (expenses.length > 0) {
            console.log('\n🎉 SUCCESS: Template approval created expenses!');
        } else {
            console.log('\n⚠️  WARNING: No expenses were created from template approval');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('📤 Error Response:', error.response.data);
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
testTemplateApprovalExpenses(); 