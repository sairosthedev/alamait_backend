/**
 * 🎯 Test Student Status Job
 * 
 * This script tests if the student status job is working correctly
 */

const mongoose = require('mongoose');
require('dotenv').config();

const StudentStatusJob = require('../src/jobs/studentStatusJob');

async function testStudentStatusJob() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        console.log('🔄 Testing student status job...');
        
        // Test manual update
        const result = await StudentStatusJob.runManualUpdate();
        
        if (result.success) {
            console.log('✅ Student status job test completed successfully!');
            console.log('📊 Update Results:');
            console.log(`   Total Students: ${result.updateResult.total}`);
            console.log(`   Updated: ${result.updateResult.updated}`);
            console.log(`   Unchanged: ${result.updateResult.unchanged}`);
            console.log(`   Errors: ${result.updateResult.errors}`);
            
            console.log('📊 Expired Student Results:');
            console.log(`   Total Checked: ${result.expiredResult.total}`);
            console.log(`   Processed: ${result.expiredResult.processed}`);
            console.log(`   Archived: ${result.expiredResult.archived}`);
            console.log(`   Errors: ${result.expiredResult.errors}`);
        } else {
            console.log('❌ Student status job test failed:', result.error);
        }

    } catch (error) {
        console.error('❌ Error testing student status job:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the test
if (require.main === module) {
    testStudentStatusJob();
}

module.exports = { testStudentStatusJob };


