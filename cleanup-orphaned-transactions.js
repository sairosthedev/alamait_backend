const mongoose = require('mongoose');

// Import models
const Request = require('./src/models/Request');
const TransactionEntry = require('./src/models/TransactionEntry');

// Database connection
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

class OrphanedTransactionCleaner {
    constructor() {
        this.orphanedTransactions = [];
        this.deletedTransactions = [];
        this.errors = [];
        this.accountImpact = {};
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

    async findOrphanedTransactions() {
        console.log('\n🔍 FINDING ORPHANED TRANSACTIONS');
        console.log('=' .repeat(60));

        try {
            // 1. Get all current request IDs (these are the expenses)
            const currentRequests = await Request.find({}, '_id');
            const currentRequestIds = currentRequests.map(req => req._id.toString());
            
            console.log(`📋 Current requests (expenses) in database: ${currentRequests.length}`);
            currentRequestIds.forEach((id, index) => {
                console.log(`   ${index + 1}. ${id}`);
            });

            // 2. Find all transaction entries
            const allTransactions = await TransactionEntry.find({});
            console.log(`\n💳 Total transactions in database: ${allTransactions.length}`);

            // 3. Identify orphaned transactions
            this.orphanedTransactions = allTransactions.filter(txn => {
                // Check if transaction has a source that references a request
                if (txn.sourceId && txn.sourceModel === 'Request') {
                    return !currentRequestIds.includes(txn.sourceId.toString());
                }
                
                // Check if transaction description suggests it's expense-related
                if (txn.description && (
                    txn.description.includes('Expense') || 
                    txn.description.includes('EXP_') ||
                    txn.description.includes('Payment for Expense') ||
                    txn.description.includes('Request') ||
                    txn.description.includes('Maintenance')
                )) {
                    // Look for request ID in description
                    const requestIdMatch = txn.description.match(/(?:EXP|REQ|MAINT)[_-]?([A-Z0-9]+)/);
                    if (requestIdMatch) {
                        const extractedId = requestIdMatch[1];
                        // Check if this ID exists in current requests
                        return !currentRequestIds.some(id => id.includes(extractedId));
                    }
                }

                // Check if transaction source is expense-related
                if (txn.source === 'expense' || txn.source === 'expense_payment' || txn.source === 'request' || txn.source === 'maintenance') {
                    return true; // Mark as orphaned if source suggests expense but no valid sourceId
                }

                return false;
            });

            console.log(`\n🚨 ORPHANED TRANSACTIONS FOUND: ${this.orphanedTransactions.length}`);

            if (this.orphanedTransactions.length === 0) {
                console.log('✅ No orphaned transactions found');
                return;
            }

            // 4. Analyze orphaned transactions
            await this.analyzeOrphanedTransactions();

        } catch (error) {
            console.error('❌ Error finding orphaned transactions:', error);
            throw error;
        }
    }

    async analyzeOrphanedTransactions() {
        console.log('\n📊 ANALYZING ORPHANED TRANSACTIONS');
        console.log('-'.repeat(50));

        let totalAmount = 0;
        let sourceTypes = new Set();
        let accountCodes = new Set();

        this.orphanedTransactions.forEach((txn, index) => {
            console.log(`\n${index + 1}. Transaction ID: ${txn.transactionId || txn._id}`);
            console.log(`   Description: ${txn.description}`);
            console.log(`   Date: ${txn.date.toLocaleDateString()}`);
            console.log(`   Source: ${txn.source || 'N/A'}`);
            console.log(`   Source Model: ${txn.sourceModel || 'N/A'}`);
            console.log(`   Source ID: ${txn.sourceId || 'N/A'}`);
            console.log(`   Entries: ${txn.entries.length}`);

            // Calculate total amount
            const transactionAmount = txn.entries.reduce((sum, entry) => {
                return sum + (entry.debit || 0) + (entry.credit || 0);
            }, 0);
            totalAmount += transactionAmount;

            // Collect source types and account codes
            if (txn.source) sourceTypes.add(txn.source);
            txn.entries.forEach(entry => {
                if (entry.accountCode) accountCodes.add(entry.accountCode);
            });

            // Show entry details
            txn.entries.forEach((entry, entryIndex) => {
                console.log(`      Entry ${entryIndex + 1}: ${entry.accountCode} - Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
            });
        });

        console.log(`\n💰 SUMMARY:`);
        console.log(`   Total orphaned transactions: ${this.orphanedTransactions.length}`);
        console.log(`   Total amount involved: $${totalAmount.toFixed(2)}`);
        console.log(`   Source types: ${Array.from(sourceTypes).join(', ')}`);
        console.log(`   Account codes affected: ${Array.from(accountCodes).join(', ')}`);

        // Calculate account impact
        this.calculateAccountImpact();
    }

    calculateAccountImpact() {
        console.log(`\n💳 ACCOUNT BALANCE IMPACT IF DELETED:`);
        console.log('-'.repeat(50));

        this.orphanedTransactions.forEach(txn => {
            txn.entries.forEach(entry => {
                if (entry.accountCode) {
                    if (!this.accountImpact[entry.accountCode]) {
                        this.accountImpact[entry.accountCode] = 0;
                    }
                    // Deleting transaction reverses the original posting
                    this.accountImpact[entry.accountCode] += (entry.credit || 0) - (entry.debit || 0);
                }
            });
        });

        if (Object.keys(this.accountImpact).length === 0) {
            console.log('   No account balance impact');
        } else {
            Object.entries(this.accountImpact).forEach(([accountCode, impact]) => {
                console.log(`   Account ${accountCode}: ${impact > 0 ? '+' : ''}$${impact.toFixed(2)}`);
            });
        }
    }

    async deleteOrphanedTransactions(options = {}) {
        const { dryRun = true, confirm = false } = options;

        console.log(`\n🗑️  DELETING ORPHANED TRANSACTIONS`);
        console.log('=' .repeat(60));
        console.log(`Dry Run: ${dryRun ? 'Yes' : 'No'}`);
        console.log(`Confirm: ${confirm ? 'Yes' : 'No'}`);

        if (this.orphanedTransactions.length === 0) {
            console.log('✅ No orphaned transactions to delete');
            return;
        }

        // Confirm deletion if not dry run
        if (!dryRun && !confirm) {
            console.log(`\n⚠️  WARNING: This will permanently delete ${this.orphanedTransactions.length} orphaned transactions`);
            console.log(`❌ Set confirm: true to proceed with deletion`);
            return;
        }

        if (dryRun) {
            console.log(`\n🔍 DRY RUN - No actual deletion performed`);
            console.log(`   Would delete: ${this.orphanedTransactions.length} orphaned transactions`);
            return;
        }

        // Actual deletion
        console.log(`\n🗑️  PERFORMING ACTUAL DELETION...`);

        for (const transaction of this.orphanedTransactions) {
            try {
                await TransactionEntry.findByIdAndDelete(transaction._id);
                this.deletedTransactions.push(transaction.transactionId || transaction._id);
                console.log(`   ✅ Deleted transaction: ${transaction.transactionId || transaction._id}`);
            } catch (error) {
                this.errors.push(`Failed to delete transaction ${transaction.transactionId || transaction._id}: ${error.message}`);
                console.log(`   ❌ Failed to delete transaction: ${transaction.transactionId || transaction._id}`);
            }
        }

        console.log(`\n✅ DELETION COMPLETED`);
        console.log(`   Transactions deleted: ${this.deletedTransactions.length}`);
        console.log(`   Errors: ${this.errors.length}`);

        if (this.errors.length > 0) {
            console.log(`\n❌ ERRORS:`);
            this.errors.forEach(error => {
                console.log(`   • ${error}`);
            });
        }
    }

    async generateCleanupReport() {
        console.log(`\n📊 CLEANUP REPORT`);
        console.log('=' .repeat(60));

        console.log(`🔍 Orphaned transactions found: ${this.orphanedTransactions.length}`);
        console.log(`🗑️  Transactions deleted: ${this.deletedTransactions.length}`);
        console.log(`❌ Errors encountered: ${this.errors.length}`);

        if (this.deletedTransactions.length > 0) {
            console.log(`\n✅ SUCCESSFULLY DELETED:`);
            this.deletedTransactions.forEach((txnId, index) => {
                console.log(`   ${index + 1}. ${txnId}`);
            });
        }

        if (Object.keys(this.accountImpact).length > 0) {
            console.log(`\n💰 ACCOUNT BALANCE IMPACT:`);
            Object.entries(this.accountImpact).forEach(([accountCode, impact]) => {
                console.log(`   Account ${accountCode}: ${impact > 0 ? '+' : ''}$${impact.toFixed(2)}`);
            });
        }

        return {
            orphanedCount: this.orphanedTransactions.length,
            deletedCount: this.deletedTransactions.length,
            errorCount: this.errors.length,
            accountImpact: this.accountImpact
        };
    }
}

// Main execution
async function main() {
    const cleaner = new OrphanedTransactionCleaner();
    
    try {
        await cleaner.connect();
        
        // Check command line arguments
        const args = process.argv.slice(2);
        const dryRun = args.includes('dry-run');
        const confirm = args.includes('confirm');
        
        console.log('🧹 ORPHANED TRANSACTION CLEANUP TOOL');
        console.log('=' .repeat(60));
        console.log('Usage:');
        console.log('  node cleanup-orphaned-transactions.js [dry-run] [confirm]');
        console.log('');
        console.log('Examples:');
        console.log('  node cleanup-orphaned-transactions.js                    # Find orphaned transactions only');
        console.log('  node cleanup-orphaned-transactions.js dry-run           # Show what would be deleted');
        console.log('  node cleanup-orphaned-transactions.js confirm          # Actually delete orphaned transactions');
        console.log('  node cleanup-orphaned-transactions.js dry-run confirm  # Invalid combination');
        console.log('');

        if (dryRun && confirm) {
            console.log('❌ Cannot use both dry-run and confirm together');
            return;
        }

        // 1. Find orphaned transactions
        await cleaner.findOrphanedTransactions();

        // 2. Delete if requested
        if (confirm) {
            await cleaner.deleteOrphanedTransactions({ dryRun: false, confirm: true });
        } else if (dryRun) {
            await cleaner.deleteOrphanedTransactions({ dryRun: true, confirm: false });
        }

        // 3. Generate report
        const report = await cleaner.generateCleanupReport();
        
        console.log('\n💡 NEXT STEPS:');
        if (report.orphanedCount > 0 && !confirm) {
            console.log('   1. Review the orphaned transactions identified above');
            console.log('   2. Run with "confirm" to delete them:');
            console.log(`      node cleanup-orphaned-transactions.js confirm`);
        } else if (report.deletedCount > 0) {
            console.log('   1. Re-run your balance sheet generation to see improvements');
            console.log('   2. Check account balances for the affected accounts');
            console.log('   3. Verify that your balance sheet now balances');
        } else {
            console.log('   1. No orphaned transactions found - your data is clean!');
            console.log('   2. Check other potential causes of balance sheet imbalance');
        }

    } catch (error) {
        console.error('❌ Script execution failed:', error);
        process.exit(1);
    } finally {
        await cleaner.disconnect();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { OrphanedTransactionCleaner };
