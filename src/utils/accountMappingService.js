const Account = require('../models/Account');

/**
 * Comprehensive Account Mapping Service
 * 
 * This service ensures proper account allocation based on:
 * 1. Item title and description keywords
 * 2. Provider/vendor information
 * 3. Category classification
 * 4. Specific expense types
 */

class AccountMappingService {

    /**
     * Get the most appropriate expense account based on item content
     */
    static async getExpenseAccountForItem(item) {
        try {
            const { title, description, category, provider } = item;
            
            // Combine all text for keyword analysis
            const searchText = `${title} ${description} ${provider || ''}`.toLowerCase();
            
            // Check for specific keywords first (most specific)
            const specificAccount = await this.getAccountByKeywords(searchText);
            if (specificAccount) {
                return specificAccount;
            }
            
            // Check by provider/vendor type
            const providerAccount = await this.getAccountByProvider(provider);
            if (providerAccount) {
                return providerAccount;
            }
            
            // Check by category
            const categoryAccount = await this.getAccountByCategory(category);
            if (categoryAccount) {
                return categoryAccount;
            }
            
            // Default fallback
            return await this.getDefaultExpenseAccount();
            
        } catch (error) {
            console.error('Error getting expense account for item:', error);
            return await this.getDefaultExpenseAccount();
        }
    }

    /**
     * Get account by specific keywords in title/description
     */
    static async getAccountByKeywords(searchText) {
        const keywordMappings = {
            // Water & Utilities
            'water': { code: '5001', name: 'Water & Sewer Expense' },
            'sewer': { code: '5001', name: 'Water & Sewer Expense' },
            'electricity': { code: '5002', name: 'Electricity Expense' },
            'power': { code: '5002', name: 'Electricity Expense' },
            'gas': { code: '5003', name: 'Gas Expense' },
            'internet': { code: '5004', name: 'Internet & Communication Expense' },
            'wifi': { code: '5004', name: 'Internet & Communication Expense' },
            'telephone': { code: '5004', name: 'Internet & Communication Expense' },
            'phone': { code: '5004', name: 'Internet & Communication Expense' },
            
            // Maintenance & Repairs
            'plumbing': { code: '5005', name: 'Plumbing Maintenance Expense' },
            'electrical': { code: '5006', name: 'Electrical Maintenance Expense' },
            'hvac': { code: '5007', name: 'HVAC Maintenance Expense' },
            'heating': { code: '5007', name: 'HVAC Maintenance Expense' },
            'air conditioning': { code: '5007', name: 'HVAC Maintenance Expense' },
            'roof': { code: '5008', name: 'Roof Maintenance Expense' },
            'painting': { code: '5009', name: 'Painting & Decorating Expense' },
            'carpentry': { code: '5010', name: 'Carpentry Maintenance Expense' },
            'flooring': { code: '5011', name: 'Flooring Maintenance Expense' },
            
            // Cleaning & Services
            'cleaning': { code: '5012', name: 'Cleaning Services Expense' },
            'janitorial': { code: '5012', name: 'Cleaning Services Expense' },
            'housekeeping': { code: '5012', name: 'Cleaning Services Expense' },
            'security': { code: '5013', name: 'Security Services Expense' },
            'guard': { code: '5013', name: 'Security Services Expense' },
            'patrol': { code: '5013', name: 'Security Services Expense' },
            'landscaping': { code: '5014', name: 'Landscaping Expense' },
            'gardening': { code: '5014', name: 'Landscaping Expense' },
            'lawn': { code: '5014', name: 'Landscaping Expense' },
            
            // Transportation & Logistics
            'transport': { code: '5015', name: 'Transportation Expense' },
            'delivery': { code: '5015', name: 'Transportation Expense' },
            'shipping': { code: '5015', name: 'Transportation Expense' },
            'fuel': { code: '5016', name: 'Fuel Expense' },
            'gasoline': { code: '5016', name: 'Fuel Expense' },
            'diesel': { code: '5016', name: 'Fuel Expense' },
            'toll': { code: '5016', name: 'Fuel Expense' },
            'toll gate': { code: '5016', name: 'Fuel Expense' },
            'tollgate': { code: '5016', name: 'Fuel Expense' },
            'petrol': { code: '5016', name: 'Fuel Expense' },
            
            // Supplies & Materials
            'supplies': { code: '5017', name: 'Office Supplies Expense' },
            'materials': { code: '5018', name: 'Building Materials Expense' },
            'tools': { code: '5019', name: 'Tools & Equipment Expense' },
            'equipment': { code: '5019', name: 'Tools & Equipment Expense' },
            
            // Insurance & Legal
            'insurance': { code: '5020', name: 'Insurance Expense' },
            'legal': { code: '5021', name: 'Legal & Professional Expense' },
            'lawyer': { code: '5021', name: 'Legal & Professional Expense' },
            'attorney': { code: '5021', name: 'Legal & Professional Expense' },
            
            // Taxes & Fees
            'tax': { code: '5022', name: 'Property Tax Expense' },
            'permit': { code: '5023', name: 'Permits & Licenses Expense' },
            'license': { code: '5023', name: 'Permits & Licenses Expense' },
            'fee': { code: '5024', name: 'Miscellaneous Fees Expense' },
            
            // Administrative
            'office': { code: '5025', name: 'Office Expense' },
            'administrative': { code: '5026', name: 'Administrative Expense' },
            'management': { code: '5027', name: 'Property Management Expense' },
            'accounting': { code: '5028', name: 'Accounting & Bookkeeping Expense' },
            'bookkeeping': { code: '5028', name: 'Accounting & Bookkeeping Expense' }
        };

        // Check for keyword matches
        for (const [keyword, accountInfo] of Object.entries(keywordMappings)) {
            if (searchText.includes(keyword)) {
                return await this.getOrCreateAccount(accountInfo.code, accountInfo.name, 'Expense');
            }
        }

        return null;
    }

    /**
     * Get account by provider/vendor type
     */
    static async getAccountByProvider(provider) {
        if (!provider) return null;

        const providerText = provider.toLowerCase();
        
        const providerMappings = {
            // Utility providers
            'zimbabwe national water': { code: '5001', name: 'Water & Sewer Expense' },
            'zimbabwe electricity': { code: '5002', name: 'Electricity Expense' },
            'zera': { code: '5002', name: 'Electricity Expense' },
            'zimbabwe power': { code: '5002', name: 'Electricity Expense' },
            
            // Cleaning companies
            'cleanpro': { code: '5012', name: 'Cleaning Services Expense' },
            'clean': { code: '5012', name: 'Cleaning Services Expense' },
            'janitorial': { code: '5012', name: 'Cleaning Services Expense' },
            
            // Security companies
            'secureguard': { code: '5013', name: 'Security Services Expense' },
            'security': { code: '5013', name: 'Security Services Expense' },
            'guard': { code: '5013', name: 'Security Services Expense' },
            
            // Maintenance companies
            'maintainpro': { code: '5005', name: 'General Maintenance Expense' },
            'maintenance': { code: '5005', name: 'General Maintenance Expense' },
            'repair': { code: '5005', name: 'General Maintenance Expense' },
            
            // Landscaping
            'landscape': { code: '5014', name: 'Landscaping Expense' },
            'garden': { code: '5014', name: 'Landscaping Expense' },
            'lawn': { code: '5014', name: 'Landscaping Expense' }
        };

        for (const [providerKeyword, accountInfo] of Object.entries(providerMappings)) {
            if (providerText.includes(providerKeyword)) {
                return await this.getOrCreateAccount(accountInfo.code, accountInfo.name, 'Expense');
            }
        }

        return null;
    }

    /**
     * Get account by category
     */
    static async getAccountByCategory(category) {
        if (!category) return null;

        const categoryMappings = {
            'utilities': { code: '5001', name: 'Utilities Expense' },
            'maintenance': { code: '5005', name: 'General Maintenance Expense' },
            'supplies': { code: '5017', name: 'Office Supplies Expense' },
            'equipment': { code: '5019', name: 'Tools & Equipment Expense' },
            'services': { code: '5029', name: 'Professional Services Expense' },
            'cleaning': { code: '5012', name: 'Cleaning Services Expense' },
            'security': { code: '5013', name: 'Security Services Expense' },
            'landscaping': { code: '5014', name: 'Landscaping Expense' },
            'transportation': { code: '5015', name: 'Transportation Expense' },
            'insurance': { code: '5020', name: 'Insurance Expense' },
            'legal': { code: '5021', name: 'Legal & Professional Expense' },
            'taxes': { code: '5022', name: 'Property Tax Expense' },
            'administrative': { code: '5026', name: 'Administrative Expense' },
            'management': { code: '5027', name: 'Property Management Expense' },
            'other': { code: '5099', name: 'Other Operating Expenses' }
        };

        const accountInfo = categoryMappings[category.toLowerCase()];
        if (accountInfo) {
            return await this.getOrCreateAccount(accountInfo.code, accountInfo.name, 'Expense');
        }

        return null;
    }

    /**
     * Get default expense account
     */
    static async getDefaultExpenseAccount() {
        return await this.getOrCreateAccount('5099', 'Other Operating Expenses', 'Expense');
    }

    /**
     * Get or create account
     */
    static async getOrCreateAccount(code, name, type) {
        let account = await Account.findOne({ code });
        
        if (!account) {
            account = new Account({
                code,
                name,
                type,
                isActive: true,
                description: `Auto-created for ${name}`,
                category: this.getCategoryFromType(type)
            });
            await account.save();
            console.log(`✅ Created new account: ${code} - ${name}`);
        }
        
        return account.code;
    }

    /**
     * Get category from account type
     */
    static getCategoryFromType(type) {
        const typeCategories = {
            'Asset': 'Current Assets',
            'Liability': 'Current Liabilities',
            'Equity': 'Owner Equity',
            'Income': 'Operating Revenue',
            'Expense': 'Operating Expenses'
        };
        
        return typeCategories[type] || 'Other';
    }

    /**
     * Get payment source account by payment method
     */
    static async getPaymentSourceAccount(paymentMethod) {
        const paymentMappings = {
            'Bank Transfer': '1000', // Bank Account
            'Cash': '1015', // Cash on Hand
            'Online Payment': '1000', // Bank Account
            'Ecocash': '1016', // Mobile Money - Ecocash
            'Innbucks': '1017', // Mobile Money - Innbucks
            'MasterCard': '1000', // Bank Account
            'Visa': '1000', // Bank Account
            'PayPal': '1000', // Bank Account
            'Petty Cash': '1010' // Petty Cash
        };

        const accountCode = paymentMappings[paymentMethod] || '1000';
        return await this.getOrCreateAccount(accountCode, this.getPaymentAccountName(paymentMethod), 'Asset');
    }

    /**
     * Get payment account name
     */
    static getPaymentAccountName(paymentMethod) {
        const accountNames = {
            'Bank Transfer': 'Bank Account',
            'Cash': 'Cash on Hand',
            'Online Payment': 'Bank Account',
            'Ecocash': 'Mobile Money - Ecocash',
            'Innbucks': 'Mobile Money - Innbucks',
            'MasterCard': 'Bank Account',
            'Visa': 'Bank Account',
            'PayPal': 'Bank Account',
            'Petty Cash': 'Petty Cash'
        };

        return accountNames[paymentMethod] || 'Bank Account';
    }

    /**
     * Validate account mapping for an item
     */
    static async validateAccountMapping(item) {
        const accountCode = await this.getExpenseAccountForItem(item);
        const account = await Account.findOne({ code: accountCode });
        
        return {
            itemTitle: item.title,
            itemDescription: item.description,
            provider: item.provider,
            category: item.category,
            mappedAccountCode: accountCode,
            mappedAccountName: account ? account.name : 'Unknown',
            isValid: !!account
        };
    }

    /**
     * Get all expense accounts for reference
     */
    static async getAllExpenseAccounts() {
        return await Account.find({ type: 'Expense' }).sort({ code: 1 });
    }
}

module.exports = AccountMappingService; 