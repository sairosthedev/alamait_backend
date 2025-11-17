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
      // Convert account codes to strings to ensure consistent key format
      accounts.forEach(acc => {
        const accountCode = String(acc.code); // Normalize to string
        accountMap.set(accountCode, { ...acc, code: accountCode });
      });
      
      // Process each month (1-12)
      for (let month = 1; month <= 12; month++) {
        try {
          console.log(`📅 Processing month ${month}/${year}...`);
          
          // Calculate end of month date in UTC to avoid timezone issues
          // month is 1-based (1-12), Date.UTC expects 0-based month (0-11)
          // Last day of month = first day of next month minus 1 day
          const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
          const endOfMonthUTC = new Date(Date.UTC(year, month - 1, lastDayOfMonth, 23, 59, 59, 999));
          const monthEndDateStr = endOfMonthUTC.toISOString().split('T')[0];
          
          // Get balance sheet data for this month
          const monthData = await this.generateBalanceSheetForDate(monthEndDateStr, residence, accountMap);
          
          if (monthData) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            monthlyData[month] = {
              month: month,
              monthName: monthNames[month - 1],
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
      // Parse date as UTC to avoid timezone issues between localhost and production
      // asOfDate is in format YYYY-MM-DD, we need to parse it as UTC end-of-day
      const dateParts = asOfDate.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // month is 0-based for Date.UTC
      const day = parseInt(dateParts[2]);
      
      // Create UTC date for end of the specified day (23:59:59.999)
      const asOf = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
      
      // Also calculate the start of next month in UTC to ensure we don't include next month's data
      const nextMonthStart = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
      
      // Get accounts if not provided - include ALL active accounts
      if (!accountMap) {
        const accounts = await Account.find({ isActive: true }).sort({ code: 1 });
        accountMap = new Map();
        
        // Convert account codes to strings to ensure consistent key format
        accounts.forEach(acc => {
          const accountCode = String(acc.code); // Ensure code is a string
          accountMap.set(accountCode, { ...acc, code: accountCode });
        });
        
        console.log(`📋 Loaded ${accountMap.size} accounts from Account collection`);
        
        // Debug: Check if deposit accounts are in the map
        ['2020', '20002', '2002'].forEach(code => {
          const stringCode = String(code);
          if (accountMap.has(stringCode)) {
            const account = accountMap.get(stringCode);
            console.log(`✅ Account ${code} found in accountMap: ${account.name} (${account.type}), code type: ${typeof account.code}`);
          } else {
            console.log(`⚠️ Account ${code} NOT found in accountMap`);
            // Try to find it by checking all keys
            console.log(`   Available codes around 20002:`, Array.from(accountMap.keys()).filter(k => k.includes('200')).slice(0, 10));
          }
        });
      }
      
      // Get all transactions up to the as-of date (using UTC to prevent timezone issues)
      // Ensure we don't accidentally include next month's data by using the smaller of asOf or nextMonthStart
      const queryUpperBound = asOf < nextMonthStart ? asOf : nextMonthStart;
      const query = {
        date: { $lte: queryUpperBound },
        status: 'posted',
        voided: { $ne: true }
      };
      
      let transactions = [];
      if (residence) {
        // Handle residence filter - support both ObjectId and string formats
        const mongoose = require('mongoose');
        const Request = require('../models/Request');
        const Expense = require('../models/Expense');
        
        const residenceObjectId = mongoose.Types.ObjectId.isValid(residence) 
          ? new mongoose.Types.ObjectId(residence) 
          : residence;
        
        // Use $or to match residence in multiple possible formats
        // Combine with existing query conditions using $and
        const existingConditions = { ...query };
        const residenceQuery = {
          $and: [
            existingConditions,
            {
              $or: [
                { residence: residenceObjectId },
                { residence: residence.toString() },
                { 'metadata.residenceId': residenceObjectId },
                { 'metadata.residenceId': residence.toString() },
                { 'metadata.residence': residenceObjectId },
                { 'metadata.residence': residence.toString() }
              ]
            }
          ]
        };
        
        console.log(`🔍 Filtering transactions by residence: ${residence} (ObjectId: ${residenceObjectId})`);
        console.log(`📋 Residence filter query:`, JSON.stringify(residenceQuery, null, 2));
        
        // First, get transactions that match the residence filter directly
        transactions = await TransactionEntry.find(residenceQuery).sort({ date: 1 });
        
        console.log(`📊 Found ${transactions.length} transactions with direct residence match`);
        
        // CRITICAL FIX: For expense_accrual transactions, ALWAYS check related Request/Expense records
        // Some expense accruals might not have residence set on TransactionEntry but have it in the Request
        console.log(`🔍 Checking for expense_accrual transactions via Request/Expense references...`);
        
        // Get all expense_accrual transactions with AP entries that might be linked to this residence
        const expenseAccrualQuery = {
          ...existingConditions,
          source: 'expense_accrual',
          'entries.accountCode': '2000' // Accounts Payable entries
        };
        
        const allExpenseAccruals = await TransactionEntry.find(expenseAccrualQuery).sort({ date: 1 });
        console.log(`📊 Found ${allExpenseAccruals.length} total expense_accrual transactions with AP entries`);
        
        // Check each transaction's reference to see if it's linked to a Request/Expense for this residence
        const matchingTransactions = [];
        const existingIds = new Set(transactions.map(t => t._id.toString()));
        
        for (const txn of allExpenseAccruals) {
          // Skip if already in transactions list
          if (existingIds.has(txn._id.toString())) {
            continue;
          }
          
          let matchesResidence = false;
          
          // Check if transaction already has residence set
          if (txn.residence) {
            const txnResidence = txn.residence.toString ? txn.residence.toString() : txn.residence;
            if (txnResidence === residenceObjectId.toString() || txnResidence === residence.toString()) {
              matchesResidence = true;
            }
          }
          
          // If not found, check via reference (Request or Expense)
          if (!matchesResidence && txn.reference) {
            try {
              // Check Request
              const request = await Request.findById(txn.reference).select('residence');
              if (request && request.residence) {
                const requestResidence = request.residence.toString ? request.residence.toString() : request.residence;
                if (requestResidence === residenceObjectId.toString() || requestResidence === residence.toString()) {
                  matchesResidence = true;
                  // Update the transaction's residence field for future queries
                  await TransactionEntry.updateOne(
                    { _id: txn._id },
                    { $set: { residence: residenceObjectId } }
                  );
                  console.log(`✅ Updated transaction ${txn._id} with residence ${residence}`);
                }
              }
              
              // Check Expense if not found in Request
              if (!matchesResidence) {
                const expense = await Expense.findById(txn.reference).select('residence');
                if (expense && expense.residence) {
                  const expenseResidence = expense.residence.toString ? expense.residence.toString() : expense.residence;
                  if (expenseResidence === residenceObjectId.toString() || expenseResidence === residence.toString()) {
                    matchesResidence = true;
                    // Update the transaction's residence field for future queries
                    await TransactionEntry.updateOne(
                      { _id: txn._id },
                      { $set: { residence: residenceObjectId } }
                    );
                    console.log(`✅ Updated transaction ${txn._id} with residence ${residence}`);
                  }
                }
              }
            } catch (err) {
              console.log(`⚠️ Error checking reference ${txn.reference}:`, err.message);
            }
          }
          
          if (matchesResidence) {
            matchingTransactions.push(txn);
          }
        }
        
        console.log(`📊 Found ${matchingTransactions.length} expense_accrual transactions linked to residence ${residence} via Request/Expense`);
        
        // Combine with direct matches (avoid duplicates)
        matchingTransactions.forEach(txn => {
          if (!existingIds.has(txn._id.toString())) {
            transactions.push(txn);
          }
        });
        
        console.log(`📊 Total transactions after combining: ${transactions.length}`);
        
        // CRITICAL: Verify AP transactions are included
        if (residence) {
          const finalAPCount = transactions.filter(t => 
            t.entries && t.entries.some(e => e.accountCode === '2000')
          ).length;
          console.log(`✅ Final verification: ${finalAPCount} AP transactions in transactions array`);
        }
      } else {
        transactions = await TransactionEntry.find(query).sort({ date: 1 });
      }
      
      console.log(`🔍 Found ${transactions.length} transactions for balance sheet as of ${asOfDate}${residence ? ` (filtered by residence: ${residence})` : ''}`);
      
      // Debug: Log sample transactions with AP entries when residence is filtered
      if (residence && transactions.length > 0) {
        const apTransactions = transactions.filter(t => 
          t.entries && t.entries.some(e => e.accountCode === '2000' || e.accountCode?.startsWith('2000'))
        );
        console.log(`📊 Found ${apTransactions.length} transactions with Accounts Payable entries for residence ${residence}`);
        
        // Calculate total AP credits/debits from these transactions
        let totalAPCredits = 0;
        let totalAPDebits = 0;
        apTransactions.forEach(txn => {
          txn.entries?.forEach(entry => {
            if (entry.accountCode === '2000') {
              totalAPCredits += parseFloat(entry.credit) || 0;
              totalAPDebits += parseFloat(entry.debit) || 0;
            }
          });
        });
        console.log(`💰 Total AP Credits: $${totalAPCredits}, Total AP Debits: $${totalAPDebits}, Expected Balance: $${totalAPCredits - totalAPDebits}`);
        
        if (apTransactions.length > 0) {
          console.log(`📋 Sample AP transaction:`, {
            id: apTransactions[0]._id,
            date: apTransactions[0].date,
            residence: apTransactions[0].residence,
            entries: apTransactions[0].entries?.filter(e => e.accountCode === '2000' || e.accountCode?.startsWith('2000')).map(e => ({
              accountCode: e.accountCode,
              debit: e.debit,
              credit: e.credit
            }))
          });
        }
      }
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
      
      // Initialize all accounts - include opening balances if they exist
      // Convert code to string to ensure consistent key format
      accountMap.forEach((account, code) => {
        const accountCode = String(code); // Normalize code to string
        
        // Normalize type and category to handle different formats (Liability, LIABILITY, liability)
        const accountType = (account.type || '').toLowerCase().charAt(0).toUpperCase() + (account.type || '').toLowerCase().slice(1);
        const accountCategory = account.category || 'Other';
        
        const openingBalance = parseFloat(account.openingBalance) || 0;
        // For liability accounts, opening balance is typically a credit (positive for liabilities)
        // For asset accounts, opening balance is typically a debit (positive for assets)
        let initialBalance = 0;
        let initialDebit = 0;
        let initialCredit = 0;
        
        if (openingBalance !== 0 && account.openingBalanceDate) {
          const openingDate = new Date(account.openingBalanceDate);
          // Only include opening balance if it's on or before the as-of date
          if (openingDate <= asOf) {
            // Use normalized type for comparison
            const normalizedTypeLower = accountType.toLowerCase();
            if (normalizedTypeLower === 'asset' || normalizedTypeLower === 'expense') {
              initialBalance = openingBalance;
              initialDebit = Math.abs(openingBalance);
            } else {
              // Liability or Equity
              initialBalance = openingBalance;
              initialCredit = Math.abs(openingBalance);
            }
          }
        }
        
        accountBalances.set(accountCode, {
          code: accountCode, // Use normalized string code
          name: account.name,
          type: accountType, // Normalized: "Liability", "Asset", "Equity"
          category: accountCategory, // e.g., "Current Liabilities"
          balance: initialBalance,
          debit: initialDebit,
          credit: initialCredit
        });
        
        // Debug: Log account 20002 specifically
        if (accountCode === '20002' || String(account.code) === '20002') {
          console.log(`📋 Initialized account 20002: Type="${accountType}", Category="${accountCategory}", Original Type="${account.type}", Code="${accountCode}"`);
        }
      });
      
      console.log(`📊 Initialized ${accountBalances.size} accounts for balance sheet`);
      console.log(`🏦 Sample accounts:`, Array.from(accountBalances.entries()).slice(0, 3).map(([code, acc]) => `${code} - ${acc.name} (${acc.type})`));
      
      // Process transactions to calculate balances
      transactions.forEach(transaction => {
        // Process transaction entries (the actual account data is in transaction.entries)
        if (transaction.entries && transaction.entries.length > 0) {
          transaction.entries.forEach(entry => {
            // Normalize account code to string for consistent lookup
            const accountCode = String(entry.accountCode || '');
            const accountName = entry.accountName;
            const accountType = entry.accountType;
            const debit = parseFloat(entry.debit) || 0;
            const credit = parseFloat(entry.credit) || 0;
            
            // Debug: Log Accounts Payable transactions
            if (accountCode === '2000' || accountCode.startsWith('2000')) {
              console.log(`📋 AP Transaction: Date=${transaction.date?.toISOString()?.split('T')[0]}, Account=${accountCode}, Debit=$${debit}, Credit=$${credit}, Source=${transaction.source}, Description=${transaction.description}, Residence=${transaction.residence}`);
            }
            
            // Find the account by code (normalize to string)
            let account = accountBalances.get(accountCode);
            
            // If account doesn't exist in accountMap, create it dynamically from transaction entry
            if (!account) {
              console.log(`📝 Creating dynamic account entry for ${accountCode} (${accountName || 'Unknown'}) from transaction - Type: ${accountType}`);
              // Normalize type to match Account collection format
              const normalizedType = (accountType || 'Asset').toLowerCase().charAt(0).toUpperCase() + (accountType || 'Asset').toLowerCase().slice(1);
              account = {
                code: accountCode,
                name: accountName || `Account ${accountCode}`,
                type: normalizedType, // "Liability", "Asset", "Equity"
                category: normalizedType === 'Asset' ? 'Current Assets' : 
                          normalizedType === 'Liability' ? 'Current Liabilities' :
                          normalizedType === 'Equity' ? 'Equity' : 'Other',
                balance: 0,
                debit: 0,
                credit: 0
              };
              accountBalances.set(accountCode, account);
              console.log(`✅ Created account: ${accountCode} - ${account.name} (${account.type})`);
            }
            
              account.debit += debit;
              account.credit += credit;
              
              // Calculate balance based on account type
              if (accountType === 'Asset' || accountType === 'Expense') {
                account.balance += debit - credit;
              } else {
              // Liability, Equity, Income: credit increases balance, debit decreases
                account.balance += credit - debit;
              }
            
            // Debug: Track account 20002 transactions
            if (accountCode === '20002') {
              console.log(`   💰 Account 20002 transaction: Debit $${debit}, Credit $${credit}, New balance: $${account.balance}`);
            }
          });
        }
      });
      
      console.log(`📊 Processed ${transactions.length} transactions for balance sheet as of ${asOfDate}`);
      console.log(`💰 Sample account balances:`, Array.from(accountBalances.entries()).slice(0, 5).map(([code, acc]) => `${code}: $${acc.balance}`));
      
// Debug: Check account 2000 specifically
const apAccount = accountBalances.get('2000');
if (apAccount) {
  console.log(`📊 Account 2000 (AP) AFTER processing transactions: Balance = $${apAccount.balance.toFixed(2)}, Debits = $${apAccount.debit.toFixed(2)}, Credits = $${apAccount.credit.toFixed(2)}`);
  if (residence) {
    console.log(`   🔍 Filtered by residence: ${residence}`);
    console.log(`   📋 If balance is 0 but credits > 0, there may be a calculation issue`);
  }
} else {
  console.log(`⚠️ WARNING: Account 2000 (AP) NOT FOUND in accountBalances after processing transactions!`);
  console.log(`   Available account codes:`, Array.from(accountBalances.keys()).filter(k => k.includes('200') || k === '2000').slice(0, 10));
}
      
      // Debug: Check deposit accounts specifically - check both string and original format
      const depositAccountCodes = ['2020', '20002', '2002'];
      depositAccountCodes.forEach(code => {
        // Try multiple formats
        const account1 = accountBalances.get(code);
        const account2 = accountBalances.get(String(code));
        const account = account1 || account2;
        
        if (account) {
          console.log(`✅ Deposit Account ${code} FOUND: Balance = $${account.balance}, Debits = $${account.debit}, Credits = $${account.credit}, Type = ${account.type}`);
          
          // CRITICAL FIX: If balance is 0 but there are credits for liability, recalculate
          if (account.type === 'Liability' && account.balance === 0 && account.credit > 0) {
            console.log(`⚠️ FIXING: Account ${code} has credits of $${account.credit} but balance is $${account.balance} - recalculating...`);
            account.balance = account.credit - account.debit;
            console.log(`   ✅ Recalculated balance: $${account.balance}`);
          }
        } else {
          console.log(`❌ Deposit Account ${code} NOT FOUND in accountBalances`);
          // List similar account codes
          const similarCodes = Array.from(accountBalances.keys()).filter(k => 
            String(k).includes('200') || String(k).includes('202')
          );
          console.log(`   Similar codes found: ${similarCodes.slice(0, 10).join(', ')}`);
        }
      });
      
      // Aggregate parent-child accounts
      const aggregatedBalances = await this.aggregateParentChildAccounts(accountBalances, accountMap);
      
      // Debug: Check deposit accounts in aggregated balances - CRITICAL CHECK
      console.log(`\n🔍 Checking aggregated balances for deposit accounts:`);
      const depositCodes = ['2020', '20002', '2002'];
      depositCodes.forEach(code => {
        // Try multiple formats
        const account1 = aggregatedBalances.get(code);
        const account2 = aggregatedBalances.get(String(code));
        const account = account1 || account2;
        
        if (account) {
          console.log(`✅ Found ${code} (${account.name}): Balance = $${account.balance}, Debits = $${account.debit}, Credits = $${account.credit}, Type = ${account.type}`);
          
          // CRITICAL FIX: If balance is wrong for liability, recalculate it
          if (account.type === 'Liability' && account.balance === 0 && account.credit > account.debit) {
            console.log(`⚠️ FIXING: Account ${code} balance is 0 but should be $${account.credit - account.debit} - fixing...`);
            account.balance = account.credit - account.debit;
            console.log(`   ✅ Fixed balance to: $${account.balance}`);
          }
        } else {
          console.log(`❌ Account ${code} NOT FOUND in aggregatedBalances - checking original accountBalances...`);
          const originalAccount = accountBalances.get(code) || accountBalances.get(String(code));
          if (originalAccount) {
            console.log(`   Found in accountBalances: Balance = $${originalAccount.balance}`);
            // Copy it to aggregatedBalances
            aggregatedBalances.set(String(code), { ...originalAccount });
            console.log(`   ✅ Copied to aggregatedBalances`);
          }
        }
      });
      
      // Build balance sheet structure - use aggregatedBalances but ensure deposits are correct
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
  /**
   * Aggregate parent-child accounts (LESS AGGRESSIVE VERSION)
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
      
      // --- ACCOUNTS PAYABLE (2000) AGGREGATION ---
      // ONLY aggregate accounts that explicitly have parentAccount = 2000's _id
      const apParentAccount = await Account.findOne({ code: '2000' });
      if (apParentAccount) {
        console.log(`🔍 Found AP parent account 2000 with _id: ${apParentAccount._id}`);
        
        // CRITICAL: Only get accounts that explicitly have parentAccount = apParentAccount._id
        const apChildAccounts = await Account.find({
          parentAccount: apParentAccount._id,
          isActive: true
        });

        console.log(`🔗 Found ${apChildAccounts.length} explicit child accounts for AP parent 2000`);
        
        // Log the found child accounts for debugging
        apChildAccounts.forEach(child => {
          console.log(`   ✅ AP Child: ${child.code} - ${child.name} (parentAccount: ${child.parentAccount})`);
        });

        // Aggregate ONLY these explicit child accounts into parent
        const parentAccount = aggregatedBalances.get('2000');
        if (parentAccount) {
          console.log(`📊 AP Parent Account (2000) BEFORE aggregation: Balance = $${parentAccount.balance.toFixed(2)}, Debits = $${parentAccount.debit.toFixed(2)}, Credits = $${parentAccount.credit.toFixed(2)}`);
          
          let totalChildBalance = 0;
          apChildAccounts.forEach(childAccount => {
            const childCode = String(childAccount.code);
            const childBalance = aggregatedBalances.get(childCode);
            
            if (childBalance && childCode !== '2000') {
              totalChildBalance += childBalance.balance;
              console.log(
                `   💰 Aggregating explicit AP child ${childCode} (${childAccount.name}): $${childBalance.balance.toFixed(2)}`
              );
            }
          });

          // Add the aggregated child balances to parent
          const originalAPBalance = parentAccount.balance;
          parentAccount.balance = originalAPBalance + totalChildBalance;
          
          console.log(
            `📊 Accounts Payable (2000): Original = $${originalAPBalance.toFixed(2)}, Added from children = $${totalChildBalance.toFixed(2)}, Final = $${parentAccount.balance.toFixed(2)}`
          );
        } else {
          console.log(`⚠️ WARNING: AP Parent Account (2000) NOT FOUND in aggregatedBalances!`);
          console.log(`   Available account codes:`, Array.from(aggregatedBalances.keys()).filter(k => k.includes('200')).slice(0, 10));
        }
      }
      
      // --- ACCOUNTS RECEIVABLE (1100) AGGREGATION ---
      const arParentAccount = await Account.findOne({ code: '1100' });
      if (arParentAccount) {
        console.log(`🔍 Found AR parent account 1100 with _id: ${arParentAccount._id}`);
        
        // ONLY get accounts that explicitly have parentAccount = arParentAccount._id
        const arChildAccounts = await Account.find({
          parentAccount: arParentAccount._id,
          isActive: true
        });

        console.log(`🔗 Found ${arChildAccounts.length} explicit child accounts for AR parent 1100`);
        
        // Log the found child accounts for debugging
        arChildAccounts.forEach(child => {
          console.log(`   ✅ AR Child: ${child.code} - ${child.name} (parentAccount: ${child.parentAccount})`);
        });

        // Aggregate ONLY these explicit child accounts into parent
        const parentAccount = aggregatedBalances.get('1100');
        if (parentAccount) {
          let totalChildBalance = 0;
          arChildAccounts.forEach(childAccount => {
            const childCode = String(childAccount.code);
            const childBalance = aggregatedBalances.get(childCode);
            
            if (childBalance && childCode !== '1100') {
              totalChildBalance += childBalance.balance;
              console.log(
                `   💰 Aggregating explicit AR child ${childCode} (${childAccount.name}): $${childBalance.balance.toFixed(2)}`
              );
            }
          });

          // Add the aggregated child balances to parent
          const originalARBalance = parentAccount.balance;
          parentAccount.balance = originalARBalance + totalChildBalance;
          
          console.log(
            `📊 Accounts Receivable (1100): Original = $${originalARBalance.toFixed(2)}, Added from children = $${totalChildBalance.toFixed(2)}, Final = $${parentAccount.balance.toFixed(2)}`
          );
        }
      }
      
    } catch (error) {
      console.error('❌ Error aggregating parent-child accounts:', error);
      // Fallback to hardcoded explicit relationships only
      console.log('🔄 Falling back to hardcoded explicit parent-child relationships...');
      
      // ONLY include accounts that we know have explicit parent-child relationships
      const fallbackRelationships = {
        '2000': ['200004'], // ONLY 200004 has explicit parentAccount relationship
        '1100': [] // No explicit AR children in the provided data
      };
      
      Object.entries(fallbackRelationships).forEach(([parentCode, childCodes]) => {
        const parentAccount = aggregatedBalances.get(parentCode);
        if (parentAccount) {
          let totalChildBalance = 0;
          
          childCodes.forEach(childCode => {
            const childAccount = aggregatedBalances.get(childCode);
            if (childAccount) {
              totalChildBalance += childAccount.balance;
              console.log(`🔗 Fallback: Aggregating explicit child account ${childCode}: $${childAccount.balance} into parent ${parentCode}`);
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
    const account = accountMap.get(accountCode);
    
    // Only return true if there's an explicit parentAccount relationship
    if (account && account.parentAccount) {
      // Check if the parent account is 2000
      const parentAccount = accountMap.get('2000');
      if (parentAccount && account.parentAccount.toString() === parentAccount._id.toString()) {
        return true;
      }
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
          deferredIncome: { amount: 0, accountCode: '2200', accountName: 'Advance Payment Liability' },
          otherCurrentLiabilities: {}
        },
        nonCurrent: {},
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
    
    // Process assets - show ALL accounts individually except Accounts Receivable (1100) which aggregates children
    accountBalances.forEach((account, code) => {
      // Normalize type check
      const normalizedType = (account.type || '').toLowerCase();
      if (normalizedType === 'asset') {
        // Include ALL asset accounts from Account collection, regardless of balance
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
    // Aggregate tenant deposits from multiple account codes (2020, 20002, 2002)
    let totalTenantDeposits = 0;
    let tenantDepositsAccounts = [];
    
    console.log(`\n🔍 Processing liabilities from ${accountBalances.size} accounts...`);
    console.log(`📋 Account codes in accountBalances:`, Array.from(accountBalances.keys()).slice(0, 10));
    
      // Process ALL liability accounts, not just those with balance > 0.01
    // Normalize all account codes to strings for consistent comparison
    console.log(`\n🔍 STARTING LIABILITIES PROCESSING: accountBalances.size = ${accountBalances.size}`);
    console.log(`📋 All account codes in accountBalances:`, Array.from(accountBalances.keys()).slice(0, 20));
    
    // CRITICAL: Check if account 20002 exists BEFORE the loop
    const check20002_1 = accountBalances.get('20002');
    const check20002_2 = accountBalances.get(String('20002'));
    const check20002_3 = Array.from(accountBalances.entries()).find(([code]) => String(code) === '20002' || code === '20002');
    console.log(`🔍 CHECKING FOR ACCOUNT 20002 BEFORE LOOP:`);
    console.log(`   accountBalances.get('20002'):`, check20002_1 ? `Found - Balance: $${check20002_1.balance}, Debits: $${check20002_1.debit}, Credits: $${check20002_1.credit}` : 'NOT FOUND');
    console.log(`   accountBalances.get(String('20002')):`, check20002_2 ? `Found - Balance: $${check20002_2.balance}` : 'NOT FOUND');
    console.log(`   Array.find(([code]) => String(code) === '20002'):`, check20002_3 ? `Found - Balance: $${check20002_3[1].balance}` : 'NOT FOUND');
    
    // Debug: Check if account 2000 exists BEFORE processing liabilities
    const apAccountCheck = accountBalances.get('2000');
    console.log(`🔍 Checking for account 2000 BEFORE liability processing:`, apAccountCheck ? {
      code: apAccountCheck.code,
      name: apAccountCheck.name,
      type: apAccountCheck.type,
      balance: apAccountCheck.balance,
      debit: apAccountCheck.debit,
      credit: apAccountCheck.credit
    } : 'NOT FOUND');
    if (!apAccountCheck) {
      console.log(`   Available account codes:`, Array.from(accountBalances.keys()).filter(k => k.includes('200') || k === '2000').slice(0, 10));
    }
    
    accountBalances.forEach((account, code) => {
      const accountCode = String(code); // Normalize to string
      
      // Debug: Log account 2000 specifically
      if (accountCode === '2000') {
        console.log(`🔍 Processing account 2000: Type = "${account.type}", Category = "${account.category}", Balance = $${account.balance}, Debits = $${account.debit}, Credits = $${account.credit}`);
      }
      
      // Debug: Log all deposit-related accounts (check both string and original code format)
      if (accountCode === '2020' || accountCode === '20002' || accountCode === '2002' || accountCode === '20001' ||
          String(code) === '2020' || String(code) === '20002' || String(code) === '2002' || String(code) === '20001') {
        console.log(`🔍 Checking deposit account ${accountCode}: Type = "${account.type}", Category = "${account.category}", Balance = $${account.balance}, Debits = $${account.debit}, Credits = $${account.credit}`);
      }
      
      // Normalize type check to handle case variations (Liability, LIABILITY, liability)
      const normalizedType = (account.type || '').toLowerCase();
      const isLiability = normalizedType === 'liability';
      const isAsset = normalizedType === 'asset';
      const isEquity = normalizedType === 'equity';
      
      if (isLiability) {
        // Aggregate tenant deposits from multiple account codes (2020, 20002, 2002, and possibly 20001 if it's a deposit)
        // NOTE: These accounts should NOT be aggregated into parent accounts - they go into tenant deposits
        // Normalize code to string for comparison
        if (accountCode === '2020' || accountCode === '20002' || accountCode === '2002') {
          // Tenant Deposits - Aggregate from all deposit account codes
          const depositBalance = account.balance || 0;
          
          // Debug: Detailed logging for deposit accounts
          if (accountCode === '20002') {
            console.log(`🔍 PROCESSING DEPOSIT ACCOUNT 20002:`);
            console.log(`   Code: ${accountCode} (original: ${code})`);
            console.log(`   Name: ${account.name}`);
            console.log(`   Type: ${account.type}`);
            console.log(`   Category: ${account.category}`);
            console.log(`   Balance: $${depositBalance}`);
            console.log(`   Debits: $${account.debit}`);
            console.log(`   Credits: $${account.credit}`);
            console.log(`   Will add to totalTenantDeposits: $${totalTenantDeposits} + $${depositBalance} = $${totalTenantDeposits + depositBalance}`);
          }
          
          // CRITICAL FIX: Ensure balance is correct - recalculate if needed
          let finalDepositBalance = depositBalance;
          if (account.type === 'Liability') {
            // For liabilities: balance = credit - debit
            const recalculatedBalance = account.credit - account.debit;
            if (Math.abs(recalculatedBalance - depositBalance) > 0.01) {
              console.log(`   ⚠️ Balance mismatch for ${accountCode}: Stored=${depositBalance}, Recalculated=${recalculatedBalance} - using recalculated`);
              finalDepositBalance = recalculatedBalance;
              account.balance = recalculatedBalance; // Fix the stored balance
            }
          }
          
          // Always include deposit accounts in aggregation, even if balance is small or zero
          totalTenantDeposits += finalDepositBalance;
          tenantDepositsAccounts.push({
            code: code,
            name: account.name,
            balance: finalDepositBalance,
            debits: account.debit,
            credits: account.credit,
            category: account.category
          });
          console.log(`💰 Tenant Deposits (${code}): Balance = $${finalDepositBalance} (Debits: $${account.debit}, Credits: $${account.credit}), Category: ${account.category}`);
          
          // ALSO add deposit accounts to liabilities.current.otherCurrentLiabilities so they appear in the frontend list
          // This ensures account 20002 shows up in the UI even though it's also aggregated into tenant deposits
          // Use consistent key format
          const depositKey = `liability_${accountCode}`;
          balanceSheet.liabilities.current.otherCurrentLiabilities[depositKey] = {
            amount: Math.max(0, finalDepositBalance),
            accountCode: accountCode,
            accountName: account.name,
            type: account.type.toLowerCase() || 'liability',
            category: account.category || 'Current Liabilities'
          };
          console.log(`📝 Also added deposit account ${accountCode} (${account.name}) to current liabilities with key "${depositKey}": $${Math.max(0, finalDepositBalance)}`);
        } else {
          // Include ALL liability accounts from the Account collection, regardless of balance
        if (accountCode === '2000') {
          // Main Accounts Payable (with aggregated child accounts)
          console.log(`📊 Setting Accounts Payable (2000) balance: $${account.balance} (Debits: $${account.debit}, Credits: $${account.credit})`);
          console.log(`   Account details:`, {
            code: account.code,
            name: account.name,
            type: account.type,
            balance: account.balance,
            debit: account.debit,
            credit: account.credit
          });
          balanceSheet.liabilities.current.accountsPayable.amount = account.balance;
          balanceSheet.liabilities.current.accountsPayable.accountCode = accountCode;
          balanceSheet.liabilities.current.accountsPayable.accountName = account.name;
        } else if (accountCode === '2200') {
          // Deferred Income
          balanceSheet.liabilities.current.deferredIncome.amount = account.balance;
          balanceSheet.liabilities.current.deferredIncome.accountCode = accountCode;
          balanceSheet.liabilities.current.deferredIncome.accountName = account.name;
        } else if (!this.isAccountsPayableChildAccount(code, accountMap)) {
          // ALL other liabilities - categorize into current or non-current
          // BUT skip deposit accounts (20001, 20002, 2002, 2020) as they're processed explicitly above
          const depositCodes = ['20001', '20002', '2002', '2020'];
          if (!depositCodes.includes(accountCode)) {
            // Check if this is a current or non-current liability
            const BalanceSheetService = require('./balanceSheetService');
            const isCurrent = BalanceSheetService.isCurrentLiability(code, account.name);
            
            const key = this.getLiabilityKey(code);
            const liabilityData = {
              amount: account.balance,
              accountCode: code,
              accountName: account.name,
              type: account.type.toLowerCase() || 'liability'
            };
            
            if (isCurrent) {
              balanceSheet.liabilities.current.otherCurrentLiabilities[key] = liabilityData;
            } else {
              balanceSheet.liabilities.nonCurrent[key] = liabilityData;
            }
            console.log(`📝 Added ${isCurrent ? 'current' : 'non-current'} liability account ${code} (${account.name}) to balance sheet: $${account.balance}`);
          } else {
            console.log(`📝 Skipping ${code} (${account.name}) from regular processing - already processed explicitly as deposit`);
          }
        }
        }
      }
    });
    
    // Set aggregated tenant deposits amount (show even if 0 for visibility)
    console.log(`\n💰 FINAL TENANT DEPOSITS AGGREGATION:`);
    console.log(`   Total aggregated: $${totalTenantDeposits}`);
    console.log(`   Number of accounts aggregated: ${tenantDepositsAccounts.length}`);
    tenantDepositsAccounts.forEach(acc => {
      console.log(`   - Account ${acc.code} (${acc.name}): $${acc.balance} (Debits: $${acc.debits}, Credits: $${acc.credits})`);
    });
    
    // CRITICAL FIX: ALWAYS check for deposit accounts explicitly (20001, 20002, 2002, 2020)
    // Process them directly from accountBalances to ensure they're included
    console.log(`\n💰 EXPLICITLY PROCESSING DEPOSIT ACCOUNTS:`);
    const depositCodesToProcess = ['2020', '20002', '2002', '20001'];
    depositCodesToProcess.forEach(depositCode => {
      // Try multiple ways to find the account
      let account = accountBalances.get(depositCode) || 
                    accountBalances.get(String(depositCode)) ||
                    Array.from(accountBalances.entries()).find(([code]) => 
                      String(code) === depositCode || code === depositCode
                    )?.[1];
      
      if (account) {
        const accountType = (account.type || '').toLowerCase();
        if (accountType === 'liability') {
          // Recalculate balance: For liabilities, balance = credit - debit
          let depositBalance = account.balance || 0;
          const recalculatedBalance = (account.credit || 0) - (account.debit || 0);
          
          // Use recalculated balance if different or if stored balance is 0 but credits exist
          if (Math.abs(recalculatedBalance - depositBalance) > 0.01 || (depositBalance === 0 && account.credit > 0)) {
            console.log(`   🔄 Recalculating balance for ${depositCode}: Stored=${depositBalance}, Recalculated=${recalculatedBalance}`);
            depositBalance = recalculatedBalance;
            account.balance = recalculatedBalance; // Update stored balance
          }
          
          // Check if already added to avoid duplicates
          const alreadyAdded = tenantDepositsAccounts.find(acc => 
            String(acc.code) === depositCode || String(acc.code) === String(depositCode)
          );
          
          if (!alreadyAdded) {
            totalTenantDeposits += Math.max(0, depositBalance); // Only positive balances
            tenantDepositsAccounts.push({
              code: depositCode,
              name: account.name || `Account ${depositCode}`,
              balance: Math.max(0, depositBalance),
              debits: account.debit || 0,
              credits: account.credit || 0,
              category: account.category
            });
            console.log(`   ✅ PROCESSED ${depositCode} (${account.name}): Balance = $${depositBalance}, Debits = $${account.debit || 0}, Credits = $${account.credit || 0}`);
          } else {
            console.log(`   ℹ️ ${depositCode} already in tenantDepositsAccounts`);
          }
          
          // ALSO ensure it's in liabilities.current.otherCurrentLiabilities so it shows as individual account
          // Use a unique key to ensure it doesn't get overwritten
          const depositKey = `liability_${depositCode}`;
          balanceSheet.liabilities.current.otherCurrentLiabilities[depositKey] = {
            amount: Math.max(0, depositBalance),
            accountCode: depositCode,
            accountName: account.name || `Account ${depositCode}`,
            type: 'liability',
            category: account.category || 'Current Liabilities'
          };
          console.log(`   📝 Added ${depositCode} to current liabilities with key "${depositKey}": $${Math.max(0, depositBalance)}`);
        } else {
          console.log(`   ⚠️ Account ${depositCode} found but type is "${account.type}" not Liability`);
        }
      } else {
        console.log(`   ❌ Account ${depositCode} NOT FOUND in accountBalances`);
      }
    });
    
    console.log(`💰 After explicit processing: totalTenantDeposits = $${totalTenantDeposits}, tenantDepositsAccounts.length = ${tenantDepositsAccounts.length}`);
    
    // Ensure we're using the absolute value and it's at least 0
    const finalTenantDeposits = Math.max(0, Math.abs(totalTenantDeposits));
    
    balanceSheet.liabilities.current.tenantDeposits.amount = finalTenantDeposits;
    balanceSheet.liabilities.current.tenantDeposits.accountCode = '2020'; // Use primary account code for display
    balanceSheet.liabilities.current.tenantDeposits.accountName = 'Tenant Deposits Held';
    
    if (tenantDepositsAccounts.length > 0) {
      console.log(`✅ Total Tenant Deposits (aggregated from ${tenantDepositsAccounts.length} accounts): $${finalTenantDeposits}`);
    } else {
      console.log(`❌ ERROR: No tenant deposit accounts found after fallback search!`);
    }
    
    // Process equity - include ALL equity accounts from Account collection
    accountBalances.forEach((account, code) => {
      // Normalize type check
      const normalizedType = (account.type || '').toLowerCase();
      if (normalizedType === 'equity') {
        // Include ALL equity accounts, regardless of balance
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
    
    // CRITICAL FIX: Ensure Accounts Payable balance is ALWAYS set correctly
    // accountBalances parameter IS the aggregatedBalances (see function call)
    const apAccountFromBalances = accountBalances.get('2000');
    if (apAccountFromBalances) {
      // ALWAYS set it from accountBalances - this is the source of truth
      const currentAPAmount = balanceSheet.liabilities.current.accountsPayable.amount || 0;
      balanceSheet.liabilities.current.accountsPayable.amount = apAccountFromBalances.balance;
      balanceSheet.liabilities.current.accountsPayable.accountCode = '2000';
      balanceSheet.liabilities.current.accountsPayable.accountName = apAccountFromBalances.name || 'Accounts Payable';
      
      if (Math.abs(apAccountFromBalances.balance - currentAPAmount) > 0.01) {
        console.log(`⚠️ FIXED: Accounts Payable balance was incorrect!`);
        console.log(`   Was: $${currentAPAmount}, Now: $${apAccountFromBalances.balance}`);
      }
    } else {
      console.log(`⚠️ WARNING: Account 2000 NOT FOUND in accountBalances when calculating totals!`);
      console.log(`   Available account codes:`, Array.from(accountBalances.keys()).filter(k => k.includes('200') || k === '2000').slice(0, 10));
    }
    
    // Current liabilities total
    const otherCurrentLiabilitiesTotal = Object.values(balanceSheet.liabilities.current.otherCurrentLiabilities || {})
      .reduce((sum, acc) => sum + (acc.amount || 0), 0);
    balanceSheet.liabilities.current.total = 
      (balanceSheet.liabilities.current.accountsPayable.amount || 0) +
      (balanceSheet.liabilities.current.tenantDeposits.amount || 0) +
      (balanceSheet.liabilities.current.deferredIncome.amount || 0) +
      otherCurrentLiabilitiesTotal;
    
    console.log(`📊 Final Current Liabilities Breakdown:`);
    console.log(`   Accounts Payable: $${balanceSheet.liabilities.current.accountsPayable.amount || 0}`);
    console.log(`   Tenant Deposits: $${balanceSheet.liabilities.current.tenantDeposits.amount || 0}`);
    console.log(`   Deferred Income: $${balanceSheet.liabilities.current.deferredIncome.amount || 0}`);
    console.log(`   Other Current Liabilities: $${otherCurrentLiabilitiesTotal}`);
    console.log(`   Total Current Liabilities: $${balanceSheet.liabilities.current.total}`);
    
    // Non-current liabilities total
    balanceSheet.liabilities.nonCurrent.total = 
      Object.values(balanceSheet.liabilities.nonCurrent || {})
        .reduce((sum, acc) => sum + (acc.amount || 0), 0);
    
    // Total liabilities
    balanceSheet.liabilities.total = 
      balanceSheet.liabilities.current.total + 
      balanceSheet.liabilities.nonCurrent.total;
    
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
      
      // Add residence filtering if specified - handle both ObjectId and string formats
      if (residence) {
        const mongoose = require('mongoose');
        const residenceObjectId = mongoose.Types.ObjectId.isValid(residence) 
          ? new mongoose.Types.ObjectId(residence) 
          : residence;
        
        // Use $or to match residence in multiple possible formats
        const residenceFilter = {
          $or: [
            { residence: residenceObjectId },
            { residence: residence.toString() },
            { 'metadata.residenceId': residenceObjectId },
            { 'metadata.residenceId': residence.toString() },
            { 'metadata.residence': residenceObjectId },
            { 'metadata.residence': residence.toString() }
          ]
        };
        
        // Combine with existing query conditions
        revenueQuery = { $and: [revenueQuery, residenceFilter] };
        expenseQuery = { $and: [expenseQuery, residenceFilter] };
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
      
      const query = {
        date: { $gte: startOfMonth, $lte: endOfMonth }
      };
      
      // Add residence filtering if specified - handle both ObjectId and string formats
      if (residence) {
        const mongoose = require('mongoose');
        const residenceObjectId = mongoose.Types.ObjectId.isValid(residence) 
          ? new mongoose.Types.ObjectId(residence) 
          : residence;
        
        const existingConditions = { ...query };
        query.$and = [
          existingConditions,
          {
            $or: [
              { residence: residenceObjectId },
              { residence: residence.toString() },
              { 'metadata.residenceId': residenceObjectId },
              { 'metadata.residenceId': residence.toString() },
              { 'metadata.residence': residenceObjectId },
              { 'metadata.residence': residence.toString() }
            ]
          }
        ];
      }
      
      const transactions = await TransactionEntry.find(query);
      
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
      const query = {
        date: { $lte: asOfDate }
      };
      
      // Add residence filtering if specified - handle both ObjectId and string formats
      if (residence) {
        const mongoose = require('mongoose');
        const residenceObjectId = mongoose.Types.ObjectId.isValid(residence) 
          ? new mongoose.Types.ObjectId(residence) 
          : residence;
        
        const existingConditions = { ...query };
        query.$and = [
          existingConditions,
          {
            $or: [
              { residence: residenceObjectId },
              { residence: residence.toString() },
              { 'metadata.residenceId': residenceObjectId },
              { 'metadata.residenceId': residence.toString() },
              { 'metadata.residence': residenceObjectId },
              { 'metadata.residence': residence.toString() }
            ]
          }
        ];
      }
      
      const transactions = await TransactionEntry.find(query);
      
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
      
      const query = {
        date: { $gte: startDate, $lte: endDate }
      };
      
      // Add residence filtering if specified - handle both ObjectId and string formats
      if (residence) {
        const mongoose = require('mongoose');
        const residenceObjectId = mongoose.Types.ObjectId.isValid(residence) 
          ? new mongoose.Types.ObjectId(residence) 
          : residence;
        
        const existingConditions = { ...query };
        query.$and = [
          existingConditions,
          {
            $or: [
              { residence: residenceObjectId },
              { residence: residence.toString() },
              { 'metadata.residenceId': residenceObjectId },
              { 'metadata.residenceId': residence.toString() },
              { 'metadata.residence': residenceObjectId },
              { 'metadata.residence': residence.toString() }
            ]
          }
        ];
      }
      
      const transactions = await TransactionEntry.find(query);
      
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
