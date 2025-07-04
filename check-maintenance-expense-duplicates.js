const mongoose = require('mongoose');
const Maintenance = require('./src/models/Maintenance');
const Expense = require('./src/models/finance/Expense');

// Check for duplicate expenses from maintenance requests
async function checkMaintenanceExpenseDuplicates() {
    try {
        console.log('=== CHECKING MAINTENANCE EXPENSE DUPLICATES ===');
        
        // Connect to MongoDB using the same method as the main app
        const connectDB = require('./src/config/database');
        await connectDB();
        console.log('✅ Connected to MongoDB');

        // Get all maintenance requests with financeStatus=approved
        console.log('\n1. Checking maintenance requests with financeStatus=approved...');
        const approvedMaintenance = await Maintenance.find({ financeStatus: 'approved' });
        console.log(`Found ${approvedMaintenance.length} approved maintenance requests`);

        // Get all expenses with maintenanceRequestId
        console.log('\n2. Checking expenses linked to maintenance requests...');
        const maintenanceExpenses = await Expense.find({ 
            maintenanceRequestId: { $exists: true, $ne: null } 
        });
        console.log(`Found ${maintenanceExpenses.length} expenses linked to maintenance requests`);

        // Group expenses by maintenanceRequestId to find duplicates
        const expenseGroups = {};
        maintenanceExpenses.forEach(expense => {
            const maintenanceId = expense.maintenanceRequestId.toString();
            if (!expenseGroups[maintenanceId]) {
                expenseGroups[maintenanceId] = [];
            }
            expenseGroups[maintenanceId].push(expense);
        });

        // Find maintenance requests with multiple expenses
        console.log('\n3. Checking for duplicate expenses...');
        const duplicates = [];
        Object.entries(expenseGroups).forEach(([maintenanceId, expenses]) => {
            if (expenses.length > 1) {
                duplicates.push({
                    maintenanceId,
                    expenseCount: expenses.length,
                    expenses: expenses.map(exp => ({
                        expenseId: exp.expenseId,
                        amount: exp.amount,
                        description: exp.description,
                        createdAt: exp.createdAt
                    }))
                });
            }
        });

        if (duplicates.length > 0) {
            console.log(`❌ Found ${duplicates.length} maintenance requests with duplicate expenses:`);
            duplicates.forEach((dup, index) => {
                console.log(`\n${index + 1}. Maintenance ID: ${dup.maintenanceId}`);
                console.log(`   Expense count: ${dup.expenseCount}`);
                console.log('   Expenses:');
                dup.expenses.forEach((exp, expIndex) => {
                    console.log(`     ${expIndex + 1}. ${exp.expenseId} - $${exp.amount} - ${exp.description} (${exp.createdAt})`);
                });
            });
        } else {
            console.log('✅ No duplicate expenses found');
        }

        // Check for approved maintenance requests without expenses
        console.log('\n4. Checking approved maintenance requests without expenses...');
        const approvedWithoutExpenses = [];
        for (const maintenance of approvedMaintenance) {
            const maintenanceId = maintenance._id.toString();
            const hasExpense = maintenanceExpenses.some(exp => 
                exp.maintenanceRequestId.toString() === maintenanceId
            );
            if (!hasExpense) {
                approvedWithoutExpenses.push({
                    maintenanceId,
                    issue: maintenance.issue,
                    amount: maintenance.amount,
                    financeStatus: maintenance.financeStatus
                });
            }
        }

        if (approvedWithoutExpenses.length > 0) {
            console.log(`⚠️  Found ${approvedWithoutExpenses.length} approved maintenance requests without expenses:`);
            approvedWithoutExpenses.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.maintenanceId} - ${item.issue} - $${item.amount || 0}`);
            });
        } else {
            console.log('✅ All approved maintenance requests have expenses');
        }

        console.log('\n=== SUMMARY ===');
        console.log(`Total approved maintenance requests: ${approvedMaintenance.length}`);
        console.log(`Total maintenance expenses: ${maintenanceExpenses.length}`);
        console.log(`Duplicate expense groups: ${duplicates.length}`);
        console.log(`Approved requests without expenses: ${approvedWithoutExpenses.length}`);

    } catch (error) {
        console.error('Error checking maintenance expense duplicates:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the check
checkMaintenanceExpenseDuplicates(); 