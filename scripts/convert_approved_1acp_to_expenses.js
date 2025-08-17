// Script to convert approved 1ACP monthly approvals to expenses
// Run this in MongoDB shell or MongoDB Compass

print("=== Converting Approved 1ACP Monthly Approvals to Expenses ===");

// Find the 1ACP template
const acpTemplate = db.monthlyrequests.findOne({ "_id": ObjectId("688c449e57271825c8910fcf") });

if (!acpTemplate) {
    print("❌ 1ACP template not found!");
    quit();
}

print(`\n--- 1ACP Template Found ---`);
print(`ID: ${acpTemplate._id}`);
print(`Title: ${acpTemplate.title}`);
print(`Status: ${acpTemplate.status}`);
print(`Total Cost: $${acpTemplate.totalEstimatedCost}`);

// Find approved monthly approvals
const approvedApprovals = acpTemplate.monthlyApprovals.filter(approval => approval.status === 'approved');

print(`\n--- Found ${approvedApprovals.length} Approved Monthly Approvals ---`);

if (approvedApprovals.length === 0) {
    print("❌ No approved monthly approvals found!");
    quit();
}

// Show approved months
approvedApprovals.forEach(approval => {
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][approval.month - 1];
    print(`✅ ${monthName} ${approval.year}: $${approval.totalCost} (Approved by: ${approval.approvedByEmail})`);
});

// Check if expenses already exist
print(`\n--- Checking Existing Expenses ---`);
const existingExpenses = db.expenses.find({ 
    monthlyRequestId: ObjectId("688c449e57271825c8910fcf") 
}).toArray();

print(`Found ${existingExpenses.length} existing expenses for this template`);

if (existingExpenses.length > 0) {
    print("⚠️  Expenses already exist! Skipping conversion.");
    existingExpenses.forEach(expense => {
        print(`   - ${expense.title} - $${expense.amount} (${expense.expenseDate})`);
    });
    quit();
}

// Convert approved monthly approvals to expenses
print(`\n--- Converting to Expenses ---`);

const createdExpenses = [];
const errors = [];

approvedApprovals.forEach(approval => {
    try {
        const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][approval.month - 1];
        
        // Generate unique expense ID
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        const expenseId = `EXP_${timestamp}_${random}`.toUpperCase();
        
        // Create expense document
        const expense = {
            expenseId: expenseId,
            title: `Monthly Request - ${acpTemplate.title}`,
            description: `${acpTemplate.description} for ${monthName} ${approval.year}`,
            amount: approval.totalCost,
            category: "Maintenance", // Default category
            expenseDate: new Date(approval.year, approval.month - 1, 1),
            period: "monthly",
            paymentStatus: "Pending",
            paymentMethod: "Bank Transfer",
            monthlyRequestId: acpTemplate._id,
            createdBy: approval.approvedBy || ObjectId("67f4ef0fcb87ffa3fb7e2d73"), // Finance user
            notes: `Converted from approved monthly request: ${monthName} ${approval.year}`,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Insert expense
        const result = db.expenses.insertOne(expense);
        
        if (result.insertedId) {
            createdExpenses.push({
                expenseId: expense.expenseId,
                month: approval.month,
                year: approval.year,
                amount: expense.amount,
                insertedId: result.insertedId
            });
            
            print(`✅ Created expense for ${monthName} ${approval.year}: $${expense.amount} (ID: ${expense.expenseId})`);
        } else {
            errors.push(`Failed to create expense for ${monthName} ${approval.year}`);
        }
        
    } catch (error) {
        const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][approval.month - 1];
        errors.push(`Error creating expense for ${monthName} ${approval.year}: ${error.message}`);
        print(`❌ Error creating expense for ${monthName} ${approval.year}: ${error.message}`);
    }
});

// Update template with conversion history
if (createdExpenses.length > 0) {
    try {
        db.monthlyrequests.updateOne(
            { "_id": ObjectId("688c449e57271825c8910fcf") },
            {
                $push: {
                    requestHistory: {
                        date: new Date(),
                        action: "Retroactively converted approved monthly approvals to expenses",
                        user: ObjectId("67f4ef0fcb87ffa3fb7e2d73"), // Finance user
                        changes: [`Converted ${createdExpenses.length} approved monthly approvals to expenses`]
                    }
                }
            }
        );
        
        print(`\n✅ Updated template with conversion history`);
    } catch (error) {
        print(`❌ Error updating template history: ${error.message}`);
    }
}

// Summary
print(`\n=== Conversion Summary ===`);
print(`✅ Successfully created: ${createdExpenses.length} expenses`);
print(`❌ Errors: ${errors.length}`);

if (createdExpenses.length > 0) {
    print(`\n--- Created Expenses ---`);
    createdExpenses.forEach(expense => {
        const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][expense.month - 1];
        print(`${monthName} ${expense.year}: $${expense.amount} (${expense.expenseId})`);
    });
}

if (errors.length > 0) {
    print(`\n--- Errors ---`);
    errors.forEach(error => print(`❌ ${error}`));
}

print(`\n=== Conversion Complete ===`);
print("The approved 1ACP monthly approvals have been converted to expenses!");
print("You should now see these expenses in your expense system."); 