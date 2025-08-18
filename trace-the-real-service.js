const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function traceTheRealService() {
  try {
    console.log('🔍 Tracing the Real Service Being Called...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Test 1: Check if there are multiple services with the same name
    console.log('\n🔍 TEST 1: Checking for Multiple Services...');
    console.log('=====================================');
    
    // Check if there are other balance sheet services
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Search for any files containing "balance" or "BalanceSheet"
      const searchTerms = ['balance', 'BalanceSheet', 'balanceSheet'];
      const srcDir = path.join(__dirname, 'src');
      
      console.log('🔍 Searching for balance sheet related files...');
      
      function searchFiles(dir, searchTerm) {
        const files = [];
        try {
          const items = fs.readdirSync(dir);
          items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
              files.push(...searchFiles(fullPath, searchTerm));
            } else if (stat.isFile() && item.toLowerCase().includes(searchTerm.toLowerCase())) {
              files.push(fullPath);
            }
          });
        } catch (e) {
          // Directory doesn't exist or can't be read
        }
        return files;
      }
      
      searchTerms.forEach(term => {
        const foundFiles = searchFiles(srcDir, term);
        if (foundFiles.length > 0) {
          console.log(`\n📁 Files containing "${term}":`);
          foundFiles.forEach(file => {
            try {
              const stats = fs.statSync(file);
              const relativePath = path.relative(__dirname, file);
              console.log(`  ✅ ${relativePath} (${stats.size} bytes, modified: ${stats.mtime})`);
              
              // Check if this file exports a service
              try {
                const content = fs.readFileSync(file, 'utf8');
                if (content.includes('generateMonthlyBalanceSheet') || content.includes('monthly-balance-sheet')) {
                  console.log(`    🔍 This file contains balance sheet logic!`);
                }
              } catch (e) {
                // Can't read file content
              }
            } catch (e) {
              console.log(`  ❌ Error reading ${file}`);
            }
          });
        }
      });
      
    } catch (e) {
      console.log('Could not search for files:', e.message);
    }

    // Test 2: Check if there are multiple BalanceSheetService imports
    console.log('\n🔍 TEST 2: Checking for Multiple Imports...');
    console.log('=====================================');
    
    // Check if there are multiple ways to import the service
    try {
      const fs = require('fs');
      const controllerPath = path.join(__dirname, 'src/controllers/financialReportsController.js');
      
      if (fs.existsSync(controllerPath)) {
        const content = fs.readFileSync(controllerPath, 'utf8');
        console.log('📁 FinancialReportsController imports:');
        
        // Look for import statements
        const importMatches = content.match(/require\(['"`]([^'"`]+)['"`]\)/g);
        if (importMatches) {
          importMatches.forEach(match => {
            if (match.includes('balance') || match.includes('BalanceSheet')) {
              console.log(`  🔍 ${match}`);
            }
          });
        }
        
        // Look for the exact method call
        if (content.includes('BalanceSheetService.generateMonthlyBalanceSheet')) {
          console.log('  ✅ Calls BalanceSheetService.generateMonthlyBalanceSheet');
        } else {
          console.log('  ❌ Does NOT call BalanceSheetService.generateMonthlyBalanceSheet');
        }
      }
    } catch (e) {
      console.log('Could not check controller:', e.message);
    }

    // Test 3: Check if there are other services with similar names
    console.log('\n🔍 TEST 3: Checking for Similar Service Names...');
    console.log('=====================================');
    
    try {
      const fs = require('fs');
      const servicesDir = path.join(__dirname, 'src/services');
      
      if (fs.existsSync(servicesDir)) {
        const services = fs.readdirSync(servicesDir);
        console.log('📁 All services in src/services:');
        
        services.forEach(service => {
          if (service.toLowerCase().includes('balance') || service.toLowerCase().includes('sheet')) {
            const fullPath = path.join(servicesDir, service);
            try {
              const stats = fs.statSync(fullPath);
              console.log(`  🔍 ${service} (${stats.size} bytes, modified: ${stats.mtime})`);
              
              // Check if this service has monthly balance sheet method
              const content = fs.readFileSync(fullPath, 'utf8');
              if (content.includes('generateMonthlyBalanceSheet')) {
                console.log(`    ✅ Contains generateMonthlyBalanceSheet method!`);
              }
              if (content.includes('monthly-balance-sheet')) {
                console.log(`    ✅ Contains monthly-balance-sheet logic!`);
              }
            } catch (e) {
              console.log(`  ❌ Error reading ${service}`);
            }
          }
        });
      }
    } catch (e) {
      console.log('Could not check services directory:', e.message);
    }

    // Test 4: Check if there's a different method being called
    console.log('\n🔍 TEST 4: Checking for Alternative Methods...');
    console.log('=====================================');
    
    // Check if there are other methods that might be called
    const allMethods = Object.getOwnPropertyNames(BalanceSheetService);
    console.log('Available methods in BalanceSheetService:');
    allMethods.forEach(method => {
      if (method.toLowerCase().includes('monthly') || method.toLowerCase().includes('balance')) {
        console.log(`  🔍 ${method}`);
      }
    });

  } catch (error) {
    console.error('❌ Error tracing the real service:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

traceTheRealService();
