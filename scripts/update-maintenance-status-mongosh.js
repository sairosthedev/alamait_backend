// Update Maintenance Collection Status - MongoDB Shell Script
// Run this directly in MongoDB Compass

print("🔗 Connected to MongoDB");
print("\n📋 Updating Maintenance Collection Status...");

// Update 1: Request with approved quotation but pending-ceo-approval status
const result1 = db.maintenances.updateOne(
    { 
        _id: ObjectId("688a4e45c0f30f13fe683751"),
        "items.quotations.isApproved": true 
    },
    { 
        $set: { 
            status: "approved",
            financeStatus: "approved",
            "approval.approved": true,
            "approval.approvedBy": ObjectId("67c023adae5e27657502e887"),
            "approval.approvedAt": new Date(),
            "approval.approvedByEmail": "admin@alamait.com"
        },
        $push: {
            requestHistory: {
                date: new Date(),
                action: "Status updated to approved",
                user: ObjectId("67c023adae5e27657502e887"),
                changes: ["Status changed from pending-ceo-approval to approved due to approved quotation"]
            }
        }
    }
);
print(`✅ Updated request 688a4e45c0f30f13fe683751: ${result1.modifiedCount} document(s)`);

// Update 2: Request with quotations but pending status
const result2 = db.maintenances.updateOne(
    { 
        _id: ObjectId("688ddd9cb5b09c633d688505"),
        "items.quotations": { $exists: true, $ne: [] }
    },
    { 
        $set: { 
            status: "pending-finance-approval",
            financeStatus: "pending"
        },
        $push: {
            requestHistory: {
                date: new Date(),
                action: "Status updated to pending finance approval",
                user: ObjectId("67c023adae5e27657502e887"),
                changes: ["Status changed from pending to pending-finance-approval due to quotations"]
            }
        }
    }
);
print(`✅ Updated request 688ddd9cb5b09c633d688505: ${result2.modifiedCount} document(s)`);

// Update 3: Request with approved finance status but in-progress
const result3 = db.maintenances.updateOne(
    { 
        _id: ObjectId("688def7cd7fd1a4091fc2d2f"),
        financeStatus: "approved"
    },
    { 
        $set: { 
            status: "approved",
            "approval.approved": true,
            "approval.approvedBy": ObjectId("67c023adae5e27657502e887"),
            "approval.approvedAt": new Date(),
            "approval.approvedByEmail": "admin@alamait.com"
        },
        $push: {
            requestHistory: {
                date: new Date(),
                action: "Status updated to approved",
                user: ObjectId("67c023adae5e27657502e887"),
                changes: ["Status changed from in-progress to approved due to finance approval"]
            }
        }
    }
);
print(`✅ Updated request 688def7cd7fd1a4091fc2d2f: ${result3.modifiedCount} document(s)`);

// Update 4: Student request with pending finance status
const result4 = db.maintenances.updateOne(
    { 
        _id: ObjectId("688e88c44cd4fe2eae34d5a3"),
        financeStatus: "pending"
    },
    { 
        $set: { 
            status: "pending-finance-approval"
        },
        $push: {
            requestHistory: {
                date: new Date(),
                action: "Status updated to pending finance approval",
                user: ObjectId("67c023adae5e27657502e887"),
                changes: ["Status changed from in-progress to pending-finance-approval"]
            }
        }
    }
);
print(`✅ Updated request 688e88c44cd4fe2eae34d5a3: ${result4.modifiedCount} document(s)`);

// Update 5: Add missing fields to all maintenance requests
const result5 = db.maintenances.updateMany(
    { 
        $or: [
            { "approval.approved": { $exists: false } },
            { financeStatus: { $exists: false } }
        ]
    },
    { 
        $set: { 
            "approval.approved": false,
            "approval.approvedBy": null,
            "approval.approvedAt": null,
            "approval.approvedByEmail": null,
            financeStatus: "pending"
        }
    }
);
print(`✅ Updated ${result5.modifiedCount} maintenance requests with missing fields`);

print('\n🎉 Maintenance collection status update completed!'); 