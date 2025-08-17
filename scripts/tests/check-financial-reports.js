process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

async function checkFinancialReports() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n📊 GENERATING FINANCIAL REPORTS...\n');

        // Generate Income Statement for 2025
        console.log('💰 INCOME STATEMENT (2025):');
        console.log('=' .repeat(50));
        const incomeStatement = await FinancialReportingService.generateIncomeStatement('2025', 'cash');
        console.log(JSON.stringify(incomeStatement, null, 2));

        console.log('\n📋 BALANCE SHEET (as of 2025-12-31):');
        console.log('=' .repeat(50));
        const balanceSheet = await FinancialReportingService.generateBalanceSheet('2025-12-31', 'cash');
        console.log(JSON.stringify(balanceSheet, null, 2));

        console.log('\n💸 CASH FLOW STATEMENT (2025):');
        console.log('=' .repeat(50));
        const cashFlow = await FinancialReportingService.generateCashFlowStatement('2025', 'cash');
        console.log(JSON.stringify(cashFlow, null, 2));

        console.log('\n📈 TRIAL BALANCE (as of 2025-12-31):');
        console.log('=' .repeat(50));
        const trialBalance = await FinancialReportingService.generateTrialBalance('2025-12-31', 'cash');
        console.log(JSON.stringify(trialBalance, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

checkFinancialReports(); 