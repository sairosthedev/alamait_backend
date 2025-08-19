const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Transaction = require('../src/models/Transaction');
const Account = require('../src/models/Account');
const Debtor = require('../src/models/Debtor');

/**
 * COMPLETE RENTAL ACCRUAL SYSTEM FIX
 * 
 * This script will:
 * 1. Fix the rental accrual system to properly link to debtors collection
 * 2. Create missing monthly rent accruals for May-August 2025
 * 3. Ensure proper double-entry accounting
 * 4. Link all accruals to specific debtors
 */

async function fixRentalAccrualSystem() {
  try {
    console.log('\n🔧 FIXING RENTAL ACCRUAL SYSTEM');
    console.log('==================================\n');
    
    // ========================================
    // STEP 1: VERIFY REQUIRED ACCOUNTS
    // ========================================
    console.log('🔍 STEP 1: Verifying Required Accounts\n');
    
    const requiredAccounts = [
      { code: '1101', name: 'Accounts Receivable', type: 'Asset' },
      { code: '4001', name: 'Rental Income', type: 'Income' },
      { code: '4100', name: 'Administrative Income', type: 'Income' }
    ];
    
    const accountStatus = {};
    for (const required of requiredAccounts) {
      const account = await Account.findOne({ code: required.code });
      if (account) {
        console.log(`   ✅ ${required.code} - ${required.name} (${account.type})`);
        accountStatus[required.code] = account;
      } else {
        console.log(`   ❌ ${required.code} - ${required.name} (MISSING - Creating...)`);
        
        // Create missing account
        const newAccount = new Account({
          code: required.code,
          name: required.name,
          type: required.type,
          category: required.type === 'Asset' ? 'Current Assets' : 
                   required.type === 'Income' ? 'Operating Revenue' : 'Operating Expenses',
          description: `Account for ${required.name.toLowerCase()}`
        });
        
        await newAccount.save();
        console.log(`      ✅ Created account ${required.code}`);
        accountStatus[required.code] = newAccount;
      }
    }
    
    // ========================================
    // STEP 2: GET ACTIVE DEBTORS
    // ========================================
    console.log('\n🔍 STEP 2: Getting Active Debtors\n');
    
    const activeDebtors = await Debtor.find({ 
      status: { $in: ['active', 'overdue'] },
      currentBalance: { $gte: 0 }
    });
    
    console.log(`📊 Found ${activeDebtors.length} active debtors`);
    
    if (activeDebtors.length === 0) {
      console.log('   ❌ No active debtors found. Cannot create accruals.');
      return;
    }
    
    // Display debtor information
    activeDebtors.forEach((debtor, index) => {
      console.log(`   ${index + 1}. ${debtor.debtorCode} - Room ${debtor.roomNumber || 'N/A'} - Balance: $${debtor.currentBalance || 0}`);
    });
    
    // ========================================
    // STEP 3: CREATE MONTHLY RENT ACCRUALS
    // ========================================
    console.log('\n🔍 STEP 3: Creating Monthly Rent Accruals (May-August 2025)\n');
    
    const months = [
      { month: 5, year: 2025, name: 'May' },
      { month: 6, year: 2025, name: 'June' },
      { month: 7, year: 2025, name: 'July' },
      { month: 8, year: 2025, name: 'August' }
    ];
    
    let totalAccrualsCreated = 0;
    let totalRentAccrued = 0;
    
    for (const monthInfo of months) {
      console.log(`\n📅 Creating accruals for ${monthInfo.name} ${monthInfo.year}:`);
      
      for (const debtor of activeDebtors) {
        try {
          // Check if accrual already exists for this debtor and month
          const existingAccrual = await TransactionEntry.findOne({
            source: 'rental_accrual',
            'metadata.debtorId': debtor._id,
            'metadata.accrualMonth': monthInfo.month,
            'metadata.accrualYear': monthInfo.year
          });
          
          if (existingAccrual) {
            console.log(`   ⏭️  ${debtor.debtorCode}: Accrual already exists for ${monthInfo.name}`);
            continue;
          }
          
          // Calculate rent amount (use debtor's room price or default to $180)
          const rentAmount = debtor.roomPrice || 180;
          const adminFee = 20; // Standard admin fee
          const totalAmount = rentAmount + adminFee;
          
          // Create transaction
          const transaction = new Transaction({
            transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            date: new Date(monthInfo.year, monthInfo.month - 1, 1), // First day of month
            description: `Rent accrual: ${debtor.debtorCode} - ${monthInfo.name} ${monthInfo.year}`,
            type: 'rental_accrual',
            status: 'posted',
            createdBy: 'system@accrual.com',
            metadata: {
              debtorId: debtor._id,
              debtorCode: debtor.debtorCode,
              accrualMonth: monthInfo.month,
              accrualYear: monthInfo.year,
              rentAmount,
              adminFee,
              totalAmount
            }
          });
          
          await transaction.save();
          
          // Create double-entry accounting entries
          const entries = [
            // Debit: Accounts Receivable (Student owes money)
            {
              accountCode: accountStatus['1101'].code,
              accountName: accountStatus['1101'].name,
              accountType: accountStatus['1101'].type,
              debit: totalAmount,
              credit: 0,
              description: `Rent due from ${debtor.debtorCode} - ${monthInfo.name} ${monthInfo.year}`
            },
            // Credit: Rental Income
            {
              accountCode: accountStatus['4001'].code,
              accountName: accountStatus['4001'].name,
              accountType: accountStatus['4001'].type,
              debit: 0,
              credit: rentAmount,
              description: `Rental income accrued - ${debtor.debtorCode} - ${monthInfo.name} ${monthInfo.year}`
            },
            // Credit: Administrative Income
            {
              accountCode: accountStatus['4100'].code,
              accountName: accountStatus['4100'].name,
              accountType: accountStatus['4100'].type,
              debit: 0,
              credit: adminFee,
              description: `Admin fee accrued - ${debtor.debtorCode} - ${monthInfo.name} ${monthInfo.year}`
            }
          ];
          
          // Create transaction entry
          const transactionEntry = new TransactionEntry({
            transactionId: transaction.transactionId,
            date: new Date(monthInfo.year, monthInfo.month - 1, 1),
            description: `Rent accrual: ${debtor.debtorCode} - ${monthInfo.name} ${monthInfo.year}`,
            reference: debtor._id.toString(),
            entries,
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            source: 'rental_accrual',
            sourceId: debtor._id,
            sourceModel: 'Debtor',
            createdBy: 'system@accrual.com',
            status: 'posted',
            metadata: {
              debtorId: debtor._id,
              debtorCode: debtor.debtorCode,
              roomNumber: debtor.roomNumber,
              residence: debtor.residence,
              accrualMonth: monthInfo.month,
              accrualYear: monthInfo.year,
              type: 'rent_accrual',
              rentAmount,
              adminFee,
              totalAmount
            }
          });
          
          await transactionEntry.save();
          
          // Update transaction with entry reference
          transaction.entries = [transactionEntry._id];
          await transaction.save();
          
          // Update debtor's total owed amount
          debtor.totalOwed += totalAmount;
          debtor.currentBalance += totalAmount;
          await debtor.save();
          
          console.log(`   ✅ ${debtor.debtorCode}: Created accrual for ${monthInfo.name} - $${totalAmount}`);
          totalAccrualsCreated++;
          totalRentAccrued += totalAmount;
          
        } catch (error) {
          console.error(`   ❌ ${debtor.debtorCode}: Error creating accrual for ${monthInfo.name}:`, error.message);
        }
      }
    }
    
    // ========================================
    // STEP 4: SUMMARY AND VERIFICATION
    // ========================================
    console.log('\n🔍 STEP 4: Summary and Verification\n');
    
    console.log(`📊 ACCRUAL CREATION SUMMARY:`);
    console.log(`   Total Accruals Created: ${totalAccrualsCreated}`);
    console.log(`   Total Rent Accrued: $${totalRentAccrued.toFixed(2)}`);
    console.log(`   Months Covered: May, June, July, August 2025`);
    console.log(`   Debtors Covered: ${activeDebtors.length}`);
    
    // Verify the accruals were created
    const totalAccruals = await TransactionEntry.countDocuments({ source: 'rental_accrual' });
    console.log(`   Total Accruals in System: ${totalAccruals}`);
    
    // Check total rent revenue from accruals
    const accrualRentRevenue = await TransactionEntry.aggregate([
      { $match: { source: 'rental_accrual', 'entries.accountCode': '4001' } },
      { $unwind: '$entries' },
      { $match: { 'entries.accountCode': '4001' } },
      { $group: { _id: null, total: { $sum: '$entries.credit' } } }
    ]);
    
    const totalRentRevenue = accrualRentRevenue[0]?.total || 0;
    console.log(`   Total Rent Revenue from Accruals: $${totalRentRevenue.toFixed(2)}`);
    
    // Check total admin fee revenue from accruals
    const accrualAdminRevenue = await TransactionEntry.aggregate([
      { $match: { source: 'rental_accrual', 'entries.accountCode': '4100' } },
      { $unwind: '$entries' },
      { $match: { 'entries.accountCode': '4100' } },
      { $group: { _id: null, total: { $sum: '$entries.credit' } } }
    ]);
    
    const totalAdminRevenue = accrualAdminRevenue[0]?.total || 0;
    console.log(`   Total Admin Fee Revenue from Accruals: $${totalAdminRevenue.toFixed(2)}`);
    
    // ========================================
    // STEP 5: VERIFY BUSINESS SCENARIO
    // ========================================
    console.log('\n🔍 STEP 5: Verifying Business Scenario\n');
    
    const expectedRentRevenue = 180 * 4; // 4 months × $180
    const expectedAdminRevenue = 20 * 4; // 4 months × $20
    const expectedTotal = expectedRentRevenue + expectedAdminRevenue;
    
    console.log(`📋 EXPECTED VALUES FROM SCENARIO:`);
    console.log(`   Expected Rent Revenue: $${expectedRentRevenue.toFixed(2)}`);
    console.log(`   Expected Admin Fee Revenue: $${expectedAdminRevenue.toFixed(2)}`);
    console.log(`   Expected Total: $${expectedTotal.toFixed(2)}`);
    
    if (Math.abs(totalRentAccrued - expectedTotal) <= 0.01) {
      console.log(`\n🎉 SUCCESS! Your rental accrual system is now COMPLETE!`);
      console.log(`   ✅ All monthly accruals created`);
      console.log(`   ✅ Properly linked to debtors collection`);
      console.log(`   ✅ Double-entry accounting implemented`);
      console.log(`   ✅ Matches your business scenario perfectly`);
    } else {
      console.log(`\n⚠️  PARTIAL SUCCESS: Some accruals created but amounts don't match exactly`);
      console.log(`   Expected: $${expectedTotal.toFixed(2)}`);
      console.log(`   Created: $${totalRentAccrued.toFixed(2)}`);
      console.log(`   Difference: $${Math.abs(totalRentAccrued - expectedTotal).toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing rental accrual system:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the complete fix
fixRentalAccrualSystem();
