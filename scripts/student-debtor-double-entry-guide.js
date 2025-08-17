const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Debtor = require('../src/models/Debtor');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await demonstrateStudentDebtorDoubleEntry();
});

async function demonstrateStudentDebtorDoubleEntry() {
    console.log('\n🎓 STUDENT DEBTOR DOUBLE-ENTRY ACCOUNTING GUIDE');
    console.log('================================================\n');

    try {
        // 1. Show current debtors
        console.log('📊 1. CURRENT DEBTORS ANALYSIS');
        console.log('==============================');
        
        const debtors = await Debtor.find({});
        console.log(`Found ${debtors.length} debtors`);
        
        debtors.forEach(debtor => {
            console.log(`  ${debtor.debtorCode}: ${debtor.contactInfo?.name || 'Unknown'}`);
            console.log(`    Current Balance: $${debtor.currentBalance.toFixed(2)}`);
            console.log(`    Total Owed: $${debtor.totalOwed.toFixed(2)}`);
            console.log(`    Total Paid: $${debtor.totalPaid.toFixed(2)}`);
            console.log('');
        });

        // 2. Demonstrate the double-entry accounting flow
        console.log('📋 2. DOUBLE-ENTRY ACCOUNTING FLOW FOR STUDENT DEBTORS');
        console.log('=======================================================');

        console.log('\n🎯 SCENARIO 1: STUDENT RENT INVOICE (CREATES DEBT)');
        console.log('===================================================');
        console.log('When a student is invoiced for rent:');
        console.log('  Dr. Accounts Receivable - Student: $500');
        console.log('  Cr. Rental Income: $500');
        console.log('  → Student owes money (becomes a debtor)');

        console.log('\n🎯 SCENARIO 2: STUDENT MAKES PAYMENT (SETTLES DEBT)');
        console.log('===================================================');
        console.log('When a student pays their rent:');
        console.log('  Dr. Bank/Cash: $500');
        console.log('  Cr. Accounts Receivable - Student: $500');
        console.log('  → Student debt is reduced');

        console.log('\n🎯 SCENARIO 3: STUDENT HAS OUTSTANDING DEBT');
        console.log('=============================================');
        console.log('Student owes $750 but pays $500:');
        console.log('  Dr. Bank/Cash: $500');
        console.log('  Cr. Accounts Receivable - Student: $500');
        console.log('  → Remaining debt: $250');

        // 3. Create example transactions
        console.log('\n🔧 3. CREATING EXAMPLE TRANSACTIONS');
        console.log('===================================');

        if (debtors.length > 0) {
            const exampleDebtor = debtors[0];
            console.log(`Using example debtor: ${exampleDebtor.debtorCode} - ${exampleDebtor.contactInfo?.name || 'Unknown'}`);

            // Get required accounts
            const accountsReceivable = await Account.findOne({ code: '1100' });
            const rentalIncome = await Account.findOne({ code: '4000' });
            const bankAccount = await Account.findOne({ code: '1000' });
            const cashAccount = await Account.findOne({ code: '1015' });

            if (!accountsReceivable || !rentalIncome || !bankAccount || !cashAccount) {
                console.log('❌ Missing required accounts');
                return;
            }

            // Example 1: Create rent invoice transaction
            console.log('\n📝 Example 1: Creating rent invoice transaction');
            await createRentInvoiceTransaction(exampleDebtor, 500, rentalIncome, accountsReceivable);

            // Example 2: Create payment transaction
            console.log('\n📝 Example 2: Creating payment transaction');
            await createStudentPaymentTransaction(exampleDebtor, 300, bankAccount, accountsReceivable);

            // Example 3: Create partial payment (student still owes money)
            console.log('\n📝 Example 3: Creating partial payment transaction');
            await createStudentPaymentTransaction(exampleDebtor, 200, cashAccount, accountsReceivable);

        } else {
            console.log('No debtors found to demonstrate with');
        }

        // 4. Show the proper implementation
        console.log('\n📋 4. PROPER IMPLEMENTATION GUIDE');
        console.log('==================================');

        console.log('\n🎯 WHEN TO CREATE DOUBLE-ENTRY TRANSACTIONS:');
        console.log('=============================================');
        console.log('1. When student is invoiced (creates debt)');
        console.log('2. When student makes payment (reduces debt)');
        console.log('3. When student has outstanding balance');
        console.log('4. When student pays late fees or penalties');

        console.log('\n🎯 ACCOUNT MAPPING:');
        console.log('===================');
        console.log('• Accounts Receivable (1100): Student debt');
        console.log('• Rental Income (4000): Income from rent');
        console.log('• Bank Account (1000): Cash received via bank');
        console.log('• Cash Account (1015): Cash received in person');

        console.log('\n🎯 TRANSACTION TYPES:');
        console.log('=====================');
        console.log('• Invoice: Dr. AR, Cr. Income');
        console.log('• Payment: Dr. Bank/Cash, Cr. AR');
        console.log('• Late Fee: Dr. AR, Cr. Other Income');
        console.log('• Refund: Dr. Income, Cr. Bank/Cash');

        // 5. Show current transaction state
        console.log('\n🔍 5. CURRENT TRANSACTION STATE');
        console.log('===============================');

        const allTransactions = await TransactionEntry.find({});
        console.log(`Total transactions: ${allTransactions.length}`);

        // Calculate current balances
        let totalAR = 0;
        let totalIncome = 0;
        let totalBank = 0;
        let totalCash = 0;

        allTransactions.forEach(entry => {
            entry.entries.forEach(accEntry => {
                if (accEntry.accountCode === '1100') {
                    totalAR += (accEntry.debit || 0) - (accEntry.credit || 0);
                } else if (accEntry.accountCode === '4000') {
                    totalIncome += (accEntry.credit || 0) - (accEntry.debit || 0);
                } else if (accEntry.accountCode === '1000') {
                    totalBank += (accEntry.debit || 0) - (accEntry.credit || 0);
                } else if (accEntry.accountCode === '1015') {
                    totalCash += (accEntry.debit || 0) - (accEntry.credit || 0);
                }
            });
        });

        console.log('\n📊 CURRENT ACCOUNT BALANCES:');
        console.log('============================');
        console.log(`Accounts Receivable: $${totalAR.toFixed(2)}`);
        console.log(`Rental Income: $${totalIncome.toFixed(2)}`);
        console.log(`Bank Account: $${totalBank.toFixed(2)}`);
        console.log(`Cash Account: $${totalCash.toFixed(2)}`);

        // 6. Final recommendations
        console.log('\n🎯 6. IMPLEMENTATION RECOMMENDATIONS');
        console.log('====================================');

        console.log('\n✅ DO:');
        console.log('=====');
        console.log('• Create transaction when student is invoiced');
        console.log('• Create transaction when student makes payment');
        console.log('• Use proper account codes (1100 for AR, 4000 for Income)');
        console.log('• Include detailed descriptions in transactions');
        console.log('• Link transactions to specific students/debtors');

        console.log('\n❌ DON\'T:');
        console.log('=========');
        console.log('• Skip transaction creation for payments');
        console.log('• Use wrong account codes');
        console.log('• Create unbalanced transactions');
        console.log('• Forget to update debtor balances');

        console.log('\n🔧 IMPLEMENTATION STEPS:');
        console.log('========================');
        console.log('1. Update payment controller to create transactions');
        console.log('2. Update invoice controller to create transactions');
        console.log('3. Ensure all student payments create proper double-entry');
        console.log('4. Test with sample data to verify balances');

        // 7. Show the actual implementation code
        console.log('\n💻 7. IMPLEMENTATION CODE EXAMPLES');
        console.log('==================================');

        console.log('\n📝 EXAMPLE: Creating rent invoice transaction');
        console.log('```javascript');
        console.log('// When student is invoiced for rent');
        console.log('const transactionEntry = new TransactionEntry({');
        console.log('  transactionId: generateTransactionId(),');
        console.log('  date: new Date(),');
        console.log('  description: `Rent Invoice: ${studentName}`,');
        console.log('  entries: [');
        console.log('    {');
        console.log('      accountCode: "1100", // Accounts Receivable');
        console.log('      debit: 500,');
        console.log('      credit: 0,');
        console.log('      description: "Rent owed by student"');
        console.log('    },');
        console.log('    {');
        console.log('      accountCode: "4000", // Rental Income');
        console.log('      debit: 0,');
        console.log('      credit: 500,');
        console.log('      description: "Rental income from student"');
        console.log('    }');
        console.log('  ],');
        console.log('  totalDebit: 500,');
        console.log('  totalCredit: 500,');
        console.log('  source: "invoice",');
        console.log('  sourceId: debtor._id,');
        console.log('  sourceModel: "Invoice"');
        console.log('});');
        console.log('```');

        console.log('\n📝 EXAMPLE: Creating payment transaction');
        console.log('```javascript');
        console.log('// When student makes payment');
        console.log('const transactionEntry = new TransactionEntry({');
        console.log('  transactionId: generateTransactionId(),');
        console.log('  date: new Date(),');
        console.log('  description: `Payment: ${studentName}`,');
        console.log('  entries: [');
        console.log('    {');
        console.log('      accountCode: "1000", // Bank Account');
        console.log('      debit: 500,');
        console.log('      credit: 0,');
        console.log('      description: "Payment received from student"');
        console.log('    },');
        console.log('    {');
        console.log('      accountCode: "1100", // Accounts Receivable');
        console.log('      debit: 0,');
        console.log('      credit: 500,');
        console.log('      description: "Settlement of student debt"');
        console.log('    }');
        console.log('  ],');
        console.log('  totalDebit: 500,');
        console.log('  totalCredit: 500,');
        console.log('  source: "payment",');
        console.log('  sourceId: debtor._id,');
        console.log('  sourceModel: "Payment"');
        console.log('});');
        console.log('```');

    } catch (error) {
        console.error('❌ Error during demonstration:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Student debtor double-entry guide completed');
    }
}

async function createRentInvoiceTransaction(debtor, amount, incomeAccount, arAccount) {
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const transactionEntry = new TransactionEntry({
        transactionId: transactionId,
        date: new Date(),
        description: `Rent Invoice: ${debtor.contactInfo?.name || debtor.debtorCode}`,
        reference: `INV-${debtor.debtorCode}`,
        entries: [
            {
                accountCode: arAccount.code,
                accountName: arAccount.name,
                accountType: arAccount.type,
                debit: amount,
                credit: 0,
                description: `Rent owed by ${debtor.contactInfo?.name || debtor.debtorCode}`
            },
            {
                accountCode: incomeAccount.code,
                accountName: incomeAccount.name,
                accountType: incomeAccount.type,
                debit: 0,
                credit: amount,
                description: `Rental income from ${debtor.contactInfo?.name || debtor.debtorCode}`
            }
        ],
        totalDebit: amount,
        totalCredit: amount,
        source: 'invoice',
        sourceId: debtor._id,
        sourceModel: 'Invoice',
        createdBy: 'system@demo.com',
        status: 'posted'
    });

    await transactionEntry.save();
    console.log(`  ✅ Created rent invoice transaction: $${amount}`);
    return transactionEntry;
}

async function createStudentPaymentTransaction(debtor, amount, paymentAccount, arAccount) {
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const transactionEntry = new TransactionEntry({
        transactionId: transactionId,
        date: new Date(),
        description: `Payment: ${debtor.contactInfo?.name || debtor.debtorCode}`,
        reference: `PAY-${debtor.debtorCode}`,
        entries: [
            {
                accountCode: paymentAccount.code,
                accountName: paymentAccount.name,
                accountType: paymentAccount.type,
                debit: amount,
                credit: 0,
                description: `Payment received from ${debtor.contactInfo?.name || debtor.debtorCode}`
            },
            {
                accountCode: arAccount.code,
                accountName: arAccount.name,
                accountType: arAccount.type,
                debit: 0,
                credit: amount,
                description: `Settlement of debt by ${debtor.contactInfo?.name || debtor.debtorCode}`
            }
        ],
        totalDebit: amount,
        totalCredit: amount,
        source: 'payment',
        sourceId: debtor._id,
        sourceModel: 'Payment',
        createdBy: 'system@demo.com',
        status: 'posted'
    });

    await transactionEntry.save();
    console.log(`  ✅ Created payment transaction: $${amount} via ${paymentAccount.name}`);
    return transactionEntry;
}

// Run the demonstration
console.log('🚀 Starting Student Debtor Double-Entry Guide...'); 