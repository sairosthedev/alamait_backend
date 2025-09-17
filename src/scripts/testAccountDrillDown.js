/**
 * Test script to verify account drill-down functionality
 */

const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Payment = require('../models/Payment');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

async function testAccountDrillDown() {
    try {
        console.log('🔍 Testing Account Drill-Down Functionality\n');
        
        // Test different account codes
        const testAccounts = [
            { code: '4001', name: 'Rental Income' },
            { code: '4002', name: 'Administrative Fees' },
            { code: '2200', name: 'Advance Payment Liability' },
            { code: '2020', name: 'Tenant Security Deposits' }
        ];
        
        for (const account of testAccounts) {
            console.log(`\n📊 Testing Account: ${account.code} (${account.name})`);
            
            // Find transactions for July 2025
            const startDate = new Date(2025, 6, 1); // July 1, 2025
            const endDate = new Date(2025, 6, 31); // July 31, 2025
            
            const allTransactions = await TransactionEntry.find({
                date: { $gte: startDate, $lte: endDate },
                'metadata.isForfeiture': { $ne: true }
            }).populate('entries');
            
            // Filter for transactions containing this account code
            const accountTransactions = allTransactions.filter(entry => {
                if (!entry.entries || !Array.isArray(entry.entries)) return false;
                return entry.entries.some(line => line.accountCode === account.code);
            });
            
            console.log(`   Found ${accountTransactions.length} transactions`);
            
            if (accountTransactions.length > 0) {
                let totalAmount = 0;
                let transactionCount = 0;
                
                for (const entry of accountTransactions) {
                    for (const line of entry.entries) {
                        if (line.accountCode === account.code) {
                            const amount = line.credit || line.debit || 0;
                            totalAmount += amount;
                            transactionCount++;
                            
                            console.log(`   - ${entry.date.toISOString().split('T')[0]}: $${amount} (${entry.description})`);
                            
                            // Try to find payment details
                            if (entry.reference) {
                                try {
                                    const payment = await Payment.findById(entry.reference).populate('student');
                                    if (payment && payment.student) {
                                        console.log(`     Student: ${payment.student.firstName} ${payment.student.lastName}`);
                                    }
                                } catch (error) {
                                    // Ignore error
                                }
                            }
                        }
                    }
                }
                
                console.log(`   Total: $${totalAmount} across ${transactionCount} entries`);
            } else {
                console.log('   No transactions found for this account');
            }
        }
        
        console.log('\n✅ Account drill-down test completed');
        
    } catch (error) {
        console.error('❌ Error testing account drill-down:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the test
testAccountDrillDown();


