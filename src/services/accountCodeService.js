const Account = require('../models/Account');

/**
 * Canonical chart-of-accounts types + categories for account creation.
 * API accepts "Revenue" (alias) and stores it as "Income" for report compatibility.
 */
const ACCOUNT_TYPE_DEFS = [
  {
    value: 'Asset',
    label: 'Asset',
    storageType: 'Asset',
    prefix: '1',
    description: 'Resources owned by the business',
    normalBalance: 'Debit',
    categories: [
      'Current Assets',
      'Fixed Assets',
      'Non-Current Assets',
      'Intangible Assets',
      'Other Assets'
    ]
  },
  {
    value: 'Liability',
    label: 'Liability',
    storageType: 'Liability',
    prefix: '2',
    description: 'Obligations owed to others',
    normalBalance: 'Credit',
    categories: [
      'Current Liabilities',
      'Long-term Liabilities',
      'Non-Current Liabilities',
      'Other Liabilities'
    ]
  },
  {
    value: 'Equity',
    label: 'Equity',
    storageType: 'Equity',
    prefix: '3',
    description: "Owner's investment and retained earnings",
    normalBalance: 'Credit',
    categories: [
      'Owner Equity',
      'Retained Earnings',
      'Capital',
      'Drawings',
      'Other Equity'
    ]
  },
  {
    value: 'Revenue',
    label: 'Revenue',
    storageType: 'Income',
    prefix: '4',
    description: 'Revenue and income sources',
    normalBalance: 'Credit',
    categories: [
      'Operating Revenue',
      'Other Income',
      'Other Revenue',
      'Non-Operating Revenue'
    ]
  },
  {
    value: 'Expense',
    label: 'Expense',
    storageType: 'Expense',
    prefix: '5',
    description: 'Costs and expenses incurred',
    normalBalance: 'Debit',
    categories: [
      'Operating Expenses',
      'Administrative Expenses',
      'Financial Expenses',
      'Cost of Sales',
      'Other Expenses'
    ]
  }
];

/** All categories allowed on the Account model (union of the above). */
const ALL_CATEGORIES = [
  ...new Set(ACCOUNT_TYPE_DEFS.flatMap((t) => t.categories))
];

/** Storage types persisted on Account.type */
const STORAGE_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

/** API-facing type names (includes Revenue). */
const API_TYPES = ACCOUNT_TYPE_DEFS.map((t) => t.value);

function titleCaseType(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  const map = {
    asset: 'Asset',
    assets: 'Asset',
    liability: 'Liability',
    liabilities: 'Liability',
    equity: 'Equity',
    revenue: 'Revenue',
    income: 'Revenue', // API prefers Revenue; storage still Income
    expense: 'Expense',
    expenses: 'Expense'
  };
  return map[lower] || s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Normalize incoming type to { apiType, storageType }.
 * Accepts Asset|Liability|Equity|Revenue|Income|Expense (any case).
 */
function normalizeAccountType(rawType) {
  const apiType = titleCaseType(rawType);
  if (apiType === 'Income') {
    return { apiType: 'Revenue', storageType: 'Income' };
  }
  const def = ACCOUNT_TYPE_DEFS.find((t) => t.value === apiType);
  if (!def) return null;
  return { apiType: def.value, storageType: def.storageType };
}

function getCategoriesForType(rawType) {
  const normalized = normalizeAccountType(rawType);
  if (!normalized) return [];
  const def = ACCOUNT_TYPE_DEFS.find((t) => t.value === normalized.apiType);
  return def ? [...def.categories] : [];
}

function getAccountTypesMeta() {
  return ACCOUNT_TYPE_DEFS.map((t) => ({
    value: t.value,
    label: t.label,
    storageType: t.storageType,
    prefix: t.prefix,
    description: t.description,
    normalBalance: t.normalBalance,
    categories: [...t.categories]
  }));
}

class AccountCodeService {
  /**
   * Generate the next available account code based on type and category
   * @param {string} type - Account type (Asset, Liability, Income/Revenue, Expense, Equity)
   * @param {string} category - Account category
   * @param {string} accountName - Optional account name to detect non-AP accounts
   * @returns {Promise<string>} Generated account code
   */
  static async generateAccountCode(type, category = null, accountName = null) {
    try {
      const normalized = normalizeAccountType(type);
      const storageType = normalized ? normalized.storageType : type;
      const code = await Account.getNextCode(storageType, category, accountName);
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
   * @param {string} type - Account type (Asset, Liability, Equity, Revenue, Expense, Income)
   * @returns {Array<string>} Array of suggested categories
   */
  static getSuggestedCategories(type) {
    return getCategoriesForType(type);
  }

  /**
   * Get account type information including prefix and description
   * @param {string} type - Account type
   * @returns {Object} Type information
   */
  static getAccountTypeInfo(type) {
    const normalized = normalizeAccountType(type);
    if (!normalized) return null;
    const def = ACCOUNT_TYPE_DEFS.find((t) => t.value === normalized.apiType);
    if (!def) return null;
    return {
      value: def.value,
      label: def.label,
      storageType: def.storageType,
      prefix: def.prefix,
      description: def.description,
      normalBalance: def.normalBalance
    };
  }

  static getAccountTypesMeta() {
    return getAccountTypesMeta();
  }

  static normalizeAccountType(type) {
    return normalizeAccountType(type);
  }

  /**
   * Generate a custom account code with specific logic
   * @param {Object} accountData - Account data
   * @returns {Promise<string>} Generated custom code
   */
  static async generateCustomCode(accountData) {
    const { type, category, subcategory, name } = accountData;

    let baseCode = await this.generateAccountCode(type, category, name);

    if (subcategory) {
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
      Cash: '1',
      Bank: '2',
      'Accounts Receivable': '3',
      Inventory: '4',
      'Prepaid Expenses': '5',
      'Fixed Assets': '6',
      'Accounts Payable': '1',
      'Accrued Expenses': '2',
      Loans: '3',
      'Taxes Payable': '4',
      'Rental Income': '1',
      'Service Income': '2',
      'Interest Income': '3',
      Salary: '1',
      Rent: '2',
      Utilities: '3',
      Maintenance: '4',
      Insurance: '5',
      Depreciation: '6'
    };

    return subcategoryMap[subcategory] || '0';
  }

  /**
   * Validate complete account data before creation
   * @param {Object} accountData - Account data to validate
   * @returns {Object} Validation result (includes normalized type/category)
   */
  static async validateAccountData(accountData) {
    const { name, type, category } = accountData;
    const errors = [];

    if (!name || String(name).trim().length === 0) {
      errors.push('Account name is required');
    }

    if (!type) {
      errors.push('Account type is required');
    }

    if (!category) {
      errors.push('Account category is required');
    }

    const normalized = type ? normalizeAccountType(type) : null;
    if (type && !normalized) {
      errors.push(
        `Invalid account type "${type}". Must be one of: ${API_TYPES.join(', ')}`
      );
    }

    const suggestedCategories = normalized
      ? getCategoriesForType(normalized.apiType)
      : [];
    if (
      category &&
      suggestedCategories.length > 0 &&
      !suggestedCategories.includes(category)
    ) {
      errors.push(
        `Invalid category for ${normalized?.apiType || type}. Valid categories: ${suggestedCategories.join(', ')}`
      );
    }

    if (name) {
      const existingAccount = await Account.findOne({
        name: { $regex: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        isActive: true
      });
      if (existingAccount) {
        errors.push('Account name already exists');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalizedType: normalized?.storageType || null,
      apiType: normalized?.apiType || null
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

        const storageType = validation.normalizedType || accountData.type;
        const code = await this.generateAccountCode(
          storageType,
          accountData.category,
          accountData.name
        );
        results.push({
          ...accountData,
          type: storageType,
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

AccountCodeService.ACCOUNT_TYPE_DEFS = ACCOUNT_TYPE_DEFS;
AccountCodeService.ALL_CATEGORIES = ALL_CATEGORIES;
AccountCodeService.STORAGE_TYPES = STORAGE_TYPES;
AccountCodeService.API_TYPES = API_TYPES;

module.exports = AccountCodeService;
module.exports.ACCOUNT_TYPE_DEFS = ACCOUNT_TYPE_DEFS;
module.exports.ALL_CATEGORIES = ALL_CATEGORIES;
module.exports.normalizeAccountType = normalizeAccountType;
module.exports.getAccountTypesMeta = getAccountTypesMeta;
