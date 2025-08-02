const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Expense = require('../models/finance/Expense');
const Account = require('../models/Account');
const Vendor = require('../models/Vendor');

class FinancialService {
    /**
     * Create double-entry transaction when finance approves a request
     * @param {Object} request - The approved request
     * @param {Object} user - The finance user who approved
     * @returns {Object} Created transaction and expense
     */
    static async createApprovalTransaction(request, user) {
        try {
            console.log('💰 Creating approval transaction for request:', request._id);
            
            // Generate unique transaction ID
            const transactionId = await this.generateTransactionId();
            
            // Create main transaction
            const transaction = new Transaction({
                transactionId,
                date: new Date(),
                description: `Request approval: ${request.title}`,
                reference: request._id.toString(),
                residence: request.residence,
                residenceName: request.residence?.name || 'Unknown Residence'
            });

            await transaction.save();
            console.log('✅ Transaction created:', transaction._id);

            // Create transaction entries for each item
            const entries = [];
            
            for (let i = 0; i < request.items.length; i++) {
                const item = request.items[i];
                const itemEntries = await this.createItemTransactionEntries(
                    transaction._id, 
                    item, 
                    i, 
                    request, 
                    user
                );
                entries.push(...itemEntries);
            }

            // Create itemized expense
            const expense = await this.createItemizedExpense(request, transaction._id, user);
            
            // Update transaction with expense reference
            transaction.expenseId = expense._id;
            await transaction.save();

            console.log('✅ Approval transaction completed');
            return {
                transaction,
                expense,
                entries
            };

        } catch (error) {
            console.error('❌ Error creating approval transaction:', error);
            throw error;
        }
    }

    /**
     * Create transaction entries for a specific item
     * @param {ObjectId} transactionId - Transaction ID
     * @param {Object} item - Request item
     * @param {Number} itemIndex - Item index
     * @param {Object} request - Full request object
     * @param {Object} user - Finance user
     * @returns {Array} Transaction entries
     */
    static async createItemTransactionEntries(transactionId, item, itemIndex, request, user) {
        const entries = [];
        
        try {
            // Find selected quotation for this item
            const selectedQuotation = item.quotations?.find(q => q.isSelected);
            
            if (selectedQuotation) {
                // Item has selected quotation - create vendor-specific entries
                entries.push(...await this.createVendorTransactionEntries(
                    transactionId, 
                    item, 
                    itemIndex, 
                    selectedQuotation, 
                    request, 
                    user
                ));
            } else {
                // Item without quotation - create general expense entries
                entries.push(...await this.createGeneralExpenseEntries(
                    transactionId, 
                    item, 
                    itemIndex, 
                    request, 
                    user
                ));
            }

            console.log(`✅ Created ${entries.length} transaction entries for item ${itemIndex}`);
            return entries;

        } catch (error) {
            console.error(`❌ Error creating transaction entries for item ${itemIndex}:`, error);
            throw error;
        }
    }

    /**
     * Create vendor-specific transaction entries
     * @param {ObjectId} transactionId - Transaction ID
     * @param {Object} item - Request item
     * @param {Number} itemIndex - Item index
     * @param {Object} quotation - Selected quotation
     * @param {Object} request - Full request object
     * @param {Object} user - Finance user
     * @returns {Array} Transaction entries
     */
    static async createVendorTransactionEntries(transactionId, item, itemIndex, quotation, request, user) {
        const entries = [];
        
        try {
            // Get or create vendor account
            const vendorAccount = await this.getOrCreateVendorAccount(quotation.vendorId);
            
            // Get or create expense account
            const expenseAccount = await this.getOrCreateExpenseAccount(
                quotation.expenseCategory || 'other_expenses'
            );

            // Entry 1: Debit Expense Account (we incurred an expense)
            const expenseEntry = new TransactionEntry({
                transaction: transactionId,
                account: expenseAccount._id,
                debit: quotation.amount,
                credit: 0,
                type: 'expense',
                description: `Expense for ${item.description} - ${quotation.provider}`,
                reference: `${request._id}-item-${itemIndex}`,
                metadata: {
                    itemIndex,
                    vendorId: quotation.vendorId,
                    vendorName: quotation.provider,
                    expenseCategory: quotation.expenseCategory
                }
            });
            entries.push(expenseEntry);

            // Entry 2: Credit Vendor Account (we owe money to vendor)
            const vendorEntry = new TransactionEntry({
                transaction: transactionId,
                account: vendorAccount._id,
                debit: 0,
                credit: quotation.amount,
                type: 'liability',
                description: `Accounts payable to ${quotation.provider} for ${item.description}`,
                reference: `${request._id}-item-${itemIndex}`,
                metadata: {
                    itemIndex,
                    vendorId: quotation.vendorId,
                    vendorName: quotation.provider,
                    vendorCode: quotation.vendorCode
                }
            });
            entries.push(vendorEntry);

            // Save entries
            await TransactionEntry.insertMany(entries);
            
            // Update vendor's current balance
            await this.updateVendorBalance(quotation.vendorId, quotation.amount);

            console.log(`✅ Created vendor transaction entries for ${quotation.provider}: $${quotation.amount}`);
            return entries;

        } catch (error) {
            console.error('❌ Error creating vendor transaction entries:', error);
            throw error;
        }
    }

    /**
     * Create general expense transaction entries (no vendor)
     * @param {ObjectId} transactionId - Transaction ID
     * @param {Object} item - Request item
     * @param {Number} itemIndex - Item index
     * @param {Object} request - Full request object
     * @param {Object} user - Finance user
     * @returns {Array} Transaction entries
     */
    static async createGeneralExpenseEntries(transactionId, item, itemIndex, request, user) {
        const entries = [];
        
        try {
            // Get or create general expense account
            const expenseAccount = await this.getOrCreateExpenseAccount('other_expenses');
            
            // Get or create accounts payable account
            const payableAccount = await this.getOrCreateAccount('200000', 'General Accounts Payable', 'Liability');

            // Entry 1: Debit Expense Account (we incurred an expense)
            const expenseEntry = new TransactionEntry({
                transaction: transactionId,
                account: expenseAccount._id,
                debit: item.totalCost,
                credit: 0,
                type: 'expense',
                description: `General expense for ${item.description}`,
                reference: `${request._id}-item-${itemIndex}`,
                metadata: {
                    itemIndex,
                    expenseCategory: 'other_expenses'
                }
            });
            entries.push(expenseEntry);

            // Entry 2: Credit Accounts Payable (we owe money)
            const payableEntry = new TransactionEntry({
                transaction: transactionId,
                account: payableAccount._id,
                debit: 0,
                credit: item.totalCost,
                type: 'liability',
                description: `Accounts payable for ${item.description}`,
                reference: `${request._id}-item-${itemIndex}`,
                metadata: {
                    itemIndex
                }
            });
            entries.push(payableEntry);

            // Save entries
            await TransactionEntry.insertMany(entries);

            console.log(`✅ Created general expense entries for item ${itemIndex}: $${item.totalCost}`);
            return entries;

        } catch (error) {
            console.error('❌ Error creating general expense entries:', error);
            throw error;
        }
    }

    /**
     * Create itemized expense from request
     * @param {Object} request - The approved request
     * @param {ObjectId} transactionId - Transaction ID
     * @param {Object} user - Finance user
     * @returns {Object} Created expense
     */
    static async createItemizedExpense(request, transactionId, user) {
        try {
            // Generate unique expense ID
            const expenseId = await this.generateExpenseId();
            
            // Create expense items from request items
            const expenseItems = request.items.map((item, index) => {
                const selectedQuotation = item.quotations?.find(q => q.isSelected);
                
                return {
                    itemIndex: index,
                    description: item.description,
                    quantity: item.quantity,
                    unitCost: item.unitCost,
                    totalCost: item.totalCost,
                    purpose: item.purpose,
                    selectedQuotation: selectedQuotation ? {
                        provider: selectedQuotation.provider,
                        amount: selectedQuotation.amount,
                        vendorId: selectedQuotation.vendorId,
                        vendorCode: selectedQuotation.vendorCode,
                        vendorName: selectedQuotation.vendorName,
                        vendorType: selectedQuotation.vendorType,
                        expenseCategory: selectedQuotation.expenseCategory,
                        paymentMethod: selectedQuotation.paymentMethod,
                        hasBankDetails: selectedQuotation.hasBankDetails,
                        selectedBy: selectedQuotation.selectedBy,
                        selectedByEmail: selectedQuotation.selectedByEmail,
                        selectedAt: selectedQuotation.selectedAt
                    } : null,
                    paymentStatus: 'Pending'
                };
            });

            const expense = new Expense({
                expenseId,
                requestId: request._id,
                residence: request.residence,
                category: 'Other', // Default category
                amount: request.totalEstimatedCost,
                description: request.title,
                expenseDate: new Date(),
                paymentStatus: 'Pending',
                period: 'monthly',
                items: expenseItems,
                transactionId,
                createdBy: user._id,
                approvedBy: user._id,
                approvedAt: new Date(),
                approvedByEmail: user.email
            });

            await expense.save();
            console.log('✅ Itemized expense created:', expense.expenseId);
            return expense;

        } catch (error) {
            console.error('❌ Error creating itemized expense:', error);
            throw error;
        }
    }

    /**
     * Update transaction entries when expense is paid
     * @param {Object} expense - The expense being paid
     * @param {Object} user - User making the payment
     * @param {String} paymentMethod - Payment method
     * @returns {Object} Updated transaction entries
     */
    static async markExpenseAsPaid(expense, user, paymentMethod) {
        try {
            console.log('💰 Marking expense as paid:', expense.expenseId);
            
            // Generate payment transaction ID
            const paymentTransactionId = await this.generateTransactionId();
            
            // Create payment transaction
            const paymentTransaction = new Transaction({
                transactionId: paymentTransactionId,
                date: new Date(),
                description: `Payment for expense: ${expense.description}`,
                reference: expense.expenseId,
                residence: expense.residence,
                residenceName: expense.residence?.name || 'Unknown Residence'
            });

            await paymentTransaction.save();

            // Create payment transaction entries
            const paymentEntries = [];
            
            for (const item of expense.items) {
                if (item.paymentStatus === 'Pending') {
                    const itemPaymentEntries = await this.createPaymentTransactionEntries(
                        paymentTransaction._id,
                        item,
                        expense,
                        user,
                        paymentMethod
                    );
                    paymentEntries.push(...itemPaymentEntries);
                }
            }

            // Update expense payment status
            expense.paymentStatus = 'Paid';
            expense.paymentMethod = paymentMethod;
            expense.paidBy = user._id;
            expense.paidDate = new Date();
            
            // Update item payment statuses
            expense.items.forEach(item => {
                if (item.paymentStatus === 'Pending') {
                    item.paymentStatus = 'Paid';
                    item.paidBy = user._id;
                    item.paidDate = new Date();
                    item.paymentMethod = paymentMethod;
                }
            });

            await expense.save();

            console.log('✅ Expense marked as paid');
            return {
                paymentTransaction,
                paymentEntries,
                expense
            };

        } catch (error) {
            console.error('❌ Error marking expense as paid:', error);
            throw error;
        }
    }

    /**
     * Create payment transaction entries
     * @param {ObjectId} transactionId - Payment transaction ID
     * @param {Object} item - Expense item
     * @param {Object} expense - Full expense object
     * @param {Object} user - User making payment
     * @param {String} paymentMethod - Payment method
     * @returns {Array} Payment transaction entries
     */
    static async createPaymentTransactionEntries(transactionId, item, expense, user, paymentMethod) {
        const entries = [];
        
        try {
            // Get payment source account (Cash/Bank)
            const paymentAccount = await this.getPaymentSourceAccount(paymentMethod);
            
            // Get vendor account if item has vendor
            let vendorAccount = null;
            if (item.selectedQuotation?.vendorId) {
                vendorAccount = await this.getOrCreateVendorAccount(item.selectedQuotation.vendorId);
            } else {
                // General accounts payable
                vendorAccount = await this.getOrCreateAccount('200000', 'General Accounts Payable', 'Liability');
            }

            // Entry 1: Debit Vendor Account (reduce what we owe)
            const vendorEntry = new TransactionEntry({
                transaction: transactionId,
                account: vendorAccount._id,
                debit: item.totalCost,
                credit: 0,
                type: 'liability',
                description: `Payment to ${item.selectedQuotation?.provider || 'vendor'} for ${item.description}`,
                reference: expense.expenseId,
                metadata: {
                    vendorId: item.selectedQuotation?.vendorId,
                    vendorName: item.selectedQuotation?.provider
                }
            });
            entries.push(vendorEntry);

            // Entry 2: Credit Payment Source Account (reduce cash/bank)
            const paymentEntry = new TransactionEntry({
                transaction: transactionId,
                account: paymentAccount._id,
                debit: 0,
                credit: item.totalCost,
                type: 'asset',
                description: `Payment for ${item.description}`,
                reference: expense.expenseId,
                metadata: {
                    paymentMethod
                }
            });
            entries.push(paymentEntry);

            // Save entries
            await TransactionEntry.insertMany(entries);
            
            // Update vendor balance if applicable
            if (item.selectedQuotation?.vendorId) {
                await this.updateVendorBalance(item.selectedQuotation.vendorId, -item.totalCost);
            }

            console.log(`✅ Created payment entries for item: $${item.totalCost}`);
            return entries;

        } catch (error) {
            console.error('❌ Error creating payment transaction entries:', error);
            throw error;
        }
    }

    // Helper methods
    static async generateTransactionId() {
        const count = await Transaction.countDocuments();
        const year = new Date().getFullYear().toString().substr(-2);
        const sequence = (count + 1).toString().padStart(6, '0');
        return `TXN${year}${sequence}`;
    }

    static async generateExpenseId() {
        const count = await Expense.countDocuments();
        const year = new Date().getFullYear().toString().substr(-2);
        const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
        const sequence = (count + 1).toString().padStart(4, '0');
        return `EXP${year}${month}${sequence}`;
    }

    static async getOrCreateVendorAccount(vendorId) {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            throw new Error(`Vendor not found: ${vendorId}`);
        }

        let account = await Account.findOne({ code: vendor.chartOfAccountsCode });
        if (!account) {
            account = new Account({
                code: vendor.chartOfAccountsCode,
                name: `Accounts Payable - ${vendor.businessName}`,
                type: 'Liability'
            });
            await account.save();
        }
        return account;
    }

    static async getOrCreateExpenseAccount(category) {
        const categoryMap = {
            'maintenance_expenses': '5000',
            'utilities_expenses': '5001',
            'supplies_expenses': '5002',
            'equipment_expenses': '5003',
            'services_expenses': '5004',
            'cleaning_expenses': '5010',
            'security_expenses': '5011',
            'landscaping_expenses': '5012',
            'other_expenses': '5013'
        };

        const code = categoryMap[category] || '5013';
        let account = await Account.findOne({ code });
        if (!account) {
            account = new Account({
                code,
                name: `${category.replace('_', ' ').toUpperCase()}`,
                type: 'Expense'
            });
            await account.save();
        }
        return account;
    }

    static async getOrCreateAccount(code, name, type) {
        let account = await Account.findOne({ code });
        if (!account) {
            account = new Account({
                code,
                name,
                type
            });
            await account.save();
        }
        return account;
    }

    static async getPaymentSourceAccount(paymentMethod) {
        if (paymentMethod === 'Cash') {
            return await this.getOrCreateAccount('1000', 'Cash', 'Asset');
        } else {
            return await this.getOrCreateAccount('1001', 'Bank Account', 'Asset');
        }
    }

    static async updateVendorBalance(vendorId, amount) {
        await Vendor.findByIdAndUpdate(vendorId, {
            $inc: { currentBalance: amount }
        });
    }
}

module.exports = FinancialService; 