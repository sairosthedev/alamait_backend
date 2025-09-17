require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

async function checkTransactions() {
    try {
        await mongoose.connection.asPromise();
        const db = mongoose.connection.db;
        
        console.log('🔍 TRANSACTION STATUS CHECK\n');
        
        const transactions = await db.collection('transactions').find({}).toArray();
        console.log(`📊 Total Transactions: ${transactions.length}\n`);
        
        // Check each scenario
        const scenarios = {
            'Student Payments': transactions.filter(t => t.metadata?.type === 'rent_payment'),
            'Admin Fee Payments': transactions.filter(t => t.metadata?.type === 'admin_fee_payment'),
            'Deposit Payments': transactions.filter(t => t.metadata?.type === 'deposit_payment'),
            'Petty Cash Allocations': transactions.filter(t => t.metadata?.type === 'petty_cash_allocation'),
            'Expenses': transactions.filter(t => t.metadata?.type === 'expense_creation'),
            'Petty Cash Expenses': transactions.filter(t => t.metadata?.type === 'petty_cash_expense'),
            'Rent Accruals': transactions.filter(t => t.metadata?.type === 'rent_accrual')
        };
        
        Object.entries(scenarios).forEach(([name, txs]) => {
            console.log(`${name}: ${txs.length} transactions`);
            if (txs.length > 0) {
                const sample = txs[0];
                console.log(`  Sample: $${sample.metadata?.amount || 'unknown'} - ${sample.residence ? 'Has Residence' : 'No Residence'} - ${sample.entries?.length || 0} entries`);
            }
        });
        
        // Check double-entry compliance
        let balanced = 0;
        let unbalanced = 0;
        
        transactions.forEach(t => {
            if (t.entries && t.entries.length >= 2) {
                const debits = t.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                const credits = t.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
                if (Math.abs(debits - credits) < 0.01) balanced++;
                else unbalanced++;
            }
        });
        
        console.log(`\n🔍 Double-Entry Status:`);
        console.log(`  Balanced: ${balanced}`);
        console.log(`  Unbalanced: ${unbalanced}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

checkTransactions();


























