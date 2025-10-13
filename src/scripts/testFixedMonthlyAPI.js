const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function testFixedMonthlyAPI() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to database');
    
    const FinancialReportsController = require('../controllers/financialReportsController');
    
    console.log('\n🔍 TESTING FIXED MONTHLY BALANCE SHEET API');
    console.log('=' .repeat(60));
    
    // Test the monthly balance sheet endpoint
    const mockReq = {
      query: {
        period: '2025',
        basis: 'cash'
      }
    };
    
    const mockRes = {
      json: (data) => {
        console.log('\n📊 MONTHLY BALANCE SHEET API RESPONSE:');
        console.log('Success:', data.success);
        console.log('Message:', data.message);
        
        if (data.success && data.data && data.data.monthly) {
          console.log('\n📋 MONTHLY BREAKDOWN:');
          
          // Test specific months
          const testMonths = [8, 9, 10, 11, 12];
          
          testMonths.forEach(month => {
            const monthData = data.data.monthly[month];
            if (monthData) {
              console.log(`\n${monthData.monthName} ${monthData.month}:`);
              console.log(`  Total Assets: $${monthData.summary.totalAssets}`);
              console.log(`  Total Liabilities: $${monthData.summary.totalLiabilities}`);
              console.log(`  Total Equity: $${monthData.summary.totalEquity}`);
              console.log(`  Balance Check: ${monthData.balanceCheck}`);
              
              // Check individual asset accounts
              if (monthData.assets && monthData.assets.current && monthData.assets.current.cashAndBank) {
                const cashAndBank = monthData.assets.current.cashAndBank;
                console.log(`  Cash: $${cashAndBank.cash.amount}`);
                console.log(`  Bank: $${cashAndBank.bank.amount}`);
                console.log(`  CBZ Vault: $${cashAndBank.cbzVault.amount}`);
                console.log(`  Admin Petty Cash: $${cashAndBank.adminPettyCash.amount}`);
                console.log(`  Total Cash & Bank: $${cashAndBank.total}`);
              }
              
              // Check liabilities
              if (monthData.liabilities && monthData.liabilities.current) {
                console.log(`  Accounts Payable: $${monthData.liabilities.current.accountsPayable.amount}`);
                console.log(`  Advance Payment Liability: $${monthData.liabilities.current.deferredIncome.amount}`);
              }
              
              // Check equity
              if (monthData.equity) {
                console.log(`  Owner Capital: $${monthData.equity.ownerCapital.amount}`);
                console.log(`  Retained Earnings: $${monthData.equity.retainedEarnings.amount}`);
              }
            }
          });
        }
      },
      status: (code) => ({
        json: (data) => {
          console.log(`\n❌ API Error (${code}):`, data);
        }
      })
    };
    
    // Call the monthly balance sheet endpoint
    await FinancialReportsController.generateMonthlyBalanceSheet(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testFixedMonthlyAPI();