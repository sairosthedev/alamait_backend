// Script to check 1ACP template status and expense conversion
// Run this in MongoDB shell or MongoDB Compass

print("=== Checking 1ACP Template Status ===");

// Find the 1ACP template
const acpTemplate = db.monthlyrequests.findOne({ "_id": ObjectId("688c449e57271825c8910fcf") });

if (!acpTemplate) {
    print("❌ 1ACP template not found!");
    quit();
}

print(`\n--- 1ACP Template Details ---`);
print(`ID: ${acpTemplate._id}`);
print(`Title: ${acpTemplate.title}`);
print(`Residence: ${acpTemplate.residence}`);
print(`Template Status: ${acpTemplate.status}`);
print(`Is Template: ${acpTemplate.isTemplate}`);
print(`Total Estimated Cost: $${acpTemplate.totalEstimatedCost}`);
print(`Items Count: ${acpTemplate.items ? acpTemplate.items.length : 0}`);

// Check monthly approvals
if (acpTemplate.monthlyApprovals) {
    print(`\n--- Monthly Approvals (${acpTemplate.monthlyApprovals.length}) ---`);
    acpTemplate.monthlyApprovals.forEach((approval, index) => {
        const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][approval.month - 1];
        const statusIcon = approval.status === 'approved' ? '✅' : '⏳';
        print(`${statusIcon} ${monthName} ${approval.year}: ${approval.status} ($${approval.totalCost})`);
        
        if (approval.status === 'approved') {
            print(`   Approved By: ${approval.approvedByEmail || 'N/A'}`);
            print(`   Approved At: ${approval.approvedAt || 'N/A'}`);
        }
    });
} else {
    print("\n❌ No monthlyApprovals field found!");
}

// Check request history
if (acpTemplate.requestHistory && acpTemplate.requestHistory.length > 0) {
    print(`\n--- Recent Request History (Last 5) ---`);
    const recentHistory = acpTemplate.requestHistory.slice(-5);
    recentHistory.forEach(entry => {
        print(`📝 ${entry.action} - ${entry.date}`);
        if (entry.changes && entry.changes.length > 0) {
            entry.changes.forEach(change => print(`   - ${change}`));
        }
    });
}

// Check if expenses exist for this template
print(`\n--- Checking for Related Expenses ---`);
const relatedExpenses = db.expenses.find({ 
    monthlyRequestId: ObjectId("688c449e57271825c8910fcf") 
}).toArray();

print(`Found ${relatedExpenses.length} expenses for this template:`);
relatedExpenses.forEach((expense, index) => {
    print(`${index + 1}. ${expense.title} - $${expense.amount} (${expense.paymentStatus})`);
    print(`   Expense ID: ${expense.expenseId}`);
    print(`   Created: ${expense.createdAt}`);
});

// Check if there are any expenses with similar titles
print(`\n--- Checking for Similar Expenses ---`);
const similarExpenses = db.expenses.find({ 
    title: { $regex: "1ACP", $options: "i" } 
}).toArray();

print(`Found ${similarExpenses.length} expenses with "1ACP" in title:`);
similarExpenses.forEach((expense, index) => {
    print(`${index + 1}. ${expense.title} - $${expense.amount} (${expense.paymentStatus})`);
    print(`   Expense ID: ${expense.expenseId}`);
    print(`   Monthly Request ID: ${expense.monthlyRequestId || 'N/A'}`);
});

// Check current date for auto-approval logic
const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();

print(`\n--- Current Date Analysis ---`);
print(`Current Date: ${currentDate.toISOString()}`);
print(`Current Month/Year: ${currentMonth}/${currentYear}`);

// Check which months should be auto-approved
print(`\n--- Auto-Approval Analysis ---`);
for (let month = 1; month <= 12; month++) {
    const isPastOrCurrent = (2025 < currentYear) || (2025 === currentYear && month <= currentMonth);
    const status = isPastOrCurrent ? 'SHOULD BE APPROVED' : 'SHOULD BE PENDING';
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];
    print(`${monthName} 2025: ${status}`);
}

print("\n=== Analysis Complete ==="); 