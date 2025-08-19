const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugCashFlowCalculation() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🔍 DEBUGGING CASH FLOW CALCULATION...');
    console.log('='.repeat(80));
    
    // Get the cash flow data
    console.log('📊 Generating Cash Flow Data...');
    const cashFlowData = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
    
    if (!cashFlowData) {
      console.log('❌ No cash flow data returned');
      return;
    }
    
    console.log('✅ Cash Flow Data Generated');
    console.log('📊 Period:', cashFlowData.period);
    console.log('📊 Basis:', cashFlowData.basis);
    
    // Check January specifically
    const january = cashFlowData.monthly_breakdown?.january;
    if (january) {
      console.log('\n📅 JANUARY 2025 CASH FLOW BREAKDOWN:');
      console.log('-'.repeat(80));
      console.log('Operating Activities:');
      console.log(`  Inflows: $${january.operating_activities.inflows.toLocaleString()}`);
      console.log(`  Outflows: $${january.operating_activities.outflows.toLocaleString()}`);
      console.log(`  Net: $${january.operating_activities.net.toLocaleString()}`);
      
      console.log('\nInvesting Activities:');
      console.log(`  Inflows: $${january.investing_activities.inflows.toLocaleString()}`);
      console.log(`  Outflows: $${january.investing_activities.outflows.toLocaleString()}`);
      console.log(`  Net: $${january.investing_activities.net.toLocaleString()}`);
      
      console.log('\nFinancing Activities:');
      console.log(`  Inflows: $${january.financing_activities.inflows.toLocaleString()}`);
      console.log(`  Outflows: $${january.financing_activities.outflows.toLocaleString()}`);
      console.log(`  Net: $${january.financing_activities.net.toLocaleString()}`);
      
      console.log('\nSummary:');
      console.log(`  Net Cash Flow: $${january.net_cash_flow.toLocaleString()}`);
      console.log(`  Opening Balance: $${january.opening_balance.toLocaleString()}`);
      console.log(`  Closing Balance: $${january.closing_balance.toLocaleString()}`);
    }
    
    // Now let's manually check what transactions the service is processing
    console.log('\n🔍 MANUALLY CHECKING TRANSACTIONS...');
    console.log('='.repeat(80));
    
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-01-31');
    
    // Get all transactions for January
    const TransactionEntry = require('./src/models/TransactionEntry');
    const januaryTransactions = await TransactionEntry.find({
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${januaryTransactions.length} transactions in January 2025`);
    
    // Analyze each transaction manually
    let manualCashInflows = 0;
    let manualCashOutflows = 0;
    
    januaryTransactions.forEach((transaction, index) => {
      console.log(`\n${index + 1}. ${transaction.description || 'No description'}`);
      console.log(`   Date: ${transaction.date.toDateString()}`);
      console.log(`   Source: ${transaction.source || 'N/A'}`);
      
      if (transaction.entries && Array.isArray(transaction.entries)) {
        transaction.entries.forEach((entry, entryIndex) => {
          console.log(`   Entry ${entryIndex + 1}: ${entry.accountCode} - ${entry.accountName}`);
          console.log(`     Type: ${entry.accountType}, Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
          
          // Manual cash flow calculation
          if (entry.accountType === 'Expense') {
            manualCashOutflows += (entry.debit || 0);
          } else if (entry.accountType === 'Income') {
            manualCashInflows += (entry.credit || 0);
          } else if (entry.accountType === 'Asset') {
            if (entry.debit > 0) {
              manualCashOutflows += entry.debit; // Asset increase = cash outflow
            } else if (entry.credit > 0) {
              manualCashInflows += entry.credit; // Asset decrease = cash inflow
            }
          } else if (entry.accountType === 'Liability') {
            if (entry.credit > 0) {
              manualCashInflows += entry.credit; // Liability increase = cash inflow
            } else if (entry.debit > 0) {
              manualCashOutflows += entry.debit; // Liability decrease = cash outflow
            }
          }
        });
      }
    });
    
    console.log('\n📈 MANUAL CALCULATION RESULTS:');
    console.log('='.repeat(80));
    console.log(`Manual Cash Inflows: $${manualCashInflows.toLocaleString()}`);
    console.log(`Manual Cash Outflows: $${manualCashOutflows.toLocaleString()}`);
    console.log(`Manual Net Cash Flow: $${(manualCashInflows - manualCashOutflows).toLocaleString()}`);
    
    // Compare with service results
    if (january) {
      console.log('\n🔍 COMPARISON WITH SERVICE:');
      console.log('='.repeat(80));
      console.log('Service Operating Inflows:', january.operating_activities.inflows);
      console.log('Manual Cash Inflows:', manualCashInflows);
      console.log('Difference:', january.operating_activities.inflows - manualCashInflows);
      
      console.log('\nService Operating Outflows:', january.operating_activities.outflows);
      console.log('Manual Cash Outflows:', manualCashOutflows);
      console.log('Difference:', january.operating_activities.outflows - manualCashOutflows);
    }
    
    // Check if there are any other transactions we might be missing
    console.log('\n🔍 CHECKING FOR MISSING TRANSACTIONS...');
    console.log('='.repeat(80));
    
    // Look for any transactions that might be dated differently
    const allTransactions = await TransactionEntry.find({
      date: { $gte: new Date('2024-12-01'), $lte: new Date('2025-02-28') }
    }).sort({ date: 1 });
    
    console.log(`📊 Found ${allTransactions.length} transactions from Dec 2024 to Feb 2025`);
    
    // Look for transactions around the $730 amount
    const suspiciousTransactions = allTransactions.filter(t => {
      if (t.entries && Array.isArray(t.entries)) {
        return t.entries.some(entry => 
          (entry.debit && entry.debit >= 700 && entry.debit <= 800) ||
          (entry.credit && entry.credit >= 700 && entry.credit <= 800)
        );
      }
      return false;
    });
    
    if (suspiciousTransactions.length > 0) {
      console.log('\n⚠️  SUSPICIOUS TRANSACTIONS ($700-$800 range):');
      suspiciousTransactions.forEach(t => {
        console.log(`  - Date: ${t.date.toDateString()}, Description: ${t.description || 'No description'}`);
        if (t.entries) {
          t.entries.forEach(entry => {
            if ((entry.debit && entry.debit >= 700 && entry.debit <= 800) ||
                (entry.credit && entry.credit >= 700 && entry.credit <= 800)) {
              console.log(`    Account: ${entry.accountCode} - ${entry.accountName}`);
              console.log(`    Debit: $${entry.debit || 0}, Credit: $${entry.credit || 0}`);
            }
          });
        }
      });
    }

  } catch (error) {
    console.error('❌ Error debugging cash flow:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

debugCashFlowCalculation();
