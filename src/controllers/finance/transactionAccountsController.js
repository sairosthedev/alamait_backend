const Account = require('../../models/Account');
const TransactionEntry = require('../../models/TransactionEntry');

class TransactionAccountsController {
    
    /**
     * Get all accounts for transaction creation
     * GET /api/finance/transaction-accounts
     */
    static async getAccounts(req, res) {
        try {
            console.log('🔍 Fetching accounts for transaction mappings...');
            
            const accounts = await Account.find().sort({ code: 1 });
            console.log(`📊 Found ${accounts.length} accounts`);
            
            // Group accounts by type for easier frontend consumption
            const groupedAccounts = {
                assets: accounts.filter(acc => acc.type === 'Asset'),
                liabilities: accounts.filter(acc => acc.type === 'Liability'),
                equity: accounts.filter(acc => acc.type === 'Equity'),
                revenue: accounts.filter(acc => acc.type === 'Income'),
                expenses: accounts.filter(acc => acc.type === 'Expense')
            };
            
            console.log('📋 Account groups:', {
                assets: groupedAccounts.assets.length,
                liabilities: groupedAccounts.liabilities.length,
                equity: groupedAccounts.equity.length,
                revenue: groupedAccounts.revenue.length,
                expenses: groupedAccounts.expenses.length
            });
            
            res.json({
                success: true,
                data: {
                    accounts: accounts,
                    grouped: groupedAccounts,
                    total: accounts.length
                }
            });
        } catch (error) {
            console.error('❌ Error fetching transaction accounts:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch accounts',
                error: error.message
            });
        }
    }
    
    /**
     * Get account mappings for specific transaction types
     * POST /api/finance/transaction-accounts/mappings/:transactionType
     */
    static async getTransactionTypeMapping(req, res) {
        try {
            const { transactionType } = req.params;
            const { studentName, studentId, paymentMethod, category, residenceId } = req.body;
            
            console.log(`🔍 Getting mapping for transaction type: ${transactionType}`);
            console.log(`   Context:`, { studentName, studentId, paymentMethod, category, residenceId });
            
            let mapping = null;
            
            switch (transactionType) {
                case 'rental_income':
                    mapping = await TransactionAccountsController.getRentalIncomeMapping(studentId, studentName, residenceId);
                    break;
                    
                case 'rental_payment':
                    mapping = await TransactionAccountsController.getRentalPaymentMapping(paymentMethod);
                    break;
                    
                case 'other_income':
                    mapping = await TransactionAccountsController.getOtherIncomeMapping(category, paymentMethod);
                    break;
                    
                case 'expense':
                    mapping = await TransactionAccountsController.getExpenseMapping(category, paymentMethod);
                    break;
                    
                case 'refund':
                    mapping = await TransactionAccountsController.getRefundMapping(paymentMethod);
                    break;
                    
                case 'custom':
                    mapping = {
                        debit: { code: '', name: 'Custom Debit Account' },
                        credit: { code: '', name: 'Custom Credit Account' }
                    };
                    break;
                    
                default:
                    return res.status(400).json({
                        success: false,
                        message: `Unknown transaction type: ${transactionType}`
                    });
            }
            
            if (!mapping) {
                console.log(`⚠️ No mapping found for transaction type: ${transactionType}, using fallback`);
                
                // Provide fallback mapping
                const fallbackMapping = {
                    debit: { code: '1100', name: 'Accounts Receivable - Tenants', type: 'Asset' },
                    credit: { code: '4001', name: 'Rental Income - School Accommodation', type: 'Income' }
                };
                
                res.json({
                    success: true,
                    data: fallbackMapping,
                    warning: `Using fallback mapping for ${transactionType}`
                });
            } else {
                res.json({
                    success: true,
                    data: mapping
                });
            }
            
        } catch (error) {
            console.error('Error getting transaction type mapping:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get transaction mapping',
                error: error.message
            });
        }
    }
    
    /**
     * Get rental income mapping (Debit: A/R, Credit: Rental Income)
     */
    static async getRentalIncomeMapping(studentId, studentName, residenceId) {
        try {
            console.log(`🔍 Getting rental income mapping for student: ${studentName} (${studentId})`);
            
            // Get or create student-specific A/R account
            let arAccount;
            if (studentId && studentName) {
                // Look for existing student-specific A/R account
                arAccount = await Account.findOne({
                    code: `1100-${studentId}`,
                    type: 'Asset'
                });
                
                if (!arAccount) {
                    // Create student-specific A/R account
                    arAccount = new Account({
                        code: `1100-${studentId}`,
                        name: `Accounts Receivable - ${studentName}`,
                        type: 'Asset',
                        category: 'Current Assets',
                        description: `Accounts receivable for ${studentName}`
                    });
                    await arAccount.save();
                    console.log(`✅ Created student-specific A/R account: ${arAccount.code}`);
                }
            } else {
                // Use general A/R account
                arAccount = await Account.findOne({
                    code: '1100',
                    type: 'Asset'
                });
            }
            
            // Get rental income account - try multiple possibilities
            let rentalIncomeAccount = await Account.findOne({
                $or: [
                    { code: '4001', type: 'Income' },
                    { code: '4000', type: 'Income' },
                    { name: /rental income.*school accommodation/i, type: 'Income' },
                    { name: /rental income.*residential/i, type: 'Income' },
                    { name: /rental income/i, type: 'Income' }
                ]
            });
            
            // If still not found, get any income account
            if (!rentalIncomeAccount) {
                rentalIncomeAccount = await Account.findOne({ type: 'Income' });
            }
            
            console.log(`📊 Found accounts:`, {
                arAccount: arAccount ? { code: arAccount.code, name: arAccount.name } : null,
                rentalIncomeAccount: rentalIncomeAccount ? { code: rentalIncomeAccount.code, name: rentalIncomeAccount.name } : null
            });
            
            if (!arAccount || !rentalIncomeAccount) {
                throw new Error(`Required accounts not found for rental income mapping. AR: ${!!arAccount}, Income: ${!!rentalIncomeAccount}`);
            }
            
            return {
                debit: {
                    code: arAccount.code,
                    name: arAccount.name,
                    type: arAccount.type
                },
                credit: {
                    code: rentalIncomeAccount.code,
                    name: rentalIncomeAccount.name,
                    type: rentalIncomeAccount.type
                }
            };
            
        } catch (error) {
            console.error('Error getting rental income mapping:', error);
            throw error;
        }
    }
    
    /**
     * Get rental payment mapping (Debit: Bank/Cash, Credit: A/R)
     */
    static async getRentalPaymentMapping(paymentMethod) {
        try {
            // Get payment method account
            const paymentAccount = await this.getPaymentMethodAccount(paymentMethod);
            
            // Get general A/R account
            const arAccount = await Account.findOne({
                code: '1100',
                type: 'Asset'
            });
            
            if (!paymentAccount || !arAccount) {
                throw new Error('Required accounts not found for rental payment mapping');
            }
            
            return {
                debit: {
                    code: paymentAccount.code,
                    name: paymentAccount.name,
                    type: paymentAccount.type
                },
                credit: {
                    code: arAccount.code,
                    name: arAccount.name,
                    type: arAccount.type
                }
            };
            
        } catch (error) {
            console.error('Error getting rental payment mapping:', error);
            throw error;
        }
    }
    
    /**
     * Get other income mapping (Debit: Bank/Cash, Credit: Other Income)
     */
    static async getOtherIncomeMapping(category, paymentMethod) {
        try {
            // Get payment method account
            const paymentAccount = await this.getPaymentMethodAccount(paymentMethod);
            
            // Get other income account
            const otherIncomeAccount = await Account.findOne({
                $or: [
                    { code: '4002', type: 'Income' },
                    { name: /other income/i, type: 'Income' }
                ]
            });
            
            if (!paymentAccount || !otherIncomeAccount) {
                throw new Error('Required accounts not found for other income mapping');
            }
            
            return {
                debit: {
                    code: paymentAccount.code,
                    name: paymentAccount.name,
                    type: paymentAccount.type
                },
                credit: {
                    code: otherIncomeAccount.code,
                    name: otherIncomeAccount.name,
                    type: otherIncomeAccount.type
                }
            };
            
        } catch (error) {
            console.error('Error getting other income mapping:', error);
            throw error;
        }
    }
    
    /**
     * Get expense mapping (Debit: Expense, Credit: Bank/Cash)
     */
    static async getExpenseMapping(category, paymentMethod) {
        try {
            // Get expense account based on category
            const expenseAccount = await this.getExpenseAccountByCategory(category);
            
            // Get payment method account
            const paymentAccount = await this.getPaymentMethodAccount(paymentMethod);
            
            if (!expenseAccount || !paymentAccount) {
                throw new Error('Required accounts not found for expense mapping');
            }
            
            return {
                debit: {
                    code: expenseAccount.code,
                    name: expenseAccount.name,
                    type: expenseAccount.type
                },
                credit: {
                    code: paymentAccount.code,
                    name: paymentAccount.name,
                    type: paymentAccount.type
                }
            };
            
        } catch (error) {
            console.error('Error getting expense mapping:', error);
            throw error;
        }
    }
    
    /**
     * Get refund mapping (Debit: Income, Credit: Bank/Cash)
     */
    static async getRefundMapping(paymentMethod) {
        try {
            // Get rental income account (for refunds)
            const rentalIncomeAccount = await Account.findOne({
                $or: [
                    { code: '4001', type: 'Income' },
                    { name: /rental income/i, type: 'Income' }
                ]
            });
            
            // Get payment method account
            const paymentAccount = await this.getPaymentMethodAccount(paymentMethod);
            
            if (!rentalIncomeAccount || !paymentAccount) {
                throw new Error('Required accounts not found for refund mapping');
            }
            
            return {
                debit: {
                    code: rentalIncomeAccount.code,
                    name: rentalIncomeAccount.name,
                    type: rentalIncomeAccount.type
                },
                credit: {
                    code: paymentAccount.code,
                    name: paymentAccount.name,
                    type: paymentAccount.type
                }
            };
            
        } catch (error) {
            console.error('Error getting refund mapping:', error);
            throw error;
        }
    }
    
    /**
     * Get payment method account
     */
    static async getPaymentMethodAccount(paymentMethod = 'Bank Transfer') {
        console.log(`🔍 Getting payment method account for: ${paymentMethod}`);
        
        const paymentMethodMap = {
            'Bank Transfer': '1000', // Bank - Main Account
            'Cash': '1015',          // Cash
            'Online Payment': '1000', // Bank - Main Account
            'Ecocash': '1000',       // Default to Bank
            'Innbucks': '1000',      // Default to Bank
            'MasterCard': '1000',    // Bank - Main Account
            'Visa': '1000',          // Bank - Main Account
            'PayPal': '1000',        // Bank - Main Account
            'Petty Cash': '1010'     // General Petty Cash
        };
        
        const accountCode = paymentMethodMap[paymentMethod] || '1000'; // Default to Bank - Main Account
        
        let account = await Account.findOne({
            code: accountCode,
            type: 'Asset'
        });
        
        // If specific account not found, try to find any bank/cash account
        if (!account) {
            account = await Account.findOne({
                $or: [
                    { code: '1000', type: 'Asset' }, // Bank - Main Account
                    { code: '1015', type: 'Asset' }, // Cash
                    { name: /bank/i, type: 'Asset' },
                    { name: /cash/i, type: 'Asset' }
                ]
            });
        }
        
        console.log(`📊 Found payment account:`, account ? { code: account.code, name: account.name } : null);
        
        return account;
    }
    
    /**
     * Get expense account by category
     */
    static async getExpenseAccountByCategory(category = 'Other') {
        console.log(`🔍 Getting expense account for category: ${category}`);
        
        const categoryMap = {
            'Maintenance': '5000', // Repairs and Maintenance
            'Utilities': '5001',   // Utilities - Water
            'Water': '5001',       // Utilities - Water
            'Taxes': '5013',       // Administrative Expenses
            'Insurance': '5013',   // Administrative Expenses
            'Salaries': '5012',    // Property Management Salaries
            'Supplies': '5013',    // Administrative Expenses
            'Other': '5013'        // Administrative Expenses
        };
        
        const accountCode = categoryMap[category] || '5013'; // Default to Administrative Expenses
        
        let account = await Account.findOne({
            code: accountCode,
            type: 'Expense'
        });
        
        // If specific account not found, try to find any expense account
        if (!account) {
            account = await Account.findOne({
                $or: [
                    { code: '5000', type: 'Expense' }, // Repairs and Maintenance
                    { code: '5013', type: 'Expense' }, // Administrative Expenses
                    { name: /maintenance/i, type: 'Expense' },
                    { name: /administrative/i, type: 'Expense' }
                ]
            });
        }
        
        console.log(`📊 Found expense account:`, account ? { code: account.code, name: account.name } : null);
        
        return account;
    }
    
    /**
     * Get student-specific accounts receivable account
     * POST /api/finance/transaction-accounts/student-ar
     */
    static async getStudentARAccount(req, res) {
        try {
            const { studentId, studentName } = req.body;
            
            if (!studentId || !studentName) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID and name are required'
                });
            }
            
            // Look for existing student-specific A/R account
            let arAccount = await Account.findOne({
                code: `1100-${studentId}`,
                type: 'Asset'
            });
            
            if (!arAccount) {
                // Create student-specific A/R account
                arAccount = new Account({
                    code: `1100-${studentId}`,
                    name: `Accounts Receivable - ${studentName}`,
                    type: 'Asset',
                    category: 'Current Assets',
                    description: `Accounts receivable for ${studentName}`
                });
                await arAccount.save();
                console.log(`✅ Created student-specific A/R account: ${arAccount.code}`);
            }
            
            res.json({
                success: true,
                data: {
                    code: arAccount.code,
                    name: arAccount.name,
                    type: arAccount.type
                }
            });
            
        } catch (error) {
            console.error('Error getting student AR account:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get student AR account',
                error: error.message
            });
        }
    }
}

module.exports = TransactionAccountsController;
