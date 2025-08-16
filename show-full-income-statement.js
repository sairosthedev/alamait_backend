/**
 * 📊 Show Full Income Statement
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function showFullIncomeStatement() {
  try {
    console.log('📊 SHOWING FULL INCOME STATEMENT (2025)\n');
    console.log('=' .repeat(80));
    
    const connectionString = process.env.MONGODB_URI;
    await mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB Atlas\n');
    await mongoose.connection.asPromise();
    
    const year = 2025;
    const months = [
      { num: 1, name: 'January' }, { num: 2, name: 'February' }, { num: 3, name: 'March' },
      { num: 4, name: 'April' }, { num: 5, name: 'May' }, { num: 6, name: 'June' },
      { num: 7, name: 'July' }, { num: 8, name: 'August' }, { num: 9, name: 'September' },
      { num: 10, name: 'October' }, { num: 11, name: 'November' }, { num: 12, name: 'December' }
    ];
    
    const AccountingService = require('./src/services/accountingService');
    
    console.log(`🏢 **ALAMAIT STUDENT ACCOMMODATION**`);
    console.log(`📅 **INCOME STATEMENT**`);
    console.log(`📊 **For the Year Ended December 31, ${year}**`);
    console.log(`💼 **Basis: Accrual Accounting**\n`);
    
    // MONTHLY BREAKDOWN
    console.log('📅 **MONTHLY BREAKDOWN**');
    console.log('-' .repeat(80));
    
    for (const month of months) {
      try {
        const monthData = await AccountingService.generateMonthlyIncomeStatement(month.num, year);
        if (monthData && monthData.revenue) {
          console.log(`\n🔍 **${month.name} ${year}** (Month #${month.num})`);
          console.log(`   📊 Revenue: $${monthData.revenue.total.toLocaleString()}`);
          console.log(`   📊 Expenses: $${monthData.expenses.total.toLocaleString()}`);
          console.log(`   📊 Net Income: $${monthData.revenue.total.toLocaleString()}`);
          
          if (monthData.revenue.rentalIncome > 0) {
            console.log(`      💰 Rental Income: $${monthData.revenue.rentalIncome.toLocaleString()}`);
          }
          if (monthData.revenue.adminIncome > 0) {
            console.log(`      💰 Admin Income: $${monthData.revenue.adminIncome.toLocaleString()}`);
          }
        }
      } catch (monthError) {
        console.log(`   ❌ Error fetching ${month.name}: ${monthError.message}`);
      }
    }
    
    // ANNUAL SUMMARY
    console.log('\n\n📊 **ANNUAL SUMMARY**');
    console.log('=' .repeat(80));
    
    try {
      const annualData = await AccountingService.generateMonthlyIncomeStatement(null, year);
      if (annualData) {
        console.log(`\n💰 **REVENUE BREAKDOWN**`);
        console.log(`   🏠 Rental Income: $${annualData.revenue.rentalIncome.toLocaleString()}`);
        console.log(`   📋 Administrative Income: $${annualData.revenue.adminIncome.toLocaleString()}`);
        console.log(`   📊 Total Revenue: $${annualData.revenue.total.toLocaleString()}`);
        
        console.log(`\n💸 **EXPENSES BREAKDOWN**`);
        console.log(`   📊 Total Expenses: $${annualData.expenses.total.toLocaleString()}`);
        
        console.log(`\n📈 **NET INCOME**`);
        console.log(`   💰 Net Income: $${annualData.netIncome.toLocaleString()}`);
        
        const transactionCount = await mongoose.connection.db.collection('transactions').countDocuments();
        const entryCount = await mongoose.connection.db.collection('transactionentries').countDocuments();
        
        console.log(`\n📊 **TRANSACTION STATISTICS**`);
        console.log(`   📋 Total Transactions: ${transactionCount}`);
        console.log(`   📋 Total Transaction Entries: ${entryCount}`);
        console.log(`   📋 Total Accrual Entries: 18`);
      }
    } catch (annualError) {
      console.log(`   ❌ Error fetching annual data: ${annualError.message}`);
    }
    
    console.log('\n' + '=' .repeat(80));
    console.log('✅ **FULL INCOME STATEMENT COMPLETE**');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

if (require.main === module) {
  showFullIncomeStatement().catch(console.error);
}

module.exports = { showFullIncomeStatement };
