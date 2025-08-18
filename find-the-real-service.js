const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function findTheRealService() {
  try {
    console.log('🔍 Finding the Real Balance Sheet Service...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Test 1: Direct service call (what should work)
    console.log('\n🔍 TEST 1: Direct BalanceSheetService.generateMonthlyBalanceSheet()');
    console.log('=====================================');
    
    const directResult = await BalanceSheetService.generateMonthlyBalanceSheet(2025, null);
    
    if (directResult.success) {
      const januaryData = directResult.data.monthly[1];
      if (januaryData) {
        console.log('✅ Direct Service Result:');
        console.log('  - Total Liabilities:', januaryData.liabilities.total);
        console.log('  - Accounts Payable:', januaryData.liabilities.current.accountsPayable);
        console.log('  - Total Equity:', januaryData.equity.total);
      }
    }

    // Test 2: Check if there are multiple services
    console.log('\n🔍 TEST 2: Checking for Multiple Services...');
    console.log('=====================================');
    
    // List all files that might contain balance sheet logic
    console.log('🔍 Searching for balance sheet related files...');
    
    // Check if there are multiple BalanceSheetService files
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check current directory structure
      const currentDir = __dirname;
      console.log('Current directory:', currentDir);
      
      // Check if there are multiple service files
      const serviceFiles = [
        'src/services/balanceSheetService.js',
        'src/services/BalanceSheetService.js',
        'services/balanceSheetService.js',
        'BalanceSheetService.js'
      ];
      
      serviceFiles.forEach(file => {
        try {
          if (fs.existsSync(path.join(currentDir, file))) {
            console.log(`✅ Found: ${file}`);
            const stats = fs.statSync(path.join(currentDir, file));
            console.log(`   Size: ${stats.size} bytes`);
            console.log(`   Modified: ${stats.mtime}`);
          }
        } catch (e) {
          // File doesn't exist
        }
      });
      
    } catch (e) {
      console.log('Could not check file system');
    }

    // Test 3: Check if the service method exists
    console.log('\n🔍 TEST 3: Checking Service Method...');
    console.log('=====================================');
    
    console.log('Available methods in BalanceSheetService:');
    console.log(Object.getOwnPropertyNames(BalanceSheetService));
    console.log('Available methods in BalanceSheetService.prototype:');
    console.log(Object.getOwnPropertyNames(BalanceSheetService.prototype || {}));
    
    // Test 4: Check if there's a different method being called
    console.log('\n🔍 TEST 4: Checking for Alternative Methods...');
    console.log('=====================================');
    
    // Check if there are static methods
    const staticMethods = Object.getOwnPropertyNames(BalanceSheetService);
    console.log('Static methods:', staticMethods);
    
    // Check if generateMonthlyBalanceSheet exists
    if (typeof BalanceSheetService.generateMonthlyBalanceSheet === 'function') {
      console.log('✅ generateMonthlyBalanceSheet method exists');
    } else {
      console.log('❌ generateMonthlyBalanceSheet method NOT found');
    }

  } catch (error) {
    console.error('❌ Error finding the real service:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

findTheRealService();
