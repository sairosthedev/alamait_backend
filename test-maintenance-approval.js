const mongoose = require('mongoose');
require('dotenv').config();

const Request = require('./src/models/Request');
const Expense = require('./src/models/finance/Expense');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');

async function testMaintenanceApproval() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n🧪 TESTING MAINTENANCE APPROVAL EXPENSE CREATION');
        console.log('=' .repeat(60));
        
        // Find a maintenance request that has been approved by finance
        const approvedRequest = await Request.findOne({
            'approval.finance.approved': true,
            'approval.finance.approvedBy': { $exists: true },
            convertedToExpense: true
        }).populate('residence');
        
        if (!approvedRequest) {
            console.log('❌ No approved maintenance request found with convertedToExpense=true');
            console.log('💡 Please approve a maintenance request first to test this');
            return;
        }
        
        console.log(`✅ Found approved request: ${approvedRequest.title}`);
        console.log(`   - ID: ${approvedRequest._id}`);
        console.log(`   - Status: ${approvedRequest.status}`);
        console.log(`   - Finance Status: ${approvedRequest.financeStatus}`);
        console.log(`   - Converted to Expense: ${approvedRequest.convertedToExpense}`);
        console.log(`   - Residence: ${approvedRequest.residence?.name || 'Unknown'}`);
        
        // Check if expense was created
        const expense = await Expense.findOne({ requestId: approvedRequest._id });
        if (expense) {
            console.log(`\n✅ Expense record found:`);
            console.log(`   - Expense ID: ${expense.expenseId}`);
            console.log(`   - Amount: $${expense.amount}`);
            console.log(`   - Category: ${expense.category}`);
            console.log(`   - Description: ${expense.description}`);
            console.log(`   - Payment Status: ${expense.paymentStatus}`);
            console.log(`   - Transaction ID: ${expense.transactionId}`);
        } else {
            console.log(`\n❌ No expense record found for request ${approvedRequest._id}`);
        }
        
        // Check if transaction was created
        if (expense?.transactionId) {
            const transaction = await Transaction.findById(expense.transactionId);
            if (transaction) {
                console.log(`\n✅ Transaction record found:`);
                console.log(`   - Transaction ID: ${transaction.transactionId}`);
                console.log(`   - Type: ${transaction.type}`);
                console.log(`   - Description: ${transaction.description}`);
                console.log(`   - Amount: $${transaction.amount}`);
                console.log(`   - Entries: ${transaction.entries?.length || 0}`);
            } else {
                console.log(`\n❌ Transaction not found for ID: ${expense.transactionId}`);
            }
            
            // Check transaction entries
            if (transaction?.entries?.length > 0) {
                console.log(`\n✅ Transaction entries found:`);
                for (const entryId of transaction.entries) {
                    const entry = await TransactionEntry.findById(entryId);
                    if (entry) {
                        console.log(`   - Entry ID: ${entry._id}`);
                        console.log(`   - Source: ${entry.source}`);
                        console.log(`   - Total Debit: $${entry.totalDebit}`);
                        console.log(`   - Total Credit: $${entry.totalCredit}`);
                        console.log(`   - Status: ${entry.status}`);
                        
                        if (entry.entries && entry.entries.length > 0) {
                            console.log(`   - Individual entries: ${entry.entries.length}`);
                            entry.entries.forEach((individualEntry, index) => {
                                console.log(`     ${index + 1}. ${individualEntry.accountName} (${individualEntry.accountCode})`);
                                console.log(`        Debit: $${individualEntry.debit}, Credit: $${individualEntry.credit}`);
                            });
                        }
                    }
                }
            } else {
                console.log(`\n❌ No transaction entries found`);
            }
        }
        
        // Check for any other expenses related to this request
        const allRelatedExpenses = await Expense.find({ 
            $or: [
                { requestId: approvedRequest._id },
                { description: { $regex: approvedRequest.title, $options: 'i' } }
            ]
        });
        
        if (allRelatedExpenses.length > 1) {
            console.log(`\n⚠️  Multiple expenses found for this request:`);
            allRelatedExpenses.forEach((exp, index) => {
                console.log(`   ${index + 1}. ${exp.expenseId} - $${exp.amount} - ${exp.description}`);
            });
        }
        
        console.log('\n🎯 MAINTENANCE APPROVAL TEST COMPLETED!');
        console.log('=' .repeat(60));
        
        if (expense && expense.transactionId) {
            console.log('✅ SUCCESS: Maintenance approval created both expense and transaction!');
            console.log('💡 The system is now working correctly for expense accruals.');
        } else {
            console.log('❌ ISSUE: Maintenance approval did not create proper expense/transaction records.');
            console.log('💡 Check the DoubleEntryAccountingService.recordMaintenanceApproval method.');
        }
        
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testMaintenanceApproval();
