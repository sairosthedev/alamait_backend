const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function updateForfeitureTransaction() {
    try {
        console.log('🔧 Updating forfeiture transaction...\n');
        
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
        
        // Update the entries with correct accounting (3-entry structure)
        const studentName = 'Kudzai Vella';
        const totalPayments = 50;
        const studentId = '68c814d942bf9ffb8792f0df';
        
        transaction.entries = [
            // Debit: Accounts Receivable (restore $30 rent payment)
            {
                accountCode: `1100-${studentId}`,
                accountName: `Accounts Receivable - ${studentName}`,
                accountType: 'Asset',
                debit: 30,
                credit: 0,
                description: `Forfeited rent payment - AR restored for ${studentName} (no-show)`,
                metadata: {
                    studentId: studentId,
                    studentName: studentName,
                    reason: 'Student no-show',
                    transactionType: 'payment_forfeiture',
                    createdBy: 'system',
                    createdByEmail: 'system@alamait.com',
                    isForfeiture: true
                }
            },
            // Debit: Advance Payment Liability (reduce $20 admin advance)
            {
                accountCode: '2200',
                accountName: 'Advance Payment Liability',
                accountType: 'Liability',
                debit: 20,
                credit: 0,
                description: `Forfeited admin advance payment from ${studentName} (no-show)`,
                metadata: {
                    studentId: studentId,
                    studentName: studentName,
                    reason: 'Student no-show',
                    transactionType: 'payment_forfeiture',
                    createdBy: 'system',
                    createdByEmail: 'system@alamait.com',
                    isForfeiture: true
                }
            },
            // Credit: Forfeited Deposits Income (total $50)
            {
                accountCode: '4003',
                accountName: 'Forfeited Deposits Income',
                accountType: 'Income',
                debit: 0,
                credit: totalPayments,
                description: `Forfeited deposits income from ${studentName} (no-show)`,
                metadata: {
                    studentId: studentId,
                    studentName: studentName,
                    reason: 'Student no-show',
                    transactionType: 'payment_forfeiture',
                    createdBy: 'system',
                    createdByEmail: 'system@alamait.com',
                    isForfeiture: true
                }
            }
        ];
        
        // Update totals (should remain the same)
        transaction.totalDebit = totalPayments;
        transaction.totalCredit = totalPayments;
        
        // Save the updated transaction
        await transaction.save();
        
        console.log('\n✅ Transaction updated!');
        console.log('📝 New entries:');
        transaction.entries.forEach((entry, index) => {
            console.log(`  ${index}: ${entry.accountName} - Debit: ${entry.debit}, Credit: ${entry.credit}`);
        });
        
        console.log('\n💰 Accounting Summary:');
        console.log('  - Accounts Receivable (1100): +$30 (restored)');
        console.log('  - Advance Payment Liability (2200): -$20 (reduced)');
        console.log('  - Forfeited Deposits Income (4003): +$50 (new category)');
        console.log('  - Cash: No change (we keep the money)');
        console.log('  - Net effect: Student owes $30, we earned $50 forfeited income');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateForfeitureTransaction();
