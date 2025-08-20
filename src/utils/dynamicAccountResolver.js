const Account = require('../models/Account');

/**
 * Dynamic Account Resolution Service
 * Resolves payment methods to actual accounts from the database
 * instead of using hardcoded account codes
 */
class DynamicAccountResolver {
    
    /**
     * Get the appropriate source account for a payment method
     * @param {string} paymentMethod - The payment method (e.g., 'Bank Transfer', 'Cash')
     * @returns {Promise<Object>} The account object or null if not found
     */
    static async getPaymentSourceAccount(paymentMethod) {
        try {
            console.log(`🔍 Resolving payment method: ${paymentMethod}`);
            
            // Define payment method patterns to search for in account names
            const paymentMethodPatterns = {
                'Bank Transfer': ['bank', 'account', 'main account', 'primary account'],
                'Cash': ['cash', 'cash on hand', 'petty cash'],
                'Ecocash': ['ecocash', 'eco cash', 'mobile money'],
                'Innbucks': ['innbucks', 'inn bucks', 'mobile money'],
                'Online Payment': ['bank', 'account', 'online', 'digital'],
                'MasterCard': ['bank', 'account', 'card', 'credit'],
                'Visa': ['bank', 'account', 'card', 'credit'],
                'PayPal': ['bank', 'account', 'online', 'digital'],
                'Petty Cash': ['petty cash', 'cash', 'small cash']
            };
            
            const patterns = paymentMethodPatterns[paymentMethod];
            if (!patterns) {
                console.log(`⚠️  No patterns defined for payment method: ${paymentMethod}`);
                return null;
            }
            
            // Search for accounts that match the patterns
            let account = null;
            
            // First, try exact name matches
            for (const pattern of patterns) {
                account = await Account.findOne({
                    name: { $regex: new RegExp(pattern, 'i') },
                    type: 'Asset',
                    isActive: true
                });
                
                if (account) {
                    console.log(`✅ Found exact match: ${account.code} - ${account.name}`);
                    break;
                }
            }
            
            // If no exact match, try partial matches
            if (!account) {
                for (const pattern of patterns) {
                    account = await Account.findOne({
                        name: { $regex: new RegExp(pattern, 'i') },
                        type: 'Asset',
                        isActive: true
                    });
                    
                    if (account) {
                        console.log(`✅ Found partial match: ${account.code} - ${account.name}`);
                        break;
                    }
                }
            }
            
            // If still no match, try to find any asset account that might be suitable
            if (!account) {
                // Look for common asset account types
                const fallbackAccount = await Account.findOne({
                    type: 'Asset',
                    isActive: true,
                    $or: [
                        { name: { $regex: /bank/i } },
                        { name: { $regex: /cash/i } },
                        { name: { $regex: /account/i } }
                    ]
                });
                
                if (fallbackAccount) {
                    console.log(`⚠️  Using fallback account: ${fallbackAccount.code} - ${fallbackAccount.name}`);
                    account = fallbackAccount;
                }
            }
            
            if (account) {
                console.log(`💰 Payment method '${paymentMethod}' resolved to: ${account.code} - ${account.name}`);
                return account;
            } else {
                console.log(`❌ No suitable account found for payment method: ${paymentMethod}`);
                return null;
            }
            
        } catch (error) {
            console.error(`❌ Error resolving payment method ${paymentMethod}:`, error);
            return null;
        }
    }
    
    /**
     * Get the appropriate expense account for a category
     * @param {string} category - The expense category (e.g., 'Maintenance', 'Utilities')
     * @returns {Promise<Object>} The account object or null if not found
     */
    static async getExpenseAccount(category) {
        try {
            console.log(`🔍 Resolving expense category: ${category}`);
            
            // Define category patterns to search for in account names
            const categoryPatterns = {
                'Maintenance': ['maintenance', 'repair', 'property maintenance', 'emergency repairs'],
                'Utilities': ['utilities', 'water', 'electricity', 'gas'],
                'Water': ['water', 'utilities'],
                'Electricity': ['electricity', 'utilities', 'power'],
                'Gas': ['gas', 'utilities'],
                'WiFi': ['wifi', 'internet', 'communication'],
                'Internet': ['internet', 'wifi', 'communication'],
                'Taxes': ['taxes', 'operating', 'other'],
                'Insurance': ['insurance', 'operating', 'other'],
                'Salaries': ['salaries', 'wages', 'payroll', 'operating'],
                'Supplies': ['supplies', 'materials', 'maintenance supplies'],
                'Other': ['other', 'operating', 'miscellaneous']
            };
            
            const patterns = categoryPatterns[category];
            if (!patterns) {
                console.log(`⚠️  No patterns defined for category: ${category}`);
                return null;
            }
            
            // Search for expense accounts that match the patterns
            let account = null;
            
            for (const pattern of patterns) {
                account = await Account.findOne({
                    name: { $regex: new RegExp(pattern, 'i') },
                    type: 'Expense',
                    isActive: true
                });
                
                if (account) {
                    console.log(`✅ Found expense account: ${account.code} - ${account.name}`);
                    break;
                }
            }
            
            // If no match, try to find any expense account
            if (!account) {
                const fallbackAccount = await Account.findOne({
                    type: 'Expense',
                    isActive: true
                });
                
                if (fallbackAccount) {
                    console.log(`⚠️  Using fallback expense account: ${fallbackAccount.code} - ${fallbackAccount.name}`);
                    account = fallbackAccount;
                }
            }
            
            if (account) {
                console.log(`💰 Expense category '${category}' resolved to: ${account.code} - ${account.name}`);
                return account;
            } else {
                console.log(`❌ No suitable expense account found for category: ${category}`);
                return null;
            }
            
        } catch (error) {
            console.error(`❌ Error resolving expense category ${category}:`, error);
            return null;
        }
    }
    
    /**
     * Get all available payment source accounts (for frontend dropdowns)
     * @returns {Promise<Array>} Array of available payment source accounts
     */
    static async getAvailablePaymentSourceAccounts() {
        try {
            const accounts = await Account.find({
                type: 'Asset',
                isActive: true,
                $or: [
                    { name: { $regex: /bank/i } },
                    { name: { $regex: /cash/i } },
                    { name: { $regex: /account/i } },
                    { name: { $regex: /wallet/i } },
                    { name: { $regex: /mobile/i } }
                ]
            }).select('code name type description').sort('name');
            
            console.log(`💰 Found ${accounts.length} available payment source accounts`);
            return accounts;
            
        } catch (error) {
            console.error('❌ Error fetching available payment source accounts:', error);
            return [];
        }
    }
    
    /**
     * Get all available expense accounts (for frontend dropdowns)
     * @returns {Promise<Array>} Array of available expense accounts
     */
    static async getAvailableExpenseAccounts() {
        try {
            const accounts = await Account.find({
                type: 'Expense',
                isActive: true
            }).select('code name type description category').sort('name');
            
            console.log(`💰 Found ${accounts.length} available expense accounts`);
            return accounts;
            
        } catch (error) {
            console.error('❌ Error fetching available expense accounts:', error);
            return [];
        }
    }
    
    /**
     * Validate that a payment method can be resolved to an account
     * @param {string} paymentMethod - The payment method to validate
     * @returns {Promise<boolean>} True if resolvable, false otherwise
     */
    static async validatePaymentMethod(paymentMethod) {
        const account = await this.getPaymentSourceAccount(paymentMethod);
        return account !== null;
    }
    
    /**
     * Get a list of all supported payment methods
     * @returns {Array} Array of supported payment method names
     */
    static getSupportedPaymentMethods() {
        return [
            'Bank Transfer',
            'Cash',
            'Ecocash',
            'Innbucks',
            'Online Payment',
            'MasterCard',
            'Visa',
            'PayPal',
            'Petty Cash'
        ];
    }
}

module.exports = DynamicAccountResolver;
