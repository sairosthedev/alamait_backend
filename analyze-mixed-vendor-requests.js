const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const Expense = require('./src/models/finance/Expense');
const MonthlyRequest = require('./src/models/MonthlyRequest');
const Request = require('./src/models/Request');
const Residence = require('./src/models/Residence'); // Add Residence model

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await analyzeMixedVendorRequests();
});

async function analyzeMixedVendorRequests() {
    console.log('\n🔍 MIXED VENDOR REQUESTS ANALYSIS');
    console.log('==================================\n');

    try {
        // 1. Analyze Monthly Requests
        console.log('📋 1. MONTHLY REQUESTS ANALYSIS');
        console.log('===============================');
        
        const monthlyRequests = await MonthlyRequest.find({}).populate('residence');
        console.log(`Total Monthly Requests: ${monthlyRequests.length}`);
        
        let mixedRequests = 0;
        let vendorOnlyRequests = 0;
        let noVendorRequests = 0;
        
        monthlyRequests.forEach(request => {
            const itemsWithVendor = request.items.filter(item => item.provider);
            const itemsWithoutVendor = request.items.filter(item => !item.provider);
            
            if (itemsWithVendor.length > 0 && itemsWithoutVendor.length > 0) {
                mixedRequests++;
                console.log(`\n🔀 MIXED REQUEST: ${request.title}`);
                console.log(`   Items with vendor: ${itemsWithVendor.length}`);
                console.log(`   Items without vendor: ${itemsWithoutVendor.length}`);
                console.log(`   Total items: ${request.items.length}`);
                
                itemsWithVendor.forEach(item => {
                    console.log(`     ✅ ${item.title} - Provider: ${item.provider}`);
                });
                
                itemsWithoutVendor.forEach(item => {
                    console.log(`     ❌ ${item.title} - No provider`);
                });
            } else if (itemsWithVendor.length > 0) {
                vendorOnlyRequests++;
            } else {
                noVendorRequests++;
            }
        });
        
        console.log(`\n📊 SUMMARY:`);
        console.log(`   Mixed requests: ${mixedRequests}`);
        console.log(`   Vendor-only requests: ${vendorOnlyRequests}`);
        console.log(`   No-vendor requests: ${noVendorRequests}`);

        // 2. Analyze Regular Requests
        console.log('\n📋 2. REGULAR REQUESTS ANALYSIS');
        console.log('===============================');
        
        const regularRequests = await Request.find({}).populate('residence');
        console.log(`Total Regular Requests: ${regularRequests.length}`);
        
        let mixedRegularRequests = 0;
        let vendorOnlyRegularRequests = 0;
        let noVendorRegularRequests = 0;
        
        regularRequests.forEach(request => {
            const itemsWithVendor = request.items.filter(item => 
                item.quotations && item.quotations.some(q => q.provider)
            );
            const itemsWithoutVendor = request.items.filter(item => 
                !item.quotations || item.quotations.length === 0 || 
                !item.quotations.some(q => q.provider)
            );
            
            if (itemsWithVendor.length > 0 && itemsWithoutVendor.length > 0) {
                mixedRegularRequests++;
                console.log(`\n🔀 MIXED REGULAR REQUEST: ${request.title}`);
                console.log(`   Items with vendor: ${itemsWithVendor.length}`);
                console.log(`   Items without vendor: ${itemsWithoutVendor.length}`);
                console.log(`   Total items: ${request.items.length}`);
            } else if (itemsWithVendor.length > 0) {
                vendorOnlyRegularRequests++;
            } else {
                noVendorRegularRequests++;
            }
        });
        
        console.log(`\n📊 REGULAR REQUESTS SUMMARY:`);
        console.log(`   Mixed requests: ${mixedRegularRequests}`);
        console.log(`   Vendor-only requests: ${vendorOnlyRegularRequests}`);
        console.log(`   No-vendor requests: ${noVendorRegularRequests}`);

        // 3. Analyze Current Double-Entry Logic
        console.log('\n📋 3. CURRENT DOUBLE-ENTRY LOGIC ANALYSIS');
        console.log('==========================================');
        
        console.log('\n🔍 ISSUE IDENTIFIED:');
        console.log('===================');
        console.log('❌ PROBLEM: The current `recordMaintenanceApproval` function ONLY processes items with vendors!');
        console.log('❌ Items without vendors are IGNORED in double-entry accounting!');
        
        console.log('\n📝 CURRENT LOGIC (from doubleEntryAccountingService.js):');
        console.log('=======================================================');
        console.log('```javascript');
        console.log('for (const item of request.items) {');
        console.log('    const selectedQuotation = item.quotations?.find(q => q.isSelected);');
        console.log('    ');
        console.log('    if (selectedQuotation) {  // ← ONLY processes items with quotations!');
        console.log('        // Creates double-entry for vendor items');
        console.log('        // Dr. Maintenance Expense');
        console.log('        // Cr. Accounts Payable: Vendor');
        console.log('    }');
        console.log('    // ❌ Items without quotations are SKIPPED!');
        console.log('}');
        console.log('```');
        
        console.log('\n💡 WHAT SHOULD HAPPEN:');
        console.log('=====================');
        console.log('✅ Items WITH vendors:');
        console.log('   Dr. Maintenance Expense');
        console.log('   Cr. Accounts Payable: Vendor');
        console.log('');
        console.log('✅ Items WITHOUT vendors:');
        console.log('   Dr. Maintenance Expense');
        console.log('   Cr. Cash/Bank (immediate payment)');
        console.log('   OR');
        console.log('   Cr. Accounts Payable: General (if paid later)');

        // 4. Check Transaction Entries
        console.log('\n📋 4. TRANSACTION ENTRIES ANALYSIS');
        console.log('==================================');
        
        const transactionEntries = await TransactionEntry.find({
            source: 'expense_payment',
            'metadata.requestType': 'maintenance'
        });
        
        console.log(`Total maintenance transaction entries: ${transactionEntries.length}`);
        
        let totalAmount = 0;
        transactionEntries.forEach(entry => {
            const debitTotal = entry.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
            totalAmount += debitTotal;
        });
        
        console.log(`Total maintenance expenses recorded: $${totalAmount.toFixed(2)}`);
        
        // 5. Check Expenses
        console.log('\n📋 5. EXPENSES ANALYSIS');
        console.log('=======================');
        
        const expenses = await Expense.find({
            category: { $in: ['Maintenance', 'maintenance'] }
        });
        
        console.log(`Total maintenance expenses: ${expenses.length}`);
        
        let expensesWithTransactions = 0;
        let expensesWithoutTransactions = 0;
        let totalExpenseAmount = 0;
        
        expenses.forEach(expense => {
            totalExpenseAmount += expense.amount || 0;
            if (expense.transactionId) {
                expensesWithTransactions++;
            } else {
                expensesWithoutTransactions++;
            }
        });
        
        console.log(`Total expense amount: $${totalExpenseAmount.toFixed(2)}`);
        console.log(`Expenses with transactions: ${expensesWithTransactions}`);
        console.log(`Expenses without transactions: ${expensesWithoutTransactions}`);
        
        const difference = totalExpenseAmount - totalAmount;
        console.log(`Difference (Expenses - Transactions): $${difference.toFixed(2)}`);
        
        if (Math.abs(difference) > 0.01) {
            console.log('❌ MISMATCH: Expenses and transactions don\'t match!');
            console.log('   This indicates items without vendors are not being recorded in double-entry!');
        } else {
            console.log('✅ MATCH: Expenses and transactions match');
        }

        // 6. Recommendations
        console.log('\n📋 6. RECOMMENDATIONS');
        console.log('=====================');
        
        console.log('\n🔧 FIX REQUIRED:');
        console.log('===============');
        console.log('1. Update `recordMaintenanceApproval` function to handle items without vendors');
        console.log('2. Create separate double-entry logic for vendor vs non-vendor items');
        console.log('3. Ensure all items in mixed requests are properly accounted for');
        console.log('4. Add validation to prevent items from being skipped');
        
        console.log('\n💡 SUGGESTED LOGIC:');
        console.log('==================');
        console.log('```javascript');
        console.log('for (const item of request.items) {');
        console.log('    const selectedQuotation = item.quotations?.find(q => q.isSelected);');
        console.log('    ');
        console.log('    if (selectedQuotation) {');
        console.log('        // ✅ Items WITH vendors');
        console.log('        // Dr. Maintenance Expense');
        console.log('        // Cr. Accounts Payable: Vendor');
        console.log('    } else {');
        console.log('        // ✅ Items WITHOUT vendors');
        console.log('        // Dr. Maintenance Expense');
        console.log('        // Cr. Cash/Bank (immediate) or Accounts Payable: General');
        console.log('    }');
        console.log('}');
        console.log('```');

    } catch (error) {
        console.error('❌ Error during analysis:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Mixed vendor requests analysis completed');
    }
}

// Run the analysis
console.log('🚀 Starting Mixed Vendor Requests Analysis...'); 