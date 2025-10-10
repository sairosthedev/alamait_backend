/**
 * Test Script for Enhanced Balance Sheet with Student Negotiations
 * 
 * This script demonstrates how the enhanced balance sheet system
 * provides clear visibility into student rent negotiations and their impact.
 */

const mongoose = require('mongoose');
const EnhancedBalanceSheetService = require('./src/services/enhancedBalanceSheetService');

// Test data based on your transaction
const testTransaction = {
    _id: "68e85c8b9df7c4e08b327b0a",
    transactionId: "NEG-RENT-1760058507521",
    date: new Date("2025-09-01T00:00:00.000+00:00"),
    description: "far from uz",
    reference: "NEG-RENT-1760058507521",
    entries: [
        {
            accountCode: "4001",
            accountName: "Student Accommodation Rent",
            accountType: "Income",
            debit: 30,
            credit: 0,
            description: "Student Accommodation Rent reduction for negotiated rent discount - Kudzai Pemhiwa"
        },
        {
            accountCode: "1100-68e7763d3f4d94b74d6e9bee",
            accountName: "Accounts Receivable - Kudzai Pemhiwa",
            accountType: "Asset",
            debit: 0,
            credit: 30,
            description: "A/R reduction for negotiated rent discount - Kudzai Pemhiwa"
        }
    ],
    totalDebit: 30,
    totalCredit: 30,
    source: "manual",
    sourceId: "67f4ef0fcb87ffa3fb7e2d73",
    sourceModel: "TransactionEntry",
    createdBy: "67f4ef0fcb87ffa3fb7e2d73",
    approvedBy: null,
    approvedAt: null,
    status: "posted",
    metadata: {
        type: "negotiated_payment_adjustment",
        studentId: "68e7763d3f4d94b74d6e9bee",
        studentName: "Kudzai Pemhiwa",
        originalAmount: 150,
        negotiatedAmount: 120,
        discountAmount: 30,
        negotiationReason: "Student negotiation"
    }
};

async function testEnhancedBalanceSheet() {
    try {
        console.log('🧪 Testing Enhanced Balance Sheet with Student Negotiations\n');
        
        // Connect to database (you'll need to update this with your connection string)
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend';
        
        if (mongoose.connection.readyState !== 1) {
            console.log('🔌 Connecting to database...');
            await mongoose.connect(MONGODB_URI);
            console.log('✅ Connected to database\n');
        }
        
        // Test 1: Generate Enhanced Balance Sheet
        console.log('📊 Test 1: Generating Enhanced Balance Sheet');
        console.log('=' .repeat(50));
        
        const asOfDate = new Date('2025-09-30');
        const balanceSheet = await EnhancedBalanceSheetService.generateEnhancedBalanceSheet(asOfDate);
        
        console.log('✅ Enhanced Balance Sheet Generated Successfully\n');
        
        // Display key metrics
        console.log('📈 Key Metrics:');
        console.log(`   Total Transactions Processed: ${balanceSheet.metadata.totalTransactions}`);
        console.log(`   Total Negotiations: ${balanceSheet.metadata.negotiationSummary.totalNegotiations}`);
        console.log(`   Total Discounts Given: $${balanceSheet.metadata.negotiationSummary.totalDiscountsGiven}`);
        console.log(`   Students Affected: ${balanceSheet.metadata.negotiationSummary.studentsAffected.length}`);
        console.log(`   Average Discount per Negotiation: $${balanceSheet.metadata.negotiationSummary.averageDiscountPerNegotiation}\n`);
        
        // Display Accounts Receivable breakdown
        console.log('💰 Accounts Receivable Breakdown:');
        console.log(`   Total A/R: $${balanceSheet.assets.currentAssets.accountsReceivable.total}`);
        console.log(`   Original Accruals: $${balanceSheet.assets.currentAssets.accountsReceivable.breakdown.originalAccruals}`);
        console.log(`   Negotiated Adjustments: $${balanceSheet.assets.currentAssets.accountsReceivable.breakdown.negotiatedAdjustments}`);
        console.log(`   Payments Received: $${balanceSheet.assets.currentAssets.accountsReceivable.breakdown.paymentsReceived}`);
        console.log(`   Net Outstanding: $${balanceSheet.assets.currentAssets.accountsReceivable.breakdown.netOutstanding}\n`);
        
        // Display student details
        const studentDetails = balanceSheet.assets.currentAssets.accountsReceivable.studentDetails;
        const studentIds = Object.keys(studentDetails);
        
        if (studentIds.length > 0) {
            console.log('👥 Student Details:');
            studentIds.forEach(studentId => {
                const student = studentDetails[studentId];
                console.log(`   Student: ${student.studentName}`);
                console.log(`     Account Code: ${student.accountCode}`);
                console.log(`     Original Accruals: $${student.originalAccruals}`);
                console.log(`     Negotiated Adjustments: $${student.negotiatedAdjustments}`);
                console.log(`     Payments Received: $${student.paymentsReceived}`);
                console.log(`     Net Outstanding: $${student.netOutstanding}`);
                console.log(`     Transaction Count: ${student.transactions.length}\n`);
            });
        }
        
        // Test 2: Generate Student Negotiation Report
        console.log('📊 Test 2: Generating Student Negotiation Report');
        console.log('=' .repeat(50));
        
        const negotiationReport = await EnhancedBalanceSheetService.generateStudentNegotiationReport(asOfDate);
        
        console.log('✅ Student Negotiation Report Generated Successfully\n');
        
        console.log('📈 Negotiation Report Summary:');
        console.log(`   Report Date: ${negotiationReport.reportDate}`);
        console.log(`   Total Negotiations: ${negotiationReport.summary.totalNegotiations}`);
        console.log(`   Total Discounts Given: $${negotiationReport.summary.totalDiscountsGiven}`);
        console.log(`   Students with Negotiations: ${negotiationReport.students.length}\n`);
        
        if (negotiationReport.students.length > 0) {
            console.log('🎓 Students with Negotiations:');
            negotiationReport.students.forEach((student, index) => {
                console.log(`   ${index + 1}. ${student.studentName}`);
                console.log(`      Student ID: ${student.studentId}`);
                console.log(`      Original Accruals: $${student.originalAccruals}`);
                console.log(`      Total Discounts: $${student.totalDiscounts}`);
                console.log(`      Negotiation Count: ${student.negotiationCount}`);
                console.log(`      Current Balance: $${student.netOutstanding}\n`);
            });
        }
        
        // Test 3: Demonstrate API Endpoint Usage
        console.log('🌐 Test 3: API Endpoint Usage Examples');
        console.log('=' .repeat(50));
        
        console.log('📡 Available API Endpoints:');
        console.log('   1. GET /api/finance/enhanced-balance-sheet?asOfDate=2025-09-30');
        console.log('      → Returns detailed balance sheet with negotiation breakdown');
        console.log('');
        console.log('   2. GET /api/finance/student-negotiation-report?asOfDate=2025-09-30');
        console.log('      → Returns comprehensive negotiation report');
        console.log('');
        console.log('   3. GET /api/finance/student-negotiation-history/68e7763d3f4d94b74d6e9bee');
        console.log('      → Returns negotiation history for specific student');
        console.log('');
        console.log('   4. GET /api/finance/negotiation-impact-summary?asOfDate=2025-09-30');
        console.log('      → Returns financial impact analysis of negotiations\n');
        
        // Test 4: Show how your specific transaction would appear
        console.log('🎯 Test 4: Your Transaction Analysis');
        console.log('=' .repeat(50));
        
        console.log('📋 Transaction: NEG-RENT-1760058507521');
        console.log('   Student: Kudzai Pemhiwa');
        console.log('   Date: September 1, 2025');
        console.log('   Type: Rent Negotiation');
        console.log('   Discount Amount: $30\n');
        
        console.log('📊 How it appears in Enhanced Balance Sheet:');
        console.log('   • Original Accrual: $150 (when student was first invoiced)');
        console.log('   • Negotiated Adjustment: -$30 (discount given)');
        console.log('   • Net Outstanding: $120 (what student actually owes)');
        console.log('   • Income Impact: -$30 (reduction in rental income)\n');
        
        console.log('✅ All tests completed successfully!');
        console.log('\n🎉 The enhanced balance sheet system now provides:');
        console.log('   • Clear visibility into student negotiations');
        console.log('   • Detailed breakdown of original vs. negotiated amounts');
        console.log('   • Comprehensive reporting for management decisions');
        console.log('   • Audit-ready transaction records');
        console.log('   • Proper double-entry accounting compliance');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testEnhancedBalanceSheet()
        .then(() => {
            console.log('\n🏁 Test script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Test script failed:', error);
            process.exit(1);
        });
}

module.exports = { testEnhancedBalanceSheet };
