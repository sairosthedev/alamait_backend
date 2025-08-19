const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');

/**
 * DEBUG ACCRUAL REVENUE
 * 
 * This script will investigate why accrued revenue is showing $0.00
 */

async function debugAccrualRevenue() {
  try {
    console.log('\n🔍 DEBUGGING ACCRUAL REVENUE');
    console.log('===============================\n');
    
    // Set date range for full year 2025
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');
    
    console.log(`📅 REPORTING PERIOD: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`);
    
    // ========================================
    // STEP 1: FIND ALL RENTAL ACCRUAL TRANSACTIONS
    // ========================================
    console.log('📋 STEP 1: FINDING ALL RENTAL ACCRUAL TRANSACTIONS');
    console.log('==================================================\n');
    
    const rentalAccruals = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      source: 'rental_accrual',
      status: 'posted'
    });
    
    console.log(`🔍 Found ${rentalAccruals.length} rental accrual transactions\n`);
    
    if (rentalAccruals.length === 0) {
      console.log('❌ NO RENTAL ACCRUALS FOUND! This explains the $0.00 revenue.\n');
      
      // Check if there are any rental accruals at all (regardless of date)
      const allRentalAccruals = await TransactionEntry.find({
        source: 'rental_accrual',
        status: 'posted'
      });
      
      console.log(`🔍 Total rental accruals in database (all dates): ${allRentalAccruals.length}\n`);
      
      if (allRentalAccruals.length > 0) {
        console.log('📅 RENTAL ACCRUALS FOUND (but outside date range):');
        allRentalAccruals.forEach((accrual, index) => {
          console.log(`   ${index + 1}. Date: ${accrual.date.toLocaleDateString()}, Description: ${accrual.description}`);
        });
      }
    } else {
      console.log('✅ RENTAL ACCRUALS FOUND:');
      rentalAccruals.forEach((accrual, index) => {
        console.log(`   ${index + 1}. Date: ${accrual.date.toLocaleDateString()}, Description: ${accrual.description}`);
        console.log(`      Entries: ${JSON.stringify(accrual.entries)}`);
      });
    }
    
    // ========================================
    // STEP 2: CHECK ACCOUNT CODES IN RENTAL ACCRUALS
    // ========================================
    console.log('\n📋 STEP 2: CHECKING ACCOUNT CODES IN RENTAL ACCRUALS');
    console.log('========================================================\n');
    
    if (rentalAccruals.length > 0) {
      console.log('🔍 ANALYZING RENTAL ACCRUAL ENTRIES:');
      
      let totalRevenue = 0;
      
      rentalAccruals.forEach((accrual, index) => {
        console.log(`\n📊 ACCRUAL ${index + 1}: ${accrual.description}`);
        console.log('─'.repeat(50));
        
        if (accrual.entries && Array.isArray(accrual.entries)) {
          accrual.entries.forEach((lineItem, lineIndex) => {
            console.log(`   Line ${lineIndex + 1}: Account ${lineItem.accountCode} (${lineItem.accountName})`);
            console.log(`      Debit: $${lineItem.debit.toFixed(2)}, Credit: $${lineItem.credit.toFixed(2)}`);
            
            // Check if this is a revenue account
            if (['4001', '4000', '4100', '4020'].includes(lineItem.accountCode)) {
              console.log(`      ✅ REVENUE ACCOUNT FOUND!`);
              if (lineItem.credit > 0) {
                totalRevenue += lineItem.credit;
                console.log(`      💰 Adding $${lineItem.credit.toFixed(2)} to revenue`);
              }
            }
          });
        } else {
          console.log('   ❌ No entries found');
        }
      });
      
      console.log(`\n💰 TOTAL REVENUE FROM RENTAL ACCRUALS: $${totalRevenue.toFixed(2)}`);
    }
    
    // ========================================
    // STEP 3: CHECK ALL TRANSACTIONS FOR REVENUE ACCOUNTS
    // ========================================
    console.log('\n📋 STEP 3: CHECKING ALL TRANSACTIONS FOR REVENUE ACCOUNTS');
    console.log('==========================================================\n');
    
    const allTransactions = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate },
      status: 'posted'
    });
    
    console.log(`🔍 Found ${allTransactions.length} total transactions in date range\n`);
    
    let revenueTransactions = [];
    
    allTransactions.forEach(transaction => {
      if (transaction.entries && Array.isArray(transaction.entries)) {
        transaction.entries.forEach(lineItem => {
          if (['4001', '4000', '4100', '4020'].includes(lineItem.accountCode) && lineItem.credit > 0) {
            revenueTransactions.push({
              id: transaction._id,
              date: transaction.date,
              description: transaction.description,
              source: transaction.source,
              accountCode: lineItem.accountCode,
              accountName: lineItem.accountName,
              amount: lineItem.credit
            });
          }
        });
      }
    });
    
    console.log(`🔍 Found ${revenueTransactions.length} transactions with revenue account credits\n`);
    
    if (revenueTransactions.length > 0) {
      console.log('📊 REVENUE TRANSACTIONS FOUND:');
      revenueTransactions.forEach((rev, index) => {
        console.log(`   ${index + 1}. Date: ${rev.date.toLocaleDateString()}`);
        console.log(`      Description: ${rev.description}`);
        console.log(`      Source: ${rev.source}`);
        console.log(`      Account: ${rev.accountCode} (${rev.accountName})`);
        console.log(`      Amount: $${rev.amount.toFixed(2)}`);
        console.log('');
      });
      
      const totalRevenueFound = revenueTransactions.reduce((sum, rev) => sum + rev.amount, 0);
      console.log(`💰 TOTAL REVENUE FOUND: $${totalRevenueFound.toFixed(2)}`);
    }
    
    // ========================================
    // STEP 4: CHECK FOR RENTAL ACCRUALS OUTSIDE DATE RANGE
    // ========================================
    console.log('\n📋 STEP 4: CHECKING FOR RENTAL ACCRUALS OUTSIDE DATE RANGE');
    console.log('================================================================\n');
    
    const allRentalAccrualsEver = await TransactionEntry.find({
      source: 'rental_accrual',
      status: 'posted'
    });
    
    if (allRentalAccrualsEver.length > 0) {
      console.log('📅 ALL RENTAL ACCRUALS IN DATABASE:');
      allRentalAccrualsEver.forEach((accrual, index) => {
        const isInRange = accrual.date >= startDate && accrual.date <= endDate;
        const status = isInRange ? '✅ IN RANGE' : '❌ OUT OF RANGE';
        console.log(`   ${index + 1}. Date: ${accrual.date.toLocaleDateString()} - ${status}`);
        console.log(`      Description: ${accrual.description}`);
      });
    }
    
    // ========================================
    // STEP 5: SUMMARY
    // ========================================
    console.log('\n📋 STEP 5: SUMMARY');
    console.log('==================\n');
    
    console.log('🎯 ACCRUAL REVENUE DEBUG SUMMARY:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log(`│  🔍 RENTAL ACCRUALS IN DATE RANGE: ${rentalAccruals.length}                                        │`);
    console.log(`│  🔍 TOTAL RENTAL ACCRUALS IN DB: ${allRentalAccrualsEver.length}                                        │`);
    console.log(`│  🔍 REVENUE TRANSACTIONS FOUND: ${revenueTransactions.length}                                        │`);
    console.log('│                                                                                             │');
    console.log('│  💡 POSSIBLE ISSUES:                                                                         │');
    console.log('│     • Date range might be wrong                                                             │');
    console.log('│     • Rental accruals might not exist                                                        │');
    console.log('│     • Account codes might be different                                                       │');
    console.log('│     • Source field might be different                                                        │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
  } catch (error) {
    console.error('❌ Error debugging accrual revenue:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the debug
debugAccrualRevenue();
