const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');
require('dotenv').config();

// Vendor details
const VENDOR_ID = '689247eb0067f3f7098c4b78';
const VENDOR_CHART_CODE = '200009';
const VENDOR_NAME = 'Miccs Technologies';

// Sample transactions to create
const sampleTransactions = [
    {
        transactionId: `TXN${Date.now()}001`,
        date: new Date('2024-01-15'),
        description: 'IT Equipment Purchase - Laptops',
        reference: 'INV-2024-001',
        source: 'manual',
        sourceId: new mongoose.Types.ObjectId(),
        sourceModel: 'Manual',
        status: 'posted',
        createdBy: 'admin@alamait.com',
        entries: [
            {
                accountCode: '200009', // Vendor account (credit)
                accountName: `Accounts Payable - ${VENDOR_NAME}`,
                credit: 5000.00,
                debit: 0
            },
            {
                accountCode: '5000', // Equipment expense (debit)
                accountName: 'Equipment Expense',
                credit: 0,
                debit: 5000.00
            }
        ],
        totalDebit: 5000.00,
        totalCredit: 5000.00
    },
    {
        transactionId: `TXN${Date.now()}002`,
        date: new Date('2024-02-20'),
        description: 'Software License Renewal',
        reference: 'INV-2024-002',
        source: 'manual',
        sourceId: new mongoose.Types.ObjectId(),
        sourceModel: 'Manual',
        status: 'posted',
        createdBy: 'admin@alamait.com',
        entries: [
            {
                accountCode: '200009', // Vendor account (credit)
                accountName: `Accounts Payable - ${VENDOR_NAME}`,
                credit: 1200.00,
                debit: 0
            },
            {
                accountCode: '5013', // Other expenses (debit)
                accountName: 'Other Expenses',
                credit: 0,
                debit: 1200.00
            }
        ],
        totalDebit: 1200.00,
        totalCredit: 1200.00
    },
    {
        transactionId: `TXN${Date.now()}003`,
        date: new Date('2024-03-10'),
        description: 'Payment to Miccs Technologies',
        reference: 'PAY-2024-001',
        source: 'vendor_payment',
        sourceId: new mongoose.Types.ObjectId(),
        sourceModel: 'Vendor',
        status: 'posted',
        createdBy: 'admin@alamait.com',
        entries: [
            {
                accountCode: '200009', // Vendor account (debit - reducing payable)
                accountName: `Accounts Payable - ${VENDOR_NAME}`,
                credit: 0,
                debit: 3000.00
            },
            {
                accountCode: '1000', // Bank account (credit)
                accountName: 'Bank Account',
                credit: 3000.00,
                debit: 0
            }
        ],
        totalDebit: 3000.00,
        totalCredit: 3000.00
    },
    {
        transactionId: `TXN${Date.now()}004`,
        date: new Date('2024-04-05'),
        description: 'Network Maintenance Services',
        reference: 'INV-2024-003',
        source: 'manual',
        sourceId: new mongoose.Types.ObjectId(),
        sourceModel: 'Manual',
        status: 'posted',
        createdBy: 'admin@alamait.com',
        entries: [
            {
                accountCode: '200009', // Vendor account (credit)
                accountName: `Accounts Payable - ${VENDOR_NAME}`,
                credit: 800.00,
                debit: 0
            },
            {
                accountCode: '5013', // Other expenses (debit)
                accountName: 'Other Expenses',
                credit: 0,
                debit: 800.00
            }
        ],
        totalDebit: 800.00,
        totalCredit: 800.00
    },
    {
        transactionId: `TXN${Date.now()}005`,
        date: new Date('2024-05-12'),
        description: 'Final Payment to Miccs Technologies',
        reference: 'PAY-2024-002',
        source: 'vendor_payment',
        sourceId: new mongoose.Types.ObjectId(),
        sourceModel: 'Vendor',
        status: 'posted',
        createdBy: 'admin@alamait.com',
        entries: [
            {
                accountCode: '200009', // Vendor account (debit - reducing payable)
                accountName: `Accounts Payable - ${VENDOR_NAME}`,
                credit: 0,
                debit: 4000.00
            },
            {
                accountCode: '1000', // Bank account (credit)
                accountName: 'Bank Account',
                credit: 4000.00,
                debit: 0
            }
        ],
        totalDebit: 4000.00,
        totalCredit: 4000.00
    }
];

async function createVendorTransactions() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('Connected to MongoDB');

        console.log(`Creating transactions for vendor: ${VENDOR_NAME} (ID: ${VENDOR_ID})`);
        console.log(`Chart of Accounts Code: ${VENDOR_CHART_CODE}`);
        console.log('=' .repeat(60));

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < sampleTransactions.length; i++) {
            const transactionData = sampleTransactions[i];
            console.log(`\nCreating transaction ${i + 1}/${sampleTransactions.length}:`);
            console.log(`- Date: ${transactionData.date.toDateString()}`);
            console.log(`- Description: ${transactionData.description}`);
            console.log(`- Reference: ${transactionData.reference}`);
            console.log(`- Amount: $${transactionData.entries[0].credit || transactionData.entries[0].debit}`);

            try {
                const transaction = new TransactionEntry(transactionData);
                await transaction.save();
                console.log(`✅ Transaction created successfully (ID: ${transaction._id})`);
                successCount++;
            } catch (error) {
                console.log(`❌ Failed to create transaction: ${error.message}`);
                errorCount++;
            }
        }

        console.log('\n' + '=' .repeat(60));
        console.log(`SUMMARY:`);
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${errorCount}`);
        console.log(`📊 Total: ${sampleTransactions.length}`);

        if (successCount > 0) {
            console.log(`\n🎉 Created ${successCount} transactions for ${VENDOR_NAME}!`);
            console.log(`Now you can view the ledger tab to see these transactions.`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the script
createVendorTransactions(); 