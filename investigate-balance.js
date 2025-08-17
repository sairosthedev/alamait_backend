require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function investigateBalance() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔍 Investigating Balance Sheet Discrepancy...');

        // Check all TransactionEntry records
        const allEntries = await TransactionEntry.find({}).sort({ date: 1 });
        console.log(`\n📊 Total TransactionEntry records: ${allEntries.length}`);

        // Breakdown by type
        console.log('\n📊 Breakdown by type:');
        const typeCounts = {};
        allEntries.forEach(entry => {
            const type = entry.metadata?.type || 'unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        
        Object.entries(typeCounts).forEach(([type, count]) => {
            console.log(`  ${type}: ${count} entries`);
        });

        // Check unknown entries
        const unknownEntries = await TransactionEntry.find({ 'metadata.type': { $exists: false } });
        console.log(`\n🔍 Found ${unknownEntries.length} entries without metadata.type`);
        
        if (unknownEntries.length > 0) {
            console.log('\n📋 Sample unknown entries:');
            unknownEntries.slice(0, 3).forEach((entry, i) => {
                console.log(`\nEntry ${i + 1}:`);
                console.log(`  ID: ${entry._id}`);
                console.log(`  Date: ${entry.date}`);
                console.log(`  Description: ${entry.description}`);
                console.log(`  Total Debit: ${entry.totalDebit}`);
                console.log(`  Total Credit: ${entry.totalCredit}`);
                if (entry.entries && entry.entries.length > 0) {
                    console.log(`  Sub-entries: ${entry.entries.length}`);
                    entry.entries.forEach((subEntry, j) => {
                        console.log(`    ${j + 1}. ${subEntry.accountCode} - ${subEntry.accountName}: Debit ${subEntry.debit}, Credit ${subEntry.credit}`);
                    });
                }
            });
        }

        // Check for entries with specific account codes that might be causing issues
        console.log('\n🔍 Checking specific account balances:');
        
        const bankEntries = await TransactionEntry.find({ 'entries.accountCode': '1001' });
        console.log(`Bank Account (1001) entries: ${bankEntries.length}`);
        
        const receivableEntries = await TransactionEntry.find({ 'entries.accountCode': '1100' });
        console.log(`Accounts Receivable (1100) entries: ${receivableEntries.length}`);
        
        const adminIncomeEntries = await TransactionEntry.find({ 'entries.accountCode': '4100' });
        console.log(`Admin Income (4100) entries: ${adminIncomeEntries.length}`);
        
        const rentalIncomeEntries = await TransactionEntry.find({ 'entries.accountCode': '4000' });
        console.log(`Rental Income (4000) entries: ${rentalIncomeEntries.length}`);

        // Calculate total debits and credits
        let totalDebits = 0;
        let totalCredits = 0;
        
        allEntries.forEach(entry => {
            totalDebits += entry.totalDebit || 0;
            totalCredits += entry.totalCredit || 0;
        });
        
        console.log(`\n📊 Total Debits: $${totalDebits.toLocaleString()}`);
        console.log(`📊 Total Credits: $${totalCredits.toLocaleString()}`);
        console.log(`📊 Net Difference: $${(totalCredits - totalDebits).toLocaleString()}`);

        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error investigating balance:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

// Run the investigation
investigateBalance();


