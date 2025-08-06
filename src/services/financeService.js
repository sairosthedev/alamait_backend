import api from './api';

// Get transaction entries with filters
export const getTransactionEntries = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    const response = await api.get(`/transactions/entries?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction entries:', error);
    throw error;
  }
};

// Get all transactions (main endpoint)
export const getAllTransactions = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    const response = await api.get(`/finance/transactions?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    throw error;
  }
};

// Get transaction summary
export const getTransactionSummary = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    const response = await api.get(`/finance/transactions/summary?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    throw error;
  }
};

// Get transaction by ID
export const getTransactionById = async (id) => {
  try {
    const response = await api.get(`/finance/transactions/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction by ID:', error);
    throw error;
  }
};

// Get transaction entries by transaction ID
export const getTransactionEntriesById = async (id) => {
  try {
    const response = await api.get(`/finance/transactions/${id}/entries`);
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction entries by ID:', error);
    throw error;
  }
};

// Financial Reports

// Get Income Statement
export const getIncomeStatement = async (period, basis = 'cash') => {
  try {
    const response = await api.get(`/financial-reports/income-statement?period=${period}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching income statement:', error);
    throw error;
  }
};

// Get Monthly Income Statement
export const getMonthlyIncomeStatement = async (period, basis = 'cash') => {
  try {
    const response = await api.get(`/financial-reports/monthly-income-statement?period=${period}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching monthly income statement:', error);
    throw error;
  }
};

// Get Balance Sheet
export const getBalanceSheet = async (asOf, basis = 'cash') => {
  try {
    const response = await api.get(`/financial-reports/balance-sheet?asOf=${asOf}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching balance sheet:', error);
    throw error;
  }
};

// Get Cash Flow Statement
export const getCashFlowStatement = async (period, basis = 'cash') => {
  try {
    const response = await api.get(`/financial-reports/cash-flow?period=${period}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching cash flow statement:', error);
    throw error;
  }
};

// Get Trial Balance
export const getTrialBalance = async (asOf, basis = 'cash') => {
  try {
    const response = await api.get(`/financial-reports/trial-balance?asOf=${asOf}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching trial balance:', error);
    throw error;
  }
};

// Get General Ledger
export const getGeneralLedger = async (accountCode, period, basis = 'cash') => {
  try {
    const response = await api.get(`/financial-reports/general-ledger?accountCode=${accountCode}&period=${period}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching general ledger:', error);
    throw error;
  }
};

// Get Account Balances
export const getAccountBalances = async (asOf, basis = 'cash') => {
  try {
    const response = await api.get(`/financial-reports/account-balances?asOf=${asOf}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching account balances:', error);
    throw error;
  }
};

// Get Financial Summary
export const getFinancialSummary = async (period, basis = 'cash') => {
  try {
    const response = await api.get(`/financial-reports/financial-summary?period=${period}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    throw error;
  }
};

// Export Financial Report
export const exportFinancialReport = async (reportType, params) => {
  try {
    const response = await api.post('/financial-reports/export', {
      reportType,
      ...params
    });
    return response.data;
  } catch (error) {
    console.error('Error exporting financial report:', error);
    throw error;
  }
};

// Finance-specific endpoints

// Get Income Transactions
export const getIncomeTransactions = async (period, basis = 'cash', type = 'all', page = 1, limit = 20) => {
  try {
    const response = await api.get(`/finance/income/transactions?period=${period}&basis=${basis}&type=${type}&page=${page}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching income transactions:', error);
    throw error;
  }
};

// Get Cash Flow Data
export const getCashFlowData = async (period, basis = 'cash') => {
  try {
    const response = await api.get(`/finance/cash-flow?period=${period}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching cash flow data:', error);
    throw error;
  }
};

// Get Trial Balance Data
export const getTrialBalanceData = async (asOf, basis = 'cash') => {
  try {
    const response = await api.get(`/finance/trial-balance?asOf=${asOf}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching trial balance data:', error);
    throw error;
  }
};

// Get Monthly Expenses
export const getMonthlyExpenses = async (period, basis = 'cash') => {
  try {
    const response = await api.get(`/financial-reports/monthly-expenses?period=${period}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching monthly expenses:', error);
    throw error;
  }
};

// Get Monthly Cash Flow
export const getMonthlyCashFlow = async (period, basis = 'cash') => {
  try {
    const response = await api.get(`/financial-reports/monthly-cash-flow?period=${period}&basis=${basis}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching monthly cash flow:', error);
    throw error;
  }
}; 