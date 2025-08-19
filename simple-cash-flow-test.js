const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function testCashFlow() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    console.log('\n🧪 Testing Cash Flow Service...');
    
    try {
      const result = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
      console.log('✅ Cash Flow generated successfully!');
      console.log('📊 Result structure:', Object.keys(result));
      console.log('📊 Monthly breakdown keys:', Object.keys(result.monthly_breakdown || {}));
      console.log('📊 Yearly totals:', result.yearly_totals ? 'Found' : 'Missing');
      console.log('📊 Summary:', result.summary ? 'Found' : 'Missing');
      
    } catch (error) {
      console.error('❌ Error in generateMonthlyCashFlow:', error.message);
      console.error('❌ Error stack:', error.stack);
    }

  } catch (error) {
    console.error('❌ Connection error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testCashFlow();
