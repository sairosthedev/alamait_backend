/**
 * Test script to verify sourceType filtering in drill-down
 */

const CashFlowController = require('../controllers/finance/cashFlowController');

async function testSourceTypeFiltering() {
    try {
        console.log('🧪 Testing SourceType Filtering...\n');
        
        // Test 1: Rentals filtering
        console.log('🔍 Test 1: Testing Rentals filtering...');
        const mockReq1 = {
            query: {
                period: '2025',
                month: 'august',
                accountCode: '1000',
                sourceType: 'Rentals'
            }
        };
        
        const mockRes1 = {
            json: (data) => {
                console.log('✅ Rentals Response:');
                console.log(`📋 Account: ${data.data.accountName} (${data.data.accountCode})`);
                console.log(`📊 Source Type: ${data.data.sourceType}`);
                console.log(`📊 Total transactions: ${data.data.summary.totalTransactions}`);
                console.log(`💰 Total amount: $${data.data.summary.totalAmount}`);
                
                console.log('\n📋 First 3 transactions:');
                data.data.transactions.slice(0, 3).forEach((tx, index) => {
                    console.log(`   ${index + 1}. ${tx.studentName} - $${tx.amount} - ${tx.description}`);
                });
            },
            status: (code) => ({
                json: (data) => {
                    console.log(`❌ Error ${code}: ${data.message}`);
                }
            })
        };
        
        await CashFlowController.getAccountTransactionDetails(mockReq1, mockRes1);
        
        console.log('\n' + '='.repeat(50));
        
        // Test 2: Admin filtering
        console.log('🔍 Test 2: Testing Admin filtering...');
        const mockReq2 = {
            query: {
                period: '2025',
                month: 'august',
                accountCode: '1000',
                sourceType: 'Admin'
            }
        };
        
        const mockRes2 = {
            json: (data) => {
                console.log('✅ Admin Response:');
                console.log(`📋 Account: ${data.data.accountName} (${data.data.accountCode})`);
                console.log(`📊 Source Type: ${data.data.sourceType}`);
                console.log(`📊 Total transactions: ${data.data.summary.totalTransactions}`);
                console.log(`💰 Total amount: $${data.data.summary.totalAmount}`);
                
                console.log('\n📋 First 3 transactions:');
                data.data.transactions.slice(0, 3).forEach((tx, index) => {
                    console.log(`   ${index + 1}. ${tx.studentName} - $${tx.amount} - ${tx.description}`);
                });
            },
            status: (code) => ({
                json: (data) => {
                    console.log(`❌ Error ${code}: ${data.message}`);
                }
            })
        };
        
        await CashFlowController.getAccountTransactionDetails(mockReq2, mockRes2);
        
        console.log('\n' + '='.repeat(50));
        
        // Test 3: Advance Payments filtering
        console.log('🔍 Test 3: Testing Advance Payments filtering...');
        const mockReq3 = {
            query: {
                period: '2025',
                month: 'august',
                accountCode: '1000',
                sourceType: 'Advance Payments'
            }
        };
        
        const mockRes3 = {
            json: (data) => {
                console.log('✅ Advance Payments Response:');
                console.log(`📋 Account: ${data.data.accountName} (${data.data.accountCode})`);
                console.log(`📊 Source Type: ${data.data.sourceType}`);
                console.log(`📊 Total transactions: ${data.data.summary.totalTransactions}`);
                console.log(`💰 Total amount: $${data.data.summary.totalAmount}`);
                
                console.log('\n📋 First 3 transactions:');
                data.data.transactions.slice(0, 3).forEach((tx, index) => {
                    console.log(`   ${index + 1}. ${tx.studentName} - $${tx.amount} - ${tx.description}`);
                });
            },
            status: (code) => ({
                json: (data) => {
                    console.log(`❌ Error ${code}: ${data.message}`);
                }
            })
        };
        
        await CashFlowController.getAccountTransactionDetails(mockReq3, mockRes3);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSourceTypeFiltering();


