const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');
const Expense = require('./src/models/Expense');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const DoubleEntryAccountingService = require('./src/services/doubleEntryAccountingService');
const AccountMappingService = require('./src/services/accountMappingService');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function convertExistingMonthlyRequest() {
  try {
    console.log('🔄 Converting existing monthly request to expenses...');
    
    // Get the specific monthly request
    const requestId = '68a68d3a191b6fbe7ea22bec';
    const request = await MonthlyRequest.findById(requestId);
    
    if (!request) {
      throw new Error('Monthly request not found');
    }
    
    console.log(`📋 Found request: ${request.title}`);
    console.log(`   Status: ${request.status}`);
    console.log(`   Is Template: ${request.isTemplate}`);
    console.log(`   Items: ${request.items.length}`);
    console.log(`   Total Cost: $${request.totalEstimatedCost}`);
    
    // Check if expenses already exist
    const existingExpenses = await Expense.find({ monthlyRequestId: request._id });
    if (existingExpenses.length > 0) {
      console.log(`⚠️  Expenses already exist for this request: ${existingExpenses.length} found`);
      console.log('   Existing expenses:', existingExpenses.map(e => ({ id: e._id, title: e.title, amount: e.amount })));
      
      // Check if we should proceed
      const shouldProceed = process.argv.includes('--force');
      if (!shouldProceed) {
        console.log('   Use --force flag to recreate expenses');
        return;
      }
      
      // Delete existing expenses
      console.log('🗑️  Deleting existing expenses...');
      await Expense.deleteMany({ monthlyRequestId: request._id });
      console.log('✅ Existing expenses deleted');
    }
    
    // Generate base expense ID
    const expenseId = `EXP_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const createdExpenses = [];
    
    console.log(`\n🔍 Processing ${request.items.length} items...`);
    
    // Process each item individually
    for (let i = 0; i < request.items.length; i++) {
      const item = request.items[i];
      
      console.log(`\n📝 Processing item ${i + 1}: ${item.title}`);
      console.log(`   Description: ${item.description}`);
      console.log(`   Estimated Cost: $${item.estimatedCost}`);
      console.log(`   Category: ${item.category}`);
      
      try {
        // Get proper expense account using the mapping service
        const expenseAccountCode = await AccountMappingService.getExpenseAccountForItem(item);
        const expenseAccount = await Account.findOne({ code: expenseAccountCode });
        const expenseCategory = mapAccountNameToExpenseCategory(expenseAccount ? expenseAccount.name : 'Other Operating Expenses');
        
        console.log(`   Expense Account: ${expenseAccountCode} - ${expenseAccount ? expenseAccount.name : 'Unknown'}`);
        console.log(`   Expense Category: ${expenseCategory}`);
        
        // Create expense record
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
          createdBy: request.approvedBy,
          notes: `Converted from monthly request item: ${item.title} - Account: ${expenseAccountCode}`
        });
        
        await expense.save();
        console.log(`✅ Expense created: ${expense._id}`);
        
        // Create double-entry transaction for this item
        try {
          console.log(`💰 Creating double-entry transaction for: ${item.title}`);
          
          const tempRequest = {
            ...request.toObject(),
            items: [item], // Only this item
            totalEstimatedCost: item.estimatedCost
          };
          
          const transactionResult = await DoubleEntryAccountingService.recordMaintenanceApproval(tempRequest, {
            _id: request.approvedBy,
            email: request.approvedByEmail || 'finance@alamait.com'
          });
          
          // Link expense to transaction
          expense.transactionId = transactionResult.transaction._id;
          await expense.save();
          
          console.log(`✅ Double-entry transaction created: ${transactionResult.transaction._id}`);
          console.log(`✅ Expense linked to transaction: ${expense.transactionId}`);
          
        } catch (transactionError) {
          console.error(`❌ Error creating double-entry transaction for ${item.title}:`, transactionError);
          // Don't fail the expense creation if transaction fails
        }
        
        createdExpenses.push(expense);
        
      } catch (itemError) {
        console.error(`❌ Error processing item ${item.title}:`, itemError);
      }
    }
    
    // Update request status to completed
    request.status = 'completed';
    request.requestHistory.push({
      date: new Date(),
      action: 'Converted to expenses with double-entry transactions',
      user: request.approvedBy,
      changes: [`${createdExpenses.length} items converted to expenses`]
    });
    
    await request.save();
    console.log(`\n✅ Monthly request conversion completed: ${createdExpenses.length} expenses created`);
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Request: ${request.title}`);
    console.log(`   Expenses Created: ${createdExpenses.length}`);
    console.log(`   Total Amount: $${createdExpenses.reduce((sum, e) => sum + e.amount, 0)}`);
    console.log(`   Request Status: ${request.status}`);
    
    // Show created expenses
    console.log('\n📋 Created Expenses:');
    createdExpenses.forEach((expense, index) => {
      console.log(`   ${index + 1}. ${expense.title} - $${expense.amount} (${expense.category})`);
      if (expense.transactionId) {
        console.log(`      Transaction: ${expense.transactionId}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error converting monthly request:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Helper function to map account names to valid expense categories
function mapAccountNameToExpenseCategory(accountName) {
  const accountNameLower = accountName.toLowerCase();
  
  if (accountNameLower.includes('maintenance') || accountNameLower.includes('plumbing') || 
      accountNameLower.includes('electrical') || accountNameLower.includes('hvac') || 
      accountNameLower.includes('roof') || accountNameLower.includes('painting') || 
      accountNameLower.includes('carpentry') || accountNameLower.includes('flooring')) {
    return 'Maintenance';
  } else if (accountNameLower.includes('utility') || accountNameLower.includes('electricity') || 
             accountNameLower.includes('gas') || accountNameLower.includes('water')) {
    return 'Utilities';
  } else if (accountNameLower.includes('insurance')) {
    return 'Insurance';
  } else if (accountNameLower.includes('property') || accountNameLower.includes('management')) {
    return 'Property Management';
  } else if (accountNameLower.includes('administrative') || accountNameLower.includes('office')) {
    return 'Administrative';
  } else {
    return 'Other Operating Expenses';
  }
}

// Run the conversion
convertExistingMonthlyRequest();
