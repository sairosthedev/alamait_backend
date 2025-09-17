const mongoose = require('mongoose');
const FinancialReportingService = require('../services/financialReportingService');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function testIncomeStatementFixed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        console.log('🔍 Testing FIXED Comprehensive Income Statement...');
        
        const result = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement('2025', 'accrual');
        
        console.log('\n📊 Results:');
        console.log('Structure:', Object.keys(result));
        
        if (result.monthly_breakdown) {
            console.log('\n📅 Monthly Breakdown Available');
            
            // July is index 6 (0-based)
            const julyData = result.monthly_breakdown[6];
            
            if (julyData && julyData.total_expenses > 0) {
                console.log('\n📅 JULY 2025:');
                console.log(`Total Expenses: $${julyData.total_expenses}`);
                console.log(`Expense Categories: ${Object.keys(julyData.expenses).length}`);
                
                console.log('\n💸 EXPENSE SUMMARY BY CATEGORY:');
                Object.keys(julyData.expenses).forEach(account => {
                    console.log(`  ${account}: $${julyData.expenses[account]}`);
                });
                
                console.log('\n📋 INDIVIDUAL EXPENSE DETAILS:');
                console.log(`Number of individual expenses: ${julyData.expense_details.length}`);
                
                julyData.expense_details.forEach((expense, index) => {
                    console.log(`\n${index + 1}. ${expense.transactionId}`);
                    console.log(`   Date: ${expense.date.toString().split('T')[0]}`);
                    console.log(`   Description: ${expense.description}`);
                    console.log(`   Account: ${expense.accountCode} - ${expense.accountName}`);
                    console.log(`   Amount: $${expense.amount}`);
                    console.log(`   Source: ${expense.source}`);
                    if (expense.lineItemDescription) {
                        console.log(`   Line Item: ${expense.lineItemDescription}`);
                    }
                });
                
                console.log(`\n💰 Revenue Categories: ${Object.keys(julyData.revenue).length}`);
                Object.keys(julyData.revenue).forEach(account => {
                    console.log(`  ${account}: $${julyData.revenue[account]}`);
                });
            } else {
                console.log('❌ July data not found or no expenses');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testIncomeStatementFixed();
