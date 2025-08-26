/**
 * Vendor Account Migration Script
 * 
 * This script creates vendor-specific accounts based on existing vendor data
 * and links them properly to the double-entry accounting system.
 * 
 * Usage: node src/scripts/migrateVendorAccounts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

console.log('🔄 Starting Vendor Account Migration...\n');

// Import models
const Vendor = require('../models/Vendor');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');

// Migration statistics
const vendorMigrationStats = {
  vendorsProcessed: 0,
  accountsCreated: 0,
  accountsLinked: 0,
  errors: 0,
  skipped: 0
};

/**
 * Create vendor-specific accounts
 */
async function createVendorAccounts() {
  console.log('📊 Creating Vendor-Specific Accounts...');
  
  try {
    const vendors = await Vendor.find({ status: 'active' });
    console.log(`Found ${vendors.length} active vendors to process`);

    for (const vendor of vendors) {
      try {
        // Create vendor-specific payable account
        const payableAccountName = `Accounts Payable: ${vendor.businessName}`;
        const payableAccountCode = vendor.chartOfAccountsCode || `200${vendor.vendorCode.slice(-3)}`;
        
        let payableAccount = await Account.findOne({ 
          name: payableAccountName,
          type: 'Liability'
        });

        // Get the main Accounts Payable account (2000) to link vendor accounts
        const mainAPAccount = await Account.findOne({ code: '2000', type: 'Liability' });
        
        if (!payableAccount) {
          payableAccount = new Account({
            code: payableAccountCode,
            name: payableAccountName,
            type: 'Liability',
            category: 'Current Liabilities',
            subcategory: 'Accounts Payable',
            description: `Payable account for ${vendor.businessName}`,
            isActive: true,
            level: 2, // Set as level 2 (child of main AP account)
            parentAccount: mainAPAccount ? mainAPAccount._id : null, // Link to main AP account
            metadata: {
              vendorId: vendor._id,
              vendorCode: vendor.vendorCode,
              vendorType: vendor.category,
              originalChartOfAccountsCode: vendor.chartOfAccountsCode,
              linkedToMainAP: true,
              linkedDate: new Date(),
              mainAPAccountCode: '2000'
            }
          });

          await payableAccount.save();
          
          // Update main AP account metadata if it exists
          if (mainAPAccount) {
            await Account.findByIdAndUpdate(mainAPAccount._id, {
              $set: {
                'metadata.hasChildren': true,
                'metadata.lastUpdated': new Date()
              },
              $inc: { 'metadata.childrenCount': 1 }
            });
          }
          
          vendorMigrationStats.accountsCreated++;
          console.log(`✅ Created payable account: ${payableAccountCode} - ${payableAccountName} (linked to 2000)`);
        } else {
          // If account exists but isn't linked, link it now
          if (!payableAccount.parentAccount && mainAPAccount) {
            payableAccount.parentAccount = mainAPAccount._id;
            payableAccount.level = 2;
            payableAccount.metadata = {
              ...payableAccount.metadata,
              linkedToMainAP: true,
              linkedDate: new Date(),
              mainAPAccountCode: '2000'
            };
            await payableAccount.save();
            
            // Update main AP account metadata
            await Account.findByIdAndUpdate(mainAPAccount._id, {
              $set: {
                'metadata.hasChildren': true,
                'metadata.lastUpdated': new Date()
              },
              $inc: { 'metadata.childrenCount': 1 }
            });
            
            vendorMigrationStats.accountsLinked++;
            console.log(`✅ Linked existing payable account: ${payableAccountCode} - ${payableAccountName} to 2000`);
          }
        }

        // Create vendor-specific expense account if needed
        if (vendor.expenseAccountCode) {
          const expenseAccountName = `${vendor.category} Expense - ${vendor.businessName}`;
          
          let expenseAccount = await Account.findOne({ 
            name: expenseAccountName,
            type: 'Expense'
          });

          if (!expenseAccount) {
            expenseAccount = new Account({
              code: vendor.expenseAccountCode,
              name: expenseAccountName,
              type: 'Expense',
              category: 'Operating Expenses',
              subcategory: vendor.category,
              description: `Expense account for ${vendor.businessName} services`,
              isActive: true,
              metadata: {
                vendorId: vendor._id,
                vendorCode: vendor.vendorCode,
                vendorType: vendor.category
              }
            });

            await expenseAccount.save();
            vendorMigrationStats.accountsCreated++;
            console.log(`✅ Created expense account: ${vendor.expenseAccountCode} - ${expenseAccountName}`);
          }
        }

        vendorMigrationStats.vendorsProcessed++;

      } catch (error) {
        console.error(`❌ Error processing vendor ${vendor.businessName}:`, error.message);
        vendorMigrationStats.errors++;
      }
    }

    console.log(`✅ Vendor accounts creation completed. Processed: ${vendorMigrationStats.vendorsProcessed}, Created: ${vendorMigrationStats.accountsCreated}\n`);

  } catch (error) {
    console.error('❌ Error in vendor account creation:', error);
    vendorMigrationStats.errors++;
  }
}

/**
 * Link existing transactions to vendor accounts
 */
async function linkVendorTransactions() {
  console.log('🔗 Linking Existing Transactions to Vendor Accounts...');
  
  try {
    // Find transactions that might be related to vendors
    const transactions = await Transaction.find({
      $or: [
        { description: { $regex: /maintenance|repair|cleaning|electrical|plumbing/i } },
        { type: 'approval' }
      ]
    });

    console.log(`Found ${transactions.length} transactions to check for vendor links`);

    for (const transaction of transactions) {
      try {
        // Try to match transaction description with vendor names
        const vendors = await Vendor.find({ status: 'active' });
        
        for (const vendor of vendors) {
          const vendorNamePattern = new RegExp(vendor.businessName.split(' ')[0], 'i');
          const tradingNamePattern = new RegExp(vendor.tradingName.split(' ')[0], 'i');
          
          if (vendorNamePattern.test(transaction.description) || 
              tradingNamePattern.test(transaction.description)) {
            
            // Find the vendor's payable account
            const payableAccount = await Account.findOne({
              name: `Accounts Payable: ${vendor.businessName}`,
              type: 'Liability'
            });

            if (payableAccount) {
              // Update transaction entries to use vendor account
              const entries = await TransactionEntry.find({ 
                transactionId: transaction.transactionId 
              });

              for (const entry of entries) {
                if (entry.entries && entry.entries.length > 0) {
                  let updated = false;
                  
                  for (const lineItem of entry.entries) {
                    // If this is a liability entry, update it to use vendor account
                    if (lineItem.accountType === 'Liability' && 
                        lineItem.accountName.includes('Accounts Payable')) {
                      lineItem.accountCode = payableAccount.code;
                      lineItem.accountName = payableAccount.name;
                      updated = true;
                    }
                  }

                  if (updated) {
                    await TransactionEntry.findByIdAndUpdate(entry._id, {
                      entries: entry.entries,
                      metadata: {
                        ...entry.metadata,
                        vendorId: vendor._id,
                        vendorName: vendor.businessName
                      }
                    });
                    vendorMigrationStats.accountsLinked++;
                    console.log(`✅ Linked transaction ${transaction.transactionId} to vendor ${vendor.businessName}`);
                  }
                }
              }
            }
            break; // Found matching vendor, no need to check others
          }
        }

      } catch (error) {
        console.error(`❌ Error linking transaction ${transaction.transactionId}:`, error.message);
        vendorMigrationStats.errors++;
      }
    }

    console.log(`✅ Vendor transaction linking completed. Linked: ${vendorMigrationStats.accountsLinked}\n`);

  } catch (error) {
    console.error('❌ Error in vendor transaction linking:', error);
    vendorMigrationStats.errors++;
  }
}

/**
 * Create vendor balance summary
 */
async function createVendorBalanceSummary() {
  console.log('📈 Creating Vendor Balance Summary...');
  
  try {
    const vendors = await Vendor.find({ status: 'active' });
    const summary = [];

    for (const vendor of vendors) {
      try {
        const payableAccount = await Account.findOne({
          name: `Accounts Payable: ${vendor.businessName}`,
          type: 'Liability'
        });

        if (payableAccount) {
          // Calculate current balance from transaction entries
          const entries = await TransactionEntry.find({
            'entries.accountCode': payableAccount.code
          });

          let totalDebits = 0;
          let totalCredits = 0;

          for (const entry of entries) {
            for (const lineItem of entry.entries) {
              if (lineItem.accountCode === payableAccount.code) {
                totalDebits += lineItem.debit || 0;
                totalCredits += lineItem.credit || 0;
              }
            }
          }

          const currentBalance = totalCredits - totalDebits; // Credits increase payable, debits decrease

          summary.push({
            vendorId: vendor._id,
            vendorCode: vendor.vendorCode,
            vendorName: vendor.businessName,
            accountCode: payableAccount.code,
            accountName: payableAccount.name,
            totalDebits: totalDebits,
            totalCredits: totalCredits,
            currentBalance: currentBalance,
            creditLimit: vendor.creditLimit || 0,
            paymentTerms: vendor.paymentTerms || 30
          });

          // Update vendor's current balance
          await Vendor.findByIdAndUpdate(vendor._id, {
            currentBalance: currentBalance
          });

          console.log(`✅ ${vendor.businessName}: Balance $${currentBalance.toFixed(2)}`);
        }

      } catch (error) {
        console.error(`❌ Error calculating balance for ${vendor.businessName}:`, error.message);
        vendorMigrationStats.errors++;
      }
    }

    console.log(`\n📊 Vendor Balance Summary:`);
    console.log(`   Total vendors processed: ${summary.length}`);
    console.log(`   Total outstanding payables: $${summary.reduce((sum, v) => sum + Math.max(0, v.currentBalance), 0).toFixed(2)}`);
    console.log(`   Vendors with outstanding balances: ${summary.filter(v => v.currentBalance > 0).length}`);

    // Save summary to file for reference
    const fs = require('fs');
    fs.writeFileSync(
      `vendor_balance_summary_${new Date().toISOString().split('T')[0]}.json`,
      JSON.stringify(summary, null, 2)
    );

    console.log('✅ Vendor balance summary saved to file\n');

  } catch (error) {
    console.error('❌ Error creating vendor balance summary:', error);
    vendorMigrationStats.errors++;
  }
}

/**
 * Validate vendor account migration
 */
async function validateVendorMigration() {
  console.log('✅ Validating Vendor Account Migration...');
  
  try {
    // Check that all active vendors have accounts
    const activeVendors = await Vendor.find({ status: 'active' });
    let missingAccounts = 0;

    for (const vendor of activeVendors) {
      const payableAccount = await Account.findOne({
        name: `Accounts Payable: ${vendor.businessName}`,
        type: 'Liability'
      });

      if (!payableAccount) {
        missingAccounts++;
        console.warn(`⚠️  Missing payable account for vendor: ${vendor.businessName}`);
      }
    }

    if (missingAccounts === 0) {
      console.log('✅ All active vendors have payable accounts');
    } else {
      console.warn(`⚠️  ${missingAccounts} vendors missing payable accounts`);
    }

    // Check account code consistency
    const vendorAccounts = await Account.find({
      type: 'Liability',
      name: { $regex: 'Accounts Payable:' }
    });

    const duplicateCodes = [];
    const codes = vendorAccounts.map(acc => acc.code);
    const uniqueCodes = [...new Set(codes)];

    if (codes.length !== uniqueCodes.length) {
      console.warn(`⚠️  Found duplicate account codes in vendor accounts`);
    } else {
      console.log('✅ All vendor account codes are unique');
    }

    console.log('✅ Vendor migration validation completed\n');

  } catch (error) {
    console.error('❌ Error in vendor migration validation:', error);
    vendorMigrationStats.errors++;
  }
}

/**
 * Main migration function
 */
async function runVendorMigration() {
  let connection;
  try {
    // Connect to database
    console.log('🔌 Connecting to MongoDB...');
    connection = await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Run migration steps
    await createVendorAccounts();
    await linkVendorTransactions();
    await createVendorBalanceSummary();
    await validateVendorMigration();

    // Print final statistics
    console.log('🎉 Vendor Account Migration completed successfully!');
    console.log('\n📊 Migration Statistics:');
    console.log(`   Vendors processed: ${vendorMigrationStats.vendorsProcessed}`);
    console.log(`   Accounts created: ${vendorMigrationStats.accountsCreated}`);
    console.log(`   Transactions linked: ${vendorMigrationStats.accountsLinked}`);
    console.log(`   Errors encountered: ${vendorMigrationStats.errors}`);
    console.log(`   Records skipped: ${vendorMigrationStats.skipped}`);

    if (vendorMigrationStats.errors > 0) {
      console.log('\n⚠️  Some errors occurred during migration. Please review the logs above.');
    } else {
      console.log('\n✅ All vendor accounts migrated successfully!');
    }

  } catch (error) {
    console.error('\n❌ Vendor migration failed:', error.message);
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
runVendorMigration(); 