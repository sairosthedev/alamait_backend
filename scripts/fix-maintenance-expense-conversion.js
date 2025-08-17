const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function fixMaintenanceExpenseConversion() {
    try {
        console.log('🔧 Fixing maintenance expense conversion...');
        
        const Maintenance = require('../src/models/Maintenance');
        const Transaction = require('../src/models/Transaction');
        const TransactionEntry = require('../src/models/TransactionEntry');
        const Account = require('../src/models/Account');
        const { generateUniqueId } = require('../src/utils/idGenerator');
        
        // Find maintenance request that needs fixing
        const maintenanceId = '6894115a8fd1f872eed4a8d8';
        const maintenance = await Maintenance.findById(maintenanceId);
        
        if (!maintenance) {
            console.log('❌ Maintenance request not found');
            return;
        }
        
        console.log('📋 Found maintenance request:');
        console.log(`   - ID: ${maintenance._id}`);
        console.log(`   - Title: ${maintenance.issue}`);
        console.log(`   - Finance Status: ${maintenance.financeStatus}`);
        console.log(`   - Converted to Expense: ${maintenance.convertedToExpense}`);
        console.log(`   - Amount: $${maintenance.amount}`);
        console.log(`   - Total Estimated Cost: $${maintenance.totalEstimatedCost}`);
        
        // Check if it's already been converted
        if (maintenance.convertedToExpense) {
            console.log('✅ Already converted to expense');
            return;
        }
        
        // Calculate the amount to use (use totalEstimatedCost if amount is 0)
        const amount = maintenance.amount > 0 ? maintenance.amount : maintenance.totalEstimatedCost || 0;
        
        console.log(`💰 Using amount: $${amount}`);
        
        if (amount > 0) {
            // Create double-entry transaction
            console.log('📝 Creating double-entry transaction...');
            
            // Get maintenance expense account (default to 5099)
            let expenseAccount = await Account.findOne({ code: '5099', type: 'Expense' });
            if (!expenseAccount) {
                // Try to find any expense account
                expenseAccount = await Account.findOne({ type: 'Expense' });
            }
            
            if (!expenseAccount) {
                console.error('❌ No expense account found');
                return;
            }
            
            // Get or create general Accounts Payable account (default to 2000)
            let payableAccount = await Account.findOne({ code: '2000', type: 'Liability' });
            if (!payableAccount) {
                // Try to find any liability account
                payableAccount = await Account.findOne({ type: 'Liability' });
            }
            
            if (!payableAccount) {
                console.error('❌ No payable account found');
                return;
            }
            
            console.log(`   - Expense Account: ${expenseAccount.code} (${expenseAccount.name})`);
            console.log(`   - Payable Account: ${payableAccount.code} (${payableAccount.name})`);
            
            // Generate unique transaction ID
            const transactionId = await generateUniqueId('TXN');
            
            // Create transaction for approval (creates AP liability)
            const txn = await Transaction.create({
                transactionId: transactionId,
                date: new Date(),
                description: `Maintenance Approval: ${maintenance.issue} - ${maintenance.description}`,
                reference: `MAINT-${maintenance._id}`,
                residence: maintenance.residence,
                type: 'approval',
                createdBy: null // No user context in script
            });
            
            // Create double-entry transaction entry
            const transactionEntry = await TransactionEntry.create({
                transactionId: transactionId,
                date: new Date(),
                description: `Maintenance Approval: ${maintenance.issue}`,
                reference: `MAINT-${maintenance._id}`,
                entries: [
                    {
                        accountCode: expenseAccount.code,
                        accountName: expenseAccount.name,
                        accountType: expenseAccount.type,
                        debit: amount,
                        credit: 0,
                        description: `Maintenance expense: ${maintenance.issue}`
                    },
                    {
                        accountCode: payableAccount.code,
                        accountName: payableAccount.name,
                        accountType: payableAccount.type,
                        debit: 0,
                        credit: amount,
                        description: `Accounts payable for maintenance: ${maintenance.issue}`
                    }
                ],
                totalDebit: amount,
                totalCredit: amount,
                source: 'manual',
                sourceId: maintenance._id,
                sourceModel: 'Maintenance',
                createdBy: 'System Fix Script',
                status: 'posted'
            });
            
            // Link transaction entry to transaction
            await Transaction.findByIdAndUpdate(txn._id, {
                $push: { entries: transactionEntry._id }
            });
            
            console.log('✅ Double-entry transaction created:');
            console.log(`   - Transaction ID: ${transactionId}`);
            console.log(`   - Transaction Entry ID: ${transactionEntry._id}`);
            console.log(`   - Amount: $${amount}`);
        }
        
        // Update maintenance request to mark as converted
        await Maintenance.findByIdAndUpdate(maintenanceId, {
            $set: {
                convertedToExpense: true,
                amount: amount // Update amount if it was 0
            }
        });
        
        console.log('✅ Maintenance request updated:');
        console.log(`   - Converted to Expense: true`);
        console.log(`   - Amount: $${amount}`);
        
        // Verify the fix
        const updatedMaintenance = await Maintenance.findById(maintenanceId);
        console.log('\n🎉 Fix completed! Updated maintenance:');
        console.log(`   - Finance Status: ${updatedMaintenance.financeStatus}`);
        console.log(`   - Converted to Expense: ${updatedMaintenance.convertedToExpense}`);
        console.log(`   - Amount: $${updatedMaintenance.amount}`);
        
    } catch (error) {
        console.error('❌ Error fixing maintenance expense conversion:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the fix
fixMaintenanceExpenseConversion();
