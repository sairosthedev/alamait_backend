const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkTransactionDates() {
  try {
    console.log('🔍 Checking Transaction Entry dates in database...\n');
    
    // Get all transaction entries
    const entries = await TransactionEntry.find({}).sort({ date: 1 });
    
    console.log(`📊 Total Transaction Entries found: ${entries.length}\n`);
    
    if (entries.length === 0) {
      console.log('❌ No transaction entries found in database!');
      console.log('💡 This means no financial data has been created yet.');
      return;
    }
    
    // Group by year and month
    const monthlyData = {};
    const yearlyData = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 1-12
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      // Yearly grouping
      if (!yearlyData[year]) {
        yearlyData[year] = {
          count: 0,
          months: new Set(),
          totalDebit: 0,
          totalCredit: 0
        };
      }
      yearlyData[year].count++;
      yearlyData[year].months.add(monthName);
      yearlyData[year].totalDebit += entry.totalDebit || 0;
      yearlyData[year].totalCredit += entry.totalCredit || 0;
      
      // Monthly grouping
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          year,
          month,
          monthName,
          count: 0,
          totalDebit: 0,
          totalCredit: 0,
          entries: []
        };
      }
      monthlyData[monthKey].count++;
      monthlyData[monthKey].totalDebit += entry.totalDebit || 0;
      monthlyData[monthKey].totalCredit += entry.totalCredit || 0;
      monthlyData[monthKey].entries.push({
        id: entry._id,
        date: entry.date,
        description: entry.description,
        source: entry.source,
        totalDebit: entry.totalDebit,
        totalCredit: entry.totalCredit
      });
    });
    
    // Display yearly summary
    console.log('📅 YEARLY SUMMARY:');
    console.log('==================');
    Object.keys(yearlyData).sort().forEach(year => {
      const data = yearlyData[year];
      console.log(`${year}: ${data.count} entries, Months: ${Array.from(data.months).join(', ')}`);
      console.log(`   Total Debit: $${data.totalDebit.toLocaleString()}, Total Credit: $${data.totalCredit.toLocaleString()}\n`);
    });
    
    // Display monthly breakdown
    console.log('📅 MONTHLY BREAKDOWN:');
    console.log('=====================');
    Object.keys(monthlyData).sort().forEach(monthKey => {
      const data = monthlyData[monthKey];
      console.log(`${data.monthName} ${data.year}: ${data.count} entries`);
      console.log(`   Total Debit: $${data.totalDebit.toLocaleString()}, Total Credit: $${data.totalCredit.toLocaleString()}`);
      
      // Show first few entries for this month
      if (data.entries.length > 0) {
        console.log('   Sample entries:');
        data.entries.slice(0, 3).forEach(entry => {
          console.log(`     - ${entry.date.toDateString()}: ${entry.description} (${entry.source})`);
        });
        if (data.entries.length > 3) {
          console.log(`     ... and ${data.entries.length - 3} more entries`);
        }
      }
      console.log('');
    });
    
    // Check for 2025 data specifically
    console.log('🎯 2025 DATA CHECK:');
    console.log('==================');
    const data2025 = monthlyData['2025-01'] || monthlyData['2025-02'] || monthlyData['2025-03'] || 
                    monthlyData['2025-04'] || monthlyData['2025-05'] || monthlyData['2025-06'] ||
                    monthlyData['2025-07'] || monthlyData['2025-08'] || monthlyData['2025-09'] ||
                    monthlyData['2025-10'] || monthlyData['2025-11'] || monthlyData['2025-12'];
    
    if (data2025) {
      console.log('✅ Found 2025 data!');
      Object.keys(monthlyData).filter(key => key.startsWith('2025-')).sort().forEach(monthKey => {
        const data = monthlyData[monthKey];
        console.log(`   ${data.monthName}: ${data.count} entries`);
      });
    } else {
      console.log('❌ No 2025 data found!');
      console.log('💡 This explains why monthly reports show empty data.');
    }
    
    // Show sample entries with their actual dates
    console.log('\n📋 SAMPLE ENTRIES WITH DATES:');
    console.log('=============================');
    entries.slice(0, 10).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.date.toDateString()} - ${entry.description}`);
      console.log(`   Source: ${entry.source}, Debit: $${entry.totalDebit}, Credit: $${entry.totalCredit}`);
      console.log(`   ID: ${entry._id}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking transaction dates:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkTransactionDates(); 