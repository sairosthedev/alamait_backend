/**
 * Test Script for Double-Entry Accounting System
 * 
 * This script demonstrates all the accounting scenarios:
 * 1. Maintenance Request Approval (Accrual Basis)
 * 2. Vendor Payment (Cash Basis)
 * 3. Supply Purchase Approval (Accrual Basis)
 * 4. Student Rent Payment (Cash Basis - No Invoice)
 * 5. Invoice Issuance (Accrual Basis)
 * 6. Invoice Payment (Cash Basis)
 * 
 * Usage: node src/scripts/testDoubleEntryAccounting.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const DoubleEntryAccountingService = require('../services/doubleEntryAccountingService');
const Account = require('../models/Account');
const connectDB = require('../config/database');

console.log('🧪 Starting Double-Entry Accounting Test...\n');

// Test data
const testData = {
    user: {
        _id: new mongoose.Types.ObjectId(),
        email: 'finance@alamait.com',
        firstName: 'Finance',
        lastName: 'User'
    },
    residence: {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Residence'
    },
    vendor: {
        _id: new mongoose.Types.ObjectId(),
        name: 'Gift Plumber',
        code: 'V001'
    },
    student: {
        _id: new mongoose.Types.ObjectId(),
        firstName: 'John',
        lastName: 'Doe'
    }
};

async function initializeChartOfAccounts() {
    console.log('📊 Initializing Chart of Accounts...');
    
    const accounts = [
        // Assets
        { code: '1001', name: 'Bank Account', type: 'Asset', category: 'Current Assets' },
        { code: '1002', name: 'Cash on Hand', type: 'Asset', category: 'Current Assets' },
        { code: '1003', name: 'Ecocash Wallet', type: 'Asset', category: 'Current Assets' },
        { code: '1004', name: 'Innbucks Wallet', type: 'Asset', category: 'Current Assets' },
        { code: '1101', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets' },
        
        // Liabilities
        { code: '2001', name: 'Accounts Payable: Gift Plumber', type: 'Liability', category: 'Current Liabilities' },
        
        // Income
        { code: '4001', name: 'Rent Income', type: 'Income', category: 'Operating Revenue' },
        
        // Expenses
        { code: '5001', name: 'Maintenance Expense', type: 'Expense', category: 'Operating Expenses' },
        { code: '5002', name: 'Supplies Expense', type: 'Expense', category: 'Operating Expenses' }
    ];

    for (const accountData of accounts) {
        let account = await Account.findOne({ code: accountData.code });
        if (!account) {
            account = new Account(accountData);
            await account.save();
            console.log(`✅ Created account: ${accountData.code} - ${accountData.name}`);
        }
    }
    
    console.log('✅ Chart of Accounts initialized\n');
}

async function testMaintenanceRequestApproval() {
    console.log('🏗️ Testing Maintenance Request Approval (Accrual Basis)...');
    
    const request = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Plumbing Repair - Leaking Pipe',
        residence: testData.residence,
        items: [{
            description: 'Fix leaking pipe in bathroom',
            quotations: [{
                provider: 'Gift Plumber',
                amount: 100,
                vendorId: testData.vendor._id,
                isSelected: true
            }]
        }]
    };

    try {
        const result = await DoubleEntryAccountingService.recordMaintenanceApproval(request, testData.user);
        
        console.log('✅ Maintenance approval recorded:');
        console.log(`   Transaction ID: ${result.transaction.transactionId}`);
        console.log(`   Type: ${result.transaction.type}`);
        console.log(`   Amount: $${result.transaction.amount}`);
        console.log(`   Description: ${result.transaction.description}`);
        
        // Show double-entry entries
        console.log('   Double-Entry Entries:');
        result.transactionEntry.entries.forEach(entry => {
            if (entry.debit > 0) {
                console.log(`   Dr. ${entry.accountName} (${entry.accountCode}) $${entry.debit}`);
            } else {
                console.log(`   Cr. ${entry.accountName} (${entry.accountCode}) $${entry.credit}`);
            }
        });
        
        return result;
    } catch (error) {
        console.error('❌ Error in maintenance approval test:', error.message);
        throw error;
    }
}

async function testVendorPayment() {
    console.log('\n💳 Testing Vendor Payment (Cash Basis)...');
    
    const expense = {
        _id: new mongoose.Types.ObjectId(),
        vendorId: testData.vendor._id,
        vendorName: 'Gift Plumber',
        residence: testData.residence,
        items: [{
            description: 'Fix leaking pipe in bathroom',
            totalCost: 100,
            paymentStatus: 'Paid'
        }]
    };

    try {
        const result = await DoubleEntryAccountingService.recordVendorPayment(expense, testData.user, 'Ecocash');
        
        console.log('✅ Vendor payment recorded:');
        console.log(`   Transaction ID: ${result.transaction.transactionId}`);
        console.log(`   Type: ${result.transaction.type}`);
        console.log(`   Amount: $${result.transaction.amount}`);
        console.log(`   Description: ${result.transaction.description}`);
        
        // Show double-entry entries
        console.log('   Double-Entry Entries:');
        result.transactionEntry.entries.forEach(entry => {
            if (entry.debit > 0) {
                console.log(`   Dr. ${entry.accountName} (${entry.accountCode}) $${entry.debit}`);
            } else {
                console.log(`   Cr. ${entry.accountName} (${entry.accountCode}) $${entry.credit}`);
            }
        });
        
        return result;
    } catch (error) {
        console.error('❌ Error in vendor payment test:', error.message);
        throw error;
    }
}

async function testSupplyPurchaseApproval() {
    console.log('\n📦 Testing Supply Purchase Approval (Accrual Basis)...');
    
    const request = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Office Supplies Purchase',
        residence: testData.residence,
        items: [{
            description: 'Printer paper and ink cartridges',
            quotations: [{
                provider: 'Office Supplies Co',
                amount: 150,
                vendorId: new mongoose.Types.ObjectId(),
                isSelected: true
            }]
        }]
    };

    try {
        const result = await DoubleEntryAccountingService.recordSupplyPurchaseApproval(request, testData.user);
        
        console.log('✅ Supply purchase approval recorded:');
        console.log(`   Transaction ID: ${result.transaction.transactionId}`);
        console.log(`   Type: ${result.transaction.type}`);
        console.log(`   Amount: $${result.transaction.amount}`);
        console.log(`   Description: ${result.transaction.description}`);
        
        // Show double-entry entries
        console.log('   Double-Entry Entries:');
        result.transactionEntry.entries.forEach(entry => {
            if (entry.debit > 0) {
                console.log(`   Dr. ${entry.accountName} (${entry.accountCode}) $${entry.debit}`);
            } else {
                console.log(`   Cr. ${entry.accountName} (${entry.accountCode}) $${entry.credit}`);
            }
        });
        
        return result;
    } catch (error) {
        console.error('❌ Error in supply purchase test:', error.message);
        throw error;
    }
}

async function testStudentRentPayment() {
    console.log('\n💰 Testing Student Rent Payment (Cash Basis - No Invoice)...');
    
    const payment = {
        _id: new mongoose.Types.ObjectId(),
        student: testData.student,
        residence: testData.residence,
        totalAmount: 500,
        method: 'Bank Transfer',
        date: new Date()
    };

    try {
        const result = await DoubleEntryAccountingService.recordStudentRentPayment(payment, testData.user);
        
        console.log('✅ Student rent payment recorded:');
        console.log(`   Transaction ID: ${result.transaction.transactionId}`);
        console.log(`   Type: ${result.transaction.type}`);
        console.log(`   Amount: $${result.transaction.amount}`);
        console.log(`   Description: ${result.transaction.description}`);
        
        // Show double-entry entries
        console.log('   Double-Entry Entries:');
        result.transactionEntry.entries.forEach(entry => {
            if (entry.debit > 0) {
                console.log(`   Dr. ${entry.accountName} (${entry.accountCode}) $${entry.debit}`);
            } else {
                console.log(`   Cr. ${entry.accountName} (${entry.accountCode}) $${entry.credit}`);
            }
        });
        
        return result;
    } catch (error) {
        console.error('❌ Error in student rent payment test:', error.message);
        throw error;
    }
}

async function testInvoiceIssuance() {
    console.log('\n🧾 Testing Invoice Issuance (Accrual Basis)...');
    
    const invoice = {
        _id: new mongoose.Types.ObjectId(),
        student: testData.student,
        residence: testData.residence,
        totalAmount: 600,
        invoiceNumber: 'INV-2024-0001'
    };

    try {
        const result = await DoubleEntryAccountingService.recordInvoiceIssuance(invoice, testData.user);
        
        console.log('✅ Invoice issuance recorded:');
        console.log(`   Transaction ID: ${result.transaction.transactionId}`);
        console.log(`   Type: ${result.transaction.type}`);
        console.log(`   Amount: $${result.transaction.amount}`);
        console.log(`   Description: ${result.transaction.description}`);
        
        // Show double-entry entries
        console.log('   Double-Entry Entries:');
        result.transactionEntry.entries.forEach(entry => {
            if (entry.debit > 0) {
                console.log(`   Dr. ${entry.accountName} (${entry.accountCode}) $${entry.debit}`);
            } else {
                console.log(`   Cr. ${entry.accountName} (${entry.accountCode}) $${entry.credit}`);
            }
        });
        
        return result;
    } catch (error) {
        console.error('❌ Error in invoice issuance test:', error.message);
        throw error;
    }
}

async function testInvoicePayment() {
    console.log('\n💳 Testing Invoice Payment (Cash Basis)...');
    
    const invoice = {
        _id: new mongoose.Types.ObjectId(),
        student: testData.student,
        residence: testData.residence,
        totalAmount: 600
    };

    const paymentRecord = {
        amount: 600,
        paymentMethod: 'Ecocash',
        paymentDate: new Date()
    };

    try {
        const result = await DoubleEntryAccountingService.recordInvoicePayment(invoice, paymentRecord, testData.user);
        
        console.log('✅ Invoice payment recorded:');
        console.log(`   Transaction ID: ${result.transaction.transactionId}`);
        console.log(`   Type: ${result.transaction.type}`);
        console.log(`   Amount: $${result.transaction.amount}`);
        console.log(`   Description: ${result.transaction.description}`);
        
        // Show double-entry entries
        console.log('   Double-Entry Entries:');
        result.transactionEntry.entries.forEach(entry => {
            if (entry.debit > 0) {
                console.log(`   Dr. ${entry.accountName} (${entry.accountCode}) $${entry.debit}`);
            } else {
                console.log(`   Cr. ${entry.accountName} (${entry.accountCode}) $${entry.credit}`);
            }
        });
        
        return result;
    } catch (error) {
        console.error('❌ Error in invoice payment test:', error.message);
        throw error;
    }
}

async function testAccountingBasisFiltering() {
    console.log('\n📊 Testing Accounting Basis Filtering...');
    
    try {
        // Test Cash Basis (should only show payments)
        const cashTransactions = await DoubleEntryAccountingService.getTransactionsByBasis('cash', {
            dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            dateTo: new Date()
        });
        
        console.log('✅ Cash Basis Transactions:');
        console.log(`   Total transactions: ${cashTransactions.length}`);
        cashTransactions.forEach(txn => {
            console.log(`   - ${txn.type}: ${txn.description} ($${txn.amount})`);
        });
        
        // Test Accrual Basis (should show both approvals and payments)
        const accrualTransactions = await DoubleEntryAccountingService.getTransactionsByBasis('accrual', {
            dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            dateTo: new Date()
        });
        
        console.log('\n✅ Accrual Basis Transactions:');
        console.log(`   Total transactions: ${accrualTransactions.length}`);
        accrualTransactions.forEach(txn => {
            console.log(`   - ${txn.type}: ${txn.description} ($${txn.amount})`);
        });
        
    } catch (error) {
        console.error('❌ Error in accounting basis filtering test:', error.message);
        throw error;
    }
}

async function runAllTests() {
    let connection;
    try {
        // Connect to database
        console.log('🔌 Connecting to MongoDB...');
        connection = await connectDB();
        console.log('✅ Connected to MongoDB\n');

        // Initialize chart of accounts
        await initializeChartOfAccounts();

        // Run all tests
        await testMaintenanceRequestApproval();
        await testVendorPayment();
        await testSupplyPurchaseApproval();
        await testStudentRentPayment();
        await testInvoiceIssuance();
        await testInvoicePayment();
        await testAccountingBasisFiltering();

        console.log('\n🎉 All tests completed successfully!');
        console.log('\n📋 Summary:');
        console.log('✅ Maintenance Request Approval (Accrual Basis)');
        console.log('✅ Vendor Payment (Cash Basis)');
        console.log('✅ Supply Purchase Approval (Accrual Basis)');
        console.log('✅ Student Rent Payment (Cash Basis)');
        console.log('✅ Invoice Issuance (Accrual Basis)');
        console.log('✅ Invoice Payment (Cash Basis)');
        console.log('✅ Accounting Basis Filtering');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        // Disconnect from database
        try {
            if (connection) {
                console.log('\n🔌 Disconnecting from MongoDB...');
                await mongoose.disconnect();
                console.log('✅ Disconnected from MongoDB');
            }
        } catch (err) {
            console.error('❌ Error disconnecting from MongoDB:', err);
        }
        process.exit(0);
    }
}

// Run the tests
runAllTests(); 