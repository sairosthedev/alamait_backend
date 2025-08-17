// Update Monthly Requests Collection
// This script adds missing monthlyApprovals arrays and fixes status consistency

const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb'); // Added missing import for ObjectId

async function updateMonthlyRequests() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const monthlyRequestsCollection = db.collection('monthlyrequests');

        console.log('\n📋 Updating Monthly Requests Collection...');

        // Update 1: Add monthlyApprovals to template 688b82c53126816645f32122
        const result1 = await monthlyRequestsCollection.updateOne(
            { 
                _id: ObjectId("688b82c53126816645f32122"),
                isTemplate: true
            },
            { 
                $set: { 
                    monthlyApprovals: [
                        {
                            month: 1,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for January 2025",
                            submittedAt: new Date("2025-01-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 2,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for February 2025",
                            submittedAt: new Date("2025-02-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 3,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for March 2025",
                            submittedAt: new Date("2025-03-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 4,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for April 2025",
                            submittedAt: new Date("2025-04-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 5,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for May 2025",
                            submittedAt: new Date("2025-05-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 6,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for June 2025",
                            submittedAt: new Date("2025-06-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 7,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for July 2025",
                            submittedAt: new Date("2025-07-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 8,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for August 2025",
                            submittedAt: new Date("2025-08-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 9,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for September 2025",
                            submittedAt: new Date("2025-09-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 10,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for October 2025",
                            submittedAt: new Date("2025-10-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 11,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for November 2025",
                            submittedAt: new Date("2025-11-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 12,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 190,
                            notes: "Monthly request for December 2025",
                            submittedAt: new Date("2025-12-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        }
                    ]
                },
                $push: {
                    requestHistory: {
                        date: new Date(),
                        action: "Added monthly approvals array",
                        user: ObjectId("67c023adae5e27657502e887"),
                        changes: ["Added 12 monthly approvals for 2025"]
                    }
                }
            }
        );
        console.log(`✅ Updated template 688b82c53126816645f32122: ${result1.modifiedCount} document(s)`);

        // Update 2: Add monthlyApprovals to template 688b79ce2af26ca41a8574ad
        const result2 = await monthlyRequestsCollection.updateOne(
            { 
                _id: ObjectId("688b79ce2af26ca41a8574ad"),
                isTemplate: true
            },
            { 
                $set: { 
                    monthlyApprovals: [
                        {
                            month: 1,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for January 2025",
                            submittedAt: new Date("2025-01-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 2,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for February 2025",
                            submittedAt: new Date("2025-02-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 3,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for March 2025",
                            submittedAt: new Date("2025-03-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 4,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for April 2025",
                            submittedAt: new Date("2025-04-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 5,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for May 2025",
                            submittedAt: new Date("2025-05-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 6,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for June 2025",
                            submittedAt: new Date("2025-06-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 7,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for July 2025",
                            submittedAt: new Date("2025-07-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 8,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for August 2025",
                            submittedAt: new Date("2025-08-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 9,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for September 2025",
                            submittedAt: new Date("2025-09-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 10,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for October 2025",
                            submittedAt: new Date("2025-10-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 11,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for November 2025",
                            submittedAt: new Date("2025-11-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        },
                        {
                            month: 12,
                            year: 2025,
                            status: "draft",
                            items: [],
                            totalCost: 1042,
                            notes: "Monthly request for December 2025",
                            submittedAt: new Date("2025-12-01T00:00:00.000Z"),
                            submittedBy: ObjectId("67c023adae5e27657502e887")
                        }
                    ]
                },
                $push: {
                    requestHistory: {
                        date: new Date(),
                        action: "Added monthly approvals array",
                        user: ObjectId("67c023adae5e27657502e887"),
                        changes: ["Added 12 monthly approvals for 2025"]
                    }
                }
            }
        );
        console.log(`✅ Updated template 688b79ce2af26ca41a8574ad: ${result2.modifiedCount} document(s)`);

        // Update 3: Fix monthlyApprovals for template 688c449e57271825c8910fcf (1ACP)
        const result3 = await monthlyRequestsCollection.updateOne(
            { 
                _id: ObjectId("688c449e57271825c8910fcf"),
                isTemplate: true
            },
            { 
                $set: { 
                    "monthlyApprovals.1": {
                        month: 2,
                        year: 2025,
                        status: "approved",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for February 2025",
                        submittedAt: new Date("2025-02-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887"),
                        approvedBy: ObjectId("67f4ef0fcb87ffa3fb7e2d73"),
                        approvedAt: new Date("2025-02-15T10:30:00.000Z"),
                        approvedByEmail: "finance@alamait.com"
                    },
                    "monthlyApprovals.2": {
                        month: 3,
                        year: 2025,
                        status: "approved",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for March 2025",
                        submittedAt: new Date("2025-03-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887"),
                        approvedBy: ObjectId("67f4ef0fcb87ffa3fb7e2d73"),
                        approvedAt: new Date("2025-03-15T10:30:00.000Z"),
                        approvedByEmail: "finance@alamait.com"
                    },
                    "monthlyApprovals.3": {
                        month: 4,
                        year: 2025,
                        status: "approved",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for April 2025",
                        submittedAt: new Date("2025-04-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887"),
                        approvedBy: ObjectId("67f4ef0fcb87ffa3fb7e2d73"),
                        approvedAt: new Date("2025-04-15T10:30:00.000Z"),
                        approvedByEmail: "finance@alamait.com"
                    },
                    "monthlyApprovals.4": {
                        month: 5,
                        year: 2025,
                        status: "approved",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for May 2025",
                        submittedAt: new Date("2025-05-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887"),
                        approvedBy: ObjectId("67f4ef0fcb87ffa3fb7e2d73"),
                        approvedAt: new Date("2025-05-15T10:30:00.000Z"),
                        approvedByEmail: "finance@alamait.com"
                    },
                    "monthlyApprovals.5": {
                        month: 6,
                        year: 2025,
                        status: "approved",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for June 2025",
                        submittedAt: new Date("2025-06-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887"),
                        approvedBy: ObjectId("67f4ef0fcb87ffa3fb7e2d73"),
                        approvedAt: new Date("2025-06-15T10:30:00.000Z"),
                        approvedByEmail: "finance@alamait.com"
                    },
                    "monthlyApprovals.6": {
                        month: 7,
                        year: 2025,
                        status: "approved",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for July 2025",
                        submittedAt: new Date("2025-07-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887"),
                        approvedBy: ObjectId("67f4ef0fcb87ffa3fb7e2d73"),
                        approvedAt: new Date("2025-07-15T10:30:00.000Z"),
                        approvedByEmail: "finance@alamait.com"
                    },
                    "monthlyApprovals.7": {
                        month: 8,
                        year: 2025,
                        status: "approved",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for August 2025",
                        submittedAt: new Date("2025-08-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887"),
                        approvedBy: ObjectId("67f4ef0fcb87ffa3fb7e2d73"),
                        approvedAt: new Date("2025-08-15T10:30:00.000Z"),
                        approvedByEmail: "finance@alamait.com"
                    },
                    "monthlyApprovals.8": {
                        month: 9,
                        year: 2025,
                        status: "pending",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for September 2025",
                        submittedAt: new Date("2025-09-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887")
                    },
                    "monthlyApprovals.9": {
                        month: 10,
                        year: 2025,
                        status: "pending",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for October 2025",
                        submittedAt: new Date("2025-10-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887")
                    },
                    "monthlyApprovals.10": {
                        month: 11,
                        year: 2025,
                        status: "pending",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for November 2025",
                        submittedAt: new Date("2025-11-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887")
                    },
                    "monthlyApprovals.11": {
                        month: 12,
                        year: 2025,
                        status: "pending",
                        items: [],
                        totalCost: 280,
                        notes: "Monthly request for December 2025",
                        submittedAt: new Date("2025-12-01T00:00:00.000Z"),
                        submittedBy: ObjectId("67c023adae5e27657502e887")
                    }
                },
                $push: {
                    requestHistory: {
                        date: new Date(),
                        action: "Updated monthly approvals array",
                        user: ObjectId("67c023adae5e27657502e887"),
                        changes: ["Updated monthly approvals for 2025 with proper status"]
                    }
                }
            }
        );
        console.log(`✅ Updated template 688c449e57271825c8910fcf: ${result3.modifiedCount} document(s)`);

        console.log('\n🎉 Monthly requests collection update completed!');

    } catch (error) {
        console.error('❌ Error updating monthly requests:', error);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the update
updateMonthlyRequests(); 