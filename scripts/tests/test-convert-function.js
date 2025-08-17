// Test script to call convertRequestToExpenses directly
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Import ALL models to register schemas
require('./src/models/User');
require('./src/models/Residence');
require('./src/models/MonthlyRequest');
require('./src/models/finance/Expense');
require('./src/models/TransactionEntry');
require('./src/models/Transaction');
require('./src/models/Account');

// Import models after registration
const MonthlyRequest = require('./src/models/MonthlyRequest');
const Expense = require('./src/models/finance/Expense');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');

// Import services
const DoubleEntryAccountingService = require('./src/services/doubleEntryAccountingService');
const AccountMappingService = require('./src/utils/accountMappingService');

async function testConvertFunction() {
    try {
        console.log('🔍 Testing convertRequestToExpenses function directly...');
        
        const requestId = '6894274655ae453778d2ddc9';
        
        // Get the request
        const request = await MonthlyRequest.findById(requestId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');
        
        if (!request) {
            console.error('❌ Request not found');
            return;
        }
        
        console.log('📋 Request details:');
        console.log(`   ID: ${request._id}`);
        console.log(`   Title: ${request.title}`);
        console.log(`   Status: ${request.status}`);
        console.log(`   Items: ${request.items.length}`);
        console.log(`   Is Template: ${request.isTemplate}`);
        
        // Create finance user object
        const financeUser = {
            _id: '67f4ef0fcb87ffa3fb7e2d73',
            firstName: 'Finance',
            lastName: 'User',
            email: 'finance@alamait.com',
            role: 'finance_admin'
        };
        
        // Check existing expenses before conversion
        const existingExpenses = await Expense.find({ monthlyRequestId: requestId });
        console.log(`💰 Existing expenses before conversion: ${existingExpenses.length}`);
        
        // Call convertRequestToExpenses directly
        console.log('\n🔄 Calling convertRequestToExpenses...');
        const result = await convertRequestToExpenses(request, financeUser);
        
        console.log('\n✅ Conversion result:');
        console.log(`   Expenses created: ${result.expenses.length}`);
        console.log(`   Errors: ${result.errors.length}`);
        
        if (result.errors.length > 0) {
            console.log('❌ Errors:');
            result.errors.forEach(error => {
                console.log(`   - ${error.error}`);
            });
        }
        
        // Check expenses after conversion
        const newExpenses = await Expense.find({ monthlyRequestId: requestId });
        console.log(`\n💰 Expenses after conversion: ${newExpenses.length}`);
        newExpenses.forEach(expense => {
            console.log(`   - ${expense.expenseId}: $${expense.amount} (${expense.category})`);
        });
        
        // Check request status after conversion
        const updatedRequest = await MonthlyRequest.findById(requestId);
        console.log(`\n📋 Request status after conversion: ${updatedRequest.status}`);
        
        // Check transactions
        const transactions = await TransactionEntry.find({ 
            sourceId: requestId,
            source: { $in: ['expense_payment', 'maintenance_approval'] }
        });
        console.log(`\n💳 Transactions after conversion: ${transactions.length}`);
        transactions.forEach(transaction => {
            console.log(`   - ${transaction.transactionId}: $${transaction.totalDebit} debit, $${transaction.totalCredit} credit`);
        });
        
    } catch (error) {
        console.error('❌ Error testing convert function:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Helper function to convert request to expenses (copied from controller)
async function convertRequestToExpenses(request, user) {
    const createdExpenses = [];
    const errors = [];
    
    try {
        // Generate unique expense ID
        const expenseId = generateExpenseId();
        
        console.log('📋 Converting regular monthly request...');
        
        // For regular monthly requests, create expense for each item
        for (let i = 0; i < request.items.length; i++) {
            const item = request.items[i];
            console.log(`   Processing item ${i + 1}: ${item.title}`);
            
            const approvedQuotation = item.quotations?.find(q => q.isApproved);
            
            if (approvedQuotation) {
                console.log(`   Using approved quotation: $${approvedQuotation.amount}`);
                
                // Get proper expense account
                const expenseAccountCode = await AccountMappingService.getExpenseAccountForItem(item);
                const expenseAccount = await Account.findOne({ code: expenseAccountCode });
                const expenseCategory = mapToValidExpenseCategory(expenseAccount ? expenseAccount.name : 'Other');
                
                const expense = new Expense({
                    expenseId: `${expenseId}_item_${i}`,
                    title: `${request.title} - ${item.title}`,
                    description: item.description,
                    amount: approvedQuotation.amount,
                    category: expenseCategory,
                    expenseDate: new Date(request.year, request.month - 1, 1),
                    period: 'monthly',
                    paymentStatus: 'Pending',
                    paymentMethod: 'Bank Transfer',
                    monthlyRequestId: request._id,
                    itemIndex: i,
                    quotationId: approvedQuotation._id,
                    residence: request.residence,
                    createdBy: user._id,
                    notes: `Converted from monthly request item: ${item.title} - Account: ${expenseAccountCode}`
                });
                
                await expense.save();
                console.log(`   ✅ Created expense: ${expense.expenseId} - $${expense.amount} (${expense.category})`);
                
                // Create double-entry transaction for this item
                try {
                    const tempRequest = {
                        ...request.toObject(),
                        items: [item],
                        totalEstimatedCost: approvedQuotation.amount
                    };
                    
                    const transactionResult = await DoubleEntryAccountingService.recordMaintenanceApproval(tempRequest, user);
                    
                    // Link expense to transaction
                    expense.transactionId = transactionResult.transaction._id;
                    await expense.save();
                    
                    console.log(`   ✅ Created double-entry transaction: ${transactionResult.transaction.transactionId}`);
                } catch (transactionError) {
                    console.error('   ❌ Error creating double-entry transaction:', transactionError.message);
                }
                
                createdExpenses.push(expense);
                
            } else {
                console.log(`   Using estimated cost: $${item.estimatedCost}`);
                
                // Get proper expense account
                const expenseAccountCode = await AccountMappingService.getExpenseAccountForItem(item);
                const expenseAccount = await Account.findOne({ code: expenseAccountCode });
                const expenseCategory = mapToValidExpenseCategory(expenseAccount ? expenseAccount.name : 'Other');
                
                const expense = new Expense({
                    expenseId: `${expenseId}_item_${i}`,
                    title: `${request.title} - ${item.title}`,
                    description: item.description,
                    amount: item.estimatedCost,
                    category: expenseCategory,
                    expenseDate: new Date(request.year, request.month - 1, 1),
                    period: 'monthly',
                    paymentStatus: 'Pending',
                    paymentMethod: 'Bank Transfer',
                    monthlyRequestId: request._id,
                    itemIndex: i,
                    residence: request.residence,
                    createdBy: user._id,
                    notes: `Converted from monthly request item: ${item.title} (estimated cost) - Account: ${expenseAccountCode}`
                });
                
                await expense.save();
                console.log(`   ✅ Created expense: ${expense.expenseId} - $${expense.amount} (${expense.category})`);
                
                // Create double-entry transaction for this item
                try {
                    const tempRequest = {
                        ...request.toObject(),
                        items: [item],
                        totalEstimatedCost: item.estimatedCost
                    };
                    
                    const transactionResult = await DoubleEntryAccountingService.recordMaintenanceApproval(tempRequest, user);
                    
                    // Link expense to transaction
                    expense.transactionId = transactionResult.transaction._id;
                    await expense.save();
                    
                    console.log(`   ✅ Created double-entry transaction: ${transactionResult.transaction.transactionId}`);
                } catch (transactionError) {
                    console.error('   ❌ Error creating double-entry transaction:', transactionError.message);
                }
                
                createdExpenses.push(expense);
            }
        }
        
        // Update request status to completed
        request.status = 'completed';
        request.requestHistory.push({
            date: new Date(),
            action: 'Converted to expenses with double-entry transactions',
            user: user._id,
            changes: [`${createdExpenses.length} items converted to expenses`]
        });
        
        await request.save();
        console.log('   ✅ Updated request status to completed');
        
    } catch (error) {
        errors.push({
            requestId: request._id,
            error: error.message
        });
    }
    
    return { expenses: createdExpenses, errors };
}

// Helper function to generate expense ID
function generateExpenseId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `EXP_${timestamp}_${random}`.toUpperCase();
}

// Helper function to map account names to valid expense categories
function mapToValidExpenseCategory(accountName) {
    if (!accountName) return 'Other';
    
    const name = accountName.toLowerCase();
    
    if (name.includes('maintenance') || name.includes('repair')) return 'Maintenance';
    if (name.includes('utility') || name.includes('water') || name.includes('electricity') || name.includes('gas')) return 'Utilities';
    if (name.includes('tax')) return 'Taxes';
    if (name.includes('insurance')) return 'Insurance';
    if (name.includes('salary') || name.includes('wage') || name.includes('payroll')) return 'Salaries';
    if (name.includes('supply') || name.includes('material')) return 'Supplies';
    
    return 'Other';
}

console.log('🚀 Starting convert function test...');
testConvertFunction().then(() => {
    console.log('✅ Test completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
