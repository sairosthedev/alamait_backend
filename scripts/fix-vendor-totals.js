const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');
const Vendor = require('../src/models/Vendor');
require('dotenv').config();

// Vendor details
const VENDOR_ID = '689247eb0067f3f7098c4b78';
const VENDOR_CHART_CODE = '200009';
const VENDOR_NAME = 'Miccs Technologies';

async function calculateVendorTotals(vendorId) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
    console.log('Connected to MongoDB');

    console.log(`Calculating totals for vendor: ${VENDOR_NAME} (ID: ${vendorId})`);
    console.log(`Chart of Accounts Code: ${VENDOR_CHART_CODE}`);
    console.log('=' .repeat(60));

    // Get all transactions for this vendor
    const transactions = await TransactionEntry.find({
      'entries.accountCode': VENDOR_CHART_CODE
    }).sort({ date: 1 });

    console.log(`Found ${transactions.length} transactions for this vendor`);

    let totalSpent = 0;
    let totalPaid = 0;
    let outstandingAmount = 0;

    // Calculate totals from transactions
    transactions.forEach((transaction, index) => {
      console.log(`\nTransaction ${index + 1}:`);
      console.log(`- Date: ${transaction.date.toDateString()}`);
      console.log(`- Description: ${transaction.description}`);
      console.log(`- Reference: ${transaction.reference}`);
      
      // Find the vendor-specific entry
      const vendorEntry = transaction.entries.find(entry => 
        entry.accountCode === VENDOR_CHART_CODE
      );

      if (vendorEntry) {
        const amount = vendorEntry.debit || vendorEntry.credit || 0;
        const isDebit = vendorEntry.debit > 0;
        
        console.log(`- Amount: $${amount.toFixed(2)} (${isDebit ? 'debit' : 'credit'})`);
        
        if (isDebit) {
          // Debit to vendor account = payment made to vendor (reducing payable)
          totalPaid += amount;
          console.log(`  → Payment to vendor: +$${amount.toFixed(2)}`);
        } else {
          // Credit to vendor account = expense/purchase from vendor (increasing payable)
          totalSpent += amount;
          console.log(`  → Expense from vendor: +$${amount.toFixed(2)}`);
        }
      }
    });

    // Calculate outstanding amount
    outstandingAmount = totalSpent - totalPaid;

    console.log('\n' + '=' .repeat(60));
    console.log('CALCULATED TOTALS:');
    console.log(`Total Spent (Expenses): $${totalSpent.toFixed(2)}`);
    console.log(`Total Paid (Payments): $${totalPaid.toFixed(2)}`);
    console.log(`Outstanding Amount: $${outstandingAmount.toFixed(2)}`);
    console.log('=' .repeat(60));

    // Update the vendor record
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      console.error('Vendor not found!');
      return;
    }

    // Update vendor totals
    vendor.totalSpent = totalSpent;
    vendor.outstandingAmount = outstandingAmount;
    vendor.currentBalance = outstandingAmount; // Update current balance as well

    await vendor.save();

    console.log('\n✅ Vendor totals updated successfully!');
    console.log(`Updated vendor: ${vendor.businessName}`);
    console.log(`New Total Spent: $${vendor.totalSpent.toFixed(2)}`);
    console.log(`New Outstanding Amount: $${vendor.outstandingAmount.toFixed(2)}`);
    console.log(`New Current Balance: $${vendor.currentBalance.toFixed(2)}`);

  } catch (error) {
    console.error('Error calculating vendor totals:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
calculateVendorTotals(VENDOR_ID); 