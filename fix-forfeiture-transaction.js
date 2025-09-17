const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function fixForfeitureTransaction() {
    try {
        console.log('🔧 Fixing forfeiture transaction...\n');
        
        await mongoose.connect('mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
        
        // Find the problematic forfeiture transaction
        const transactionId = 'FORFEIT-1757949039646';
        const transaction = await TransactionEntry.findOne({ transactionId });
        
        if (!transaction) {
            console.log('❌ Transaction not found:', transactionId);
            process.exit(1);
        }
        
        console.log('📋 Current transaction:', {
            id: transaction._id,
            transactionId: transaction.transactionId,
            entries: transaction.entries.length,
            totalDebit: transaction.totalDebit,
            totalCredit: transaction.totalCredit
        });
        
        console.log('\n📝 Current entries:');
        transaction.entries.forEach((entry, index) => {
            console.log(`  ${index}: ${entry.accountName} - Debit: ${entry.debit}, Credit: ${entry.credit}`);
        });
        
        // Fix the entries
        const studentName = 'Kudzai Vella';
        const totalPayments = 50;
        
        transaction.entries = [
            // Debit: Cash (we're keeping the money)
            {
                accountCode: '1000',
                accountName: 'Cash',
                accountType: 'Asset',
                debit: totalPayments,
                credit: 0,
                description: `Forfeited payment reclassified from ${studentName} (no-show)`,
                metadata: {
                    studentId: '68c814d942bf9ffb8792f0df',
                    studentName: studentName,
                    reason: 'Student no-show',
                    transactionType: 'payment_forfeiture',
                    createdBy: 'system',
                    createdByEmail: 'system@alamait.com',
                    isForfeiture: true
                }
            },
            // Credit: Forfeited Deposits Income
            {
                accountCode: '4003',
                accountName: 'Forfeited Deposits Income',
                accountType: 'Income',
                debit: 0,
                credit: totalPayments,
                description: `Forfeited deposits income from ${studentName} (no-show)`,
                metadata: {
                    studentId: '68c814d942bf9ffb8792f0df',
                    studentName: studentName,
                    reason: 'Student no-show',
                    transactionType: 'payment_forfeiture',
                    createdBy: 'system',
                    createdByEmail: 'system@alamait.com',
                    isForfeiture: true
                }
            }
        ];
        
        // Update totals
        transaction.totalDebit = totalPayments;
        transaction.totalCredit = totalPayments;
        
        // Save the fixed transaction
        await transaction.save();
        
        console.log('\n✅ Transaction fixed!');
        console.log('📝 New entries:');
        transaction.entries.forEach((entry, index) => {
            console.log(`  ${index}: ${entry.accountName} - Debit: ${entry.debit}, Credit: ${entry.credit}`);
        });
        
        console.log('\n💰 New totals:');
        console.log(`  Total Debit: ${transaction.totalDebit}`);
        console.log(`  Total Credit: ${transaction.totalCredit}`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixForfeitureTransaction();


