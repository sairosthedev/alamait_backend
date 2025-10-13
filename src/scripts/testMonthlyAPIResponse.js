const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function testMonthlyAPIResponse() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to database');
    
    const FinancialReportsController = require('../controllers/financialReportsController');
    
    console.log('\n🔍 TESTING MONTHLY API RESPONSE STRUCTURE');
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
        console.log('\n📊 MONTHLY API RESPONSE STRUCTURE:');
        console.log('Success:', data.success);
        console.log('Message:', data.message);
        
        if (data.success && data.data && data.data.monthly) {
          console.log('\n📋 MONTHLY DATA STRUCTURE:');
          console.log('Available months:', Object.keys(data.data.monthly));
          
          // Test October data structure
          const octoberData = data.data.monthly['10'];
          if (octoberData) {
            console.log('\n🔍 OCTOBER 2025 DATA STRUCTURE:');
            console.log('Month:', octoberData.month);
            console.log('Month Name:', octoberData.monthName);
            console.log('Balance Check:', octoberData.balanceCheck);
            
            console.log('\n💰 ASSETS STRUCTURE:');
            if (octoberData.assets) {
              console.log('Assets keys:', Object.keys(octoberData.assets));
              if (octoberData.assets.current) {
                console.log('Current assets keys:', Object.keys(octoberData.assets.current));
                if (octoberData.assets.current.cashAndBank) {
                  console.log('Cash & Bank keys:', Object.keys(octoberData.assets.current.cashAndBank));
                  console.log('Cash account:', octoberData.assets.current.cashAndBank.cash);
                  console.log('Bank account:', octoberData.assets.current.cashAndBank.bank);
                  console.log('CBZ Vault account:', octoberData.assets.current.cashAndBank.cbzVault);
                  console.log('Admin Petty Cash account:', octoberData.assets.current.cashAndBank.adminPettyCash);
                }
                if (octoberData.assets.current.accountsReceivable) {
                  console.log('Accounts Receivable:', octoberData.assets.current.accountsReceivable);
                }
              }
            }
            
            console.log('\n💳 LIABILITIES STRUCTURE:');
            if (octoberData.liabilities) {
              console.log('Liabilities keys:', Object.keys(octoberData.liabilities));
              if (octoberData.liabilities.current) {
                console.log('Current liabilities keys:', Object.keys(octoberData.liabilities.current));
                console.log('Accounts Payable:', octoberData.liabilities.current.accountsPayable);
                console.log('Deferred Income:', octoberData.liabilities.current.deferredIncome);
              }
            }
            
            console.log('\n🏛️ EQUITY STRUCTURE:');
            if (octoberData.equity) {
              console.log('Equity keys:', Object.keys(octoberData.equity));
              console.log('Retained Earnings:', octoberData.equity.retainedEarnings);
              console.log('Owner Capital:', octoberData.equity.ownerCapital);
            }
            
            console.log('\n📊 SUMMARY:');
            if (octoberData.summary) {
              console.log('Summary:', octoberData.summary);
            }
          }
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

testMonthlyAPIResponse();
