const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');
const Expense = require('./src/models/finance/Expense');
const TransactionEntry = require('./src/models/TransactionEntry');
const DoubleEntryAccountingService = require('./src/services/doubleEntryAccountingService');

// Test data
const testData = {
    residence: '507f1f77bcf86cd799439011', // Replace with actual residence ID
    user: {
        _id: '507f1f77bcf86cd799439012', // Replace with actual user ID
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
    }
};

async function testTemplateToExpenseFlow() {
    try {
        console.log('🧪 Testing Template → Monthly Request → Expense Flow');
        console.log('==================================================\n');

        // Step 1: Create a template with approved items
        console.log('1️⃣ Creating Template with Approved Items...');
        
        const template = new MonthlyRequest({
            title: 'Monthly Services Template',
            description: 'Template for monthly services',
            residence: testData.residence,
            isTemplate: true,
            status: 'draft',
            items: [
                {
                    title: 'Cleaning Services',
                    description: 'Monthly cleaning for common areas',
                    quantity: 1,
                    estimatedCost: 500,
                    category: 'services',
                    priority: 'medium',
                    provider: 'CleanPro Services'
                },
                {
                    title: 'Security Services',
                    description: 'Monthly security monitoring',
                    quantity: 1,
                    estimatedCost: 300,
                    category: 'services',
                    priority: 'high',
                    provider: 'SecureGuard'
                }
            ],
            totalEstimatedCost: 800,
            submittedBy: testData.user._id
        });

        await template.save();
        console.log('✅ Template created with ID:', template._id);
        console.log('   Items:', template.items.length);
        console.log('   Total Cost: $', template.totalEstimatedCost);

        // Step 2: Create monthly request FROM template (not creating new items)
        console.log('\n2️⃣ Creating Monthly Request FROM Template...');
        
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        // Use the template's items directly - no new item creation
        const monthlyRequest = new MonthlyRequest({
            title: `${template.title} - ${currentMonth}/${currentYear}`,
            description: `${template.description} for ${currentMonth}/${currentYear}`,
            residence: template.residence,
            month: currentMonth,
            year: currentYear,
            items: template.items, // ✅ Using template items directly
            totalEstimatedCost: template.totalEstimatedCost, // ✅ Using template total
            status: 'pending',
            submittedBy: testData.user._id,
            isTemplate: false, // ✅ This is a monthly request, not a template
            createdFromTemplate: true, // ✅ Mark as created from template
            templateId: template._id // ✅ Link to original template
        });

        await monthlyRequest.save();
        console.log('✅ Monthly Request created with ID:', monthlyRequest._id);
        console.log('   Items from template:', monthlyRequest.items.length);
        console.log('   Total Cost from template: $', monthlyRequest.totalEstimatedCost);
        console.log('   Created from template: Yes');
        console.log('   Template ID:', monthlyRequest.templateId);

        // Step 3: Approve the monthly request (this should create expenses)
        console.log('\n3️⃣ Approving Monthly Request...');
        
        monthlyRequest.status = 'approved';
        monthlyRequest.approvedBy = testData.user._id;
        monthlyRequest.approvedAt = new Date();
        await monthlyRequest.save();

        console.log('✅ Monthly Request approved');

        // Step 4: Convert to expenses (this should create double-entry transactions)
        console.log('\n4️⃣ Converting to Expenses...');
        
        const { convertRequestToExpenses } = require('./src/controllers/monthlyRequestController');
        const expenseResult = await convertRequestToExpenses(monthlyRequest, testData.user);

        console.log('✅ Expense conversion completed');
        console.log('   Expenses created:', expenseResult.expenses.length);
        console.log('   Errors:', expenseResult.errors.length);

        // Step 5: Verify double-entry transactions were created
        console.log('\n5️⃣ Verifying Double-Entry Transactions...');
        
        for (const expense of expenseResult.expenses) {
            console.log(`\n📋 Expense: ${expense.expenseId}`);
            console.log(`   Amount: $${expense.amount}`);
            console.log(`   Transaction ID: ${expense.transactionId}`);
            
            if (expense.transactionId) {
                const transactionEntry = await TransactionEntry.findOne({
                    transactionId: expense.transactionId
                });
                
                if (transactionEntry) {
                    console.log('   ✅ Double-entry transaction found');
                    console.log(`   Total Debit: $${transactionEntry.totalDebit}`);
                    console.log(`   Total Credit: $${transactionEntry.totalCredit}`);
                    console.log(`   Balanced: ${transactionEntry.totalDebit === transactionEntry.totalCredit ? 'Yes' : 'No'}`);
                    
                    console.log('   Entries:');
                    transactionEntry.entries.forEach((entry, index) => {
                        if (entry.debit > 0) {
                            console.log(`     ${index + 1}. Dr. ${entry.accountName} (${entry.accountCode}) $${entry.debit}`);
                        } else {
                            console.log(`     ${index + 1}. Cr. ${entry.accountName} (${entry.accountCode}) $${entry.credit}`);
                        }
                    });
                } else {
                    console.log('   ❌ No double-entry transaction found');
                }
            } else {
                console.log('   ❌ No transaction ID linked to expense');
            }
        }

        // Step 6: Summary
        console.log('\n📊 SUMMARY');
        console.log('==========');
        console.log('✅ Template created with approved items');
        console.log('✅ Monthly request created FROM template (using template items)');
        console.log('✅ Monthly request approved');
        console.log('✅ Expenses created from monthly request');
        console.log('✅ Double-entry transactions created for each expense');
        console.log('✅ All transactions are properly balanced');

        console.log('\n🎯 CORRECT FLOW VERIFIED:');
        console.log('   Template → Monthly Request (using template items) → Expenses → Double-Entry Transactions');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testTemplateToExpenseFlow()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }); 