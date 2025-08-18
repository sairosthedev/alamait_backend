const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

class BalanceSheetService {
  /**
   * Generate Balance Sheet for Accrual Basis
   * Assets = Cash + AR + Property + Equipment + Prepaid
   * Liabilities = AP + Loans + Deposits + Accrued Expenses + Taxes
   * Equity = Capital + Retained Earnings (from Income Statement)
   */
  static async generateBalanceSheet(asOfDate, residence = null) {
    try {
      console.log(`📊 Generating Balance Sheet as of ${asOfDate}`);
      
      const query = {
        date: { $lte: new Date(asOfDate) },
        status: 'posted'
      };
      
      if (residence) {
        query.residence = residence;
      }
      
      const allEntries = await TransactionEntry.find(query).sort({ date: 1 });
      
      // Initialize balance sheet with proper structure
      const balanceSheet = {
        asOfDate: new Date(asOfDate),
        residence: residence || 'all',
        assets: { 
          current: {}, 
          nonCurrent: {}, 
          totalCurrent: 0, 
          totalNonCurrent: 0, 
          totalAssets: 0,
          accumulatedDepreciation: 0
        },
        liabilities: { 
          current: {}, 
          nonCurrent: {}, 
          totalCurrent: 0, 
          totalNonCurrent: 0, 
          totalLiabilities: 0 
        },
        equity: { 
          capital: 0, 
          retainedEarnings: 0, 
          otherEquity: 0,
          totalEquity: 0 
        },
        workingCapital: 0,
        currentRatio: 0,
        debtToEquity: 0,
        message: 'Balance sheet generated successfully'
      };
      
      // Process entries to build account balances
      const accountBalances = {};
      
      allEntries.forEach(entry => {
        if (entry.entries && Array.isArray(entry.entries)) {
          entry.entries.forEach(lineItem => {
            const accountCode = lineItem.accountCode;
            const accountName = lineItem.accountName;
            const accountType = lineItem.accountType;
            const debit = lineItem.debit || 0;
            const credit = lineItem.credit || 0;
            
            if (!accountBalances[accountCode]) {
              accountBalances[accountCode] = {
                code: accountCode,
                name: accountName,
                type: accountType,
                debitTotal: 0,
                creditTotal: 0,
                balance: 0
              };
            }
            
            accountBalances[accountCode].debitTotal += debit;
            accountBalances[accountCode].creditTotal += credit;
          });
        }
      });
      
      // Calculate net balance for each account
      Object.values(accountBalances).forEach(account => {
        switch (account.type) {
          case 'Asset':
            account.balance = account.debitTotal - account.creditTotal;
            break;
          case 'Liability':
            account.balance = account.creditTotal - account.debitTotal;
            break;
          case 'Equity':
            account.balance = account.creditTotal - account.debitTotal;
            break;
          case 'Income':
            account.balance = account.creditTotal - account.debitTotal;
            break;
          case 'Expense':
            account.balance = account.debitTotal - account.creditTotal;
            break;
        }
      });
      
      // Categorize into balance sheet sections with proper classification
      Object.values(accountBalances).forEach(account => {
        const balance = account.balance;
        
        switch (account.type) {
          case 'Asset':
            if (this.isCurrentAsset(account.code, account.name)) {
              balanceSheet.assets.current[account.code] = {
                name: account.name,
                balance: Math.max(0, balance),
                description: this.getAssetDescription(account.code, account.name),
                category: 'Current Asset'
              };
              balanceSheet.assets.totalCurrent += Math.max(0, balance);
            } else {
              balanceSheet.assets.nonCurrent[account.code] = {
                name: account.name,
                balance: Math.max(0, balance),
                description: this.getAssetDescription(account.code, account.name),
                category: 'Non-Current Asset'
              };
              balanceSheet.assets.totalNonCurrent += Math.max(0, balance);
            }
            break;
            
          case 'Liability':
            if (this.isCurrentLiability(account.code, account.name)) {
              balanceSheet.liabilities.current[account.code] = {
                name: account.name,
                balance: Math.max(0, balance),
                description: this.getLiabilityDescription(account.code, account.name),
                category: 'Current Liability'
              };
              balanceSheet.liabilities.totalCurrent += Math.max(0, balance);
            } else {
              balanceSheet.liabilities.nonCurrent[account.code] = {
                name: account.name,
                balance: Math.max(0, balance),
                description: this.getLiabilityDescription(account.code, account.name),
                category: 'Non-Current Liability'
              };
              balanceSheet.liabilities.totalNonCurrent += Math.max(0, balance);
            }
            break;
            
          case 'Equity':
            if (account.code === '3000' || account.name.toLowerCase().includes('capital')) {
              balanceSheet.equity.capital = Math.max(0, balance);
            } else if (account.name.toLowerCase().includes('retained') || account.name.toLowerCase().includes('earnings')) {
              balanceSheet.equity.retainedEarnings += balance;
            } else {
              balanceSheet.equity.otherEquity += balance;
            }
            break;
            
          case 'Income':
            // Income increases retained earnings
            balanceSheet.equity.retainedEarnings += balance;
            console.log(`📈 Income account ${account.code} (${account.name}): +$${balance.toLocaleString()} → Retained Earnings: $${balanceSheet.equity.retainedEarnings.toLocaleString()}`);
            break;
            
          case 'Expense':
            // Expenses decrease retained earnings
            balanceSheet.equity.retainedEarnings -= balance;
            console.log(`📉 Expense account ${account.code} (${account.name}): -$${balance.toLocaleString()} → Retained Earnings: $${balanceSheet.equity.retainedEarnings.toLocaleString()}`);
            break;
        }
      });
      
      // Calculate totals and ratios
      balanceSheet.assets.totalAssets = balanceSheet.assets.totalCurrent + balanceSheet.assets.totalNonCurrent;
      balanceSheet.liabilities.totalLiabilities = balanceSheet.liabilities.totalCurrent + balanceSheet.liabilities.totalNonCurrent;
      balanceSheet.equity.totalEquity = balanceSheet.equity.capital + balanceSheet.equity.retainedEarnings + balanceSheet.equity.otherEquity;
      
      // Calculate key ratios
      balanceSheet.workingCapital = balanceSheet.assets.totalCurrent - balanceSheet.liabilities.totalCurrent;
      balanceSheet.currentRatio = balanceSheet.liabilities.totalCurrent > 0 ? 
        balanceSheet.assets.totalCurrent / balanceSheet.liabilities.totalCurrent : 0;
      balanceSheet.debtToEquity = balanceSheet.equity.totalEquity > 0 ? 
        balanceSheet.liabilities.totalLiabilities / balanceSheet.equity.totalEquity : 0;
      
      // Validate accounting equation: Assets = Liabilities + Equity
      const accountingEquation = Math.abs(
        balanceSheet.assets.totalAssets - 
        (balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)
      );
      
      if (accountingEquation > 0.01) {
        console.warn(`⚠️ Accounting equation imbalance: ${accountingEquation}`);
        
        // Auto-correct the retained earnings to balance the equation
        const calculatedEquity = balanceSheet.assets.totalAssets - balanceSheet.liabilities.totalLiabilities;
        const equityDifference = calculatedEquity - balanceSheet.equity.totalEquity;
        
        console.log(`🔧 Auto-correcting equity: Current: $${balanceSheet.equity.totalEquity.toLocaleString()}, Should be: $${calculatedEquity.toLocaleString()}, Difference: $${equityDifference.toLocaleString()}`);
        
        // Adjust retained earnings to balance the equation
        balanceSheet.equity.retainedEarnings += equityDifference;
        balanceSheet.equity.totalEquity = balanceSheet.equity.capital + balanceSheet.equity.retainedEarnings + balanceSheet.equity.otherEquity;
        
        console.log(`✅ Equity corrected: Retained Earnings: $${balanceSheet.equity.retainedEarnings.toLocaleString()}, Total Equity: $${balanceSheet.equity.totalEquity.toLocaleString()}`);
        
        balanceSheet.accountingEquation = {
          balanced: false,
          difference: accountingEquation,
          message: `Assets ≠ Liabilities + Equity - Auto-corrected by $${equityDifference.toLocaleString()}`,
          autoCorrected: true,
          correctionAmount: equityDifference
        };
      } else {
        balanceSheet.accountingEquation = {
          balanced: true,
          difference: 0,
          message: 'Assets = Liabilities + Equity ✓'
        };
      }
      
      return balanceSheet;
      
    } catch (error) {
      console.error('❌ Error generating balance sheet:', error);
      throw error;
    }
  }

  /**
   * Generate Monthly Balance Sheet for React Component
   * This method provides the data structure expected by the React component
   */
  static async generateMonthlyBalanceSheet(year, residence = null) {
    try {
      console.log(`📊 Generating Monthly Balance Sheet for ${year}${residence ? ` for residence: ${residence}` : ' (all residences)'}`);
      
      const monthlyData = {};
      const annualSummary = {
        totalAnnualAssets: 0,
        totalAnnualLiabilities: 0,
        totalAnnualEquity: 0,
        totalAnnualCurrentAssets: 0,
        totalAnnualNonCurrentAssets: 0,
        totalAnnualCurrentLiabilities: 0,
        totalAnnualNonCurrentLiabilities: 0
      };
      
      // Generate balance sheet for each month
      for (let month = 1; month <= 12; month++) {
        const monthEndDate = new Date(year, month, 0); // Last day of the month
        const monthKey = month;
        
        try {
          const monthBalanceSheet = await this.generateBalanceSheet(monthEndDate, residence);
          
          // Structure the data as expected by the React component with enhanced structure
          monthlyData[monthKey] = {
            month: monthKey,
            monthName: monthEndDate.toLocaleDateString('en-US', { month: 'long' }),
            assets: {
              current: {
                cashAndBank: this.formatCashAndBankAccounts(monthBalanceSheet.assets.current),
                accountsReceivable: this.formatAccountsReceivable(monthBalanceSheet.assets.current),
                inventory: this.formatInventoryAccounts(monthBalanceSheet.assets.current),
                prepaidExpenses: this.formatPrepaidAccounts(monthBalanceSheet.assets.current),
                total: monthBalanceSheet.assets.totalCurrent
              },
              nonCurrent: {
                propertyPlantEquipment: this.formatFixedAssets(monthBalanceSheet.assets.nonCurrent),
                accumulatedDepreciation: monthBalanceSheet.assets.accumulatedDepreciation,
                total: monthBalanceSheet.assets.totalNonCurrent
              },
              total: monthBalanceSheet.assets.totalAssets
            },
            liabilities: {
              current: {
                accountsPayable: this.formatAccountsPayable(monthBalanceSheet.liabilities.current),
                accruedExpenses: this.formatAccruedExpenses(monthBalanceSheet.liabilities.current),
                tenantDeposits: this.formatTenantDeposits(monthBalanceSheet.liabilities.current),
                taxesPayable: this.formatTaxesPayable(monthBalanceSheet.liabilities.current),
                total: monthBalanceSheet.liabilities.totalCurrent
              },
              nonCurrent: {
                longTermLoans: this.formatLongTermLoans(monthBalanceSheet.liabilities.nonCurrent),
                otherLongTermLiabilities: this.formatOtherLongTermLiabilities(monthBalanceSheet.liabilities.nonCurrent),
                total: monthBalanceSheet.liabilities.totalNonCurrent
              },
              total: monthBalanceSheet.liabilities.totalLiabilities
            },
            equity: {
              capital: {
                accountCode: '3000',
                accountName: 'Owner\'s Capital',
                amount: monthBalanceSheet.equity.capital
              },
              retainedEarnings: {
                accountCode: '3100',
                accountName: 'Retained Earnings',
                amount: monthBalanceSheet.equity.retainedEarnings
              },
              otherEquity: {
                accountCode: '3200',
                accountName: 'Other Equity',
                amount: monthBalanceSheet.equity.otherEquity
              },
              total: monthBalanceSheet.equity.totalEquity
            },
            summary: {
              totalAssets: monthBalanceSheet.assets.totalAssets,
              totalLiabilities: monthBalanceSheet.liabilities.totalLiabilities,
              totalEquity: monthBalanceSheet.equity.totalEquity,
              workingCapital: monthBalanceSheet.workingCapital,
              currentRatio: monthBalanceSheet.currentRatio,
              debtToEquity: monthBalanceSheet.debtToEquity
            }
          };
          
          // Accumulate annual totals
          annualSummary.totalAnnualAssets += monthBalanceSheet.assets.totalAssets;
          annualSummary.totalAnnualLiabilities += monthBalanceSheet.liabilities.totalLiabilities;
          annualSummary.totalAnnualEquity += monthBalanceSheet.equity.totalEquity;
          annualSummary.totalAnnualCurrentAssets += monthBalanceSheet.assets.totalCurrent;
          annualSummary.totalAnnualNonCurrentAssets += monthBalanceSheet.assets.totalNonCurrent;
          annualSummary.totalAnnualCurrentLiabilities += monthBalanceSheet.liabilities.totalCurrent;
          annualSummary.totalAnnualNonCurrentLiabilities += monthBalanceSheet.liabilities.totalNonCurrent;
          
        } catch (monthError) {
          console.error(`❌ Error generating balance sheet for month ${month}:`, monthError);
          // Provide empty data for failed months
          monthlyData[monthKey] = {
            month: monthKey,
            monthName: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
            assets: { 
              current: { cashAndBank: {}, accountsReceivable: {}, inventory: {}, prepaidExpenses: {}, total: 0 }, 
              nonCurrent: { propertyPlantEquipment: {}, accumulatedDepreciation: 0, total: 0 }, 
              total: 0 
            },
            liabilities: { 
              current: { accountsPayable: {}, accruedExpenses: {}, tenantDeposits: {}, taxesPayable: {}, total: 0 }, 
              nonCurrent: { longTermLoans: {}, otherLongTermLiabilities: {}, total: 0 }, 
              total: 0 
            },
            equity: { 
              capital: { accountCode: '3000', accountName: 'Owner\'s Capital', amount: 0 }, 
              retainedEarnings: { accountCode: '3100', accountName: 'Retained Earnings', amount: 0 }, 
              otherEquity: { accountCode: '3200', accountName: 'Other Equity', amount: 0 }, 
              total: 0 
            },
            summary: { 
              totalAssets: 0, 
              totalLiabilities: 0, 
              totalEquity: 0, 
              workingCapital: 0, 
              currentRatio: 0, 
              debtToEquity: 0 
            }
          };
        }
      }
      
      // Calculate annual averages (divide by 12 for monthly average)
      annualSummary.totalAnnualAssets = Math.round(annualSummary.totalAnnualAssets / 12);
      annualSummary.totalAnnualLiabilities = Math.round(annualSummary.totalAnnualLiabilities / 12);
      annualSummary.totalAnnualEquity = Math.round(annualSummary.totalAnnualEquity / 12);
      annualSummary.totalAnnualCurrentAssets = Math.round(annualSummary.totalAnnualCurrentAssets / 12);
      annualSummary.totalAnnualNonCurrentAssets = Math.round(annualSummary.totalAnnualNonCurrentAssets / 12);
      annualSummary.totalAnnualCurrentLiabilities = Math.round(annualSummary.totalAnnualCurrentLiabilities / 12);
      annualSummary.totalAnnualNonCurrentLiabilities = Math.round(annualSummary.totalAnnualNonCurrentLiabilities / 12);
      
      const result = {
        year: year,
        residence: residence || 'all',
        monthly: monthlyData,
        annualSummary: annualSummary,
        message: `Monthly balance sheet generated for ${year}${residence ? ` for residence: ${residence}` : ' (all residences)'}`
      };
      
      console.log(`✅ Monthly Balance Sheet generated successfully for ${year}`);
      return result;
      
    } catch (error) {
      console.error('❌ Error generating monthly balance sheet:', error);
      throw error;
    }
  }

  // Enhanced helper methods for formatting data
  static formatCashAndBankAccounts(currentAssets) {
    const cashAndBank = {};
    let total = 0;
    
    Object.entries(currentAssets).forEach(([code, asset]) => {
      if (asset.name.toLowerCase().includes('cash') || asset.name.toLowerCase().includes('bank')) {
        cashAndBank[code] = {
          accountCode: code,
          accountName: asset.name,
          amount: asset.balance,
          description: asset.description,
          category: asset.category
        };
        total += asset.balance;
      }
    });
    
    cashAndBank.total = total;
    return cashAndBank;
  }

  static formatAccountsReceivable(currentAssets) {
    const accountsReceivable = {};
    
    Object.entries(currentAssets).forEach(([code, asset]) => {
      if (asset.name.toLowerCase().includes('receivable')) {
        accountsReceivable[code] = {
          accountCode: code,
          accountName: asset.name,
          amount: asset.balance,
          description: asset.description,
          category: asset.category
        };
      }
    });
    
    // If no specific AR accounts found, create a default one
    if (Object.keys(accountsReceivable).length === 0) {
      accountsReceivable.default = {
        accountCode: '1100',
        accountName: 'Accounts Receivable - Tenants',
        amount: 0,
        description: 'Accounts receivable from tenants',
        category: 'Current Asset'
      };
    }
    
    return accountsReceivable;
  }

  static formatInventoryAccounts(currentAssets) {
    const inventory = {};
    
    Object.entries(currentAssets).forEach(([code, asset]) => {
      if (asset.name.toLowerCase().includes('inventory') || asset.name.toLowerCase().includes('supplies')) {
        inventory[code] = {
          accountCode: code,
          accountName: asset.name,
          amount: asset.balance,
          description: asset.description,
          category: asset.category
        };
      }
    });
    
    return inventory;
  }

  static formatPrepaidAccounts(currentAssets) {
    const prepaid = {};
    
    Object.entries(currentAssets).forEach(([code, asset]) => {
      if (asset.name.toLowerCase().includes('prepaid')) {
        prepaid[code] = {
          accountCode: code,
          accountName: asset.name,
          amount: asset.balance,
          description: asset.description,
          category: asset.category
        };
      }
    });
    
    return prepaid;
  }

  static formatFixedAssets(nonCurrentAssets) {
    const fixedAssets = {};
    
    Object.entries(nonCurrentAssets).forEach(([code, asset]) => {
      if (asset.name.toLowerCase().includes('property') || 
          asset.name.toLowerCase().includes('equipment') || 
          asset.name.toLowerCase().includes('building') ||
          asset.name.toLowerCase().includes('vehicle')) {
        fixedAssets[code] = {
          accountCode: code,
          accountName: asset.name,
          amount: asset.balance,
          description: asset.description,
          category: asset.category
        };
      }
    });
    
    return fixedAssets;
  }

  static formatAccountsPayable(currentLiabilities) {
    const accountsPayable = {};
    
    Object.entries(currentLiabilities).forEach(([code, liability]) => {
      if (liability.name.toLowerCase().includes('payable')) {
        accountsPayable[code] = {
          accountCode: code,
          accountName: liability.name,
          amount: liability.balance,
          description: liability.description,
          category: liability.category
        };
      }
    });
    
    return accountsPayable;
  }

  static formatAccruedExpenses(currentLiabilities) {
    const accrued = {};
    
    Object.entries(currentLiabilities).forEach(([code, liability]) => {
      if (liability.name.toLowerCase().includes('accrued')) {
        accrued[code] = {
          accountCode: code,
          accountName: liability.name,
          amount: liability.balance,
          description: liability.description,
          category: liability.category
        };
      }
    });
    
    return accrued;
  }

  static formatTenantDeposits(currentLiabilities) {
    const deposits = {};
    
    Object.entries(currentLiabilities).forEach(([code, liability]) => {
      if (liability.name.toLowerCase().includes('deposit')) {
        deposits[code] = {
          accountCode: code,
          accountName: liability.name,
          amount: liability.balance,
          description: liability.description,
          category: liability.category
        };
      }
    });
    
    return deposits;
  }

  static formatTaxesPayable(currentLiabilities) {
    const taxes = {};
    
    Object.entries(currentLiabilities).forEach(([code, liability]) => {
      if (liability.name.toLowerCase().includes('tax')) {
        taxes[code] = {
          accountCode: code,
          accountName: liability.name,
          amount: liability.balance,
          description: liability.description,
          category: liability.category
        };
      }
    });
    
    return taxes;
  }

  static formatLongTermLoans(nonCurrentLiabilities) {
    const loans = {};
    
    Object.entries(nonCurrentLiabilities).forEach(([code, liability]) => {
      if (liability.name.toLowerCase().includes('loan')) {
        loans[code] = {
          accountCode: code,
          accountName: liability.name,
          amount: liability.balance,
          description: liability.description,
          category: liability.category
        };
      }
    });
    
    return loans;
  }

  static formatOtherLongTermLiabilities(nonCurrentLiabilities) {
    const other = {};
    
    Object.entries(nonCurrentLiabilities).forEach(([code, liability]) => {
      if (!liability.name.toLowerCase().includes('loan')) {
        other[code] = {
          accountCode: code,
          accountName: liability.name,
          amount: liability.balance,
          description: liability.description,
          category: liability.category
        };
      }
    });
    
    return other;
  }
  
  // Enhanced helper methods for proper classification
  static isCurrentAsset(accountCode, accountName) {
    const currentAssetCodes = ['1000', '1100', '1200', '1300', '1400', '1500'];
    const currentAssetNames = ['cash', 'bank', 'receivable', 'inventory', 'prepaid'];
    
    return currentAssetCodes.includes(accountCode) || 
           currentAssetNames.some(name => accountName.toLowerCase().includes(name));
  }
  
  static isCurrentLiability(accountCode, accountName) {
    const currentLiabilityCodes = ['2000', '2100', '2200', '2300'];
    const currentLiabilityNames = ['payable', 'accrued', 'deposit', 'tax', 'short term'];
    
    return currentLiabilityCodes.includes(accountCode) || 
           currentLiabilityNames.some(name => accountName.toLowerCase().includes(name));
  }
  
  static getAssetDescription(accountCode, accountName) {
    if (accountCode === '1000' || accountName.toLowerCase().includes('cash')) {
      return 'Cash and cash equivalents';
    } else if (accountCode === '1100' || accountName.toLowerCase().includes('receivable')) {
      return 'Accounts receivable from tenants';
    } else if (accountCode === '1200' || accountName.toLowerCase().includes('inventory')) {
      return 'Inventory and supplies';
    } else if (accountCode === '1300' || accountName.toLowerCase().includes('prepaid')) {
      return 'Prepaid expenses';
    } else if (accountCode === '3000' || accountName.toLowerCase().includes('property')) {
      return 'Property and buildings';
    } else if (accountCode === '3100' || accountName.toLowerCase().includes('equipment')) {
      return 'Equipment and furniture';
    } else if (accountCode === '3200' || accountName.toLowerCase().includes('vehicle')) {
      return 'Vehicles and transportation';
    } else {
      return 'Other assets';
    }
  }
  
  static getLiabilityDescription(accountCode, accountName) {
    if (accountCode === '2000' || accountName.toLowerCase().includes('payable')) {
      return 'Accounts payable to suppliers';
    } else if (accountCode === '2100' || accountName.toLowerCase().includes('accrued')) {
      return 'Accrued expenses and liabilities';
    } else if (accountCode === '2200' || accountName.toLowerCase().includes('deposit')) {
      return 'Tenant security deposits';
    } else if (accountCode === '2300' || accountName.toLowerCase().includes('tax')) {
      return 'Taxes payable';
    } else if (accountCode === '2400' || accountName.toLowerCase().includes('loan')) {
      return 'Long-term loans and borrowings';
    } else {
      return 'Other liabilities';
    }
  }
}

module.exports = BalanceSheetService;
