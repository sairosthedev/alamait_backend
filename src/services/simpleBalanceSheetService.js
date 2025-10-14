const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');

// Use the same MongoDB URI as other services
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

/**
 * Simple Balance Sheet Service
 * 
 * Generates a clean, simple balance sheet that follows proper accounting principles:
 * - Assets = Liabilities + Equity
 * - Proper parent-child account aggregation
 * - Monthly balance tracking
 * - Retained earnings calculation
 */
class SimpleBalanceSheetService {
  
  /**
   * Generate Monthly Balance Sheet
   * @param {number} year - The year for the balance sheet
   * @param {string} residence - Optional residence filter
   * @param {string} type - 'cumulative' (balance as of month end) or 'monthly' (monthly changes)
   * @returns {Object} Monthly balance sheet data
   */
  static async generateMonthlyBalanceSheet(year, residence = null, type = 'cumulative') {
    try {
      console.log(`📊 Generating Simple Monthly Balance Sheet for ${year}${residence ? ` (residence: ${residence})` : ''} (${type})`);
      
      // Ensure database connection
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(MONGODB_URI);
      }
      
      const monthlyData = {};
      let totalAnnualAssets = 0;
      let totalAnnualLiabilities = 0;
      let totalAnnualEquity = 0;
      
      // Get all accounts for reference
      const accounts = await Account.find({ isActive: true }).sort({ code: 1 });
      const accountMap = new Map();
      accounts.forEach(acc => accountMap.set(acc.code, acc));
      
      // Process each month (1-12)
      for (let month = 1; month <= 12; month++) {
        try {
          console.log(`📅 Processing month ${month}/${year}...`);
          
          // Calculate end of month date
          const endOfMonth = new Date(year, month, 0); // Last day of month
          const monthEndDateStr = endOfMonth.toISOString().split('T')[0];
          
          // Get balance sheet data for this month
          const monthData = await this.generateBalanceSheetForDate(monthEndDateStr, residence, accountMap);
          
          if (monthData) {
            monthlyData[month] = {
              month: month,
              monthName: endOfMonth.toLocaleDateString('en-US', { month: 'long' }),
              ...monthData
            };
            
            totalAnnualAssets += parseFloat(monthData.summary.totalAssets) || 0;
            totalAnnualLiabilities += parseFloat(monthData.summary.totalLiabilities) || 0;
            totalAnnualEquity += parseFloat(monthData.summary.totalEquity) || 0;
          }
        } catch (monthError) {
          console.error(`❌ Error processing month ${month}:`, monthError.message);
          // Create empty month data
          monthlyData[month] = {
            month: month,
            monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
            assets: { current: { total: 0 }, nonCurrent: { total: 0 }, total: 0 },
            liabilities: { current: { total: 0 }, nonCurrent: { total: 0 }, total: 0 },
            equity: { total: 0 },
            balanceCheck: 'No data',
            summary: { totalAssets: 0, totalLiabilities: 0, totalEquity: 0 }
          };
        }
      }
      
      const result = {
        monthly: monthlyData,
        annualSummary: {
          totalAnnualAssets: totalAnnualAssets / 12, // Average monthly
          totalAnnualLiabilities: totalAnnualLiabilities / 12,
          totalAnnualEquity: totalAnnualEquity / 12
        }
      };
      
      // Ensure no NaN values in annual summary
      if (isNaN(result.annualSummary.totalAnnualAssets)) result.annualSummary.totalAnnualAssets = 0;
      if (isNaN(result.annualSummary.totalAnnualLiabilities)) result.annualSummary.totalAnnualLiabilities = 0;
      if (isNaN(result.annualSummary.totalAnnualEquity)) result.annualSummary.totalAnnualEquity = 0;
      
      console.log(`✅ Simple Monthly Balance Sheet generated successfully`);
      return result;
      
    } catch (error) {
      console.error('❌ Error generating simple monthly balance sheet:', error);
      throw error;
    }
  }
  
  /**
   * Generate Balance Sheet for a specific date
   * @param {string} asOfDate - Date in YYYY-MM-DD format
   * @param {string} residence - Optional residence filter
   * @param {Map} accountMap - Map of account codes to account objects
   * @returns {Object} Balance sheet data
   */
  static async generateBalanceSheetForDate(asOfDate, residence = null, accountMap = null) {
    try {
      const asOf = new Date(asOfDate);
      
      // Get accounts if not provided
      if (!accountMap) {
        const accounts = await Account.find({ isActive: true }).sort({ code: 1 });
        accountMap = new Map();
        accounts.forEach(acc => accountMap.set(acc.code, acc));
      }
      
      // Get all transactions up to the as-of date
      const query = {
        date: { $lte: asOf },
        status: 'posted',
        voided: { $ne: true }
      };
      
      if (residence) {
        query.residence = residence;
      }
      
      const transactions = await TransactionEntry.find(query).sort({ date: 1 });
      
      console.log(`🔍 Found ${transactions.length} transactions for balance sheet as of ${asOfDate}`);
      if (transactions.length > 0) {
        console.log(`📋 Sample transaction:`, {
          id: transactions[0]._id,
          date: transactions[0].date,
          debitAccount: transactions[0].debitAccount,
          debitAmount: transactions[0].debitAmount,
          creditAccount: transactions[0].creditAccount,
          creditAmount: transactions[0].creditAmount,
          source: transactions[0].source
        });
      }
      
      // Calculate account balances
      const accountBalances = new Map();
      
      // Initialize all accounts with zero balance
      accountMap.forEach((account, code) => {
        accountBalances.set(code, {
          code: account.code,
          name: account.name,
          type: account.type,
          category: account.category,
          balance: 0,
          debit: 0,
          credit: 0
        });
      });
      
      console.log(`📊 Initialized ${accountBalances.size} accounts for balance sheet`);
      console.log(`🏦 Sample accounts:`, Array.from(accountBalances.entries()).slice(0, 3).map(([code, acc]) => `${code} - ${acc.name} (${acc.type})`));
      
      // Process transactions to calculate balances
      transactions.forEach(transaction => {
        // Process transaction entries (the actual account data is in transaction.entries)
        if (transaction.entries && transaction.entries.length > 0) {
          transaction.entries.forEach(entry => {
            const accountCode = entry.accountCode;
            const accountName = entry.accountName;
            const accountType = entry.accountType;
            const debit = parseFloat(entry.debit) || 0;
            const credit = parseFloat(entry.credit) || 0;
            
            // Find the account by code
            const account = accountBalances.get(accountCode);
            if (account) {
              account.debit += debit;
              account.credit += credit;
              
              // Calculate balance based on account type
              if (accountType === 'Asset' || accountType === 'Expense') {
                account.balance += debit - credit;
              } else {
                account.balance += credit - debit;
              }
            } else {
              console.log(`⚠️ Account ${accountCode} not found in chart of accounts`);
            }
          });
        }
      });
      
      console.log(`📊 Processed ${transactions.length} transactions for balance sheet as of ${asOfDate}`);
      console.log(`💰 Sample account balances:`, Array.from(accountBalances.entries()).slice(0, 5).map(([code, acc]) => `${code}: $${acc.balance}`));
      
      // Aggregate parent-child accounts
      const aggregatedBalances = await this.aggregateParentChildAccounts(accountBalances, accountMap);
      
      // Build balance sheet structure
      const balanceSheet = this.buildBalanceSheetStructure(aggregatedBalances, accountMap);
      
      // Calculate retained earnings using simple formula: Cumulative Net Income
      const retainedEarnings = await this.calculateCumulativeRetainedEarnings(asOf, residence);
      balanceSheet.equity.retainedEarnings = {
        amount: retainedEarnings || 0,
        accountCode: '3101',
        accountName: 'Retained Earnings'
      };
      balanceSheet.equity.total += (retainedEarnings || 0);
      
      console.log(`📊 Retained Earnings for ${asOf.toISOString().split('T')[0]}: $${retainedEarnings || 0}`);
      
      // Recalculate totals
      balanceSheet.summary.totalAssets = balanceSheet.assets.total;
      balanceSheet.summary.totalLiabilities = balanceSheet.liabilities.total;
      balanceSheet.summary.totalEquity = balanceSheet.equity.total;
      
      // Check if balanced
      const totalAssets = parseFloat(balanceSheet.summary.totalAssets) || 0;
      const totalLiabilities = parseFloat(balanceSheet.summary.totalLiabilities) || 0;
      const totalEquity = parseFloat(balanceSheet.summary.totalEquity) || 0;
      const difference = Math.abs(totalAssets - (totalLiabilities + totalEquity));
      
      if (isNaN(difference)) {
        balanceSheet.balanceCheck = 'Calculation Error';
      } else if (difference < 0.01) {
        balanceSheet.balanceCheck = 'Balanced';
      } else {
        balanceSheet.balanceCheck = `Off by $${difference.toFixed(2)}`;
      }
      
      return balanceSheet;
      
    } catch (error) {
      console.error('❌ Error generating balance sheet for date:', error);
      throw error;
    }
  }
  
  /**
   * Aggregate parent-child accounts
   * @param {Map} accountBalances - Map of account balances
   * @param {Map} accountMap - Map of account objects
   * @returns {Map} Aggregated account balances
   */
  static async aggregateParentChildAccounts(accountBalances, accountMap) {
    const aggregatedBalances = new Map();
    
    // Copy all accounts first
    accountBalances.forEach((account, code) => {
      aggregatedBalances.set(code, { ...account });
    });
    
    try {
      // Dynamically fetch parent-child relationships from database
      const Account = require('../models/Account');
      
      // Get Accounts Payable parent account (2000)
      const apParentAccount = await Account.findOne({ code: '2000' });
      if (apParentAccount) {
        // Get all accounts that have 2000 as their parent account
        const allAPChildren = await Account.find({
          parentAccount: apParentAccount._id,
          isActive: true
        });
        
        console.log(`🔗 Found ${allAPChildren.length} Accounts Payable child accounts for parent 2000`);
        
        // Aggregate AP child accounts into parent
        const parentAccount = aggregatedBalances.get('2000');
        if (parentAccount) {
          let totalChildBalance = 0;
          
          allAPChildren.forEach(childAccount => {
            const childBalance = aggregatedBalances.get(childAccount.code);
            if (childBalance) {
              totalChildBalance += childBalance.balance;
              console.log(`🔗 Aggregating AP child account ${childAccount.code} (${childAccount.name}): $${childBalance.balance} into parent 2000`);
            }
          });
          
          // Add child balances to parent
          parentAccount.balance += totalChildBalance;
          console.log(`📊 Accounts Payable (2000) total balance: $${parentAccount.balance} (including $${totalChildBalance} from ${allAPChildren.length} children)`);
        }
      }
      
      // Get Accounts Receivable parent account (1100)
      const arParentAccount = await Account.findOne({ code: '1100' });
      if (arParentAccount) {
        // Get all child accounts of 1100
        const arChildAccounts = await Account.find({ 
          parentAccount: arParentAccount._id,
          isActive: true
        });
        
        // Also get any accounts receivable accounts that start with 1100 but aren't the main account
        const arRelatedAccounts = await Account.find({
          code: { $regex: '^1100' },
          code: { $ne: '1100' },
          isActive: true
        });
        
        // Combine all AR child accounts
        const allARChildren = [...arChildAccounts, ...arRelatedAccounts];
        
        console.log(`🔗 Found ${allARChildren.length} Accounts Receivable child accounts for parent 1100`);
        
        // Aggregate AR child accounts into parent
        const parentAccount = aggregatedBalances.get('1100');
        if (parentAccount) {
          let totalChildBalance = 0;
          
          allARChildren.forEach(childAccount => {
            const childBalance = aggregatedBalances.get(childAccount.code);
            if (childBalance) {
              totalChildBalance += childBalance.balance;
              console.log(`🔗 Aggregating AR child account ${childAccount.code} (${childAccount.name}): $${childBalance.balance} into parent 1100`);
            }
          });
          
          // Add child balances to parent
          parentAccount.balance += totalChildBalance;
          console.log(`📊 Accounts Receivable (1100) total balance: $${parentAccount.balance} (including $${totalChildBalance} from ${allARChildren.length} children)`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error aggregating parent-child accounts:', error);
      // Fallback to hardcoded relationships if database query fails
      console.log('🔄 Falling back to hardcoded parent-child relationships...');
      
      const fallbackRelationships = {
        '2000': ['200001', '200002', '200003', '200004', '200005', '200006', '200008', '20041'],
        '1100': ['1100-68ecee931a1a3e93496ceed4', '1101']
      };
      
      Object.entries(fallbackRelationships).forEach(([parentCode, childCodes]) => {
        const parentAccount = aggregatedBalances.get(parentCode);
        if (parentAccount) {
          let totalChildBalance = 0;
          
          childCodes.forEach(childCode => {
            const childAccount = aggregatedBalances.get(childCode);
            if (childAccount) {
              totalChildBalance += childAccount.balance;
              console.log(`🔗 Fallback: Aggregating child account ${childCode}: $${childAccount.balance} into parent ${parentCode}`);
            }
          });
          
          parentAccount.balance += totalChildBalance;
          console.log(`📊 Fallback: Parent account ${parentCode} total balance: $${parentAccount.balance}`);
        }
      });
    }
    
    return aggregatedBalances;
  }

  /**
   * Check if an account code is a child account of Accounts Payable (2000)
   * @param {string} accountCode - The account code to check
   * @param {Map} accountMap - Map of account objects to check parentAccount field
   * @returns {boolean} True if it's an AP child account
   */
  static isAccountsPayableChildAccount(accountCode, accountMap) {
    // Check if it's the main AP account
    if (accountCode === '2000') {
      return false; // Main account, not a child
    }
    
    // Check if the account has 2000 as its parent account
    const account = accountMap.get(accountCode);
    if (account && account.parentAccount) {
      // We need to check if the parent account is 2000
      // For now, we'll use a simple approach and check if it's a known AP child account
      const knownAPChildCodes = ['20041', '200001', '200002', '200003', '200004', '200006', '200008'];
      return knownAPChildCodes.includes(accountCode);
    }
    
    return false;
  }

  /**
   * Build the balance sheet structure from account balances
   * @param {Map} accountBalances - Map of account balances
   * @param {Map} accountMap - Map of account objects
   * @returns {Object} Structured balance sheet
   */
  static buildBalanceSheetStructure(accountBalances, accountMap) {
    const balanceSheet = {
      assets: {
        current: {
          cashAndBank: {},
          accountsReceivable: { amount: 0, accountCode: '1100', accountName: 'Accounts Receivable - Tenants' },
          allOtherCurrentAssets: {},
          total: 0
        },
        nonCurrent: {},
        total: 0
      },
      liabilities: {
        current: {
          accountsPayable: { amount: 0, accountCode: '2000', accountName: 'Accounts Payable' },
          tenantDeposits: { amount: 0, accountCode: '2020', accountName: 'Tenant Deposits Held' },
          deferredIncome: { amount: 0, accountCode: '2200', accountName: 'Advance Payment Liability' }
        },
        all: {},
        total: 0
      },
      equity: {
        retainedEarnings: { amount: 0, accountCode: '3101', accountName: 'Retained Earnings' },
        ownerCapital: { amount: 0, accountCode: '3001', accountName: 'Owner Capital' },
        all: {},
        total: 0
      },
      balanceCheck: 'Balanced',
      summary: {
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0
      }
    };
    
    // Process assets - show all accounts individually except Accounts Receivable (1100) which aggregates children
    accountBalances.forEach((account, code) => {
      if (account.type === 'Asset' && Math.abs(account.balance) > 0.01) {
        if (account.category === 'Current Assets') {
          // Cash and bank accounts (1000-1099) - show all individual accounts
          if (code.startsWith('100')) {
            const key = this.getCashAccountKey(code);
            balanceSheet.assets.current.cashAndBank[key] = {
              amount: account.balance,
              accountCode: code,
              accountName: account.name
            };
          }
          // Accounts receivable (1100) - show parent account with aggregated balance
          else if (code === '1100') {
            balanceSheet.assets.current.accountsReceivable.amount = account.balance;
            balanceSheet.assets.current.accountsReceivable.accountCode = code;
            balanceSheet.assets.current.accountsReceivable.accountName = account.name;
          }
          // Other current assets (show individual accounts that are not child accounts of 1100)
          else if (!code.startsWith('1100-')) {
            const key = this.getOtherAssetKey(code);
            balanceSheet.assets.current.allOtherCurrentAssets[key] = {
              amount: account.balance,
              accountCode: code,
              accountName: account.name
            };
          }
        } else if (account.category === 'Fixed Assets' || account.category === 'Other Assets') {
          // Non-current assets
          const key = this.getNonCurrentAssetKey(code);
          balanceSheet.assets.nonCurrent[key] = {
            amount: account.balance,
            accountCode: code,
            accountName: account.name
          };
        }
      }
    });
    
    // Process liabilities - show all accounts individually except Accounts Payable (2000) which aggregates children
    accountBalances.forEach((account, code) => {
      if (account.type === 'Liability' && Math.abs(account.balance) > 0.01) {
        if (code === '2000') {
          // Main Accounts Payable (with aggregated child accounts)
          balanceSheet.liabilities.current.accountsPayable.amount = account.balance;
          balanceSheet.liabilities.current.accountsPayable.accountCode = code;
          balanceSheet.liabilities.current.accountsPayable.accountName = account.name;
        } else if (code === '2020') {
          // Tenant Deposits
          balanceSheet.liabilities.current.tenantDeposits.amount = account.balance;
          balanceSheet.liabilities.current.tenantDeposits.accountCode = code;
          balanceSheet.liabilities.current.tenantDeposits.accountName = account.name;
        } else if (code === '2200') {
          // Deferred Income
          balanceSheet.liabilities.current.deferredIncome.amount = account.balance;
          balanceSheet.liabilities.current.deferredIncome.accountCode = code;
          balanceSheet.liabilities.current.deferredIncome.accountName = account.name;
        } else if (!this.isAccountsPayableChildAccount(code, accountMap)) {
          // Other liabilities (show individual accounts that are not child accounts of 2000 series)
          const key = this.getLiabilityKey(code);
          balanceSheet.liabilities.all[key] = {
            amount: account.balance,
            accountCode: code,
            accountName: account.name
          };
        }
      }
    });
    
    // Process equity
    accountBalances.forEach((account, code) => {
      if (account.type === 'Equity' && Math.abs(account.balance) > 0.01) {
        if (code === '3001') {
          // Owner Capital
          balanceSheet.equity.ownerCapital.amount = account.balance;
          balanceSheet.equity.ownerCapital.accountCode = code;
          balanceSheet.equity.ownerCapital.accountName = account.name;
        } else if (code === '3101') {
          // Retained Earnings
          balanceSheet.equity.retainedEarnings.amount = account.balance;
          balanceSheet.equity.retainedEarnings.accountCode = code;
          balanceSheet.equity.retainedEarnings.accountName = account.name;
        } else {
          // Other equity accounts (show individual accounts that are not parent/child)
          const key = this.getEquityKey(code);
          balanceSheet.equity.all[key] = {
            amount: account.balance,
            accountCode: code,
            accountName: account.name
          };
        }
      }
    });
    
    // Calculate totals
    // Cash and bank total
    let cashAndBankTotal = 0;
    Object.values(balanceSheet.assets.current.cashAndBank).forEach(account => {
      cashAndBankTotal += account.amount;
    });
    balanceSheet.assets.current.cashAndBank.total = cashAndBankTotal;
    
    // Current assets total
    balanceSheet.assets.current.total = 
      cashAndBankTotal + 
      balanceSheet.assets.current.accountsReceivable.amount +
      Object.values(balanceSheet.assets.current.allOtherCurrentAssets).reduce((sum, acc) => sum + acc.amount, 0);
    
    // Non-current assets total
    balanceSheet.assets.nonCurrent.total = 
      Object.values(balanceSheet.assets.nonCurrent).reduce((sum, acc) => sum + acc.amount, 0);
    
    // Total assets
    balanceSheet.assets.total = balanceSheet.assets.current.total + balanceSheet.assets.nonCurrent.total;
    
    // Current liabilities total
    balanceSheet.liabilities.current.total = 
      balanceSheet.liabilities.current.accountsPayable.amount +
      balanceSheet.liabilities.current.tenantDeposits.amount +
      balanceSheet.liabilities.current.deferredIncome.amount;
    
    // All liabilities total
    balanceSheet.liabilities.all.total = 
      balanceSheet.liabilities.current.total +
      Object.values(balanceSheet.liabilities.all).reduce((sum, acc) => sum + acc.amount, 0);
    
    // Total liabilities
    balanceSheet.liabilities.total = balanceSheet.liabilities.all.total;
    
    // Total equity
    balanceSheet.equity.total = 
      (parseFloat(balanceSheet.equity.retainedEarnings.amount) || 0) +
      (parseFloat(balanceSheet.equity.ownerCapital.amount) || 0) +
      Object.values(balanceSheet.equity.all).reduce((sum, acc) => sum + (parseFloat(acc.amount) || 0), 0);
    
    return balanceSheet;
  }
  
  /**
   * Get cash account key for organization
   */
  static getCashAccountKey(code) {
    const cashAccountMap = {
      '1000': 'cash',
      '1001': 'bank',
      '1002': 'ecocash',
      '1003': 'innbucks',
      '1004': 'pettyCash',
      '1005': 'cashOnHand',
      '1010': 'generalPettyCash',
      '1011': 'adminPettyCash',
      '1012': 'financePettyCash',
      '1013': 'propertyManagerPettyCash',
      '1014': 'maintenancePettyCash',
      '10003': 'cbzVault'
    };
    return cashAccountMap[code] || `cash_${code}`;
  }
  
  /**
   * Get other asset key for organization
   */
  static getOtherAssetKey(code) {
    return `other_asset_${code}`;
  }
  
  /**
   * Get non-current asset key for organization
   */
  static getNonCurrentAssetKey(code) {
    return `non_current_${code}`;
  }
  
  /**
   * Get liability key for organization
   */
  static getLiabilityKey(code) {
    return `liability_${code}`;
  }
  
  /**
   * Get equity key for organization
   */
  static getEquityKey(code) {
    return `equity_${code}`;
  }
  
  /**
   * Calculate cumulative retained earnings using working formula from accountingService
   * @param {Date} asOfDate - The date to calculate up to
   * @param {string} residence - Optional residence filter
   * @returns {number} Cumulative retained earnings amount
   */
  static async calculateCumulativeRetainedEarnings(asOfDate, residence = null) {
    try {
      console.log(`📊 Calculating retained earnings up to ${asOfDate.toISOString().split('T')[0]}...`);
      
      // Ensure database connection
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(MONGODB_URI);
      }
      
      // Use the exact same logic as accountingService.getRetainedEarnings
      let revenueQuery = {
        'entries.accountCode': { $in: ['4000', '4001', '4002', '4020', '4100'] },
        date: { $lte: asOfDate },
        status: 'posted'
      };
      
      let expenseQuery = {
        'entries.accountCode': { $regex: /^5/ },
        date: { $lte: asOfDate },
        status: 'posted'
      };
      
      // Add residence filtering if specified
      if (residence) {
        revenueQuery['residence'] = residence;
        expenseQuery['residence'] = residence;
      }
      
      const revenueEntries = await TransactionEntry.find(revenueQuery);
      const expenseEntries = await TransactionEntry.find(expenseQuery);
      
      let totalRevenue = 0;
      let totalExpenses = 0;
      
      // Calculate revenue from nested entries
      for (const entry of revenueEntries) {
        if (entry.entries && Array.isArray(entry.entries)) {
          for (const subEntry of entry.entries) {
            if (['4000', '4001', '4002', '4020', '4100'].includes(subEntry.accountCode)) {
              // Credits increase revenue, debits decrease revenue (like negotiated discounts)
              totalRevenue += (subEntry.credit || 0) - (subEntry.debit || 0);
            }
          }
        }
      }
      
      // Calculate expenses from nested entries
      for (const entry of expenseEntries) {
        if (entry.entries && Array.isArray(entry.entries)) {
          for (const subEntry of entry.entries) {
            if (subEntry.accountCode && subEntry.accountCode.startsWith('5')) {
              totalExpenses += subEntry.debit || 0;
            }
          }
        }
      }
      
      const retainedEarnings = totalRevenue - totalExpenses;
      console.log(`💰 Revenue: $${totalRevenue}, Expenses: $${totalExpenses}, Retained Earnings: $${retainedEarnings}`);
      
      return retainedEarnings;
      
    } catch (error) {
      console.error('❌ Error calculating retained earnings:', error);
      return 0;
    }
  }

  /**
   * Calculate retained earnings for a specific month from transactions
   * @param {Date} asOfDate - The end date of the month
   * @param {string} residence - Optional residence filter
   * @returns {number} Retained earnings amount for that month
   */
  static async calculateMonthlyRetainedEarnings(asOfDate, residence = null) {
    try {
      const month = asOfDate.getMonth() + 1;
      const year = asOfDate.getFullYear();
      console.log(`📊 Calculating retained earnings for ${month}/${year}...`);
      
      // Ensure database connection
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(MONGODB_URI);
      }
      
      // Get transactions for this specific month
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999); // End of month
      
      const transactions = await TransactionEntry.find({
        date: { $gte: startOfMonth, $lte: endOfMonth },
        ...(residence && { residence: residence })
      });
      
      console.log(`🔍 Found ${transactions.length} transactions for ${month}/${year}`);
      
      let totalIncome = 0;
      let totalExpenses = 0;
      
      // Process transactions to calculate income and expenses for this month
      transactions.forEach(transaction => {
        if (transaction.entries && transaction.entries.length > 0) {
          transaction.entries.forEach(entry => {
            const accountCode = entry.accountCode;
            const debit = parseFloat(entry.debit) || 0;
            const credit = parseFloat(entry.credit) || 0;
            
            // Income accounts (4000 series) - credit increases income
            if (accountCode.startsWith('4000')) {
              const incomeAmount = credit - debit;
              totalIncome += incomeAmount;
              if (Math.abs(incomeAmount) > 0.01) {
                console.log(`💰 Income: ${accountCode} - ${entry.accountName}: $${incomeAmount} (Credit: $${credit}, Debit: $${debit})`);
              }
            }
            // Expense accounts (5000 series) - debit increases expenses
            else if (accountCode.startsWith('5000')) {
              const expenseAmount = debit - credit;
              totalExpenses += expenseAmount;
              if (Math.abs(expenseAmount) > 0.01) {
                console.log(`💸 Expense: ${accountCode} - ${entry.accountName}: $${expenseAmount} (Debit: $${debit}, Credit: $${credit})`);
              }
            }
          });
        }
      });
      
      const netIncome = totalIncome - totalExpenses;
      console.log(`💰 ${month}/${year} - Income: $${totalIncome}, Expenses: $${totalExpenses}, Net Income: $${netIncome}`);
      
      return netIncome;
      
    } catch (error) {
      console.error('❌ Error calculating monthly retained earnings:', error);
      return 0;
    }
  }

  /**
   * Calculate retained earnings up to a specific date
   * @param {Date} asOfDate - The date to calculate retained earnings up to
   * @param {string} residence - Optional residence filter
   * @returns {number} Retained earnings amount
   */
  static async calculateRetainedEarningsUpToDate(asOfDate, residence = null) {
    try {
      console.log(`📊 Calculating retained earnings up to ${asOfDate.toISOString().split('T')[0]}...`);
      
      // Ensure database connection
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(MONGODB_URI);
      }
      
      // Get all transactions up to the as-of date
      const transactions = await TransactionEntry.find({
        date: { $lte: asOfDate },
        ...(residence && { residence: residence })
      });
      
      let totalIncome = 0;
      let totalExpenses = 0;
      
      // Process transactions to calculate income and expenses
      transactions.forEach(transaction => {
        if (transaction.entries && transaction.entries.length > 0) {
          transaction.entries.forEach(entry => {
            const accountCode = entry.accountCode;
            const debit = parseFloat(entry.debit) || 0;
            const credit = parseFloat(entry.credit) || 0;
            
            // Income accounts (4000 series) - credit increases income
            if (accountCode.startsWith('4000')) {
              const incomeAmount = credit - debit;
              totalIncome += incomeAmount;
              if (Math.abs(incomeAmount) > 0.01) {
                console.log(`💰 Income: ${accountCode} - ${entry.accountName}: $${incomeAmount} (Credit: $${credit}, Debit: $${debit})`);
              }
            }
            // Expense accounts (5000 series) - debit increases expenses
            else if (accountCode.startsWith('5000')) {
              const expenseAmount = debit - credit;
              totalExpenses += expenseAmount;
              if (Math.abs(expenseAmount) > 0.01) {
                console.log(`💸 Expense: ${accountCode} - ${entry.accountName}: $${expenseAmount} (Debit: $${debit}, Credit: $${credit})`);
              }
            }
          });
        }
      });
      
      const netIncome = totalIncome - totalExpenses;
      console.log(`💰 Income: $${totalIncome}, Expenses: $${totalExpenses}, Net Income: $${netIncome}`);
      
      return netIncome;
      
    } catch (error) {
      console.error('❌ Error calculating retained earnings up to date:', error);
      return 0;
    }
  }

  /**
   * Calculate retained earnings (simplified)
   * In a real implementation, this should come from the income statement
   */
  static async calculateRetainedEarnings(year, residence = null) {
    try {
      console.log(`📊 Calculating retained earnings for ${year}...`);
      
      // Ensure database connection
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(MONGODB_URI);
      }
      
      // Get all transactions for the year
      const startDate = new Date(year, 0, 1); // January 1st
      const endDate = new Date(year, 11, 31); // December 31st
      
      const transactions = await TransactionEntry.find({
        date: { $gte: startDate, $lte: endDate },
        ...(residence && { residence: residence })
      });
      
      let totalIncome = 0;
      let totalExpenses = 0;
      
      // Process transactions to calculate income and expenses
      transactions.forEach(transaction => {
        if (transaction.entries && transaction.entries.length > 0) {
          transaction.entries.forEach(entry => {
            const accountCode = entry.accountCode;
            const debit = parseFloat(entry.debit) || 0;
            const credit = parseFloat(entry.credit) || 0;
            
            // Income accounts (4000 series) - credit increases income
            if (accountCode.startsWith('4000')) {
              const incomeAmount = credit - debit;
              totalIncome += incomeAmount;
              console.log(`💰 Income: ${accountCode} - ${entry.accountName}: $${incomeAmount} (Credit: $${credit}, Debit: $${debit})`);
            }
            // Expense accounts (5000 series) - debit increases expenses
            else if (accountCode.startsWith('5000')) {
              const expenseAmount = debit - credit;
              totalExpenses += expenseAmount;
              console.log(`💸 Expense: ${accountCode} - ${entry.accountName}: $${expenseAmount} (Debit: $${debit}, Credit: $${credit})`);
            }
          });
        }
      });
      
      const netIncome = totalIncome - totalExpenses;
      console.log(`💰 Income: $${totalIncome}, Expenses: $${totalExpenses}, Net Income: $${netIncome}`);
      
      return netIncome;
      
    } catch (error) {
      console.error('❌ Error calculating retained earnings:', error);
      return 0;
    }
  }
}

module.exports = SimpleBalanceSheetService;
