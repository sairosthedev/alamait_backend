const mongoose = require('mongoose');
require('dotenv').config();

// Import the enhanced service
const FinancialReportingService = require('./src/services/financialReportingService');

async function testEnhancedCashFlow() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas\n');

        console.log('📊 TESTING ENHANCED CASH FLOW SERVICE');
        console.log('='.repeat(80));

        // Test 1: Generate enhanced cash flow
        console.log('\n🧪 Test 1: Generate Enhanced Cash Flow (Cash Basis)');
        console.log('-'.repeat(50));
        
        const cashFlow = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
        console.log(`✅ Period: ${cashFlow.period}`);
        console.log(`✅ Basis: ${cashFlow.basis}`);
        console.log(`✅ Net Cash from Operations: $${cashFlow.summary.net_cash_from_operations?.toLocaleString() || 'N/A'}`);
        console.log(`✅ Net Cash Used in Investing: $${cashFlow.summary.net_cash_used_in_investing?.toLocaleString() || 'N/A'}`);
        console.log(`✅ Net Cash from Financing: $${cashFlow.summary.net_cash_from_financing?.toLocaleString() || 'N/A'}`);

        // Test 2: Validate cash flow
        console.log('\n🧪 Test 2: Validate Cash Flow');
        console.log('-'.repeat(50));
        
        const validation = await FinancialReportingService.validateCashFlow('2025');
        console.log(`✅ Is Balanced: ${validation.isBalanced}`);
        
        if (validation.issues.length > 0) {
            console.log('❌ Issues Found:');
            validation.issues.forEach(issue => console.log(`   - ${issue}`));
        } else {
            console.log('✅ No validation issues found');
        }
        
        if (validation.warnings.length > 0) {
            console.log('⚠️ Warnings:');
            validation.warnings.forEach(warning => console.log(`   - ${warning}`));
        } else {
            console.log('✅ No warnings');
        }

        // Test 3: Test account classification helper
        console.log('\n🧪 Test 3: Account Classification Helper');
        console.log('-'.repeat(50));
        
        const testAccounts = [
            { code: '4000', name: 'Rental Income' },
            { code: '5001', name: 'Maintenance Expense' },
            { code: '2000', name: 'Accounts Payable' },
            { code: '2020', name: 'Tenant Deposits' },
            { code: '3000', name: 'Owner Equity' },
            { code: '6000', name: 'Property Equipment' }
        ];

        testAccounts.forEach(account => {
            const category = FinancialReportingService.classifyCashFlowActivity(account.code, account.name);
            console.log(`   ${account.code} - ${account.name}: ${category.toUpperCase()}`);
        });

        // Test 4: Test security deposit tracking
        console.log('\n🧪 Test 4: Security Deposit Tracking');
        console.log('-'.repeat(50));
        
        // Get some sample entries to test deposit tracking
        const sampleEntries = await mongoose.model('TransactionEntry').find({
            date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
            'entries.accountName': { $regex: /deposit/i }
        }).limit(5);

        if (sampleEntries.length > 0) {
            const deposits = FinancialReportingService.trackSecurityDeposits(sampleEntries);
            console.log(`✅ Deposits Received: $${deposits.received.toLocaleString()}`);
            console.log(`✅ Deposits Refunded: $${deposits.refunded.toLocaleString()}`);
            console.log(`✅ Deposits Forfeited: $${deposits.forfeited.toLocaleString()}`);
            console.log(`✅ Current Liability: $${deposits.current_liability.toLocaleString()}`);
        } else {
            console.log('ℹ️ No deposit transactions found for testing');
        }

        // Test 5: Compare old vs new categorization
        console.log('\n🧪 Test 5: Compare Categorization Methods');
        console.log('-'.repeat(50));
        
        const testCases = [
            { code: '1100', type: 'Asset', name: 'Accounts Receivable' },
            { code: '2020', type: 'Liability', name: 'Tenant Deposits' },
            { code: '4000', type: 'Income', name: 'Rental Income' },
            { code: '5003', type: 'Expense', name: 'Utilities' }
        ];

        testCases.forEach(testCase => {
            const oldMethod = FinancialReportingService.getCashFlowActivityType(testCase.code, testCase.type);
            const newMethod = FinancialReportingService.classifyCashFlowActivity(testCase.code, testCase.name);
            
            console.log(`   ${testCase.code} - ${testCase.name}:`);
            console.log(`      Old Method (${testCase.type}): ${oldMethod.toUpperCase()}`);
            console.log(`      New Method (${testCase.name}): ${newMethod.toUpperCase()}`);
            console.log(`      Match: ${oldMethod === newMethod ? '✅' : '❌'}`);
        });

        console.log('\n🎉 Enhanced Cash Flow Service Testing Complete!');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ Error testing enhanced cash flow service:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the test
testEnhancedCashFlow();
