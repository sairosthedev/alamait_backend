require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const EnhancedCashFlowService = require('./src/services/enhancedCashFlowService');

async function testEnhancedCashFlowAPI() {
    try {
        console.log('\n💰 Testing Enhanced Cash Flow API\n');
        
        const detailedCashFlow = await EnhancedCashFlowService.generateDetailedCashFlowStatement('2025', 'cash');
        
        console.log('📊 ENHANCED CASH FLOW DETAILS:');
        console.log('==============================');
        
        // Show detailed income breakdown
        console.log('\n📥 INCOME BREAKDOWN:');
        Object.entries(detailedCashFlow.detailed_breakdown.income.by_source).forEach(([source, data]) => {
            console.log(`  ${source.toUpperCase().replace(/_/g, ' ')}: $${data.total.toFixed(2)}`);
            console.log(`    Transactions: ${data.transactions.length}`);
            if (data.transactions.length > 0) {
                console.log(`    Sample: ${data.transactions[0].description} - ${data.transactions[0].residence}`);
            }
        });
        
        // Show detailed expense breakdown
        console.log('\n💸 EXPENSE BREAKDOWN:');
        Object.entries(detailedCashFlow.detailed_breakdown.expenses.by_category).forEach(([category, data]) => {
            console.log(`  ${category.toUpperCase().replace(/_/g, ' ')}: $${data.total.toFixed(2)}`);
            console.log(`    Transactions: ${data.transactions.length}`);
            if (data.transactions.length > 0) {
                console.log(`    Sample: ${data.transactions[0].description} - ${data.transactions[0].residence}`);
            }
        });
        
        // Show expense details
        console.log('\n📋 EXPENSE DETAILS:');
        detailedCashFlow.detailed_breakdown.expenses_detail.slice(0, 5).forEach((expense, idx) => {
            console.log(`  ${idx + 1}. ${expense.vendor}: $${expense.amount.toFixed(2)}`);
            console.log(`     Category: ${expense.category} | Residence: ${expense.residence}`);
            console.log(`     Description: ${expense.description}`);
        });
        
        console.log('\n✅ Enhanced Cash Flow API Test Complete!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testEnhancedCashFlowAPI();
