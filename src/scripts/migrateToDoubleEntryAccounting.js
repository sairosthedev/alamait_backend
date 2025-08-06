/**
 * Migration Script: Upgrade to Double-Entry Accounting System
 * 
 * This script migrates existing transaction data to the new enhanced
 * double-entry accounting structure while preserving all existing data.
 * 
 * Usage: node src/scripts/migrateToDoubleEntryAccounting.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

console.log('🔄 Starting Migration to Double-Entry Accounting System...\n');

// Import models
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Expense = require('../models/finance/Expense');
const Payment = require('../models/Payment');

// Migration statistics
const migrationStats = {
  transactionsProcessed: 0,
  transactionEntriesProcessed: 0,
  accountsCreated: 0,
  errors: 0,
  skipped: 0
};

/**
 * Step 1: Initialize Chart of Accounts
 * Creates the basic chart of accounts if they don't exist
 */
async function initializeChartOfAccounts() {
  console.log('📊 Step 1: Initializing Chart of Accounts...');
  
  const accounts = [
    // Assets
    { code: '1001', name: 'Bank Account', type: 'Asset', category: 'Current Assets' },
    { code: '1002', name: 'Cash on Hand', type: 'Asset', category: 'Current Assets' },
    { code: '1003', name: 'Ecocash Wallet', type: 'Asset', category: 'Current Assets' },
    { code: '1004', name: 'Innbucks Wallet', type: 'Asset', category: 'Current Assets' },
    { code: '1101', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets' },
    
    // Liabilities
    { code: '2001', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities' },
    
    // Income
    { code: '4001', name: 'Rent Income', type: 'Income', category: 'Operating Revenue' },
    { code: '4002', name: 'Other Income', type: 'Income', category: 'Operating Revenue' },
    
    // Expenses
    { code: '5001', name: 'Maintenance Expense', type: 'Expense', category: 'Operating Expenses' },
    { code: '5002', name: 'Supplies Expense', type: 'Expense', category: 'Operating Expenses' },
    { code: '5003', name: 'Utilities Expense', type: 'Expense', category: 'Operating Expenses' },
    { code: '5004', name: 'Cleaning Expense', type: 'Expense', category: 'Operating Expenses' }
  ];

  for (const accountData of accounts) {
    try {
      let account = await Account.findOne({ code: accountData.code });
      if (!account) {
        account = new Account(accountData);
        await account.save();
        migrationStats.accountsCreated++;
        console.log(`✅ Created account: ${accountData.code} - ${accountData.name}`);
      }
    } catch (error) {
      console.error(`❌ Error creating account ${accountData.code}:`, error.message);
      migrationStats.errors++;
    }
  }
  
  console.log(`✅ Chart of Accounts initialized. Created: ${migrationStats.accountsCreated} accounts\n`);
}

/**
 * Step 2: Migrate Existing Transactions
 * Updates existing transactions with new required fields
 */
async function migrateTransactions() {
  console.log('📝 Step 2: Migrating Existing Transactions...');
  
  try {
    // Find all transactions that need migration
    const transactions = await Transaction.find({
      $or: [
        { transactionId: { $exists: false } },
        { type: { $exists: false } },
        { createdBy: { $exists: false } },
        { residence: { $exists: false } }
      ]
    });

    console.log(`Found ${transactions.length} transactions to migrate`);

    for (const transaction of transactions) {
      try {
        const updates = {};

        // Generate transactionId if missing
        if (!transaction.transactionId) {
          updates.transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        }

        // Set transaction type based on description
        if (!transaction.type) {
          if (transaction.description?.toLowerCase().includes('rental') || 
              transaction.description?.toLowerCase().includes('payment')) {
            updates.type = 'payment';
          } else if (transaction.description?.toLowerCase().includes('maintenance') ||
                     transaction.description?.toLowerCase().includes('supplies') ||
                     transaction.description?.toLowerCase().includes('cleaning')) {
            updates.type = 'approval';
          } else {
            updates.type = 'other';
          }
        }

        // Set createdBy if missing (default to system user)
        if (!transaction.createdBy) {
          updates.createdBy = new mongoose.Types.ObjectId('67f4ef0fcb87ffa3fb7e2d73'); // System user
        }

        // Set residence if missing (try to infer from entries or set default)
        if (!transaction.residence) {
          // Try to find residence from related data
          const relatedExpense = await Expense.findOne({ transactionId: transaction._id });
          if (relatedExpense?.residence) {
            updates.residence = relatedExpense.residence;
            updates.residenceName = 'Migrated Residence';
          } else {
            // Set default residence
            updates.residence = new mongoose.Types.ObjectId('67c13eb8425a2e078f61d00e'); // Belvedere
            updates.residenceName = 'Belvedere Student House';
          }
        }

        // Set amount if missing
        if (!transaction.amount && transaction.amount !== 0) {
          // Calculate amount from entries if available
          if (transaction.entries && transaction.entries.length > 0) {
            const entryIds = transaction.entries.map(entry => 
              typeof entry === 'object' ? entry.$oid || entry : entry
            );
            const entries = await mongoose.model('TransactionEntry').find({ _id: { $in: entryIds } });
            const totalAmount = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
            updates.amount = totalAmount;
          } else {
            updates.amount = 0;
          }
        }

        // Apply updates
        if (Object.keys(updates).length > 0) {
          await Transaction.findByIdAndUpdate(transaction._id, updates);
          migrationStats.transactionsProcessed++;
          console.log(`✅ Migrated transaction: ${transaction._id} - ${transaction.description}`);
        } else {
          migrationStats.skipped++;
        }

      } catch (error) {
        console.error(`❌ Error migrating transaction ${transaction._id}:`, error.message);
        migrationStats.errors++;
      }
    }

    console.log(`✅ Transactions migration completed. Processed: ${migrationStats.transactionsProcessed}, Skipped: ${migrationStats.skipped}\n`);

  } catch (error) {
    console.error('❌ Error in transaction migration:', error);
    migrationStats.errors++;
  }
}

/**
 * Step 3: Migrate Transaction Entries
 * Converts old simple entries to new comprehensive double-entry structure
 */
async function migrateTransactionEntries() {
  console.log('📋 Step 3: Migrating Transaction Entries...');
  
  try {
    // Find all old-style transaction entries
    const oldEntries = await mongoose.model('TransactionEntry').find({
      $or: [
        { transactionId: { $exists: false } },
        { entries: { $exists: false } },
        { source: { $exists: false } }
      ]
    });

    console.log(`Found ${oldEntries.length} transaction entries to migrate`);

    for (const entry of oldEntries) {
      try {
        const updates = {};

        // Generate transactionId if missing
        if (!entry.transactionId) {
          updates.transactionId = `TXN-ENTRY-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        }

        // Convert old structure to new double-entry structure
        if (!entry.entries || entry.entries.length === 0) {
          const newEntries = [];

          // Get account details
          let account = null;
          if (entry.account) {
            account = await Account.findById(entry.account);
          }

          // Create entry based on old structure
          if (entry.debit > 0) {
            newEntries.push({
              accountCode: account?.code || '1002', // Default to Cash
              accountName: account?.name || 'Cash on Hand',
              accountType: account?.type || 'Asset',
              debit: entry.debit,
              credit: 0,
              description: entry.description || 'Migrated entry'
            });
          }

          if (entry.credit > 0) {
            newEntries.push({
              accountCode: account?.code || '4001', // Default to Rent Income
              accountName: account?.name || 'Rent Income',
              accountType: account?.type || 'Income',
              debit: 0,
              credit: entry.credit,
              description: entry.description || 'Migrated entry'
            });
          }

          updates.entries = newEntries;
          updates.totalDebit = entry.debit || 0;
          updates.totalCredit = entry.credit || 0;
        }

        // Set source information
        if (!entry.source) {
          if (entry.type === 'income') {
            updates.source = 'payment';
            updates.sourceModel = 'Payment';
          } else if (entry.type === 'expense') {
            updates.source = 'expense_payment';
            updates.sourceModel = 'Expense';
          } else {
            updates.source = 'manual';
            updates.sourceModel = 'Request';
          }
        }

        // Set createdBy if missing
        if (!entry.createdBy) {
          updates.createdBy = 'system@migration.com';
        }

        // Set description if missing
        if (!entry.description) {
          updates.description = `Migrated entry from ${entry.type || 'unknown'} transaction`;
        }

        // Apply updates
        if (Object.keys(updates).length > 0) {
          await mongoose.model('TransactionEntry').findByIdAndUpdate(entry._id, updates);
          migrationStats.transactionEntriesProcessed++;
          console.log(`✅ Migrated entry: ${entry._id}`);
        } else {
          migrationStats.skipped++;
        }

      } catch (error) {
        console.error(`❌ Error migrating entry ${entry._id}:`, error.message);
        migrationStats.errors++;
      }
    }

    console.log(`✅ Transaction entries migration completed. Processed: ${migrationStats.transactionEntriesProcessed}, Skipped: ${migrationStats.skipped}\n`);

  } catch (error) {
    console.error('❌ Error in transaction entries migration:', error);
    migrationStats.errors++;
  }
}

/**
 * Step 4: Link Transactions with Expenses
 * Links existing transactions with their corresponding expenses
 */
async function linkTransactionsWithExpenses() {
  console.log('🔗 Step 4: Linking Transactions with Expenses...');
  
  try {
    // Find expenses that don't have transactionId
    const expenses = await Expense.find({ transactionId: null });

    console.log(`Found ${expenses.length} expenses to link`);

    for (const expense of expenses) {
      try {
        // Try to find matching transaction by reference or description
        let transaction = null;

        // Look for transaction with matching maintenance request ID
        if (expense.maintenanceRequestId) {
          transaction = await Transaction.findOne({
            reference: expense.maintenanceRequestId.toString()
          });
        }

        // If not found, look for transaction with similar description
        if (!transaction && expense.description) {
          const searchTerm = expense.description.split(' ')[0]; // First word
          transaction = await Transaction.findOne({
            description: { $regex: searchTerm, $options: 'i' }
          });
        }

        // If still not found, create a new transaction
        if (!transaction) {
          const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
          
          transaction = new Transaction({
            transactionId,
            date: expense.expenseDate || new Date(),
            description: expense.description,
            reference: expense.maintenanceRequestId?.toString() || expense.expenseId,
            residence: expense.residence,
            residenceName: 'Migrated Residence',
            type: 'approval',
            amount: expense.amount,
            createdBy: expense.createdBy || new mongoose.Types.ObjectId('67f4ef0fcb87ffa3fb7e2d73')
          });

          await transaction.save();
          console.log(`✅ Created new transaction for expense: ${expense.expenseId}`);
        }

        // Update expense with transaction reference
        await Expense.findByIdAndUpdate(expense._id, {
          transactionId: transaction._id
        });

        console.log(`✅ Linked expense ${expense.expenseId} with transaction ${transaction.transactionId}`);

      } catch (error) {
        console.error(`❌ Error linking expense ${expense.expenseId}:`, error.message);
        migrationStats.errors++;
      }
    }

    console.log('✅ Transaction-Expense linking completed\n');

  } catch (error) {
    console.error('❌ Error in transaction-expense linking:', error);
    migrationStats.errors++;
  }
}

/**
 * Step 5: Validate Migration
 * Checks that all migrated data is consistent and balanced
 */
async function validateMigration() {
  console.log('✅ Step 5: Validating Migration...');
  
  try {
    // Check for transactions without required fields
    const invalidTransactions = await Transaction.find({
      $or: [
        { transactionId: { $exists: false } },
        { type: { $exists: false } },
        { createdBy: { $exists: false } },
        { residence: { $exists: false } }
      ]
    });

    if (invalidTransactions.length > 0) {
      console.warn(`⚠️  Found ${invalidTransactions.length} transactions with missing required fields`);
    } else {
      console.log('✅ All transactions have required fields');
    }

    // Check for entries without required fields
    const invalidEntries = await mongoose.model('TransactionEntry').find({
      $or: [
        { transactionId: { $exists: false } },
        { entries: { $exists: false } },
        { source: { $exists: false } }
      ]
    });

    if (invalidEntries.length > 0) {
      console.warn(`⚠️  Found ${invalidEntries.length} entries with missing required fields`);
    } else {
      console.log('✅ All transaction entries have required fields');
    }

    // Check for balanced transactions
    const transactions = await Transaction.find().populate('entries');
    let unbalancedCount = 0;

    for (const transaction of transactions) {
      if (transaction.entries && transaction.entries.length > 0) {
        const totalDebit = transaction.entries.reduce((sum, entry) => sum + (entry.totalDebit || 0), 0);
        const totalCredit = transaction.entries.reduce((sum, entry) => sum + (entry.totalCredit || 0), 0);
        
        if (Math.abs(totalDebit - totalCredit) > 0.01) { // Allow for rounding errors
          unbalancedCount++;
        }
      }
    }

    if (unbalancedCount > 0) {
      console.warn(`⚠️  Found ${unbalancedCount} transactions that are not balanced`);
    } else {
      console.log('✅ All transactions are balanced');
    }

    console.log('✅ Migration validation completed\n');

  } catch (error) {
    console.error('❌ Error in migration validation:', error);
    migrationStats.errors++;
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  let connection;
  try {
    // Connect to database
    console.log('🔌 Connecting to MongoDB...');
    connection = await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Run migration steps
    await initializeChartOfAccounts();
    await migrateTransactions();
    await migrateTransactionEntries();
    await linkTransactionsWithExpenses();
    await validateMigration();

    // Print final statistics
    console.log('🎉 Migration completed successfully!');
    console.log('\n📊 Migration Statistics:');
    console.log(`   Transactions processed: ${migrationStats.transactionsProcessed}`);
    console.log(`   Transaction entries processed: ${migrationStats.transactionEntriesProcessed}`);
    console.log(`   Accounts created: ${migrationStats.accountsCreated}`);
    console.log(`   Errors encountered: ${migrationStats.errors}`);
    console.log(`   Records skipped: ${migrationStats.skipped}`);

    if (migrationStats.errors > 0) {
      console.log('\n⚠️  Some errors occurred during migration. Please review the logs above.');
    } else {
      console.log('\n✅ All data migrated successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Disconnect from database
    try {
      if (connection) {
        console.log('\n🔌 Disconnecting from MongoDB...');
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
      }
    } catch (err) {
      console.error('❌ Error disconnecting from MongoDB:', err);
    }
    process.exit(0);
  }
}

// Run the migration
runMigration(); 