const Account = require('../models/Account');

class AccountCodeService {
  /**
   * Generate the next available account code based on type and category
   * @param {string} type - Account type (Asset, Liability, Income, Expense, Equity)
   * @param {string} category - Account category
   * @returns {Promise<string>} Generated account code
   */
  static async generateAccountCode(type, category = null) {
    try {
      const code = await Account.getNextCode(type, category);
      return code;
    } catch (error) {
      console.error('Error generating account code:', error);
      throw new Error('Failed to generate account code');
    }
  }

  /**
   * Validate account code format
   * @param {string} code - Account code to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static validateCodeFormat(code) {
    return Account.validateCodeFormat(code);
  }

  /**
   * Check if account code already exists
   * @param {string} code - Account code to check
   * @returns {Promise<boolean>} True if exists, false otherwise
   */
  static async codeExists(code) {
    try {
      const existingAccount = await Account.findOne({ code });
      return !!existingAccount;
    } catch (error) {
      console.error('Error checking code existence:', error);
      throw new Error('Failed to check code existence');
    }
  }

  /**
   * Get suggested categories based on account type
   * @param {string} type - Account type
   * @returns {Array<string>} Array of suggested categories
   */
  static getSuggestedCategories(type) {
    const categoryMap = {
      'Asset': ['Current Assets', 'Fixed Assets', 'Other Assets'],
      'Liability': ['Current Liabilities', 'Long-term Liabilities'],
      'Equity': ['Owner Equity', 'Retained Earnings'],
      'Income': ['Operating Revenue', 'Other Income'],
      'Expense': ['Operating Expenses', 'Administrative Expenses', 'Financial Expenses']
    };

    return categoryMap[type] || [];
  }

  /**
   * Get account type information including prefix and description
   * @param {string} type - Account type
   * @returns {Object} Type information
   */
  static getAccountTypeInfo(type) {
    const typeInfo = {
      'Asset': {
        prefix: '1',
        description: 'Resources owned by the business',
        normalBalance: 'Debit'
      },
      'Liability': {
        prefix: '2',
        description: 'Obligations owed to others',
        normalBalance: 'Credit'
      },
      'Equity': {
        prefix: '3',
        description: 'Owner\'s investment and retained earnings',
        normalBalance: 'Credit'
      },
      'Income': {
        prefix: '4',
        description: 'Revenue and income sources',
        normalBalance: 'Credit'
      },
      'Expense': {
        prefix: '5',
        description: 'Costs and expenses incurred',
        normalBalance: 'Debit'
      }
    };

    return typeInfo[type] || null;
  }

  /**
   * Generate a custom account code with specific logic
   * @param {Object} accountData - Account data
   * @returns {Promise<string>} Generated custom code
   */
  static async generateCustomCode(accountData) {
    const { type, category, subcategory, name } = accountData;
    
    // Get base code
    let baseCode = await this.generateAccountCode(type, category);
    
    // If subcategory is provided, modify the code
    if (subcategory) {
      // Add subcategory identifier to the code
      const subcategoryCode = this.getSubcategoryCode(subcategory);
      if (subcategoryCode) {
        baseCode = baseCode.slice(0, -1) + subcategoryCode;
      }
    }
    
    return baseCode;
  }

  /**
   * Get subcategory code mapping
   * @param {string} subcategory - Subcategory name
   * @returns {string} Subcategory code
   */
  static getSubcategoryCode(subcategory) {
    const subcategoryMap = {
      'Cash': '1',
      'Bank': '2',
      'Accounts Receivable': '3',
      'Inventory': '4',
      'Prepaid Expenses': '5',
      'Fixed Assets': '6',
      'Accounts Payable': '1',
      'Accrued Expenses': '2',
      'Loans': '3',
      'Taxes Payable': '4',
      'Rental Income': '1',
      'Service Income': '2',
      'Interest Income': '3',
      'Salary': '1',
      'Rent': '2',
      'Utilities': '3',
      'Maintenance': '4',
      'Insurance': '5',
      'Depreciation': '6'
    };

    return subcategoryMap[subcategory] || '0';
  }

  /**
   * Validate complete account data before creation
   * @param {Object} accountData - Account data to validate
   * @returns {Object} Validation result
   */
  static async validateAccountData(accountData) {
    const { name, type, category } = accountData;
    const errors = [];

    // Required field validation
    if (!name || name.trim().length === 0) {
      errors.push('Account name is required');
    }

    if (!type) {
      errors.push('Account type is required');
    }

    if (!category) {
      errors.push('Account category is required');
    }

    // Type validation
    const validTypes = ['Asset', 'Liability', 'Income', 'Expense', 'Equity'];
    if (type && !validTypes.includes(type)) {
      errors.push('Invalid account type');
    }

    // Category validation
    const suggestedCategories = this.getSuggestedCategories(type);
    if (category && suggestedCategories.length > 0 && !suggestedCategories.includes(category)) {
      errors.push(`Invalid category for ${type} type. Valid categories: ${suggestedCategories.join(', ')}`);
    }

    // Name uniqueness check
    if (name) {
      const existingAccount = await Account.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        isActive: true 
      });
      if (existingAccount) {
        errors.push('Account name already exists');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get account code suggestions for a given type and category
   * @param {string} type - Account type
   * @param {string} category - Account category
   * @returns {Promise<Array>} Array of suggested codes
   */
  static async getCodeSuggestions(type, category) {
    try {
      const suggestions = [];
      
      // Generate next 3 available codes
      for (let i = 0; i < 3; i++) {
        const code = await this.generateAccountCode(type, category);
        suggestions.push({
          code,
          description: `${code} - Next available code for ${type} (${category})`
        });
      }

      return suggestions;
    } catch (error) {
      console.error('Error generating code suggestions:', error);
      return [];
    }
  }

  /**
   * Bulk generate codes for multiple accounts
   * @param {Array} accountsData - Array of account data
   * @returns {Promise<Array>} Array of accounts with generated codes
   */
  static async bulkGenerateCodes(accountsData) {
    const results = [];
    
    for (const accountData of accountsData) {
      try {
        const validation = await this.validateAccountData(accountData);
        
        if (!validation.isValid) {
          results.push({
            ...accountData,
            code: null,
            errors: validation.errors
          });
          continue;
        }

        const code = await this.generateAccountCode(accountData.type, accountData.category);
        results.push({
          ...accountData,
          code,
          errors: []
        });
      } catch (error) {
        results.push({
          ...accountData,
          code: null,
          errors: [error.message]
        });
      }
    }

    return results;
  }
}

module.exports = AccountCodeService; 