const mongoose = require('mongoose');

async function checkTenantDeposits() {
    try {
        console.log('🔍 Checking Tenant Deposits in TransactionEntry Collection...\n');
        
        // Connect to MongoDB
        await mongoose.connect('mongodb+srv://alamait:alamait123@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority');
        console.log('✅ Connected to MongoDB\n');
        
        // Check TransactionEntry collection for tenant deposit entries
        const TransactionEntry = mongoose.connection.db.collection('transactionentries');
        
        // Look for entries with account code 2020 (Tenant Deposits)
        const depositEntries = await TransactionEntry.find({
            'entries.accountCode': '2020'
        }).toArray();
        
        console.log(`📊 Found ${depositEntries.length} entries with Tenant Deposits (Account 2020)`);
        
        if (depositEntries.length > 0) {
            console.log('\n📋 Tenant Deposit Entries:');
            depositEntries.forEach((entry, index) => {
                console.log(`\nEntry ${index + 1}:`);
                console.log(`  Date: ${entry.date}`);
                console.log(`  Description: ${entry.description}`);
                console.log(`  Total Debit: ${entry.totalDebit}`);
                console.log(`  Total Credit: ${entry.totalCredit}`);
                
                if (entry.entries && Array.isArray(entry.entries)) {
                    entry.entries.forEach((subEntry, subIndex) => {
                        if (subEntry.accountCode === '2020') {
                            console.log(`  Sub-Entry ${subIndex + 1} (Tenant Deposits):`);
                            console.log(`    Debit: ${subEntry.debit}`);
                            console.log(`    Credit: ${subEntry.credit}`);
                            console.log(`    Description: ${subEntry.description}`);
                        }
                    });
                }
            });
        } else {
            console.log('\n⚠️  No tenant deposit entries found!');
            console.log('This means deposits from payments are not being recorded in the accounting system.');
        }
        
        // Check payments collection for deposits
        console.log('\n🔍 Checking Payments Collection for Deposits...');
        const payments = await mongoose.connection.db.collection('payments').find({}).toArray();
        
        let totalDeposits = 0;
        payments.forEach(payment => {
            if (payment.payments && Array.isArray(payment.payments)) {
                payment.payments.forEach(subPayment => {
                    if (subPayment.type === 'deposit') {
                        totalDeposits += subPayment.amount || 0;
                    }
                });
            }
        });
        
        console.log(`💰 Total deposits in payments: $${totalDeposits}`);
        
        if (totalDeposits > 0) {
            console.log('\n⚠️  Deposits exist in payments but not in accounting system!');
            console.log('We need to create accounting entries for these deposits.');
        }
        
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the check
checkTenantDeposits();
