/**
 * 🎯 Enhanced Double-Entry Accounting System Demo
 * 
 * This script demonstrates the complete double-entry accounting system
 * with proper accrual basis, cash basis, and residence filtering.
 */

const mongoose = require('mongoose');
const AccountingService = require('../src/services/accountingService');

// Sample data for demonstration
const samplePaymentData = {
    studentId: new mongoose.Types.ObjectId(),
    studentName: 'John Smith',
    residenceId: new mongoose.Types.ObjectId(),
    residenceName: 'St Kilda',
    paymentAmount: 100,
    paymentMethod: 'ecocash',
    paymentDate: new Date('2025-05-05'),
    month: 5,
    year: 2025,
    description: 'May 2025 Rent Payment',
    createdBy: 'finance@alamait.com'
};

async function demonstrateEnhancedAccountingSystem() {
    try {
        console.log('🚀 Starting Enhanced Double-Entry Accounting System Demo...\n');

        // 1. Create Monthly Accruals (Accrual Basis)
        console.log('📊 Step 1: Creating Monthly Accruals (Accrual Basis)');
        console.log('This records income when earned, not when received\n');
        
        const accrualResult = await AccountingService.createMonthlyAccruals(5, 2025);
        console.log('✅ Accruals created:', accrualResult);
        console.log('📈 This creates: Dr. Accounts Receivable, Cr. Rental Income + Admin Income\n');

        // 2. Process Rent Payment (Cash Basis)
        console.log('💰 Step 2: Processing Rent Payment (Cash Basis)');
        console.log('This reduces Accounts Receivable and increases Cash/Bank\n');
        
        const paymentResult = await AccountingService.processRentPayment(samplePaymentData);
        console.log('✅ Payment processed:', paymentResult);
        console.log('💳 This creates: Dr. Ecocash, Cr. Accounts Receivable\n');

        // 3. Calculate Student Arrears
        console.log('📊 Step 3: Calculating Student Arrears');
        console.log('Shows outstanding balance for a specific student\n');
        
        const studentArrears = await AccountingService.calculateStudentArrears(
            samplePaymentData.studentId,
            new Date('2025-05-31')
        );
        console.log('📋 Student Arrears:', studentArrears);
        console.log('🔍 Outstanding Balance = Total Accrued - Total Paid\n');

        // 4. Calculate Residence Arrears
        console.log('📊 Step 4: Calculating Residence Arrears');
        console.log('Shows outstanding balance for a specific residence\n');
        
        const residenceArrears = await AccountingService.calculateResidenceArrears(
            samplePaymentData.residenceId,
            new Date('2025-05-31')
        );
        console.log('📋 Residence Arrears:', residenceArrears);

        // 5. Generate Comprehensive Arrears Report
        console.log('\n📊 Step 5: Generating Comprehensive Arrears Report');
        console.log('Shows arrears for all residences\n');
        
        const arrearsReport = await AccountingService.generateArrearsReport(new Date('2025-05-31'));
        console.log('📋 Arrears Report Summary:', arrearsReport.summary);

        // 6. Generate Financial Reports by Residence
        console.log('\n📊 Step 6: Generating Financial Reports by Residence');
        console.log('Shows how to filter reports by specific residence\n');
        
        const incomeStatement = await AccountingService.generateMonthlyIncomeStatement(
            5, 2025, samplePaymentData.residenceId
        );
        console.log('📈 Income Statement (Residence):', {
            month: incomeStatement.month,
            year: incomeStatement.year,
            totalRevenue: incomeStatement.revenue.total,
            netIncome: incomeStatement.netIncome,
            basis: incomeStatement.basis
        });

        const balanceSheet = await AccountingService.generateMonthlyBalanceSheet(
            5, 2025, samplePaymentData.residenceId
        );
        console.log('📋 Balance Sheet (Residence):', {
            month: balanceSheet.month,
            year: balanceSheet.year,
            totalAssets: balanceSheet.assets.total,
            totalLiabilities: balanceSheet.liabilities.total,
            totalEquity: balanceSheet.equity.total,
            balanceCheck: balanceSheet.balanceCheck
        });

        const cashFlow = await AccountingService.generateMonthlyCashFlowStatement(
            5, 2025, samplePaymentData.residenceId
        );
        console.log('💸 Cash Flow (Residence):', {
            month: cashFlow.month,
            year: cashFlow.year,
            netOperatingCash: cashFlow.operatingActivities.netOperatingCash,
            netChangeInCash: cashFlow.netChangeInCash,
            basis: cashFlow.basis
        });

        // 7. Generate Overall Financial Reports (All Residences)
        console.log('\n📊 Step 7: Generating Overall Financial Reports (All Residences)');
        console.log('Shows consolidated view across all residences\n');
        
        const overallIncomeStatement = await AccountingService.generateMonthlyIncomeStatement(5, 2025);
        console.log('📈 Overall Income Statement:', {
            month: overallIncomeStatement.month,
            year: overallIncomeStatement.year,
            totalRevenue: overallIncomeStatement.revenue.total,
            netIncome: overallIncomeStatement.netIncome,
            basis: overallIncomeStatement.basis
        });

        const overallBalanceSheet = await AccountingService.generateMonthlyBalanceSheet(5, 2025);
        console.log('📋 Overall Balance Sheet:', {
            month: overallBalanceSheet.month,
            year: overallBalanceSheet.year,
            totalAssets: overallBalanceSheet.assets.total,
            totalLiabilities: overallBalanceSheet.liabilities.total,
            totalEquity: overallBalanceSheet.equity.total,
            balanceCheck: overallBalanceSheet.balanceCheck
        });

        const overallCashFlow = await AccountingService.generateMonthlyCashFlowStatement(5, 2025);
        console.log('💸 Overall Cash Flow:', {
            month: overallCashFlow.month,
            year: overallCashFlow.year,
            netOperatingCash: overallCashFlow.operatingActivities.netOperatingCash,
            netChangeInCash: overallCashFlow.netChangeInCash,
            basis: overallCashFlow.basis
        });

        // 8. Demonstrate the Accounting Principles
        console.log('\n🎯 Step 8: Demonstrating Accounting Principles');
        console.log('==============================================');
        console.log('✅ ACCRUAL BASIS: Income recorded when earned (monthly accruals)');
        console.log('✅ CASH BASIS: Cash flow shows actual money movements');
        console.log('✅ DOUBLE-ENTRY: Every transaction has equal debits and credits');
        console.log('✅ RESIDENCE FILTERING: All reports can be filtered by residence');
        console.log('✅ ARREARS TRACKING: Outstanding receivables calculated automatically');
        console.log('✅ BALANCE VERIFICATION: Assets = Liabilities + Equity');

        console.log('\n🎉 Enhanced Double-Entry Accounting System Demo Complete!');
        console.log('\n📚 Key Benefits:');
        console.log('• Accurate financial reporting per residence');
        console.log('• Proper separation of cash vs. accrual basis');
        console.log('• Automatic arrears calculation and tracking');
        console.log('• Double-entry validation ensures accuracy');
        console.log('• Residence-specific filtering for detailed analysis');

    } catch (error) {
        console.error('❌ Error in demo:', error);
    }
}

// Example usage scenarios
async function demonstrateRealWorldScenarios() {
    console.log('\n🌍 Real-World Scenarios Demonstration');
    console.log('=====================================\n');

    // Scenario 1: Student pays rent on time
    console.log('📖 Scenario 1: Student pays rent on time (May payment for May rent)');
    console.log('• May 1: Rent accrued (Dr. A/R $100, Cr. Rental Income $100)');
    console.log('• May 5: Payment received (Dr. Ecocash $100, Cr. A/R $100)');
    console.log('• Result: No arrears, $100 income in May, $100 cash inflow in May\n');

    // Scenario 2: Student pays rent late
    console.log('📖 Scenario 2: Student pays rent late (August payment for May rent)');
    console.log('• May 1: Rent accrued (Dr. A/R $100, Cr. Rental Income $100)');
    console.log('• May 31: Balance Sheet shows $100 receivable (arrears)');
    console.log('• August 15: Payment received (Dr. Ecocash $100, Cr. A/R $100)');
    console.log('• Result: $100 income in May, $100 cash inflow in August\n');

    // Scenario 3: Multiple payment methods
    console.log('📖 Scenario 3: Multiple payment methods for same student');
    console.log('• Student pays $60 via Ecocash, $40 via Innbucks');
    console.log('• Creates separate transactions for each payment method');
    console.log('• Cash flow shows $100 total inflow, split by method');
    console.log('• Balance sheet shows proper cash allocation\n');

    // Scenario 4: Residence comparison
    console.log('📖 Scenario 4: Residence comparison');
    console.log('• St Kilda: 20 students, $2,000 monthly rent');
    console.log('• Belvedere: 15 students, $1,500 monthly rent');
    console.log('• Christon Bank: 25 students, $2,500 monthly rent');
    console.log('• Each residence gets separate financial reports');
    console.log('• Overall reports show consolidated view\n');
}

// Run the demo
if (require.main === module) {
    // Connect to MongoDB first
    mongoose.connect('mongodb://localhost:27017/alamait', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => {
        console.log('✅ Connected to MongoDB');
        await demonstrateEnhancedAccountingSystem();
        await demonstrateRealWorldScenarios();
        mongoose.connection.close();
    }).catch(err => {
        console.error('❌ MongoDB connection error:', err);
    });
}

module.exports = {
    demonstrateEnhancedAccountingSystem,
    demonstrateRealWorldScenarios
};
