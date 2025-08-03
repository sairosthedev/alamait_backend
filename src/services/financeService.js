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

// Get transaction summary
export const getTransactionSummary = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    const response = await api.get(`/transactions/summary?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    throw error;
  }
};

// Get single transaction entry
export const getTransactionEntry = async (id) => {
  try {
    const response = await api.get(`/transactions/entries/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction entry:', error);
    throw error;
  }
};

// Create manual transaction entry
export const createTransactionEntry = async (transactionData) => {
  try {
    const response = await api.post('/transactions/entries', transactionData);
    return response.data;
  } catch (error) {
    console.error('Error creating transaction entry:', error);
    throw error;
  }
};

// Get accounts for dropdown
export const getAccounts = async () => {
  try {
    const response = await api.get('/transactions/accounts');
    return response.data;
  } catch (error) {
    console.error('Error fetching accounts:', error);
    throw error;
  }
};

// Export transactions to CSV
export const exportTransactions = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    const response = await api.get(`/transactions/export?${params.toString()}`, {
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    console.error('Error exporting transactions:', error);
    throw error;
  }
}; 