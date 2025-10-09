/**
 * Test script to simulate the drill-down request
 */

const CashFlowController = require('../controllers/finance/cashFlowController');

async function testDrillDownRequest() {
    try {
        console.log('🧪 Testing Drill-Down Request...\n');
        
        // Simulate the request you're making
        const mockReq = {
            query: {
                period: '2025',
                month: 'august',
                accountCode: '1000' // This is what's being sent currently
            }
        };
        
        const mockRes = {
            json: (data) => {
                console.log('✅ Response received:');
                console.log(`📋 Account: ${data.data.accountName} (${data.data.accountCode})`);
                console.log(`📊 Total transactions: ${data.data.summary.totalTransactions}`);
                console.log(`💰 Total amount: $${data.data.summary.totalAmount}`);
                console.log(`👥 Unique students: ${data.data.summary.uniqueStudents}`);
                
                console.log('\n📋 First 5 transactions:');
                data.data.transactions.slice(0, 5).forEach((tx, index) => {
                    console.log(`   ${index + 1}. ${tx.studentName} - $${tx.amount} - ${tx.description}`);
                });
            },
            status: (code) => ({
                json: (data) => {
                    console.log(`❌ Error ${code}: ${data.message}`);
                }
            })
        };
        
        console.log('🔍 Testing with accountCode: 1000 (Cash)');
        await CashFlowController.getAccountTransactionDetails(mockReq, mockRes);
        
        console.log('\n' + '='.repeat(50));
        
        // Now test with the correct account code for admin fees
        mockReq.query.accountCode = '4002';
        console.log('🔍 Testing with accountCode: 4002 (Administrative Fees)');
        await CashFlowController.getAccountTransactionDetails(mockReq, mockRes);
        
        console.log('\n' + '='.repeat(50));
        
        // Test with rental income account code
        mockReq.query.accountCode = '4001';
        console.log('🔍 Testing with accountCode: 4001 (Rental Income)');
        await CashFlowController.getAccountTransactionDetails(mockReq, mockRes);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testDrillDownRequest();










