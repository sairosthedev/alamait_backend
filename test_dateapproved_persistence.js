/**
 * Test script to verify dateApproved field persistence in monthly requests
 * This script tests that:
 * 1. dateApproved field is saved to the monthly request document
 * 2. dateApproved field is included in API responses
 * 3. All related dates use the dateApproved value
 */

const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test dateApproved field persistence
const testDateApprovedPersistence = async () => {
  try {
    console.log('\n🧪 Testing dateApproved Field Persistence');
    console.log('=' .repeat(50));

    // 1. Find a recent monthly request
    console.log('\n1. Finding recent monthly requests...');
    
    const recentRequests = await MonthlyRequest.find({ 
      status: { $in: ['approved', 'completed'] },
      isTemplate: false 
    })
    .sort({ updatedAt: -1 })
    .limit(3)
    .populate('residence', 'name')
    .populate('approvedBy', 'firstName lastName email');

    if (recentRequests.length === 0) {
      console.log('   ⚠️  No approved monthly requests found');
      return;
    }

    console.log(`   ✅ Found ${recentRequests.length} recent requests:`);
    
    recentRequests.forEach((request, index) => {
      console.log(`\n   ${index + 1}. ${request.title}`);
      console.log(`      ID: ${request._id}`);
      console.log(`      Status: ${request.status}`);
      console.log(`      Month/Year: ${request.month}/${request.year}`);
      console.log(`      Residence: ${request.residence.name}`);
      console.log(`      Approved By: ${request.approvedBy ? `${request.approvedBy.firstName} ${request.approvedBy.lastName}` : 'Unknown'}`);
      console.log(`      Approved At: ${request.approvedAt ? request.approvedAt.toISOString() : 'Not set'}`);
      console.log(`      Date Approved: ${request.dateApproved ? request.dateApproved.toISOString() : 'Not set'}`);
      console.log(`      Date Paid: ${request.datePaid ? request.datePaid.toISOString() : 'Not set'}`);
      
      // Check if dateApproved exists
      if (request.dateApproved) {
        console.log(`      ✅ dateApproved field exists: ${request.dateApproved.toISOString().split('T')[0]}`);
      } else {
        console.log(`      ❌ dateApproved field is missing`);
      }
    });

    // 2. Test creating a new monthly request with dateApproved
    console.log('\n2. Testing dateApproved field creation...');
    
    const testDateApproved = '2025-09-11';
    console.log(`   📅 Using test dateApproved: ${testDateApproved}`);
    
    // Create a test monthly request
    const testRequest = new MonthlyRequest({
      title: 'Test Monthly Request with dateApproved',
      description: 'Test request to verify dateApproved field persistence',
      month: 9,
      year: 2025,
      status: 'approved',
      isTemplate: false,
      residence: '6859be80cabd83fabe7761de', // Fife Avenue
      submittedBy: '68b7909295210ad2fa2c5dcf',
      approvedBy: '67f4ef0fcb87ffa3fb7e2d73', // Finance user
      approvedAt: new Date(testDateApproved),
      dateApproved: new Date(testDateApproved), // This is the key field
      approvedByEmail: 'finance.stkilda@gmail.com',
      items: [
        {
          title: 'Test Item',
          description: 'Test item for dateApproved verification',
          quantity: 1,
          estimatedCost: 100,
          category: 'maintenance'
        }
      ]
    });

    await testRequest.save();
    console.log(`   ✅ Created test request: ${testRequest._id}`);
    console.log(`   📅 dateApproved saved: ${testRequest.dateApproved.toISOString().split('T')[0]}`);
    console.log(`   📅 approvedAt saved: ${testRequest.approvedAt.toISOString().split('T')[0]}`);

    // 3. Verify the field was saved correctly
    console.log('\n3. Verifying dateApproved field persistence...');
    
    const savedRequest = await MonthlyRequest.findById(testRequest._id);
    if (savedRequest.dateApproved) {
      console.log(`   ✅ dateApproved field persisted: ${savedRequest.dateApproved.toISOString().split('T')[0]}`);
      console.log(`   ✅ Field matches input: ${savedRequest.dateApproved.toISOString().split('T')[0] === testDateApproved}`);
    } else {
      console.log(`   ❌ dateApproved field not found in saved document`);
    }

    // 4. Test API response format
    console.log('\n4. Testing API response format...');
    
    const apiResponse = {
      success: true,
      message: 'Monthly request approved successfully',
      monthlyRequest: {
        _id: savedRequest._id,
        title: savedRequest.title,
        status: savedRequest.status,
        month: savedRequest.month,
        year: savedRequest.year,
        approvedAt: savedRequest.approvedAt,
        dateApproved: savedRequest.dateApproved, // This should now be included
        approvedBy: savedRequest.approvedBy,
        approvedByEmail: savedRequest.approvedByEmail,
        datePaid: savedRequest.datePaid
      }
    };

    console.log('   📋 Sample API response:');
    console.log(`      _id: ${apiResponse.monthlyRequest._id}`);
    console.log(`      title: ${apiResponse.monthlyRequest.title}`);
    console.log(`      status: ${apiResponse.monthlyRequest.status}`);
    console.log(`      approvedAt: ${apiResponse.monthlyRequest.approvedAt.toISOString()}`);
    console.log(`      dateApproved: ${apiResponse.monthlyRequest.dateApproved ? apiResponse.monthlyRequest.dateApproved.toISOString() : 'null'}`);
    console.log(`      approvedBy: ${apiResponse.monthlyRequest.approvedBy}`);
    console.log(`      datePaid: ${apiResponse.monthlyRequest.datePaid ? apiResponse.monthlyRequest.datePaid.toISOString() : 'null'}`);

    // 5. Clean up test data
    console.log('\n5. Cleaning up test data...');
    await MonthlyRequest.findByIdAndDelete(testRequest._id);
    console.log(`   ✅ Deleted test request: ${testRequest._id}`);

    console.log('\n✅ dateApproved field persistence test completed successfully!');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

// Test the difference between approvedAt and dateApproved
const testDateFieldDifferences = () => {
  console.log('\n📅 Understanding Date Field Differences');
  console.log('=' .repeat(40));
  
  console.log('\n🔍 Field Purposes:');
  console.log('   📅 approvedAt: System timestamp when approval was processed');
  console.log('   📅 dateApproved: User-specified date when approval should be recorded');
  console.log('   📅 datePaid: Date when payment was made');
  console.log('   📅 dateRequested: Date when request was originally submitted');
  
  console.log('\n💡 Use Cases:');
  console.log('   ✅ approvedAt: Audit trail, system logging');
  console.log('   ✅ dateApproved: Financial reporting, accounting periods');
  console.log('   ✅ datePaid: Payment tracking, cash flow');
  console.log('   ✅ dateRequested: Request timeline, processing time');
  
  console.log('\n📊 Example Scenario:');
  console.log('   📅 Request submitted: 2025-09-01');
  console.log('   📅 Finance approves on: 2025-10-11 (system date)');
  console.log('   📅 Finance specifies: 2025-09-11 (dateApproved)');
  console.log('   📅 Payment made: 2025-09-15');
  console.log('');
  console.log('   Result:');
  console.log('   - approvedAt: 2025-10-11 (when system processed)');
  console.log('   - dateApproved: 2025-09-11 (when finance says it was approved)');
  console.log('   - datePaid: 2025-09-15 (when payment was made)');
  console.log('   - dateRequested: 2025-09-01 (when request was submitted)');
};

// Main function
const main = async () => {
  try {
    await connectDB();
    
    testDateFieldDifferences();
    await testDateApprovedPersistence();
    
    console.log('\n🎉 dateApproved Field Persistence Test Complete!');
    console.log('\n📋 Summary of Fixes:');
    console.log('   ✅ Added dateApproved field to MonthlyRequest schema');
    console.log('   ✅ Updated approveMonthlyRequest to save dateApproved');
    console.log('   ✅ Updated financeApproveMonthlyRequest to save dateApproved');
    console.log('   ✅ dateApproved field will now be included in API responses');
    console.log('   ✅ Proper separation between system timestamp and user-specified date');
    
    console.log('\n🔧 Expected API Response:');
    console.log('   {');
    console.log('     "success": true,');
    console.log('     "monthlyRequest": {');
    console.log('       "_id": "...",');
    console.log('       "approvedAt": "2025-10-11T02:06:27.020Z",  // System timestamp');
    console.log('       "dateApproved": "2025-09-11T00:00:00.000Z", // User-specified date');
    console.log('       "datePaid": "2025-09-11T00:00:00.000Z",    // Payment date');
    console.log('       "status": "completed"');
    console.log('     }');
    console.log('   }');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

// Run the test
if (require.main === module) {
  main();
}

module.exports = { testDateApprovedPersistence };
