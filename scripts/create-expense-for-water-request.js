const { MongoClient } = require('mongodb');
require('dotenv').config();

async function createExpenseForWaterRequest() {
    console.log('💰 Creating Expense for Water Request');
    console.log('====================================');

    if (!process.env.MONGODB_URI) {
        console.log('❌ MONGODB_URI not found in environment variables');
        return;
    }

    try {
        console.log('🔌 Connecting to MongoDB...');
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();
        const maintenanceCollection = db.collection('maintenance');

        console.log('\n🔍 Finding the water request...');
        const waterRequest = await maintenanceCollection.findOne({
            title: 'water'
        });

        if (!waterRequest) {
            console.log('❌ Water request not found');
            await client.close();
            return;
        }

        console.log('✅ Found water request:', {
            id: waterRequest._id,
            title: waterRequest.title,
            status: waterRequest.status,
            financeStatus: waterRequest.financeStatus,
            convertedToExpense: waterRequest.convertedToExpense,
            items: waterRequest.items?.length || 0
        });

        if (waterRequest.convertedToExpense === true) {
            console.log('⚠️  Request is already marked as converted to expense');
            console.log('   Checking if expense actually exists...');
            
            const expensesCollection = db.collection('expenses');
            const existingExpense = await expensesCollection.findOne({
                requestId: waterRequest._id
            });
            
            if (existingExpense) {
                console.log('✅ Expense already exists:', existingExpense.expenseId);
                await client.close();
                return;
            } else {
                console.log('❌ Request marked as converted but no expense found');
                console.log('   This indicates a bug in the previous approval process');
            }
        }

        console.log('\n🔧 Creating expense and updating request...');
        
        // Create expense record
        const expensesCollection = db.collection('expenses');
        const expenseId = `EXP${Date.now()}`;
        
        const expenseData = {
            expenseId,
            requestId: waterRequest._id,
            residence: waterRequest.residence,
            category: 'Maintenance',
            amount: waterRequest.totalEstimatedCost || 250,
            description: `Water request: ${waterRequest.title}`,
            expenseDate: new Date(),
            paymentStatus: 'Pending',
            createdBy: waterRequest.approval?.finance?.approvedBy || '67f4ef0fcb87ffa3fb7e2d73',
            period: 'monthly',
            paymentMethod: 'Cash',
            approvedBy: waterRequest.approval?.finance?.approvedBy || '67f4ef0fcb87ffa3fb7e2d73',
            approvedAt: waterRequest.approval?.finance?.approvedAt || new Date(),
            approvedByEmail: waterRequest.approval?.finance?.approvedByEmail || 'finance@alamait.com',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const newExpense = await expensesCollection.insertOne(expenseData);
        console.log('✅ Expense created:', expenseId);

        // Create transaction record
        const transactionsCollection = db.collection('transactions');
        const transactionId = `TXN${Date.now()}`;
        
        const transactionData = {
            transactionId,
            date: new Date(),
            description: `Water request approval: ${waterRequest.title}`,
            reference: waterRequest._id.toString(),
            residence: waterRequest.residence,
            residenceName: 'St Kilda Student House',
            amount: waterRequest.totalEstimatedCost || 250,
            expenseId: newExpense.insertedId,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const newTransaction = await transactionsCollection.insertOne(transactionData);
        console.log('✅ Transaction created:', transactionId);

        // Create transaction entries (double-entry accounting)
        const transactionEntriesCollection = db.collection('transactionentries');
        
        // Entry 1: Debit Maintenance Expense Account
        const expenseEntry = {
            transaction: newTransaction.insertedId,
            account: '67c023adae5e27657502e887', // You may need to adjust this account ID
            debit: waterRequest.totalEstimatedCost || 250,
            credit: 0,
            type: 'expense',
            description: `Maintenance expense for ${waterRequest.title}`,
            reference: `${waterRequest._id}-maintenance`,
            metadata: {
                requestId: waterRequest._id,
                requestType: 'maintenance',
                category: 'operational'
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Entry 2: Credit Cash/Bank Account (or Accounts Payable)
        const cashEntry = {
            transaction: newTransaction.insertedId,
            account: '67c023adae5e27657502e887', // You may need to adjust this account ID
            debit: 0,
            credit: waterRequest.totalEstimatedCost || 250,
            type: 'asset',
            description: `Payment for ${waterRequest.title}`,
            reference: `${waterRequest._id}-payment`,
            metadata: {
                requestId: waterRequest._id,
                requestType: 'maintenance',
                category: 'operational'
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const entries = await transactionEntriesCollection.insertMany([expenseEntry, cashEntry]);
        console.log('✅ Transaction entries created:', entries.insertedCount);

        // Update the request to mark as converted to expense
        const updateResult = await maintenanceCollection.updateOne(
            { _id: waterRequest._id },
            {
                $set: {
                    'convertedToExpense': true,
                    'expenseId': newExpense.insertedId,
                    'updatedAt': new Date()
                }
            }
        );

        if (updateResult.modifiedCount > 0) {
            console.log('✅ Request updated: convertedToExpense = true');
        } else {
            console.log('⚠️  Failed to update request');
        }

        // Verify the results
        console.log('\n📊 Verification Results:');
        console.log('========================');
        
        const updatedRequest = await maintenanceCollection.findOne({ _id: waterRequest._id });
        const createdExpense = await expensesCollection.findOne({ _id: newExpense.insertedId });
        const createdTransaction = await transactionsCollection.findOne({ _id: newTransaction.insertedId });
        const createdEntries = await transactionEntriesCollection.find({ transaction: newTransaction.insertedId }).toArray();

        console.log('  - Request convertedToExpense:', updatedRequest.convertedToExpense);
        console.log('  - Request expenseId:', updatedRequest.expenseId);
        console.log('  - Expense created:', createdExpense ? createdExpense.expenseId : 'No');
        console.log('  - Transaction created:', createdTransaction ? createdTransaction.transactionId : 'No');
        console.log('  - Transaction entries:', createdEntries.length);

        const isComplete = 
            updatedRequest.convertedToExpense === true &&
            updatedRequest.expenseId &&
            createdExpense &&
            createdTransaction &&
            createdEntries.length === 2;

        if (isComplete) {
            console.log('\n🎉 SUCCESS: Complete expense and double-entry system created!');
            console.log('   - Request marked as converted to expense ✅');
            console.log('   - Expense record created ✅');
            console.log('   - Transaction record created ✅');
            console.log('   - Double-entry accounting entries created ✅');
        } else {
            console.log('\n❌ FAILURE: Some components not created correctly');
        }

        await client.close();
        console.log('\n✅ Process completed');

    } catch (error) {
        console.error('❌ Process failed:', error);
        console.error('Error details:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

createExpenseForWaterRequest();

