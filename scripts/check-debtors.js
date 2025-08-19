const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const Debtor = require('../src/models/Debtor');

async function checkDebtors() {
  try {
    console.log('\n🔍 CHECKING YOUR DEBTORS COLLECTION');
    console.log('====================================\n');
    
    // Get all debtors
    const allDebtors = await Debtor.find({});
    console.log(`📊 Total debtors in collection: ${allDebtors.length}\n`);
    
    if (allDebtors.length === 0) {
      console.log('❌ No debtors found in collection');
      return;
    }
    
    // Display debtor information
    allDebtors.forEach((debtor, index) => {
      console.log(`📋 Debtor ${index + 1}: ${debtor.debtorCode}`);
      console.log(`   User ID: ${debtor.user}`);
      console.log(`   Room Number: ${debtor.roomNumber || 'N/A'}`);
      console.log(`   Room Price: $${debtor.roomPrice || 'N/A'}`);
      console.log(`   Residence: ${debtor.residence || 'N/A'}`);
      console.log(`   Status: ${debtor.status}`);
      console.log(`   Total Owed: $${debtor.totalOwed || 0}`);
      console.log(`   Total Paid: $${debtor.totalPaid || 0}`);
      console.log(`   Current Balance: $${debtor.currentBalance || 0}`);
      console.log(`   Credit Limit: $${debtor.creditLimit || 0}`);
      console.log(`   Overdue Amount: $${debtor.overdueAmount || 0}`);
      console.log('');
    });
    
    // Summary
    const activeDebtors = allDebtors.filter(d => d.status === 'active');
    const overdueDebtors = allDebtors.filter(d => d.status === 'overdue');
    const totalOwed = allDebtors.reduce((sum, d) => sum + (d.totalOwed || 0), 0);
    const totalPaid = allDebtors.reduce((sum, d) => sum + (d.totalPaid || 0), 0);
    const totalBalance = allDebtors.reduce((sum, d) => sum + (d.currentBalance || 0), 0);
    
    console.log('📊 DEBTOR SUMMARY:');
    console.log(`   Active Debtors: ${activeDebtors.length}`);
    console.log(`   Overdue Debtors: ${overdueDebtors.length}`);
    console.log(`   Total Owed: $${totalOwed.toFixed(2)}`);
    console.log(`   Total Paid: $${totalPaid.toFixed(2)}`);
    console.log(`   Total Outstanding Balance: $${totalBalance.toFixed(2)}`);
    
    console.log('\n🎯 CONCLUSION:');
    if (activeDebtors.length > 0) {
      console.log('   ✅ You have active debtors - rental accruals should work!');
      console.log('   💡 Each active debtor should get monthly rent accruals');
      console.log('   💡 This will create proper accrual basis accounting');
    } else {
      console.log('   ❌ No active debtors found - need to activate some');
    }
    
  } catch (error) {
    console.error('❌ Error checking debtors:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the check
checkDebtors();
