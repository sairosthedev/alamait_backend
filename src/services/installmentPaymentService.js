const mongoose = require('mongoose');
const InstallmentPayment = require('../models/InstallmentPayment');
const MonthlyRequest = require('../models/MonthlyRequest');
const Expense = require('../models/finance/Expense');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');

class InstallmentPaymentService {
    /**
     * Create an installment payment for a monthly request item
     * @param {Object} paymentData - Payment data
     * @param {string} paymentData.monthlyRequestId - Monthly request ID
     * @param {number} paymentData.itemIndex - Item index in the request
     * @param {number} paymentData.amount - Payment amount
     * @param {string} paymentData.paymentMethod - Payment method
     * @param {Object} paymentData.user - User making the payment
     * @param {string} paymentData.notes - Payment notes
     * @returns {Object} Created installment payment
     */
    static async createInstallmentPayment(paymentData) {
        try {
            const { monthlyRequestId, itemIndex, amount, paymentMethod, user, notes } = paymentData;
            
            console.log(`💰 Creating installment payment for monthly request ${monthlyRequestId}, item ${itemIndex}, amount $${amount}`);
            
            // Get the monthly request
            const monthlyRequest = await MonthlyRequest.findById(monthlyRequestId);
            if (!monthlyRequest) {
                throw new Error('Monthly request not found');
            }
            
            // Get the specific item
            const item = monthlyRequest.items[itemIndex];
            if (!item) {
                throw new Error('Item not found in monthly request');
            }
            
            // Check if the monthly request is approved
            if (monthlyRequest.status !== 'approved') {
                throw new Error('Monthly request must be approved before creating installment payments');
            }
            
            // Get existing installment payments for this item
            const existingPayments = await InstallmentPayment.find({
                monthlyRequestId,
                itemIndex
            }).sort({ installmentNumber: 1 });
            
            // Calculate total paid so far
            const totalPaid = existingPayments.reduce((sum, payment) => {
                return sum + (payment.status === 'paid' ? payment.amount : 0);
            }, 0);
            
            // Check if this payment would exceed the item amount
            const itemAmount = item.estimatedCost || item.totalCost || 0;
            if (totalPaid + amount > itemAmount) {
                throw new Error(`Payment amount ($${amount}) would exceed remaining balance ($${itemAmount - totalPaid})`);
            }
            
            // Determine installment number
            const installmentNumber = existingPayments.length + 1;
            
            // Create the installment payment
            const installmentPayment = new InstallmentPayment({
                monthlyRequestId,
                itemIndex,
                installmentNumber,
                amount,
                paymentDate: new Date(),
                paymentMethod,
                status: 'paid', // Mark as paid immediately
                createdBy: user._id,
                paidBy: user._id,
                notes: notes || `Installment ${installmentNumber} payment`
            });
            
            await installmentPayment.save();
            
            // Create expense and transaction for this installment
            const expenseResult = await this.createExpenseForInstallment(installmentPayment, monthlyRequest, item, user);
            
            // Update installment payment with expense and transaction references
            installmentPayment.expenseId = expenseResult.expense._id;
            installmentPayment.transactionId = expenseResult.transaction._id;
            await installmentPayment.save();
            
            console.log(`✅ Installment payment created: ${installmentPayment._id}`);
            console.log(`   - Amount: $${amount}`);
            console.log(`   - Installment: ${installmentNumber}`);
            console.log(`   - Expense: ${expenseResult.expense._id}`);
            console.log(`   - Transaction: ${expenseResult.transaction._id}`);
            
            return {
                installmentPayment,
                expense: expenseResult.expense,
                transaction: expenseResult.transaction
            };
            
        } catch (error) {
            console.error('❌ Error creating installment payment:', error);
            throw error;
        }
    }
    
    /**
     * Create expense and transaction for an installment payment
     * @param {Object} installmentPayment - The installment payment
     * @param {Object} monthlyRequest - The monthly request
     * @param {Object} item - The request item
     * @param {Object} user - The user making the payment
     * @returns {Object} Created expense and transaction
     */
    static async createExpenseForInstallment(installmentPayment, monthlyRequest, item, user) {
        try {
            console.log(`📝 Creating expense for installment payment ${installmentPayment._id}`);
            
            // Create expense ID
            const expenseId = `EXP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Get vendor information from the item
            const vendorId = item.vendorId || null;
            const vendorCode = item.vendorCode || null;
            const vendorName = item.vendorName || item.provider || 'Unknown Vendor';
            
            // Create expense data
            const expenseData = {
                expenseId,
                monthlyRequestId: monthlyRequest._id,
                installmentPaymentId: installmentPayment._id,
                residence: monthlyRequest.residence,
                category: item.category || 'Other',
                amount: installmentPayment.amount,
                description: `${monthlyRequest.title || 'Monthly Request'} - ${item.description} (Installment ${installmentPayment.installmentNumber})`,
                expenseDate: installmentPayment.paymentDate,
                paymentStatus: 'Paid',
                createdBy: user._id,
                period: 'monthly',
                paymentMethod: installmentPayment.paymentMethod,
                approvedBy: user._id,
                approvedAt: installmentPayment.paymentDate,
                approvedByEmail: user.email,
                vendorId,
                vendorCode,
                vendorName,
                itemIndex: installmentPayment.itemIndex,
                installmentNumber: installmentPayment.installmentNumber,
                notes: `Installment payment for ${item.description} - Payment ${installmentPayment.installmentNumber}`
            };
            
            // Create the expense
            const expense = new Expense(expenseData);
            await expense.save();
            
            // Create double-entry transaction
            const transaction = await this.createTransactionForInstallment(installmentPayment, expense, monthlyRequest, item, user);
            
            console.log(`✅ Expense created for installment: ${expense._id}`);
            
            return {
                expense,
                transaction
            };
            
        } catch (error) {
            console.error('❌ Error creating expense for installment:', error);
            throw error;
        }
    }
    
    /**
     * Create double-entry transaction for installment payment
     * @param {Object} installmentPayment - The installment payment
     * @param {Object} expense - The created expense
     * @param {Object} monthlyRequest - The monthly request
     * @param {Object} item - The request item
     * @param {Object} user - The user making the payment
     * @returns {Object} Created transaction
     */
    static async createTransactionForInstallment(installmentPayment, expense, monthlyRequest, item, user) {
        try {
            console.log(`📊 Creating transaction for installment payment ${installmentPayment._id}`);
            
            // Get accounts
            const cashAccount = await Account.findOne({ code: '1000' }); // Cash account
            const expenseAccount = await Account.findOne({ code: item.expenseAccountCode || '5000' }); // Expense account
            
            if (!cashAccount || !expenseAccount) {
                throw new Error('Required accounts not found');
            }
            
            // Create transaction ID
            const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            
            // Create transaction entry
            const transaction = new TransactionEntry({
                transactionId,
                date: installmentPayment.paymentDate,
                description: `Installment payment for ${item.description} - Payment ${installmentPayment.installmentNumber}`,
                source: 'installment_payment',
                status: 'posted',
                entries: [
                    {
                        accountCode: expenseAccount.code,
                        accountName: expenseAccount.name,
                        accountType: 'Expense',
                        debit: installmentPayment.amount,
                        credit: 0,
                        description: `Expense: ${item.description} (Installment ${installmentPayment.installmentNumber})`
                    },
                    {
                        accountCode: cashAccount.code,
                        accountName: cashAccount.name,
                        accountType: 'Asset',
                        debit: 0,
                        credit: installmentPayment.amount,
                        description: `Cash payment for ${item.description} (Installment ${installmentPayment.installmentNumber})`
                    }
                ],
                metadata: {
                    type: 'installment_payment',
                    monthlyRequestId: monthlyRequest._id,
                    installmentPaymentId: installmentPayment._id,
                    expenseId: expense._id,
                    itemIndex: installmentPayment.itemIndex,
                    installmentNumber: installmentPayment.installmentNumber,
                    paymentMethod: installmentPayment.paymentMethod,
                    createdBy: user._id,
                    createdByEmail: user.email
                }
            });
            
            await transaction.save();
            
            console.log(`✅ Transaction created for installment: ${transaction._id}`);
            
            return transaction;
            
        } catch (error) {
            console.error('❌ Error creating transaction for installment:', error);
            throw error;
        }
    }
    
    /**
     * Get installment payment summary for a monthly request item
     * @param {string} monthlyRequestId - Monthly request ID
     * @param {number} itemIndex - Item index
     * @returns {Object} Payment summary
     */
    static async getInstallmentSummary(monthlyRequestId, itemIndex) {
        try {
            const monthlyRequest = await MonthlyRequest.findById(monthlyRequestId);
            if (!monthlyRequest) {
                throw new Error('Monthly request not found');
            }
            
            const item = monthlyRequest.items[itemIndex];
            if (!item) {
                throw new Error('Item not found');
            }
            
            const installmentPayments = await InstallmentPayment.find({
                monthlyRequestId,
                itemIndex
            }).sort({ installmentNumber: 1 });
            
            const totalPaid = installmentPayments.reduce((sum, payment) => {
                return sum + (payment.status === 'paid' ? payment.amount : 0);
            }, 0);
            
            const itemAmount = item.estimatedCost || item.totalCost || 0;
            const remainingBalance = itemAmount - totalPaid;
            const isFullyPaid = remainingBalance <= 0;
            
            return {
                item,
                totalAmount: itemAmount,
                totalPaid,
                remainingBalance,
                isFullyPaid,
                installmentPayments,
                paymentProgress: {
                    percentage: itemAmount > 0 ? (totalPaid / itemAmount) * 100 : 0,
                    paidAmount: totalPaid,
                    remainingAmount: remainingBalance
                }
            };
            
        } catch (error) {
            console.error('❌ Error getting installment summary:', error);
            throw error;
        }
    }
    
    /**
     * Get all installment payments for a monthly request
     * @param {string} monthlyRequestId - Monthly request ID
     * @returns {Object} All installment payments grouped by item
     */
    static async getAllInstallmentsForRequest(monthlyRequestId) {
        try {
            const monthlyRequest = await MonthlyRequest.findById(monthlyRequestId);
            if (!monthlyRequest) {
                throw new Error('Monthly request not found');
            }
            
            const installmentPayments = await InstallmentPayment.find({
                monthlyRequestId
            }).sort({ itemIndex: 1, installmentNumber: 1 });
            
            // Group by item index
            const paymentsByItem = {};
            installmentPayments.forEach(payment => {
                if (!paymentsByItem[payment.itemIndex]) {
                    paymentsByItem[payment.itemIndex] = [];
                }
                paymentsByItem[payment.itemIndex].push(payment);
            });
            
            // Calculate summary for each item
            const itemSummaries = {};
            monthlyRequest.items.forEach((item, index) => {
                const payments = paymentsByItem[index] || [];
                const totalPaid = payments.reduce((sum, payment) => {
                    return sum + (payment.status === 'paid' ? payment.amount : 0);
                }, 0);
                
                const itemAmount = item.estimatedCost || item.totalCost || 0;
                const remainingBalance = itemAmount - totalPaid;
                
                itemSummaries[index] = {
                    item,
                    totalAmount: itemAmount,
                    totalPaid,
                    remainingBalance,
                    isFullyPaid: remainingBalance <= 0,
                    payments,
                    paymentProgress: {
                        percentage: itemAmount > 0 ? (totalPaid / itemAmount) * 100 : 0,
                        paidAmount: totalPaid,
                        remainingAmount: remainingBalance
                    }
                };
            });
            
            return {
                monthlyRequest,
                itemSummaries,
                totalRequestAmount: monthlyRequest.items.reduce((sum, item) => sum + (item.estimatedCost || item.totalCost || 0), 0),
                totalPaidAmount: Object.values(itemSummaries).reduce((sum, summary) => sum + summary.totalPaid, 0),
                overallProgress: monthlyRequest.items.length > 0 ? 
                    Object.values(itemSummaries).reduce((sum, summary) => sum + summary.paymentProgress.percentage, 0) / monthlyRequest.items.length : 0
            };
            
        } catch (error) {
            console.error('❌ Error getting all installments for request:', error);
            throw error;
        }
    }
}

module.exports = InstallmentPaymentService;
