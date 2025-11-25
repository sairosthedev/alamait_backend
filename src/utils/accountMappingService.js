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
     * First tries to find matching accounts in the database, then falls back to keyword mappings
     */
    static async getAccountByKeywords(searchText) {
        // Priority 1: Search the database for accounts that match keywords in their name or description
        // IMPORTANT: Order matters - more specific keywords should come first
        // IMPORTANT: Fuel and gas are different - search for them separately
        // Use whatever account exists in the database - don't hardcode account codes
        const keywordMatches = [
            // Fuel/Transportation keywords - HIGHEST PRIORITY (check first)
            // Search for accounts with fuel-related terms (NOT gas - that's separate)
            { keywords: ['fuel', 'gasoline', 'diesel', 'petrol', 'toll', 'toll gate', 'tollgate', 'transport', 'travel'], searchTerms: ['fuel', 'transport', 'toll', 'gasoline', 'diesel', 'petrol'], priority: 'fuel' },
            // Water & Utilities
            { keywords: ['water', 'sewer'], searchTerms: ['water', 'sewer'] },
            { keywords: ['electricity', 'power'], searchTerms: ['electricity', 'power'] },
            // Gas is separate from fuel - search for gas accounts specifically
            { keywords: ['gas'], searchTerms: ['gas'], excludeTerms: ['fuel', 'gasoline', 'diesel', 'petrol'] },
            { keywords: ['internet', 'wifi', 'telephone', 'phone'], searchTerms: ['internet', 'wifi', 'telephone'] },
            // Maintenance & Repairs
            { keywords: ['plumbing', 'pipe', 'drain', 'tap', 'toilet', 'sink'], searchTerms: ['plumbing'] },
            { keywords: ['electrical', 'wiring', 'light', 'switch', 'outlet'], searchTerms: ['electrical', 'electricity'] },
            { keywords: ['hvac', 'heating', 'air conditioning', 'ventilation'], searchTerms: ['hvac', 'heating', 'air'] },
            { keywords: ['roof'], searchTerms: ['roof'] },
            { keywords: ['painting', 'paint', 'wall', 'ceiling'], searchTerms: ['painting', 'paint'] },
            { keywords: ['carpentry', 'wood', 'door', 'window', 'cabinet'], searchTerms: ['carpentry', 'wood', 'window'] },
            { keywords: ['flooring', 'floor'], searchTerms: ['flooring', 'floor'] },
            // Cleaning & Services
            { keywords: ['cleaning', 'clean', 'janitorial', 'housekeeping'], searchTerms: ['cleaning', 'clean'] },
            { keywords: ['security', 'guard', 'patrol', 'camera', 'alarm'], searchTerms: ['security', 'guard'] },
            { keywords: ['landscaping', 'garden', 'gardening', 'lawn'], searchTerms: ['landscaping', 'garden', 'lawn'] },
            // Supplies & Materials
            { keywords: ['supplies'], searchTerms: ['supplies'] },
            { keywords: ['materials', 'building materials'], searchTerms: ['materials'] },
            { keywords: ['tools', 'tool', 'equipment'], searchTerms: ['tools', 'equipment'] },
            // Insurance & Legal
            { keywords: ['insurance'], searchTerms: ['insurance'] },
            { keywords: ['legal', 'lawyer', 'attorney'], searchTerms: ['legal', 'lawyer'] },
            // Taxes & Fees
            { keywords: ['tax', 'property tax'], searchTerms: ['tax'] },
            { keywords: ['permit', 'license'], searchTerms: ['permit', 'license'] },
            // Administrative
            { keywords: ['office'], searchTerms: ['office'] },
            { keywords: ['administrative', 'admin'], searchTerms: ['administrative', 'admin'] },
            { keywords: ['management', 'property management'], searchTerms: ['management'] },
            { keywords: ['accounting', 'bookkeeping'], searchTerms: ['accounting', 'bookkeeping'] }
        ];

        // Try to find matching account in database for each keyword group
        // Return immediately on first match (prioritizes order)
        // Use whatever account exists in the database - don't hardcode
        let matchedKeywordGroup = null;
        for (const { keywords, searchTerms, priority } of keywordMatches) {
            // Check if any keyword matches the search text
            const hasKeywordMatch = keywords.some(keyword => searchText.includes(keyword));
            if (hasKeywordMatch) {
                matchedKeywordGroup = { keywords, searchTerms, priority };
                
                // For fuel priority, do a comprehensive search of all possible fuel-related accounts
                // IMPORTANT: Fuel and gas are different - only search for fuel, not gas
                if (priority === 'fuel') {
                    // First, search by name/description with fuel-related terms (NOT gas)
                    for (const term of searchTerms) {
                        const matchingAccount = await Account.findOne({
                            type: 'Expense',
                            isActive: true,
                            $or: [
                                { name: { $regex: term, $options: 'i' } },
                                { description: { $regex: term, $options: 'i' } }
                            ]
                        }).sort({ code: 1 });
                        
                        if (matchingAccount) {
                            // Verify it's fuel-related, not gas (unless it's gasoline)
                            const accountName = (matchingAccount.name || '').toLowerCase();
                            if (!accountName.includes('gas') || accountName.includes('gasoline') || accountName.includes('fuel')) {
                                console.log(`✅ Found fuel account in database: ${matchingAccount.code} - ${matchingAccount.name} for keyword: ${term} (matched: ${keywords.filter(k => searchText.includes(k)).join(', ')})`);
                                return matchingAccount.code;
                            }
                        }
                    }
                    
                    // If no direct match, try to find any expense account that might be fuel-related
                    // Search all expense accounts and look for fuel-related keywords (NOT gas)
                    const allExpenseAccounts = await Account.find({ 
                        type: 'Expense', 
                        isActive: true 
                    }).sort({ code: 1 });
                    
                    for (const account of allExpenseAccounts) {
                        const accountName = (account.name || '').toLowerCase();
                        const accountDesc = ((account.description || '') + ' ' + accountName).toLowerCase();
                        
                        // Check if account name/description contains fuel-related keywords (NOT gas)
                        if ((accountDesc.includes('fuel') || accountDesc.includes('gasoline') || 
                            accountDesc.includes('diesel') || accountDesc.includes('petrol') ||
                            accountDesc.includes('transport') || accountDesc.includes('toll')) &&
                            !accountDesc.includes('gas') || accountDesc.includes('gasoline')) {
                            console.log(`✅ Found fuel account in database: ${account.code} - ${account.name} for keyword match: ${keywords.filter(k => searchText.includes(k)).join(', ')}`);
                            return account.code;
                        }
                    }
                    
                    console.log(`⚠️ Fuel keyword match found (${keywords.filter(k => searchText.includes(k)).join(', ')}) but no fuel account found in database for search terms: ${searchTerms.join(', ')}`);
                    break; // Stop searching other keyword groups
                } else if (keywords.includes('gas') && !keywords.includes('fuel') && !keywords.includes('gasoline')) {
                    // Gas is separate from fuel - search for gas accounts specifically
                    // Make sure we exclude fuel-related terms
                    const gasAccount = await Account.findOne({
                        type: 'Expense',
                        isActive: true,
                        $and: [
                            {
                                $or: [
                                    { name: { $regex: /gas/i } },
                                    { description: { $regex: /gas/i } }
                                ]
                            },
                            {
                                name: { $not: { $regex: /fuel|gasoline|diesel|petrol/i } } },
                            {
                                description: { $not: { $regex: /fuel|gasoline|diesel|petrol/i } } }
                        ]
                    }).sort({ code: 1 });
                    
                    if (gasAccount) {
                        console.log(`✅ Found gas account in database: ${gasAccount.code} - ${gasAccount.name} for keyword: gas`);
                        return gasAccount.code;
                    }
                } else {
                    // For non-fuel keywords, use standard search
                    for (const term of searchTerms) {
                        const matchingAccount = await Account.findOne({
                            type: 'Expense',
                            isActive: true,
                            $or: [
                                { name: { $regex: term, $options: 'i' } },
                                { description: { $regex: term, $options: 'i' } }
                            ]
                        }).sort({ code: 1 });
                        
                        if (matchingAccount) {
                            console.log(`✅ Found matching account in database: ${matchingAccount.code} - ${matchingAccount.name} for keyword: ${term} (matched: ${keywords.filter(k => searchText.includes(k)).join(', ')})`);
                            return matchingAccount.code;
                        }
                    }
                }
            }
        }

        // Priority 2: Fallback to default keyword mappings if no database match found
        const keywordMappings = {
            // Water & Utilities
            'water': { code: '5004', name: 'Utilities - Water' },
            'sewer': { code: '5004', name: 'Utilities - Water' },
            'electricity': { code: '5003', name: 'Utilities - Electricity' },
            'power': { code: '5003', name: 'Utilities - Electricity' },
            'gas': { code: '5005', name: 'Utilities - Gas' },
            'internet': { code: '5006', name: 'WiFi & Internet' },
            'wifi': { code: '5006', name: 'WiFi & Internet' },
            'telephone': { code: '5006', name: 'WiFi & Internet' },
            'phone': { code: '5006', name: 'WiFi & Internet' },
            
            // Maintenance & Repairs
            'plumbing': { code: '5000', name: 'Plumbing Expenses' },
            'electrical': { code: '5007', name: 'Property Maintenance' },
            'hvac': { code: '5007', name: 'Property Maintenance' },
            'heating': { code: '5007', name: 'Property Maintenance' },
            'air conditioning': { code: '5007', name: 'Property Maintenance' },
            'roof': { code: '5007', name: 'Property Maintenance' },
            'painting': { code: '5007', name: 'Property Maintenance' },
            'carpentry': { code: '5007', name: 'Property Maintenance' },
            'flooring': { code: '5007', name: 'Property Maintenance' },
            'window': { code: '5007', name: 'Property Maintenance' },
            
            // Cleaning & Services
            'cleaning': { code: '5009', name: 'Cleaning Services' },
            'janitorial': { code: '5009', name: 'Cleaning Services' },
            'housekeeping': { code: '5009', name: 'Cleaning Services' },
            'security': { code: '5014', name: 'Security Services' },
            'guard': { code: '5014', name: 'Security Services' },
            'patrol': { code: '5014', name: 'Security Services' },
            'landscaping': { code: '5007', name: 'Property Maintenance' },
            'gardening': { code: '5007', name: 'Property Maintenance' },
            'lawn': { code: '5007', name: 'Property Maintenance' },
            
            // Transportation & Logistics - try to use existing gas account
            'transport': { code: '5005', name: 'Utilities - Gas' },
            'delivery': { code: '5005', name: 'Utilities - Gas' },
            'shipping': { code: '5005', name: 'Utilities - Gas' },
            'fuel': { code: '5005', name: 'Utilities - Gas' },
            'gasoline': { code: '5005', name: 'Utilities - Gas' },
            'diesel': { code: '5005', name: 'Utilities - Gas' },
            'toll': { code: '5005', name: 'Utilities - Gas' },
            'toll gate': { code: '5005', name: 'Utilities - Gas' },
            'tollgate': { code: '5005', name: 'Utilities - Gas' },
            'petrol': { code: '5005', name: 'Utilities - Gas' },
            
            // Supplies & Materials
            'supplies': { code: '5011', name: 'Maintenance Supplies' },
            'materials': { code: '5011', name: 'Maintenance Supplies' },
            'tools': { code: '5011', name: 'Maintenance Supplies' },
            'equipment': { code: '5011', name: 'Maintenance Supplies' }
        };

        // Check for keyword matches as fallback - only use accounts that exist in database
        // IMPORTANT: Check priority keywords (like fuel) first
        const priorityKeywords = [];
        const regularKeywords = [];
        
        for (const [keyword, accountInfo] of Object.entries(keywordMappings)) {
            if (accountInfo.priority) {
                priorityKeywords.push([keyword, accountInfo]);
            } else {
                regularKeywords.push([keyword, accountInfo]);
            }
        }
        
        // Check priority keywords first (fuel, toll, etc.)
        for (const [keyword, accountInfo] of priorityKeywords) {
            if (searchText.includes(keyword)) {
                const account = await Account.findOne({ 
                    code: accountInfo.code, 
                    type: 'Expense',
                    isActive: true 
                });
                if (account) {
                    console.log(`✅ Using existing account from fallback (PRIORITY): ${account.code} - ${account.name} for keyword: ${keyword}`);
                    return account.code;
                } else {
                    console.log(`⚠️ Priority account ${accountInfo.code} (${accountInfo.name}) not found in database, skipping fallback for keyword: ${keyword}`);
                }
            }
        }
        
        // Then check regular keywords
        for (const [keyword, accountInfo] of regularKeywords) {
            if (searchText.includes(keyword)) {
                const account = await Account.findOne({ 
                    code: accountInfo.code, 
                    type: 'Expense',
                    isActive: true 
                });
                if (account) {
                    console.log(`✅ Using existing account from fallback: ${account.code} - ${account.name} for keyword: ${keyword}`);
                    return account.code;
                } else {
                    console.log(`⚠️ Account ${accountInfo.code} (${accountInfo.name}) not found in database, skipping fallback for keyword: ${keyword}`);
                }
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