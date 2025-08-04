// MongoDB Script to Create Debtor Accounts
// Run this in MongoDB Compass or MongoDB Shell
// NOTE: Only students become debtors (they owe money for accommodation)

// Database name
use alamait_backend;

// Function to generate debtor code
function generateDebtorCode(count) {
    return "DR" + String(count).padStart(4, '0');
}

// Function to generate account code
function generateAccountCode(count) {
    return "110" + String(count).padStart(3, '0');
}

// Get current count of debtors for code generation
var debtorCount = db.debtors.countDocuments();
var accountCount = db.accounts.countDocuments({ "code": { $regex: /^110/ } });

print("Current debtor count: " + debtorCount);
print("Current 1100-series account count: " + accountCount);

// Define users to process
var usersToProcess = [
    {
        "_id": ObjectId("688a965155fe1a1fd35411c0"),
        "email": "macdonald.sairos@students.uz.ac.zw",
        "firstName": "Macdonald",
        "lastName": "Sairos",
        "role": "student",
        "phone": "0786033933",
        "currentRoom": "M1",
        "residence": ObjectId("67d723cf20f89c4ae69804f3"),
        "shouldBeDebtor": true
    },
    {
        "_id": ObjectId("688916a5a1487dda41654a90"),
        "email": "admin.assistant@alamait.com",
        "firstName": "Admin",
        "lastName": "Assistant",
        "role": "admin",
        "phone": "1234567890",
        "shouldBeDebtor": false
    },
    {
        "_id": ObjectId("688916eba1487dda41654a93"),
        "email": "finance.assistant@alamait.com",
        "firstName": "Finance",
        "lastName": "Assistant",
        "role": "finance_admin",
        "phone": "1234567890",
        "shouldBeDebtor": false
    },
    {
        "_id": ObjectId("6889172ba1487dda41654a97"),
        "email": "ceo.assistant@alamait.com",
        "firstName": "CEO",
        "lastName": "Assistant",
        "role": "ceo",
        "phone": "1234567890",
        "shouldBeDebtor": false
    }
];

print("\n=== PROCESSING USERS ===");

usersToProcess.forEach(function(user) {
    print("\n👤 Processing: " + user.firstName + " " + user.lastName + " (" + user.role + ")");
    
    if (!user.shouldBeDebtor) {
        print("   ⚠️  SKIPPED: " + user.role + " users are not debtors (they don't owe money)");
        return;
    }
    
    // Check if debtor already exists
    var existingDebtor = db.debtors.findOne({ "user": user._id });
    
    if (existingDebtor) {
        print("   ⚠️  Debtor account already exists: " + existingDebtor.debtorCode);
    } else {
        // Generate codes
        debtorCount++;
        accountCount++;
        var debtorCode = generateDebtorCode(debtorCount);
        var accountCode = generateAccountCode(accountCount);
        
        // Create debtor document
        var debtorDoc = {
            "debtorCode": debtorCode,
            "user": user._id,
            "accountCode": accountCode,
            "status": "active",
            "currentBalance": 0,
            "totalOwed": 0,
            "totalPaid": 0,
            "creditLimit": 0,
            "paymentTerms": "monthly",
            "overdueAmount": 0,
            "daysOverdue": 0,
            "residence": user.residence || null,
            "roomNumber": user.currentRoom || null,
            "contactInfo": {
                "name": user.firstName + " " + user.lastName,
                "email": user.email,
                "phone": user.phone
            },
            "notes": "Created from migration script",
            "createdBy": user._id,
            "createdAt": new Date(),
            "updatedAt": new Date()
        };
        
        // Insert debtor
        var debtorResult = db.debtors.insertOne(debtorDoc);
        print("   ✅ Created debtor account: " + debtorCode + " with ID: " + debtorResult.insertedId);
        
        // Create corresponding account in chart of accounts
        var accountDoc = {
            "code": accountCode,
            "name": "Accounts Receivable - " + user.firstName + " " + user.lastName,
            "type": "Asset",
            "description": "Accounts receivable for " + user.firstName + " " + user.lastName,
            "isActive": true,
            "parentAccount": "1100",
            "createdBy": user._id,
            "createdAt": new Date(),
            "updatedAt": new Date()
        };
        
        var accountResult = db.accounts.insertOne(accountDoc);
        print("   🏦 Created account: " + accountCode + " with ID: " + accountResult.insertedId);
    }
});

// Calculate balances for all debtors
print("\n=== CALCULATING BALANCES ===");

var allDebtors = db.debtors.find({}).toArray();

allDebtors.forEach(function(debtor) {
    print("\n💰 Calculating for: " + debtor.contactInfo.name);
    
    // Get all invoices for this debtor
    var invoices = db.invoices.find({ "student": debtor.user }).toArray();
    var totalOwed = 0;
    
    invoices.forEach(function(invoice) {
        totalOwed += invoice.totalAmount || 0;
    });
    
    print("   📄 Total from invoices: $" + totalOwed.toFixed(2));
    
    // Get all confirmed payments for this debtor
    var payments = db.payments.find({ 
        "student": debtor.user,
        "status": { $in: ["Confirmed", "Verified"] }
    }).toArray();
    
    var totalPaid = 0;
    payments.forEach(function(payment) {
        totalPaid += payment.totalAmount || 0;
    });
    
    print("   💳 Total from payments: $" + totalPaid.toFixed(2));
    
    var currentBalance = totalOwed - totalPaid;
    print("   📊 Calculated balance: $" + currentBalance.toFixed(2));
    
    // Update debtor with calculated balances
    db.debtors.updateOne(
        { "_id": debtor._id },
        {
            $set: {
                "totalOwed": totalOwed,
                "totalPaid": totalPaid,
                "currentBalance": currentBalance,
                "overdueAmount": currentBalance > 0 ? currentBalance : 0,
                "updatedAt": new Date()
            }
        }
    );
    
    print("   ✅ Updated debtor account with calculated balances");
});

// Final Summary
print("\n=== FINAL SUMMARY ===");

var finalDebtors = db.debtors.find({}).toArray();
print("Total Debtors Created: " + finalDebtors.length);

finalDebtors.forEach(function(debtor) {
    print("\n👤 " + debtor.contactInfo.name);
    print("   Code: " + debtor.debtorCode);
    print("   Account: " + debtor.accountCode);
    print("   Owed: $" + debtor.totalOwed.toFixed(2));
    print("   Paid: $" + debtor.totalPaid.toFixed(2));
    print("   Balance: $" + debtor.currentBalance.toFixed(2));
    print("   Status: " + debtor.status);
});

// System totals
var systemTotalOwed = db.debtors.aggregate([
    { $group: { _id: null, total: { $sum: "$totalOwed" } } }
]).toArray()[0]?.total || 0;
var systemTotalPaid = db.debtors.aggregate([
    { $group: { _id: null, total: { $sum: "$totalPaid" } } }
]).toArray()[0]?.total || 0;
var systemTotalBalance = db.debtors.aggregate([
    { $group: { _id: null, total: { $sum: "$currentBalance" } } }
]).toArray()[0]?.total || 0;

print("\n=== SYSTEM TOTALS ===");
print("Total Debtors: " + finalDebtors.length);
print("System Total Owed: $" + systemTotalOwed.toFixed(2));
print("System Total Paid: $" + systemTotalPaid.toFixed(2));
print("System Total Balance: $" + systemTotalBalance.toFixed(2));

print("\n✅ Debtor creation script completed successfully!");
print("📝 Note: Only students become debtors as they owe money for accommodation services."); 