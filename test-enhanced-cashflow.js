require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import the enhanced cash flow service
const EnhancedCashFlowService = require('./src/services/enhancedCashFlowService');

async function testEnhancedCashFlow() {
    try {
        console.log('\n💰 Testing Enhanced Cash Flow Service\n');
        console.log('=====================================\n');
        
        // Test for 2025 period
        const period = '2025';
        const basis = 'cash';
        
        console.log(`📊 Generating detailed cash flow for ${period} (${basis} basis)...\n`);
        
        // Generate detailed cash flow statement
        const detailedCashFlow = await EnhancedCashFlowService.generateDetailedCashFlowStatement(period, basis);
        
        // Display summary
        console.log('📋 CASH FLOW SUMMARY:');
        console.log('======================');
        console.log(`Period: ${detailedCashFlow.period}`);
        console.log(`Basis: ${detailedCashFlow.basis}`);
        console.log(`Net Change in Cash: $${detailedCashFlow.summary.net_change_in_cash.toFixed(2)}`);
        console.log(`Net Operating Cash Flow: $${detailedCashFlow.summary.net_operating_cash_flow.toFixed(2)}`);
        console.log(`Net Investing Cash Flow: $${detailedCashFlow.summary.net_investing_cash_flow.toFixed(2)}`);
        console.log(`Net Financing Cash Flow: $${detailedCashFlow.summary.net_financing_cash_flow.toFixed(2)}`);
        console.log(`Total Income: $${detailedCashFlow.summary.total_income.toFixed(2)}`);
        console.log(`Total Expenses: $${detailedCashFlow.summary.total_expenses.toFixed(2)}`);
        console.log(`Transaction Count: ${detailedCashFlow.summary.transaction_count}`);
        console.log(`Payment Count: ${detailedCashFlow.summary.payment_count}`);
        console.log(`Expense Count: ${detailedCashFlow.summary.expense_count}`);
        
        // Display detailed income breakdown
        console.log('\n📥 DETAILED INCOME BREAKDOWN:');
        console.log('==============================');
        const incomeBreakdown = detailedCashFlow.detailed_breakdown.income;
        console.log(`Total Income: $${incomeBreakdown.total.toFixed(2)}`);
        
        Object.entries(incomeBreakdown.by_source).forEach(([source, data]) => {
            console.log(`\n${source.toUpperCase().replace(/_/g, ' ')}: $${data.total.toFixed(2)}`);
            console.log(`  Transaction Count: ${data.transactions.length}`);
            
            if (data.transactions.length > 0) {
                console.log('  Sample Transactions:');
                data.transactions.slice(0, 3).forEach((tx, idx) => {
                    console.log(`    ${idx + 1}. ${tx.transactionId}: $${tx.amount.toFixed(2)} - ${tx.residence} (${tx.date.toDateString()})`);
                });
                if (data.transactions.length > 3) {
                    console.log(`    ... and ${data.transactions.length - 3} more transactions`);
                }
            }
        });
        
        // Display income by residence
        console.log('\n🏠 INCOME BY RESIDENCE:');
        console.log('=======================');
        Object.entries(incomeBreakdown.by_residence).forEach(([residence, amount]) => {
            console.log(`${residence}: $${amount.toFixed(2)}`);
        });
        
        // Display detailed expense breakdown
        console.log('\n💸 DETAILED EXPENSE BREAKDOWN:');
        console.log('===============================');
        const expenseBreakdown = detailedCashFlow.detailed_breakdown.expenses;
        console.log(`Total Expenses: $${expenseBreakdown.total.toFixed(2)}`);
        
        Object.entries(expenseBreakdown.by_category).forEach(([category, data]) => {
            console.log(`\n${category.toUpperCase().replace(/_/g, ' ')}: $${data.total.toFixed(2)}`);
            console.log(`  Transaction Count: ${data.transactions.length}`);
            
            if (data.transactions.length > 0) {
                console.log('  Sample Transactions:');
                data.transactions.slice(0, 3).forEach((tx, idx) => {
                    console.log(`    ${idx + 1}. ${tx.transactionId}: $${tx.amount.toFixed(2)} - ${tx.residence} (${tx.date.toDateString()})`);
                });
                if (data.transactions.length > 3) {
                    console.log(`    ... and ${data.transactions.length - 3} more transactions`);
                }
            }
        });
        
        // Display expenses by residence
        console.log('\n🏠 EXPENSES BY RESIDENCE:');
        console.log('=========================');
        Object.entries(expenseBreakdown.by_residence).forEach(([residence, amount]) => {
            console.log(`${residence}: $${amount.toFixed(2)}`);
        });
        
        // Display monthly breakdown
        console.log('\n📅 MONTHLY BREAKDOWN:');
        console.log('=====================');
        const monthlyBreakdown = detailedCashFlow.detailed_breakdown.monthly_breakdown;
        
        Object.entries(monthlyBreakdown).forEach(([month, data]) => {
            if (data.income.total > 0 || data.expenses.total > 0) {
                console.log(`\n${month}:`);
                console.log(`  Income: $${data.income.total.toFixed(2)}`);
                console.log(`    - Rental Income: $${data.income.rental_income.toFixed(2)}`);
                console.log(`    - Admin Fees: $${data.income.admin_fees.toFixed(2)}`);
                console.log(`    - Deposits: $${data.income.deposits.toFixed(2)}`);
                console.log(`    - Utilities: $${data.income.utilities.toFixed(2)}`);
                console.log(`    - Other Income: $${data.income.other_income.toFixed(2)}`);
                console.log(`  Expenses: $${data.expenses.total.toFixed(2)}`);
                console.log(`    - Maintenance: $${data.expenses.maintenance.toFixed(2)}`);
                console.log(`    - Utilities: $${data.expenses.utilities.toFixed(2)}`);
                console.log(`    - Cleaning: $${data.expenses.cleaning.toFixed(2)}`);
                console.log(`    - Security: $${data.expenses.security.toFixed(2)}`);
                console.log(`    - Management: $${data.expenses.management.toFixed(2)}`);
                console.log(`    - Other Expenses: $${data.expenses.other_expenses.toFixed(2)}`);
                console.log(`  Net Cash Flow: $${data.net_cash_flow.toFixed(2)}`);
                console.log(`  Transactions: ${data.transaction_count}, Payments: ${data.payment_count}, Expenses: ${data.expense_count}`);
            }
        });
        
        // Display sample payment details
        console.log('\n💳 SAMPLE PAYMENT DETAILS:');
        console.log('===========================');
        const paymentDetails = detailedCashFlow.detailed_breakdown.payments;
        if (paymentDetails.length > 0) {
            paymentDetails.slice(0, 5).forEach((payment, idx) => {
                console.log(`${idx + 1}. ${payment.paymentId}: $${payment.totalAmount.toFixed(2)}`);
                console.log(`   Student: ${payment.student}`);
                console.log(`   Residence: ${payment.residence}`);
                console.log(`   Date: ${payment.date.toDateString()}`);
                console.log(`   Method: ${payment.paymentMethod}`);
                console.log(`   Breakdown: Rent $${payment.rentAmount.toFixed(2)}, Admin $${payment.adminFee.toFixed(2)}, Deposit $${payment.deposit.toFixed(2)}`);
            });
            if (paymentDetails.length > 5) {
                console.log(`   ... and ${paymentDetails.length - 5} more payments`);
            }
        } else {
            console.log('No payment details found');
        }
        
        // Display sample expense details
        console.log('\n📋 SAMPLE EXPENSE DETAILS:');
        console.log('===========================');
        const expenseDetails = detailedCashFlow.detailed_breakdown.expenses_detail;
        if (expenseDetails.length > 0) {
            expenseDetails.slice(0, 5).forEach((expense, idx) => {
                console.log(`${idx + 1}. ${expense.expenseId}: $${expense.amount.toFixed(2)}`);
                console.log(`   Vendor: ${expense.vendor}`);
                console.log(`   Category: ${expense.category}`);
                console.log(`   Residence: ${expense.residence}`);
                console.log(`   Date: ${expense.date.toDateString()}`);
                console.log(`   Description: ${expense.description}`);
            });
            if (expenseDetails.length > 5) {
                console.log(`   ... and ${expenseDetails.length - 5} more expenses`);
            }
        } else {
            console.log('No expense details found');
        }
        
        // Display metadata
        console.log('\n📊 METADATA:');
        console.log('=============');
        console.log(`Generated At: ${detailedCashFlow.metadata.generated_at}`);
        console.log(`Residence Filter: ${detailedCashFlow.metadata.residence_filter || 'None'}`);
        console.log(`Data Sources: ${detailedCashFlow.metadata.data_sources.join(', ')}`);
        console.log(`Basis Type: ${detailedCashFlow.metadata.basis_type}`);
        
        console.log('\n✅ Enhanced Cash Flow Test Completed Successfully!');
        
    } catch (error) {
        console.error('❌ Error testing enhanced cash flow:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the test
testEnhancedCashFlow();
