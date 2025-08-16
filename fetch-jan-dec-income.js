/**
 * 🧪 Fetch Income Statement Data from January to December
 * This will show you exactly what your endpoint returns for each month
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fetchJanToDecIncome() {
  try {
    console.log('🧪 Fetching Income Statement Data (January to December 2025)...\n');
    
    // Connect to MongoDB
    const connectionString = process.env.MONGODB_URI;
    await mongoose.connect(connectionString, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB Atlas\n');
    
    // Wait for connection to be ready
    await mongoose.connection.asPromise();
    
    // Test the income statement endpoint for each month
    const year = 2025;
    const months = [
      { num: 1, name: 'January' },
      { num: 2, name: 'February' },
      { num: 3, name: 'March' },
      { num: 4, name: 'April' },
      { num: 5, name: 'May' },
      { num: 6, name: 'June' },
      { num: 7, name: 'July' },
      { num: 8, name: 'August' },
      { num: 9, name: 'September' },
      { num: 10, name: 'October' },
      { num: 11, name: 'November' },
      { num: 12, name: 'December' }
    ];
    
    console.log(`📊 **INCOME STATEMENT ENDPOINT: /api/financial-reports/income-statement**\n`);
    console.log(`📅 **Testing Monthly Data for ${year}**\n`);
    
    // Test each month individually
    for (const month of months) {
      try {
        console.log(`\n🔍 **${month.name} ${year}** (Month #${month.num})`);
        console.log(`   Endpoint: /api/financial-reports/income-statement?period=${year}&basis=accrual&month=${month.num}`);
        
        // Get the data using AccountingService directly
        const AccountingService = require('./src/services/accountingService');
        const monthData = await AccountingService.generateMonthlyIncomeStatement(month.num, year);
        
        if (monthData && monthData.revenue) {
          console.log(`   ✅ Revenue: $${monthData.revenue.total || 0}`);
          console.log(`   ✅ Expenses: $${monthData.expenses.total || 0}`);
          console.log(`   ✅ Net Income: $${monthData.netIncome || 0}`);
          
          // Show detailed revenue breakdown
          if (monthData.revenue.accounts && Object.keys(monthData.revenue.accounts).length > 0) {
            console.log(`   📊 Revenue Breakdown:`);
            Object.entries(monthData.revenue.accounts).forEach(([account, amount]) => {
              console.log(`      - ${account}: $${amount}`);
            });
          }
        } else {
          console.log(`   ❌ No data returned for ${month.name}`);
        }
        
      } catch (monthError) {
        console.log(`   ❌ Error fetching ${month.name}: ${monthError.message}`);
      }
    }
    
    // Test the annual summary
    console.log(`\n\n📊 **ANNUAL SUMMARY ${year}**`);
    console.log(`   Endpoint: /api/financial-reports/income-statement?period=${year}&basis=accrual`);
    
    try {
      const AccountingService = require('./src/services/accountingService');
      const annualData = await AccountingService.generateMonthlyIncomeStatement(null, year);
      
      if (annualData) {
        console.log(`   ✅ Total Annual Revenue: $${annualData.revenue.total || 0}`);
        console.log(`   ✅ Total Annual Expenses: $${annualData.expenses.total || 0}`);
        console.log(`   ✅ Total Annual Net Income: $${annualData.netIncome || 0}`);
        
        // Show transaction count
        const transactionCount = await mongoose.connection.db.collection('transactions').countDocuments();
        console.log(`   📊 Total Transactions in Database: ${transactionCount}`);
        
        // Show transaction entries count
        const entryCount = await mongoose.connection.db.collection('transactionentries').countDocuments();
        console.log(`   📊 Total Transaction Entries: ${entryCount}`);
      }
    } catch (annualError) {
      console.log(`   ❌ Error fetching annual data: ${annualError.message}`);
    }
    
    console.log(`\n\n🎯 **ENDPOINT SUMMARY**`);
    console.log(`   Base URL: /api/financial-reports/income-statement`);
    console.log(`   Parameters:`);
    console.log(`     - period: ${year} (required)`);
    console.log(`     - basis: accrual (required)`);
    console.log(`     - month: 1-12 (optional, for monthly data)`);
    console.log(`     - residenceId: [residence_id] (optional, for specific residence)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

// Run the function
if (require.main === module) {
  fetchJanToDecIncome().catch(console.error);
}

module.exports = { fetchJanToDecIncome };
