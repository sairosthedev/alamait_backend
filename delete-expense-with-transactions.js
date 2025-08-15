const mongoose = require('mongoose');

// Import models
const Expense = require('./src/models/Expense');
const TransactionEntry = require('./src/models/TransactionEntry');

// Database connection
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

class ExpenseDeletionManager {
    constructor() {
        this.deletedExpenses = [];
        this.deletedTransactions = [];
        this.errors = [];
    }

    async connect() {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB successfully');
    }

    async disconnect() {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('🔌 Database connection closed');
        }
    }

    async deleteExpenseWithTransactions(expenseId, options = {}) {
        const { dryRun = true, confirm = false } = options;
        
        console.log(`\n🗑️  DELETING EXPENSE WITH TRANSACTIONS`);
        console.log('=' .repeat(50));
        console.log(`Expense ID: ${expenseId}`);
        console.log(`Dry Run: ${dryRun ? 'Yes' : 'No'}`);
        console.log(`Confirm: ${confirm ? 'Yes' : 'No'}`);

        try {
            // 1. Find the expense
            const expense = await Expense.findById(expenseId);
            if (!expense) {
                throw new Error(`Expense with ID ${expenseId} not found`);
            }

            console.log(`\n📋 EXPENSE DETAILS:`);
            console.log(`   Description: ${expense.description}`);
            console.log(`   Amount: $${expense.amount}`);
            console.log(`   Date: ${expense.date}`);
            console.log(`   Status: ${expense.status}`);
            console.log(`   Category: ${expense.category}`);

            // 2. Find related transaction entries
            const transactions = await TransactionEntry.find({
                $or: [
                    { sourceId: expenseId, sourceModel: 'Expense' },
                    { sourceId: expenseId, source: 'expense' },
                    { 'entries.description': { $regex: expense.description, $options: 'i' } }
                ]
            });

            console.log(`\n💳 RELATED TRANSACTIONS:`);
            if (transactions.length === 0) {
                console.log('   No related transactions found');
            } else {
                transactions.forEach((txn, index) => {
                    console.log(`   ${index + 1}. Transaction ID: ${txn.transactionId}`);
                    console.log(`      Description: ${txn.description}`);
                    console.log(`      Date: ${txn.date}`);
                    console.log(`      Source: ${txn.source}`);
                    console.log(`      Entries: ${txn.entries.length}`);
                    
                    txn.entries.forEach((entry, entryIndex) => {
                        console.log(`         Entry ${entryIndex + 1}: ${entry.accountCode} - Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
                    });
                });
            }

            // 3. Calculate impact on account balances
            const accountImpact = await this.calculateAccountImpact(transactions);
            
            console.log(`\n💰 ACCOUNT BALANCE IMPACT:`);
            if (Object.keys(accountImpact).length === 0) {
                console.log('   No account balance impact');
            } else {
                Object.entries(accountImpact).forEach(([accountCode, impact]) => {
                    console.log(`   Account ${accountCode}: ${impact > 0 ? '+' : ''}$${impact.toFixed(2)}`);
                });
            }

            // 4. Confirm deletion if not dry run
            if (!dryRun && !confirm) {
                console.log(`\n⚠️  WARNING: This will permanently delete:`);
                console.log(`   • 1 expense record`);
                console.log(`   • ${transactions.length} transaction records`);
                console.log(`   • ${transactions.reduce((sum, txn) => sum + txn.entries.length, 0)} transaction entries`);
                console.log(`\n❌ Set confirm: true to proceed with deletion`);
                return { success: false, message: 'Confirmation required' };
            }

            // 5. Perform deletion
            if (dryRun) {
                console.log(`\n🔍 DRY RUN - No actual deletion performed`);
                console.log(`   Would delete: 1 expense, ${transactions.length} transactions`);
                return {
                    success: true,
                    dryRun: true,
                    expense: expense,
                    transactions: transactions,
                    accountImpact: accountImpact
                };
            }

            // 6. Actual deletion
            console.log(`\n🗑️  PERFORMING ACTUAL DELETION...`);

            // Delete transaction entries first (to maintain referential integrity)
            for (const transaction of transactions) {
                try {
                    await TransactionEntry.findByIdAndDelete(transaction._id);
                    this.deletedTransactions.push(transaction.transactionId);
                    console.log(`   ✅ Deleted transaction: ${transaction.transactionId}`);
                } catch (error) {
                    this.errors.push(`Failed to delete transaction ${transaction.transactionId}: ${error.message}`);
                    console.log(`   ❌ Failed to delete transaction: ${transaction.transactionId}`);
                }
            }

            // Delete the expense
            try {
                await Expense.findByIdAndDelete(expenseId);
                this.deletedExpenses.push(expenseId);
                console.log(`   ✅ Deleted expense: ${expenseId}`);
            } catch (error) {
                this.errors.push(`Failed to delete expense ${expenseId}: ${error.message}`);
                console.log(`   ❌ Failed to delete expense: ${expenseId}`);
            }

            console.log(`\n✅ DELETION COMPLETED`);
            console.log(`   Expenses deleted: ${this.deletedExpenses.length}`);
            console.log(`   Transactions deleted: ${this.deletedTransactions.length}`);
            console.log(`   Errors: ${this.errors.length}`);

            return {
                success: true,
                dryRun: false,
                deletedExpenses: this.deletedExpenses,
                deletedTransactions: this.deletedTransactions,
                errors: this.errors,
                accountImpact: accountImpact
            };

        } catch (error) {
            console.error(`❌ Error deleting expense: ${error.message}`);
            this.errors.push(error.message);
            throw error;
        }
    }

    async deleteMultipleExpenses(expenseIds, options = {}) {
        const { dryRun = true, confirm = false } = options;
        
        console.log(`\n🗑️  DELETING MULTIPLE EXPENSES WITH TRANSACTIONS`);
        console.log('=' .repeat(50));
        console.log(`Number of expenses: ${expenseIds.length}`);
        console.log(`Dry Run: ${dryRun ? 'Yes' : 'No'}`);
        console.log(`Confirm: ${confirm ? 'Yes' : 'No'}`);

        const results = [];
        let totalTransactions = 0;
        let totalEntries = 0;

        for (const expenseId of expenseIds) {
            try {
                console.log(`\n--- Processing Expense ${expenseId} ---`);
                const result = await this.deleteExpenseWithTransactions(expenseId, { dryRun, confirm });
                results.push(result);
                
                if (result.success && !result.dryRun) {
                    totalTransactions += result.deletedTransactions.length;
                    totalEntries += result.deletedTransactions.reduce((sum, txn) => {
                        const txnData = this.deletedTransactions.find(t => t === txn);
                        return sum + (txnData ? 1 : 0);
                    }, 0);
                }
            } catch (error) {
                console.error(`❌ Failed to process expense ${expenseId}: ${error.message}`);
                results.push({
                    success: false,
                    expenseId: expenseId,
                    error: error.message
                });
            }
        }

        console.log(`\n📊 BATCH DELETION SUMMARY`);
        console.log('=' .repeat(50));
        console.log(`Total expenses processed: ${expenseIds.length}`);
        console.log(`Successful deletions: ${results.filter(r => r.success).length}`);
        console.log(`Failed deletions: ${results.filter(r => !r.success).length}`);
        
        if (!dryRun) {
            console.log(`Total transactions deleted: ${totalTransactions}`);
            console.log(`Total entries deleted: ${totalEntries}`);
        }

        return results;
    }

    async calculateAccountImpact(transactions) {
        const accountImpact = {};

        transactions.forEach(txn => {
            txn.entries.forEach(entry => {
                if (entry.accountCode) {
                    if (!accountImpact[entry.accountCode]) {
                        accountImpact[entry.accountCode] = 0;
                    }
                    // Reverse the impact (deleting transaction reverses the original posting)
                    accountImpact[entry.accountCode] += (entry.credit || 0) - (entry.debit || 0);
                }
            });
        });

        return accountImpact;
    }

    async findExpensesByCriteria(criteria = {}) {
        console.log(`\n🔍 FINDING EXPENSES BY CRITERIA`);
        console.log('=' .repeat(50));

        const query = {};
        
        if (criteria.status) {
            query.status = criteria.status;
            console.log(`   Status: ${criteria.status}`);
        }
        
        if (criteria.category) {
            query.category = criteria.category;
            console.log(`   Category: ${criteria.category}`);
        }
        
        if (criteria.dateFrom || criteria.dateTo) {
            query.date = {};
            if (criteria.dateFrom) {
                query.date.$gte = new Date(criteria.dateFrom);
                console.log(`   Date From: ${criteria.dateFrom}`);
            }
            if (criteria.dateTo) {
                query.date.$lte = new Date(criteria.dateTo);
                console.log(`   Date To: ${criteria.dateTo}`);
            }
        }

        const expenses = await Expense.find(query).sort({ date: -1 });
        
        console.log(`   Found ${expenses.length} expenses`);
        
        expenses.forEach((expense, index) => {
            console.log(`   ${index + 1}. ${expense._id} - ${expense.description} - $${expense.amount} - ${expense.date.toLocaleDateString()}`);
        });

        return expenses;
    }
}

// Main execution
async function main() {
    const manager = new ExpenseDeletionManager();
    
    try {
        await manager.connect();
        
        // Check command line arguments
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            console.log('📋 EXPENSE DELETION TOOL');
            console.log('=' .repeat(50));
            console.log('Usage:');
            console.log('  node delete-expense-with-transactions.js <expenseId> [dry-run]');
            console.log('  node delete-expense-with-transactions.js multiple <expenseId1> <expenseId2> ... [dry-run]');
            console.log('  node delete-expense-with-transactions.js find [status] [category] [dateFrom] [dateTo]');
            console.log('');
            console.log('Examples:');
            console.log('  node delete-expense-with-transactions.js 507f1f77bcf86cd799439011');
            console.log('  node delete-expense-with-transactions.js 507f1f77bcf86cd799439011 dry-run');
            console.log('  node delete-expense-with-transactions.js multiple 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012');
            console.log('  node delete-expense-with-transactions.js find pending water 2025-01-01 2025-12-31');
            return;
        }

        if (args[0] === 'find') {
            const criteria = {};
            if (args[1]) criteria.status = args[1];
            if (args[2]) criteria.category = args[2];
            if (args[3]) criteria.dateFrom = args[3];
            if (args[4]) criteria.dateTo = args[4];
            
            await manager.findExpensesByCriteria(criteria);
        } else if (args[0] === 'multiple') {
            const expenseIds = args.slice(1, -1);
            const dryRun = args[args.length - 1] === 'dry-run';
            
            if (expenseIds.length === 0) {
                console.log('❌ Please provide expense IDs for multiple deletion');
                return;
            }
            
            await manager.deleteMultipleExpenses(expenseIds, { dryRun, confirm: true });
        } else {
            const expenseId = args[0];
            const dryRun = args[1] === 'dry-run';
            
            await manager.deleteExpenseWithTransactions(expenseId, { dryRun, confirm: true });
        }
        
    } catch (error) {
        console.error('❌ Script execution failed:', error);
        process.exit(1);
    } finally {
        await manager.disconnect();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { ExpenseDeletionManager };
