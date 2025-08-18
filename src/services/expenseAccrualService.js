const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Transaction = require('../models/Transaction');

/**
 * Expense Accrual Service
 * 
 * Creates expense accrual entries for proper accrual basis accounting.
 * Expenses are recorded when incurred (obligation exists) not when paid.
 * 
 * Example: Utility bill received on August 1st, due August 15th
 * - Accrual Entry (August 1st): Debit Utilities Expense, Credit Accounts Payable
 * - Payment Entry (August 15th): Debit Accounts Payable, Credit Cash
 */
class ExpenseAccrualService {
    
    /**
     * Create an expense accrual entry
     * @param {Object} expenseData - Expense data
     * @param {string} expenseData.description - Description of the expense
     * @param {number} expenseData.amount - Amount of the expense
     * @param {Date} expenseData.incurredDate - Date when expense was incurred
     * @param {string} expenseData.accountCode - Account code for the expense
     * @param {string} expenseData.accountName - Account name for the expense
     * @param {string} expenseData.residence - Residence ID where expense occurred
     * @param {string} expenseData.category - Category of expense
     * @param {string} expenseData.createdBy - User ID who created the entry
     * @returns {Object} Created transaction entry
     */
    static async createExpenseAccrual(expenseData) {
        try {
            const {
                description,
                amount,
                incurredDate,
                accountCode,
                accountName,
                residence,
                category,
                createdBy
            } = expenseData;

            // Validate required fields
            if (!description || !amount || !incurredDate || !accountCode || !accountName || !residence || !createdBy) {
                throw new Error('Missing required fields for expense accrual');
            }

            // Create the transaction entry for expense accrual
            const transactionEntry = new TransactionEntry({
                transactionId: `EXP_ACCR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                date: incurredDate,
                description: `ACCRUAL: ${description}`,
                source: 'expense_accrual', // New source type for expense accruals
                sourceModel: 'TransactionEntry',
                sourceId: new mongoose.Types.ObjectId(),
                status: 'posted',
                residence: residence,
                createdBy: createdBy,
                totalDebit: amount,
                totalCredit: amount,
                metadata: {
                    expenseType: 'accrual',
                    category: category,
                    originalAmount: amount,
                    dueDate: incurredDate
                },
                entries: [
                    {
                        // Debit the expense account (expense increases)
                        accountCode: accountCode,
                        accountName: accountName,
                        accountType: 'Expense',
                        debit: amount,
                        credit: 0,
                        description: `Accrued: ${description}`
                    },
                    {
                        // Credit accounts payable (liability increases)
                        accountCode: '2000', // Accounts Payable account code
                        accountName: 'Accounts Payable',
                        accountType: 'Liability',
                        debit: 0,
                        credit: amount,
                        description: `Accrued liability for: ${description}`
                    }
                ]
            });

            // Save the transaction entry
            await transactionEntry.save();

            console.log(`✅ Expense accrual created: ${description} for $${amount} on ${incurredDate}`);

            return {
                success: true,
                transactionEntry,
                message: `Expense accrual created for ${description}`
            };

        } catch (error) {
            console.error('❌ Error creating expense accrual:', error);
            throw error;
        }
    }

    /**
     * Create expense accruals for common recurring expenses
     * @param {Object} options - Options for bulk accrual creation
     * @param {string} options.year - Year to create accruals for
     * @param {string} options.residence - Residence ID
     * @param {string} options.createdBy - User ID
     * @returns {Array} Array of created accruals
     */
    static async createBulkExpenseAccruals(options) {
        try {
            const { year, residence, createdBy } = options;
            const accruals = [];

            // Common recurring expenses with typical due dates
            const commonExpenses = [
                {
                    description: 'Monthly Utilities',
                    accountCode: '5003',
                    accountName: 'Utilities Expense',
                    category: 'Utilities',
                    dueDay: 1, // Due on 1st of each month
                    amount: 500 // Example amount
                },
                {
                    description: 'Monthly Internet',
                    accountCode: '5030',
                    accountName: 'Wifi',
                    category: 'Utilities',
                    dueDay: 5, // Due on 5th of each month
                    amount: 80
                },
                {
                    description: 'Monthly Cleaning',
                    accountCode: '5050',
                    accountName: 'Cleaning Supplies',
                    category: 'Supplies',
                    dueDay: 10, // Due on 10th of each month
                    amount: 150
                }
            ];

            // Create monthly accruals for the entire year
            for (let month = 0; month < 12; month++) {
                for (const expense of commonExpenses) {
                    const incurredDate = new Date(year, month, expense.dueDay);
                    
                    // Skip future dates
                    if (incurredDate > new Date()) {
                        continue;
                    }

                    const accrual = await this.createExpenseAccrual({
                        description: `${expense.description} - ${incurredDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                        amount: expense.amount,
                        incurredDate: incurredDate,
                        accountCode: expense.accountCode,
                        accountName: expense.accountName,
                        residence: residence,
                        category: expense.category,
                        createdBy: createdBy
                    });

                    if (accrual.success) {
                        accruals.push(accrual.transactionEntry);
                    }
                }
            }

            console.log(`✅ Created ${accruals.length} expense accruals for ${year}`);
            return accruals;

        } catch (error) {
            console.error('❌ Error creating bulk expense accruals:', error);
            throw error;
        }
    }

    /**
     * Get all expense accruals for a period
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {string} residence - Residence ID (optional)
     * @returns {Array} Array of expense accruals
     */
    static async getExpenseAccruals(startDate, endDate, residence = null) {
        try {
            const query = {
                date: { $gte: startDate, $lte: endDate },
                source: 'expense_accrual',
                status: 'posted'
            };

            if (residence) {
                query.residence = residence;
            }

            const accruals = await TransactionEntry.find(query).sort({ date: 1 });
            return accruals;

        } catch (error) {
            console.error('❌ Error getting expense accruals:', error);
            throw error;
        }
    }

    /**
     * Reverse an expense accrual when payment is made
     * @param {string} accrualId - ID of the accrual to reverse
     * @param {Date} paymentDate - Date when payment was made
     * @param {string} createdBy - User ID who made the payment
     * @returns {Object} Reversal transaction entry
     */
    static async reverseExpenseAccrual(accrualId, paymentDate, createdBy) {
        try {
            // Get the original accrual
            const accrual = await TransactionEntry.findById(accrualId);
            if (!accrual || accrual.source !== 'expense_accrual') {
                throw new Error('Invalid accrual entry');
            }

            // Create reversal entry
            const reversalEntry = new TransactionEntry({
                date: paymentDate,
                description: `REVERSAL: ${accrual.description}`,
                source: 'expense_accrual_reversal',
                status: 'posted',
                residence: accrual.residence,
                createdBy: createdBy,
                metadata: {
                    originalAccrualId: accrualId,
                    reversalType: 'payment',
                    paymentDate: paymentDate
                },
                entries: [
                    {
                        // Credit the expense account (expense decreases)
                        accountCode: accrual.entries[0].accountCode,
                        accountName: accrual.entries[0].accountName,
                        accountType: 'Expense',
                        debit: 0,
                        credit: accrual.entries[0].debit,
                        description: `Reversal: ${accrual.description}`
                    },
                    {
                        // Debit accounts payable (liability decreases)
                        accountCode: accrual.entries[1].accountCode,
                        accountName: accrual.entries[1].accountName,
                        accountType: 'Liability',
                        debit: accrual.entries[1].credit,
                        credit: 0,
                        description: `Reversal: ${accrual.description}`
                    }
                ]
            });

            await reversalEntry.save();

            console.log(`✅ Expense accrual reversed: ${accrual.description}`);
            return reversalEntry;

        } catch (error) {
            console.error('❌ Error reversing expense accrual:', error);
            throw error;
        }
    }
}

module.exports = ExpenseAccrualService;
