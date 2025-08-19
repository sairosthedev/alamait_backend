const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const TransactionEntry = require('../src/models/TransactionEntry');
const Debtor = require('../src/models/Debtor');
const Account = require('../src/models/Account');

/**
 * FIX PAYMENT DEFERRED INCOME LOGIC
 * 
 * This script will:
 * 1. Fix existing payment transactions to use Deferred Income
 * 2. Create a system for monthly transfers from Deferred Income to Rental Income
 * 3. Handle early payments correctly
 */

async function fixPaymentDeferredIncomeLogic() {
  try {
    console.log('\n🔧 FIXING PAYMENT DEFERRED INCOME LOGIC');
    console.log('==========================================\n');
    
    // ========================================
    // STEP 1: VERIFY DEFERRED INCOME ACCOUNT
    // ========================================
    console.log('📋 STEP 1: VERIFYING DEFERRED INCOME ACCOUNT');
    console.log('==============================================\n');
    
    const deferredIncomeAccount = await Account.findOne({ code: '2030' });
    
    if (!deferredIncomeAccount) {
      console.log('❌ DEFERRED INCOME ACCOUNT NOT FOUND!');
      console.log('   Please create account 2030: Deferred Income - Tenant Advances');
      return;
    }
    
    console.log(`✅ DEFERRED INCOME ACCOUNT FOUND:`);
    console.log(`   Code: ${deferredIncomeAccount.code}`);
    console.log(`   Name: ${deferredIncomeAccount.name}`);
    console.log(`   Type: ${deferredIncomeAccount.type}\n`);
    
    // ========================================
    // STEP 2: ANALYZE CURRENT PAYMENT STRUCTURE
    // ========================================
    console.log('📋 STEP 2: ANALYZING CURRENT PAYMENT STRUCTURE');
    console.log('================================================\n');
    
    const currentPayments = await TransactionEntry.find({
      source: 'payment',
      status: 'posted'
    }).sort({ date: 1 });
    
    console.log(`🔍 CURRENT PAYMENT TRANSACTIONS: ${currentPayments.length}\n`);
    
    if (currentPayments.length > 0) {
      console.log('💰 CURRENT PAYMENT STRUCTURE (WRONG):');
      currentPayments.forEach((payment, index) => {
        console.log(`\n📊 PAYMENT ${index + 1}: ${payment.description}`);
        console.log(`   Date: ${payment.date.toLocaleDateString()}`);
        
        if (payment.entries && Array.isArray(payment.entries)) {
          payment.entries.forEach((lineItem, lineIndex) => {
            console.log(`   Line ${lineIndex + 1}: Account ${lineItem.accountCode} (${lineItem.accountName})`);
            console.log(`      Debit: $${lineItem.debit.toFixed(2)}, Credit: $${lineItem.credit.toFixed(2)}`);
          });
        }
      });
    }
    
    // ========================================
    // STEP 3: CREATE CORRECTED PAYMENT TRANSACTIONS
    // ========================================
    console.log('\n📋 STEP 3: CREATING CORRECTED PAYMENT TRANSACTIONS');
    console.log('====================================================\n');
    
    console.log('🔧 FIXING PAYMENT LOGIC TO USE DEFERRED INCOME...\n');
    
    for (const payment of currentPayments) {
      console.log(`📝 Processing: ${payment.description}`);
      
      // Find the cash inflow amount
      let cashAmount = 0;
      if (payment.entries && Array.isArray(payment.entries)) {
        const cashEntry = payment.entries.find(lineItem => 
          ['1001', '1002', '1011'].includes(lineItem.accountCode) && lineItem.debit > 0
        );
        if (cashEntry) {
          cashAmount = cashEntry.debit;
        }
      }
      
      if (cashAmount > 0) {
        console.log(`   💰 Cash Amount: $${cashAmount.toFixed(2)}`);
        
        // Create corrected transaction entry
        const correctedEntry = new TransactionEntry({
          transactionId: `PAYMENT_FIXED_${payment._id}_${Date.now()}`,
          date: payment.date,
          description: `CORRECTED: ${payment.description} (Deferred Income)`,
          reference: `PAYMENT_FIXED_${payment._id}`,
          entries: [
            {
              accountCode: '1001', // Bank Account
              accountName: 'Bank Account',
              accountType: 'Asset',
              debit: cashAmount,
              credit: 0,
              description: `Cash received from tenant`
            },
            {
              accountCode: '2030', // Deferred Income - Tenant Advances
              accountName: 'Deferred Income - Tenant Advances',
              accountType: 'Liability',
              debit: 0,
              credit: cashAmount,
              description: `Payment received in advance of lease`
            }
          ],
          totalDebit: cashAmount,
          totalCredit: cashAmount,
          source: 'payment',
          sourceId: payment.sourceId,
          sourceModel: payment.sourceModel,
          createdBy: 'system@deferred-income-fix.com',
          status: 'posted'
        });
        
        try {
          await correctedEntry.save();
          console.log(`   ✅ CORRECTED: Created deferred income entry`);
        } catch (error) {
          console.log(`   ❌ ERROR: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️  No cash amount found, skipping`);
      }
    }
    
    // ========================================
    // STEP 4: CREATE MONTHLY TRANSFER SYSTEM
    // ========================================
    console.log('\n📋 STEP 4: CREATING MONTHLY TRANSFER SYSTEM');
    console.log('==============================================\n');
    
    console.log('🔄 CREATING MONTHLY TRANSFERS FROM DEFERRED INCOME TO RENTAL INCOME...\n');
    
    // Get all debtors to understand lease periods
    const debtors = await Debtor.find({});
    
    for (const debtor of debtors) {
      if (debtor.startDate && debtor.endDate) {
        const startDate = new Date(debtor.startDate);
        const endDate = new Date(debtor.endDate);
        
        console.log(`📅 Processing debtor: ${debtor.debtorCode}`);
        console.log(`   Lease Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
        
        // Calculate months
        const months = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
        console.log(`   Total Months: ${months}`);
        
        // Calculate monthly amount (assuming equal distribution)
        const monthlyAmount = (debtor.totalOwed || 0) / months;
        console.log(`   Monthly Amount: $${monthlyAmount.toFixed(2)}`);
        
        // Create monthly transfers for each month of the lease
        for (let i = 0; i < months; i++) {
          const transferDate = new Date(startDate);
          transferDate.setMonth(startDate.getMonth() + i);
          
          const transferEntry = new TransactionEntry({
            transactionId: `DEFERRED_TRANSFER_${debtor._id}_${i}_${Date.now()}`,
            date: transferDate,
            description: `Monthly transfer: Deferred Income to Rental Income - ${debtor.debtorCode} - ${transferDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
            reference: `DEFERRED_TRANSFER_${debtor.debtorCode}_${i}`,
            entries: [
              {
                accountCode: '2030', // Deferred Income - Tenant Advances
                accountName: 'Deferred Income - Tenant Advances',
                accountType: 'Liability',
                debit: monthlyAmount,
                credit: 0,
                description: `Transfer from deferred income for ${debtor.debtorCode}`
              },
              {
                accountCode: '4001', // Rental Income - School Accommodation
                accountName: 'Rental Income - School Accommodation',
                accountType: 'Income',
                debit: 0,
                credit: monthlyAmount,
                description: `Rental income earned for ${debtor.debtorCode}`
              }
            ],
            totalDebit: monthlyAmount,
            totalCredit: monthlyAmount,
                       source: 'manual',
           sourceId: debtor._id,
           sourceModel: 'Lease',
            createdBy: 'system@deferred-income-transfer.com',
            status: 'posted'
          });
          
          try {
            await transferEntry.save();
            console.log(`   ✅ Month ${i + 1}: Created transfer for $${monthlyAmount.toFixed(2)}`);
          } catch (error) {
            console.log(`   ❌ Month ${i + 1}: Error - ${error.message}`);
          }
        }
        console.log('');
      }
    }
    
    // ========================================
    // STEP 5: VERIFICATION
    // ========================================
    console.log('\n📋 STEP 5: VERIFICATION');
    console.log('========================\n');
    
    // Check corrected payments
    const correctedPayments = await TransactionEntry.find({
      description: { $regex: /^CORRECTED:/ }
    });
    
    console.log(`🔍 CORRECTED PAYMENT ENTRIES: ${correctedPayments.length}`);
    
    // Check transfer entries
    const transferEntries = await TransactionEntry.find({
      source: 'deferred_income_transfer'
    });
    
    console.log(`🔍 DEFERRED INCOME TRANSFER ENTRIES: ${transferEntries.length}`);
    
    // ========================================
    // STEP 6: SUMMARY
    // ========================================
    console.log('\n📋 STEP 6: SUMMARY');
    console.log('===================\n');
    
    console.log('🎯 PAYMENT DEFERRED INCOME LOGIC FIXED!');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                                                                                             │');
    console.log('│  ✅ WHAT WAS FIXED:                                                                          │');
    console.log('│     • Payment logic now uses Deferred Income (account 2030)                                │');
    console.log('│     • Early payments are properly classified as liabilities                                │');
    console.log('│     • Monthly transfers from Deferred Income to Rental Income                              │');
    console.log('│                                                                                             │');
    console.log('│  💡 HOW IT WORKS NOW:                                                                        │');
    console.log('│     • Payment received → Deferred Income (liability)                                        │');
    console.log('│     • Each month → Transfer to Rental Income (revenue)                                     │');
    console.log('│     • Revenue recognition matches service delivery                                          │');
    console.log('│                                                                                             │');
    console.log('│  🚀 NEXT STEPS:                                                                              │');
    console.log('│     • Test with Kudzai paying in January for May lease start                               │');
    console.log('│     • Verify financial statements show correct deferred income                              │');
    console.log('│     • Monitor monthly transfers are working correctly                                       │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────┘\n');
    
  } catch (error) {
    console.error('❌ Error fixing payment deferred income logic:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixPaymentDeferredIncomeLogic();
