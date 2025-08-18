const mongoose = require('mongoose');
const FinancialReportsController = require('./src/controllers/financialReportsController');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugAPIEndpoint() {
  try {
    console.log('🔍 Debugging API Endpoint...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Test the exact controller method that your API endpoint calls
    console.log('\n🔍 Testing FinancialReportsController.generateMonthlyBalanceSheet()');
    console.log('This is what your API endpoint /api/financial-reports/monthly-balance-sheet calls');
    
    // Mock the request object
    const mockReq = {
      query: {
        period: '2025',
        basis: 'accrual',
        residence: null
      }
    };
    
    // Mock the response object
    const mockRes = {
      json: function(data) {
        console.log('\n📊 API RESPONSE DATA:');
        console.log('=====================================');
        console.log('Success:', data.success);
        console.log('Message:', data.message);
        
        if (data.success && data.data && data.data.monthly) {
          // Check January data
          const januaryData = data.data.monthly[1];
          
          if (januaryData) {
            console.log('\n📅 JANUARY 2025 DATA:');
            console.log('=====================================');
            
            console.log('\n💸 LIABILITIES:');
            console.log('Total Liabilities:', januaryData.liabilities?.total);
            console.log('Current Liabilities Total:', januaryData.liabilities?.current?.total);
            
            // Check accounts payable specifically
            if (januaryData.liabilities?.current?.accountsPayable) {
              console.log('\n📋 ACCOUNTS PAYABLE:');
              Object.entries(januaryData.liabilities.current.accountsPayable).forEach(([code, account]) => {
                if (code !== 'total') {
                  console.log(`  ${code} - ${account.accountName}: $${account.amount}`);
                  console.log(`    Raw amount value: ${account.amount} (Type: ${typeof account.amount})`);
                  console.log(`    Is negative: ${account.amount < 0}`);
                }
              });
            }
            
            console.log('\n🏛️ EQUITY:');
            console.log('Total Equity:', januaryData.equity?.total);
            
            console.log('\n📋 SUMMARY:');
            console.log('Total Assets:', januaryData.summary?.totalAssets);
            console.log('Total Liabilities:', januaryData.summary?.totalLiabilities);
            console.log('Total Equity:', januaryData.summary?.totalEquity);
            
            // Check balance sheet equation
            const assets = januaryData.summary?.totalAssets || 0;
            const liabilities = januaryData.summary?.totalLiabilities || 0;
            const equity = januaryData.summary?.totalEquity || 0;
            
            console.log('\n🔍 BALANCE SHEET EQUATION:');
            console.log(`Assets: $${assets}`);
            console.log(`Liabilities: $${liabilities}`);
            console.log(`Equity: $${equity}`);
            console.log(`Liabilities + Equity: $${liabilities + equity}`);
            
            const difference = Math.abs(assets - (liabilities + equity));
            console.log(`Difference: $${difference.toFixed(2)}`);
            
            if (difference < 0.01) {
              console.log('✅ SUCCESS: Balance sheet is balanced!');
            } else {
              console.log('❌ FAILED: Balance sheet is not balanced');
            }
            
            // Check if any values are negative when they shouldn't be
            console.log('\n🔍 NEGATIVE VALUE CHECK:');
            console.log('=====================================');
            
            if (januaryData.liabilities?.total < 0) {
              console.log('❌ WARNING: Total Liabilities is negative:', januaryData.liabilities.total);
            } else {
              console.log('✅ Total Liabilities is positive:', januaryData.liabilities.total);
            }
            
            if (januaryData.liabilities?.current?.total < 0) {
              console.log('❌ WARNING: Current Liabilities is negative:', januaryData.liabilities.current.total);
            } else {
              console.log('✅ Current Liabilities is positive:', januaryData.liabilities.current.total);
            }
            
          } else {
            console.log('❌ No January data found');
          }
        }
        
        return this;
      },
      status: function(code) {
        console.log(`📡 Response Status: ${code}`);
        return this;
      }
    };
    
    // Call the controller method directly
    console.log('\n🔍 Calling controller method...');
    await FinancialReportsController.generateMonthlyBalanceSheet(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Error debugging API endpoint:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

debugAPIEndpoint();
