// MongoDB Command to Fix Gazebo Request
// Run this command directly in MongoDB Compass or MongoDB shell

const fixCommand = `
// Connect to the test database and maintenance collection
use test

// Find the gazebo request to see current state
db.maintenance.findOne({_id: ObjectId("688a4e45c0f30f13fe683751")})

// Update the request to fix the finance approval inconsistency
db.maintenance.updateOne(
  { _id: ObjectId("688a4e45c0f30f13fe683751") },
  {
    $set: {
      "approval.finance.approved": true,
      "approval.finance.approvedBy": ObjectId("67c023adae5e27657502e887"),
      "approval.finance.approvedAt": new Date(),
      "approval.finance.approvedByEmail": "finance@alamait.com",
      "approval.finance.notes": "Finance approved with selected quotation",
      "items.0.quotations.0.isApproved": true,
      "items.0.quotations.0.approvedBy": ObjectId("67c023adae5e27657502e887"),
      "items.0.quotations.0.approvedAt": new Date(),
      "items.0.estimatedCost": 150,
      "totalEstimatedCost": 150
    }
  }
)

// Verify the update worked
db.maintenance.findOne({_id: ObjectId("688a4e45c0f30f13fe683751")})
`;

console.log('🔧 MongoDB Command to Fix Gazebo Request');
console.log('==========================================');
console.log('');
console.log('Copy and paste this command into MongoDB Compass or MongoDB shell:');
console.log('');
console.log(fixCommand);
console.log('');
console.log('📋 What this command does:');
console.log('1. Sets approval.finance.approved = true');
console.log('2. Sets approval.finance.approvedBy = user ID');
console.log('3. Sets approval.finance.approvedAt = current timestamp');
console.log('4. Sets approval.finance.notes = "Finance approved with selected quotation"');
console.log('5. Sets items[0].quotations[0].isApproved = true');
console.log('6. Sets items[0].quotations[0].approvedBy = user ID');
console.log('7. Sets items[0].quotations[0].approvedAt = current timestamp');
console.log('8. Updates items[0].estimatedCost = 150 (from quotation amount)');
console.log('9. Updates totalEstimatedCost = 150');
console.log('');
console.log('✅ After running this command, the gazebo request will have:');
console.log('   - financeStatus: "approved" ✅');
console.log('   - approval.finance.approved: true ✅');
console.log('   - items[0].quotations[0].isApproved: true ✅');
console.log('');
console.log('🚀 Steps to run:');
console.log('1. Open MongoDB Compass');
console.log('2. Connect to: mongodb+srv://cluster0.ulvve.mongodb.net/test');
console.log('3. Navigate to the "maintenance" collection');
console.log('4. Open the MongoDB shell (or use the query bar)');
console.log('5. Copy and paste the command above');
console.log('6. Press Enter to execute'); 