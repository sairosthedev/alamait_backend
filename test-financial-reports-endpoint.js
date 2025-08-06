process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');
const FinancialReportsController = require('./src/controllers/financialReportsController');

async function testFinancialReportsEndpoint() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        console.log('\n📊 TESTING FINANCIAL REPORTS ENDPOINT...\n');

        // Mock request and response objects
        const mockReq = {
            query: {
                period: '2025',
                basis: 'cash'
            }
        };

        const mockRes = {
            json: (data) => {
                console.log('✅ Income Statement Response:');
                console.log(JSON.stringify(data, null, 2));
            },
            status: (code) => {
                console.log(`Status Code: ${code}`);
                return {
                    json: (data) => {
                        console.log('❌ Error Response:');
                        console.log(JSON.stringify(data, null, 2));
                    }
                };
            }
        };

        // Test income statement generation
        console.log('💰 TESTING INCOME STATEMENT:');
        console.log('=' .repeat(50));
        await FinancialReportsController.generateIncomeStatement(mockReq, mockRes);

        // Test balance sheet
        console.log('\n📋 TESTING BALANCE SHEET:');
        console.log('=' .repeat(50));
        const balanceSheetReq = {
            query: {
                asOf: '2025-12-31',
                basis: 'cash'
            }
        };
        await FinancialReportsController.generateBalanceSheet(balanceSheetReq, mockRes);

        // Test cash flow statement
        console.log('\n💸 TESTING CASH FLOW STATEMENT:');
        console.log('=' .repeat(50));
        await FinancialReportsController.generateCashFlowStatement(mockReq, mockRes);

        // Test trial balance
        console.log('\n📈 TESTING TRIAL BALANCE:');
        console.log('=' .repeat(50));
        await FinancialReportsController.generateTrialBalance(balanceSheetReq, mockRes);

        console.log('\n✅ FINANCIAL REPORTS ENDPOINT TEST COMPLETED');
        console.log('The endpoints should now be accessible at:');
        console.log('- GET /api/financial-reports/income-statement');
        console.log('- GET /api/financial-reports/balance-sheet');
        console.log('- GET /api/financial-reports/cash-flow');
        console.log('- GET /api/financial-reports/trial-balance');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

testFinancialReportsEndpoint(); 