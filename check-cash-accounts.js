require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkCashAccounts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔍 Checking Cash Account Balances...');

        const monthEnd = new Date(2025, 11, 31);
        console.log(`\n📅 As of: ${monthEnd.toDateString()}`);

        // Check each cash account individually
        const cashAccounts = [
            { code: '1001', name: 'Bank Account' },
            { code: '1002', name: 'Ecocash' },
            { code: '1003', name: 'Innbucks' },
            { code: '1004', name: 'Petty Cash' },
            { code: '1005', name: 'Cash on Hand' },
            { code: '1011', name: 'Admin Petty Cash' }
        ];

        let totalCash = 0;

        for (const account of cashAccounts) {
            // Find all entries with this account code
            const entries = await TransactionEntry.find({
                'entries.accountCode': account.code,
                status: 'posted'
            });

            let balance = 0;
            let debits = 0;
            let credits = 0;

            entries.forEach(entry => {
                if (entry.entries && Array.isArray(entry.entries)) {
                    entry.entries.forEach(subEntry => {
                        if (subEntry.accountCode === account.code) {
                            debits += subEntry.debit || 0;
                            credits += subEntry.credit || 0;
                        }
                    });
                }
            });

            // For asset accounts, balance = debits - credits
            balance = debits - credits;
            totalCash += balance;

            console.log(`\n📊 ${account.name} (${account.code}):`);
            console.log(`  Debits: $${debits.toLocaleString()}`);
            console.log(`  Credits: $${credits.toLocaleString()}`);
            console.log(`  Balance: $${balance.toLocaleString()}`);

            // Show sample entries
            if (entries.length > 0) {
                console.log(`  Sample entries: ${entries.length} total`);
                entries.slice(0, 2).forEach((entry, i) => {
                    console.log(`    ${i + 1}. ${entry.description} - $${entry.totalDebit}`);
                });
            }
        }

        console.log(`\n💰 TOTAL CASH CALCULATED: $${totalCash.toLocaleString()}`);

        // Now check what the getAccountBalance method returns
        console.log('\n🔍 Comparing with getAccountBalance method...');
        const AccountingService = require('./src/services/accountingService');
        
        for (const account of cashAccounts) {
            const balance = await AccountingService.getAccountBalance(account.code, monthEnd);
            console.log(`  ${account.name} (${account.code}): $${balance.toLocaleString()}`);
        }

        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

checkCashAccounts();

