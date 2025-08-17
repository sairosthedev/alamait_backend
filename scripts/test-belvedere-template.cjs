const mongoose = require('mongoose');
const MonthlyRequest = require('../src/models/MonthlyRequest');
require('../src/models/Residence');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testBelvedereTemplate() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find the Belvedere template
        const belvedereTemplate = await MonthlyRequest.findById('6895a2835205ee508a372963');
        
        if (!belvedereTemplate) {
            console.log('❌ Belvedere template not found');
            return;
        }

        console.log('📋 Belvedere template found:');
        console.log(`   ID: ${belvedereTemplate._id}`);
        console.log(`   Title: ${belvedereTemplate.title}`);
        console.log(`   Status: ${belvedereTemplate.status}`);
        console.log(`   Monthly Approvals: ${belvedereTemplate.monthlyApprovals?.length || 0}`);

        // Check all monthly approvals
        if (belvedereTemplate.monthlyApprovals && belvedereTemplate.monthlyApprovals.length > 0) {
            console.log('\n📅 Monthly Approvals:');
            belvedereTemplate.monthlyApprovals.forEach((approval, index) => {
                console.log(`   ${index + 1}. Month: ${approval.month}/${approval.year} - Status: ${approval.status}`);
                console.log(`      Approved by: ${approval.approvedByEmail || 'Unknown'}`);
                console.log(`      Notes: ${approval.notes || 'N/A'}`);
            });
        }

        // Check September 2025 specifically
        const septemberApproval = belvedereTemplate.monthlyApprovals?.find(
            a => a.month === 9 && a.year === 2025
        );
        
        console.log('\n🔍 September 2025 check:');
        if (septemberApproval) {
            console.log(`   ✅ Found approval: ${septemberApproval.status}`);
        } else {
            console.log(`   ❌ No approval found for September 2025`);
        }

        // Check August 2025
        const augustApproval = belvedereTemplate.monthlyApprovals?.find(
            a => a.month === 8 && a.year === 2025
        );
        
        console.log('\n🔍 August 2025 check:');
        if (augustApproval) {
            console.log(`   ✅ Found approval: ${augustApproval.status}`);
        } else {
            console.log(`   ❌ No approval found for August 2025`);
        }

        console.log('✅ Belvedere template check completed');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

testBelvedereTemplate(); 