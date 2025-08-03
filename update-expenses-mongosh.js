// Update Expenses Collection - MongoDB Shell Script
// Run this directly in MongoDB Compass

print("🔗 Connected to MongoDB");
print("\n📋 Updating Expenses Collection...");

// Update 1: Add missing fields to all expenses
const result1 = db.expenses.updateMany(
    { 
        $or: [
            { vendorId: { $exists: false } },
            { vendorCode: { $exists: false } },
            { vendorName: { $exists: false } },
            { vendorType: { $exists: false } },
            { itemIndex: { $exists: false } },
            { quotationId: { $exists: false } },
            { expenseAccountCode: { $exists: false } },
            { transactionId: { $exists: false } },
            { approvedBy: { $exists: false } },
            { approvedAt: { $exists: false } },
            { approvedByEmail: { $exists: false } }
        ]
    },
    { 
        $set: { 
            vendorId: null,
            vendorCode: null,
            vendorName: null,
            vendorType: null,
            itemIndex: null,
            quotationId: null,
            expenseAccountCode: null,
            transactionId: null,
            approvedBy: null,
            approvedAt: null,
            approvedByEmail: null
        }
    }
);
print(`✅ Updated ${result1.modifiedCount} expenses with missing fields`);

// Update 2: Set expense account codes for monthly request expenses
const result2 = db.expenses.updateMany(
    { 
        monthlyRequestId: { $exists: true },
        expenseAccountCode: null
    },
    { 
        $set: { 
            expenseAccountCode: "5013" // Administrative Expenses for monthly requests
        }
    }
);
print(`✅ Updated ${result2.modifiedCount} monthly request expenses with account codes`);

// Update 3: Set payment method for expenses without vendor information
const result3 = db.expenses.updateMany(
    { 
        vendorId: null,
        paymentMethod: { $exists: false }
    },
    { 
        $set: { 
            paymentMethod: "Cash" // Default to cash for expenses without vendors
        }
    }
);
print(`✅ Updated ${result3.modifiedCount} expenses with default payment method`);

// Update 4: Add approval information for approved expenses
const result4 = db.expenses.updateMany(
    { 
        paymentStatus: "Pending",
        approvedBy: null,
        monthlyRequestId: { $exists: true }
    },
    { 
        $set: { 
            approvedBy: ObjectId("67f4ef0fcb87ffa3fb7e2d73"), // Finance user
            approvedAt: new Date(),
            approvedByEmail: "finance@alamait.com"
        }
    }
);
print(`✅ Updated ${result4.modifiedCount} monthly request expenses with approval info`);

// Update 5: Create indexes for better performance
print('\n📊 Creating indexes for expenses collection...');

try {
    db.expenses.createIndex({ expenseId: 1 });
    print('✅ Created index on expenseId');
} catch (error) {
    print('ℹ️ Index on expenseId already exists');
}

try {
    db.expenses.createIndex({ requestId: 1 });
    print('✅ Created index on requestId');
} catch (error) {
    print('ℹ️ Index on requestId already exists');
}

try {
    db.expenses.createIndex({ vendorId: 1 });
    print('✅ Created index on vendorId');
} catch (error) {
    print('ℹ️ Index on vendorId already exists');
}

try {
    db.expenses.createIndex({ paymentStatus: 1 });
    print('✅ Created index on paymentStatus');
} catch (error) {
    print('ℹ️ Index on paymentStatus already exists');
}

try {
    db.expenses.createIndex({ monthlyRequestId: 1 });
    print('✅ Created index on monthlyRequestId');
} catch (error) {
    print('ℹ️ Index on monthlyRequestId already exists');
}

print('\n🎉 Expenses collection update completed!'); 