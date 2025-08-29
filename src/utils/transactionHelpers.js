const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Vendor = require('../models/Vendor');
const Account = require('../models/Account');
const mongoose = require('mongoose');

// Import dynamic account resolver
const DynamicAccountResolver = require('./dynamicAccountResolver');

// Legacy mapping for backward compatibility (will be deprecated)
const PAYMENT_METHOD_TO_ACCOUNT_CODE = {
    'Bank Transfer': '1001',  // Bank Account
    'Cash': '1000',           // Cash (corrected from 1002)
    'Online Payment': '1001', // Bank Account
    'Ecocash': '1003',        // Ecocash Wallet
    'Innbucks': '1004',       // Innbucks Wallet
    'MasterCard': '1001',     // Bank Account
    'Visa': '1001',          // Bank Account
    'PayPal': '1001',        // Bank Account
    'Petty Cash': '1000'     // Cash (corrected from 1002)
};

// Category to account code mapping (updated to match chart of accounts)
const CATEGORY_TO_ACCOUNT_CODE = {
    'Maintenance': '5003', // Transportation Expense (for maintenance)
    'Utilities': '5001',   // Utilities - Water (for utilities)
    'Water': '5001',       // Utilities - Water (specific for water)
    'Taxes': '5099',       // Other Operating Expenses (for taxes)
    'Insurance': '5099',   // Other Operating Expenses (for insurance)
    'Salaries': '5099',    // Other Operating Expenses (for salaries)
    'Supplies': '5099',    // Other Operating Expenses (for supplies)
    'Other': '5099'        // Other Operating Expenses (fallback)
};

// Create transaction when request is approved (creates expense)
exports.createApprovalTransaction = async (request, user) => {
    try {
        const entries = [];
        let totalAmount = 0;
        
        // Calculate total from selected quotes
        request.items.forEach(item => {
            const selectedQuote = item.quotations.find(q => q.isSelected);
            if (selectedQuote) {
                totalAmount += selectedQuote.amount;
            } else {
                totalAmount += (item.quantity * item.unitCost);
            }
        });

        // Get vendor from first selected quote
        const firstItem = request.items.find(item => 
            item.quotations.some(q => q.isSelected)
        );
        
        if (!firstItem) {
            throw new Error('No selected quotes found');
        }

        const selectedQuote = firstItem.quotations.find(q => q.isSelected);
        const vendor = await Vendor.findById(selectedQuote.vendorId);
        
        if (!vendor) {
            throw new Error('Vendor not found');
        }

        // Create expense entry
        const expenseEntry = new TransactionEntry({
            account: vendor.expenseAccountCode,
            debit: totalAmount,
            credit: 0,
            type: 'expense'
        });
        await expenseEntry.save();
        entries.push(expenseEntry._id);

        // Create liability entry (Accounts Payable)
        const liabilityEntry = new TransactionEntry({
            account: vendor.chartOfAccountsCode,
            debit: 0,
            credit: totalAmount,
            type: 'liability'
        });
        await liabilityEntry.save();
        entries.push(liabilityEntry._id);

        // Update vendor balance
        vendor.currentBalance += totalAmount;
        await vendor.save();

        // Create transaction
        const transaction = new Transaction({
            date: new Date(),
            description: `${request.title} - ${vendor.businessName}`,
            reference: `REQ-${request._id}`,
            residence: request.residence,
            entries
        });

        return await transaction.save();
    } catch (error) {
        console.error('Error creating approval transaction:', error);
        throw error;
    }
};

// Create transaction when expense is marked as paid
exports.createExpensePaymentTransaction = async (expense, user, paymentMethod = 'Bank Transfer') => {
    try {
        const entries = [];

        // Get vendor if this expense is linked to a vendor
        let vendor = null;
        if (expense.vendorId) {
            vendor = await Vendor.findById(expense.vendorId);
        }

        // Determine source account based on payment method using dynamic resolver
        let sourceAccount = await DynamicAccountResolver.getPaymentSourceAccount(paymentMethod);
        
        // Fallback to legacy mapping if dynamic resolver fails
        if (!sourceAccount) {
            console.log(`⚠️  Dynamic resolver failed for ${paymentMethod}, trying legacy mapping...`);
            const sourceAccountCode = PAYMENT_METHOD_TO_ACCOUNT_CODE[paymentMethod] || '1001';
            sourceAccount = await Account.findOne({ code: sourceAccountCode });
        }
        
        if (!sourceAccount) {
            throw new Error(`Source account not found for payment method: ${paymentMethod}. Please ensure you have a suitable asset account (bank, cash, etc.) in your chart of accounts.`);
        }

        // Get expense account using dynamic resolver
        let expenseAccount = await DynamicAccountResolver.getExpenseAccount(expense.category);
        
        // Fallback to legacy mapping if dynamic resolver fails
        if (!expenseAccount) {
            console.log(`⚠️  Dynamic resolver failed for category ${expense.category}, trying legacy mapping...`);
            const expenseAccountCode = CATEGORY_TO_ACCOUNT_CODE[expense.category] || '5099'; // Default to Other Operating Expenses
            expenseAccount = await Account.findOne({ 
                code: expenseAccountCode, 
                type: 'Expense' 
            });
        }
        
        if (!expenseAccount) {
            throw new Error(`Expense account not found for category: ${expense.category}. Please ensure you have a suitable expense account in your chart of accounts.`);
        }

        // If vendor exists, debit their Accounts Payable account
        if (vendor) {
            // Debit Accounts Payable (reduce liability)
            const liabilityEntry = new TransactionEntry({
                account: vendor.chartOfAccountsCode,
                debit: expense.amount,
                credit: 0,
                type: 'liability'
            });
            await liabilityEntry.save();
            entries.push(liabilityEntry._id);

            // Update vendor balance
            vendor.currentBalance -= expense.amount;
            await vendor.save();
        } else {
            // Direct expense payment (no vendor)
            const expenseEntry = new TransactionEntry({
                account: expenseAccount._id,
                debit: expense.amount,
                credit: 0,
                type: 'expense'
            });
            await expenseEntry.save();
            entries.push(expenseEntry._id);
        }

        // Credit source account (reduce asset)
        const sourceEntry = new TransactionEntry({
            account: sourceAccount._id,
            debit: 0,
            credit: expense.amount,
            type: sourceAccount.type.toLowerCase()
        });
        await sourceEntry.save();
        entries.push(sourceEntry._id);

        // Create transaction
        const transaction = new Transaction({
            date: new Date(),
            description: `Payment: ${expense.description}${vendor ? ` - ${vendor.businessName}` : ''}`,
            reference: expense.expenseId,
            residence: expense.residence,
            entries
        });

        return await transaction.save();
    } catch (error) {
        console.error('Error creating expense payment transaction:', error);
        throw error;
    }
};

// Create transaction when payment is processed directly
exports.createPaymentTransaction = async (payment, user) => {
    try {
        const vendor = await Vendor.findById(payment.vendorId);
        if (!vendor) {
            throw new Error('Vendor not found');
        }

        const entries = [];

        // Determine source account based on payment method
        let sourceAccount;
        const sourceAccountCode = PAYMENT_METHOD_TO_ACCOUNT_CODE[payment.paymentMethod] || '1000';
        sourceAccount = await Account.findOne({ code: sourceAccountCode });
        
        if (!sourceAccount) {
            throw new Error(`Source account not found for payment method: ${payment.paymentMethod}`);
        }

        // Debit Accounts Payable (reduce liability)
        const liabilityEntry = new TransactionEntry({
            account: vendor.chartOfAccountsCode,
            debit: payment.amount,
            credit: 0,
            type: 'liability'
        });
        await liabilityEntry.save();
        entries.push(liabilityEntry._id);

        // Credit source account (reduce asset)
        const sourceEntry = new TransactionEntry({
            account: sourceAccount._id,
            debit: 0,
            credit: payment.amount,
            type: sourceAccount.type.toLowerCase()
        });
        await sourceEntry.save();
        entries.push(sourceEntry._id);

        // Update vendor balance
        vendor.currentBalance -= payment.amount;
        await vendor.save();

        // Create transaction
        const transaction = new Transaction({
            date: new Date(),
            description: `Payment to ${vendor.businessName}`,
            reference: `PAY-${payment._id || new mongoose.Types.ObjectId()}`,
            residence: payment.residence,
            entries
        });

        return await transaction.save();
    } catch (error) {
        console.error('Error creating payment transaction:', error);
        throw error;
    }
};

// Helper function to get vendor from expense
exports.getVendorFromExpense = async (expense) => {
    try {
        // Check if expense has vendor information
        if (expense.vendorId) {
            return await Vendor.findById(expense.vendorId);
        }
        
        // Check if expense has quotation information
        if (expense.quotationId) {
            // This would need to be implemented based on your quotation structure
            // For now, return null
            return null;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting vendor from expense:', error);
        return null;
    }
};

// Helper function to update vendor balance
exports.updateVendorBalance = async (vendorId, amount, operation = 'add') => {
    try {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            throw new Error('Vendor not found');
        }

        if (operation === 'add') {
            vendor.currentBalance += amount;
        } else if (operation === 'subtract') {
            vendor.currentBalance -= amount;
        }

        await vendor.save();
        return vendor;
    } catch (error) {
        console.error('Error updating vendor balance:', error);
        throw error;
    }
};

module.exports = exports; 