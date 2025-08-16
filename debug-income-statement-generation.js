const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://alamait:alamait123@cluster0.ulvve.mongodb.net/test';

async function debugIncomeStatementGeneration() {
  try {
    console.log('🔍 Debugging Income Statement Generation - Why Still 0 Revenue...\n');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    // 1. Check if accrual transactions exist and have correct data
    console.log('📊 1. Checking Accrual Transactions...');
    const accrualTransactions = await mongoose.connection.db.collection('transactionentries').find({
      'metadata.type': 'rent_accrual'
    }).toArray();
    
    console.log(`Found ${accrualTransactions.length} accrual transactions`);
    
    // Check August 2025 specifically
    const augustAccruals = accrualTransactions.filter(accrual => 
      accrual.metadata?.accrualMonth === 8 && accrual.metadata?.accrualYear === 2025
    );
    
    console.log(`\n📅 August 2025 Accruals: ${augustAccruals.length}`);
    
    if (augustAccruals.length > 0) {
      augustAccruals.forEach((accrual, index) => {
        console.log(`\nAccrual ${index + 1}:`);
        console.log(`  Student: ${accrual.metadata?.studentName}`);
        console.log(`  Residence: ${accrual.metadata?.residence}`);
        console.log(`  Monthly Rent: $${accrual.metadata?.monthlyRent}`);
        console.log(`  Monthly Admin Fee: $${accrual.metadata?.monthlyAdminFee}`);
        
        // Check entries for revenue
        accrual.entries.forEach((entry, entryIndex) => {
          if (entry.accountCode === '4000' || entry.accountCode === '4100') {
            console.log(`  Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName} - Credit: $${entry.credit}`);
          }
        });
      });
    }
    
    // 2. Test the income statement generation step by step
    console.log('\n🧪 2. Testing Income Statement Generation Step by Step...');
    
    // Test for August 2025
    const month = 8;
    const year = 2025;
    
    console.log(`\n📊 Generating Income Statement for ${month}/${year}...`);
    
    // Get accrual entries for this month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    console.log(`Date range: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);
    
    // Query for accrual entries
    const accrualEntries = await mongoose.connection.db.collection('transactionentries').find({
      'metadata.type': 'rent_accrual',
      'metadata.accrualMonth': month,
      'metadata.accrualYear': year
    }).toArray();
    
    console.log(`Found ${accrualEntries.length} accrual entries for ${month}/${year}`);
    
    if (accrualEntries.length > 0) {
      let totalRentalIncome = 0;
      let totalAdminIncome = 0;
      
      accrualEntries.forEach((entry, index) => {
        console.log(`\nEntry ${index + 1}:`);
        console.log(`  Description: ${entry.description}`);
        console.log(`  Date: ${entry.date}`);
        console.log(`  Student: ${entry.metadata?.studentName}`);
        console.log(`  Residence: ${entry.metadata?.residence}`);
        
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach((subEntry, subIndex) => {
            console.log(`    Sub-entry ${subIndex + 1}: ${subEntry.accountCode} - ${subEntry.accountName}`);
            console.log(`      Debit: $${subEntry.debit}, Credit: $${subEntry.credit}`);
            
            if (subEntry.accountCode === '4000') { // Rental Income
              totalRentalIncome += subEntry.credit || 0;
              console.log(`      ✅ Added to rental income: $${subEntry.credit}`);
            } else if (subEntry.accountCode === '4100') { // Administrative Income
              totalAdminIncome += subEntry.credit || 0;
              console.log(`      ✅ Added to admin income: $${subEntry.credit}`);
            }
          });
        } else {
          console.log(`    ❌ No nested entries found`);
        }
      });
      
      const totalRevenue = totalRentalIncome + totalAdminIncome;
      console.log(`\n📊 Calculated Revenue for ${month}/${year}:`);
      console.log(`  Rental Income: $${totalRentalIncome}`);
      console.log(`  Admin Income: $${totalAdminIncome}`);
      console.log(`  Total Revenue: $${totalRevenue}`);
      
      if (totalRevenue === 0) {
        console.log('\n❌ WHY IS REVENUE STILL 0?');
        console.log('Possible issues:');
        console.log('1. Account codes are wrong in the entries');
        console.log('2. Credit amounts are 0');
        console.log('3. Nested entries structure is wrong');
        
        // Check the first entry structure
        if (accrualEntries[0]) {
          console.log('\n🔍 First Entry Structure:');
          console.log(JSON.stringify(accrualEntries[0], null, 2));
        }
      }
    } else {
      console.log(`❌ No accrual entries found for ${month}/${year}`);
    }
    
    // 3. Test the monthly progression method directly
    console.log('\n🧪 3. Testing Monthly Progression Method...');
    
    try {
      // Import the service
      const { AccountingService } = require('./src/services/accountingService.js');
      
      console.log('Generating monthly progression income statement...');
      const monthlyProgression = await AccountingService.generateMonthlyProgressionIncomeStatement(year);
      
      console.log('✅ Monthly progression generated successfully!');
      console.log('Summary:', monthlyProgression.summary);
      
      // Check August specifically
      if (monthlyProgression.monthlyProgression[8]) {
        const august = monthlyProgression.monthlyProgression[8];
        console.log('\n📅 August 2025 Data:');
        console.log('Revenue:', august.overall?.revenue);
        console.log('Net Income:', august.overall?.netIncome);
      }
      
    } catch (serviceError) {
      console.error('❌ Error testing accounting service:', serviceError.message);
      console.error('Stack:', serviceError.stack);
    }
    
  } catch (error) {
    console.error('❌ Error debugging income statement generation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

debugIncomeStatementGeneration();
