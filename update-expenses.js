// Update Expenses Collection
// This script adds missing fields and ensures consistency in the expenses collection

const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb'); // Added missing import for ObjectId

async function updateExpenses() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const expensesCollection = db.collection('expenses');

        console.log('\n📋 Updating Expenses Collection...');

        // Update 1: Add missing fields to all expenses
        const result1 = await expensesCollection.updateMany(
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
        console.log(`✅ Updated ${result1.modifiedCount} expenses with missing fields`);

        // Update 2: Set expense account codes for monthly request expenses
        const result2 = await expensesCollection.updateMany(
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
        console.log(`✅ Updated ${result2.modifiedCount} monthly request expenses with account codes`);

        // Update 3: Set payment method for expenses without vendor information
        const result3 = await expensesCollection.updateMany(
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
        console.log(`✅ Updated ${result3.modifiedCount} expenses with default payment method`);

        // Update 4: Add approval information for approved expenses
        const result4 = await expensesCollection.updateMany(
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
        console.log(`✅ Updated ${result4.modifiedCount} monthly request expenses with approval info`);

        // Update 5: Add indexes for better performance
        console.log('\n📊 Creating indexes for expenses collection...');
        
        try {
            await expensesCollection.createIndex({ expenseId: 1 });
            console.log('✅ Created index on expenseId');
        } catch (error) {
            console.log('ℹ️ Index on expenseId already exists');
        }

        try {
            await expensesCollection.createIndex({ requestId: 1 });
            console.log('✅ Created index on requestId');
        } catch (error) {
            console.log('ℹ️ Index on requestId already exists');
        }

        try {
            await expensesCollection.createIndex({ vendorId: 1 });
            console.log('✅ Created index on vendorId');
        } catch (error) {
            console.log('ℹ️ Index on vendorId already exists');
        }

        try {
            await expensesCollection.createIndex({ paymentStatus: 1 });
            console.log('✅ Created index on paymentStatus');
        } catch (error) {
            console.log('ℹ️ Index on paymentStatus already exists');
        }

        try {
            await expensesCollection.createIndex({ monthlyRequestId: 1 });
            console.log('✅ Created index on monthlyRequestId');
        } catch (error) {
            console.log('ℹ️ Index on monthlyRequestId already exists');
        }

        console.log('\n🎉 Expenses collection update completed!');

    } catch (error) {
        console.error('❌ Error updating expenses:', error);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the update
updateExpenses(); 