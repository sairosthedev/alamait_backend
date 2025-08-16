const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkActualFinancialData() {
    try {
        await mongoose.connect('mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');

        // 1. Check debtors collection
        console.log('\n🔍 1. CHECKING DEBTORS COLLECTION...');
        const debtors = await mongoose.connection.db
            .collection('debtors')
            .find({}).toArray();
        console.log(`Total debtors: ${debtors.length}`);
        
        if (debtors.length > 0) {
            console.log('Sample debtor:', {
                studentName: debtors[0].studentName,
                amount: debtors[0].amount,
                dueDate: debtors[0].dueDate,
                status: debtors[0].status
            });
        }

        // 2. Check transaction entries for income/revenue
        console.log('\n🔍 2. CHECKING TRANSACTION ENTRIES FOR INCOME...');
        const incomeEntries = await TransactionEntry.find({
            'entries.accountCode': { $in: ['4000', '4100'] } // Rental Income and Admin Income
        });
        console.log(`Income transaction entries: ${incomeEntries.length}`);
        
        if (incomeEntries.length > 0) {
            console.log('Sample income entry:', {
                date: incomeEntries[0].date,
                source: incomeEntries[0].source,
                entries: incomeEntries[0].entries?.map(e => ({
                    accountCode: e.accountCode,
                    accountName: e.accountName,
                    debit: e.debit,
                    credit: e.credit
                }))
            });
        }

        // 3. Check payments collection
        console.log('\n🔍 3. CHECKING PAYMENTS COLLECTION...');
        const payments = await mongoose.connection.db
            .collection('payments')
            .find({}).toArray();
        console.log(`Total payments: ${payments.length}`);
        
        if (payments.length > 0) {
            console.log('Sample payment:', {
                amount: payments[0].amount,
                date: payments[0].date,
                status: payments[0].status,
                type: payments[0].type
            });
        }

        // 4. Check expenses collection
        console.log('\n🔍 4. CHECKING EXPENSES COLLECTION...');
        const expenses = await mongoose.connection.db
            .collection('expenses')
            .find({}).toArray();
        console.log(`Total expenses: ${expenses.length}`);
        
        if (expenses.length > 0) {
            console.log('Sample expense:', {
                amount: expenses[0].amount,
                date: expenses[0].date,
                status: expenses[0].status,
                description: expenses[0].description
            });
        }

        // 5. Check for any revenue in transaction entries by account type
        console.log('\n🔍 5. CHECKING TRANSACTION ENTRIES BY ACCOUNT TYPE...');
        const revenueEntries = await TransactionEntry.find({
            'entries.accountType': 'Income'
        });
        console.log(`Revenue entries (accountType: Income): ${revenueEntries.length}`);
        
        const expenseEntries = await TransactionEntry.find({
            'entries.accountType': 'Expense'
        });
        console.log(`Expense entries (accountType: Expense): ${expenseEntries.length}`);

        // 6. Check for specific account codes that should have revenue
        console.log('\n🔍 6. CHECKING SPECIFIC REVENUE ACCOUNT CODES...');
        const rentalIncomeEntries = await TransactionEntry.find({
            'entries.accountCode': '4000'
        });
        console.log(`Rental Income entries (4000): ${rentalIncomeEntries.length}`);
        
        const adminIncomeEntries = await TransactionEntry.find({
            'entries.accountCode': '4100'
        });
        console.log(`Admin Income entries (4100): ${adminIncomeEntries.length}`);

        // 7. Check what's actually in the database for August 2025
        console.log('\n🔍 7. CHECKING AUGUST 2025 DATA...');
        const august2025Start = new Date(2025, 7, 1); // August 1, 2025
        const august2025End = new Date(2025, 7, 31);  // August 31, 2025
        
        const augustTransactions = await TransactionEntry.find({
            date: { $gte: august2025Start, $lte: august2025End }
        });
        console.log(`August 2025 transactions: ${augustTransactions.length}`);
        
        if (augustTransactions.length > 0) {
            console.log('Sample August transaction:', {
                date: augustTransactions[0].date,
                source: augustTransactions[0].source,
                entries: augustTransactions[0].entries?.length || 0
            });
        }

        // 8. Check if there are any students with active leases in August
        console.log('\n🔍 8. CHECKING STUDENTS WITH ACTIVE LEASES IN AUGUST...');
        const activeStudents = await mongoose.connection.db
            .collection('applications')
            .find({
                status: 'approved',
                startDate: { $lte: august2025End },
                endDate: { $gte: august2025Start },
                paymentStatus: { $ne: 'cancelled' }
            }).toArray();
        console.log(`Students with active leases in August 2025: ${activeStudents.length}`);
        
        if (activeStudents.length > 0) {
            console.log('Sample active student:', {
                name: `${activeStudents[0].firstName} ${activeStudents[0].lastName}`,
                startDate: activeStudents[0].startDate,
                endDate: activeStudents[0].endDate,
                residence: activeStudents[0].residence,
                allocatedRoom: activeStudents[0].allocatedRoom
            });
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed');
    }
}

checkActualFinancialData();
