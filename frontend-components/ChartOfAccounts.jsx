import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ChartOfAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    category: '',
    subcategory: '',
    description: '',
    parentAccount: ''
  });
  const [suggestedCategories, setSuggestedCategories] = useState([]);
  const [codeSuggestions, setCodeSuggestions] = useState([]);
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    search: '',
    isActive: true
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Account type options
  const accountTypes = [
    { value: 'Asset', label: 'Asset', description: 'Resources owned by the business' },
    { value: 'Liability', label: 'Liability', description: 'Obligations owed to others' },
    { value: 'Equity', label: 'Equity', description: "Owner's investment and retained earnings" },
    { value: 'Income', label: 'Income', description: 'Revenue and income sources' },
    { value: 'Expense', label: 'Expense', description: 'Costs and expenses incurred' }
  ];

  // Category options based on type
  const categoryOptions = {
    Asset: [
      { value: 'Current Assets', label: 'Current Assets' },
      { value: 'Fixed Assets', label: 'Fixed Assets' },
      { value: 'Other Assets', label: 'Other Assets' }
    ],
    Liability: [
      { value: 'Current Liabilities', label: 'Current Liabilities' },
      { value: 'Long-term Liabilities', label: 'Long-term Liabilities' }
    ],
    Equity: [
      { value: 'Owner Equity', label: 'Owner Equity' },
      { value: 'Retained Earnings', label: 'Retained Earnings' }
    ],
    Income: [
      { value: 'Operating Revenue', label: 'Operating Revenue' },
      { value: 'Other Income', label: 'Other Income' }
    ],
    Expense: [
      { value: 'Operating Expenses', label: 'Operating Expenses' },
      { value: 'Administrative Expenses', label: 'Administrative Expenses' },
      { value: 'Financial Expenses', label: 'Financial Expenses' }
    ]
  };

  // API base URL
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/finance';

  // Fetch accounts
  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });

      const response = await axios.get(`${API_BASE}/accounts?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setAccounts(response.data.accounts);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  // Get account type info and suggestions
  const getAccountTypeInfo = async (type) => {
    if (!type) return;
    
    try {
      const response = await axios.get(`${API_BASE}/accounts/type-info/${type}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setSuggestedCategories(response.data.suggestedCategories);
      
      // Get code suggestions
      if (formData.category) {
        getCodeSuggestions(type, formData.category);
      }
    } catch (err) {
      console.error('Error fetching account type info:', err);
    }
  };

  // Get code suggestions
  const getCodeSuggestions = async (type, category) => {
    try {
      const response = await axios.get(`${API_BASE}/accounts/suggestions/codes`, {
        params: { type, category },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setCodeSuggestions(response.data);
    } catch (err) {
      console.error('Error fetching code suggestions:', err);
    }
  };

  // Create new account
  const createAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE}/accounts`, formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      // Show success message with generated code
      alert(`Account created successfully! Generated code: ${response.data.generatedCode}`);
      
      // Reset form and refresh accounts
      setFormData({
        name: '',
        type: '',
        category: '',
        subcategory: '',
        description: '',
        parentAccount: ''
      });
      setShowCreateForm(false);
      setCodeSuggestions([]);
      fetchAccounts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
      if (err.response?.data?.details) {
        alert(`Validation errors: ${err.response.data.details.join(', ')}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle form changes
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Update suggestions when type or category changes
    if (field === 'type') {
      setSuggestedCategories(categoryOptions[value] || []);
      setFormData(prev => ({ ...prev, category: '', subcategory: '' }));
      getAccountTypeInfo(value);
    } else if (field === 'category' && formData.type) {
      getCodeSuggestions(formData.type, value);
    }
  };

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  // Load accounts on component mount
  useEffect(() => {
    fetchAccounts();
  }, [pagination.page, filters]);

  return (
    <div className="chart-of-accounts">
      <div className="header">
        <h1>Chart of Accounts</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          Create New Account
        </button>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search accounts..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="form-control"
          />
        </div>
        <div className="filter-group">
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="form-control"
          >
            <option value="">All Types</option>
            {accountTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="form-control"
          >
            <option value="">All Categories</option>
            {filters.type && categoryOptions[filters.type]?.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>
            <input
              type="checkbox"
              checked={filters.isActive}
              onChange={(e) => handleFilterChange('isActive', e.target.checked)}
            />
            Active Only
          </label>
        </div>
      </div>

      {/* Create Account Modal */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Create New Account</h2>
              <button 
                onClick={() => setShowCreateForm(false)}
                className="btn btn-close"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={createAccount} className="modal-body">
              <div className="form-group">
                <label>Account Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label>Account Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleFormChange('type', e.target.value)}
                  className="form-control"
                  required
                >
                  <option value="">Select Type</option>
                  {accountTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                  className="form-control"
                  required
                  disabled={!formData.type}
                >
                  <option value="">Select Category</option>
                  {suggestedCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Subcategory</label>
                <input
                  type="text"
                  value={formData.subcategory}
                  onChange={(e) => handleFormChange('subcategory', e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  className="form-control"
                  rows="3"
                />
              </div>

              {/* Code Suggestions */}
              {codeSuggestions.length > 0 && (
                <div className="code-suggestions">
                  <label>Suggested Account Codes:</label>
                  <div className="suggestions-list">
                    {codeSuggestions.map((suggestion, index) => (
                      <div key={index} className="suggestion-item">
                        <strong>{suggestion.code}</strong> - {suggestion.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowCreateForm(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {/* Accounts Table */}
      <div className="accounts-table">
        {loading ? (
          <div className="loading">Loading accounts...</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => (
                  <tr key={account._id}>
                    <td>
                      <strong>{account.code}</strong>
                    </td>
                    <td>{account.name}</td>
                    <td>
                      <span className={`badge badge-${account.type.toLowerCase()}`}>
                        {account.type}
                      </span>
                    </td>
                    <td>{account.category}</td>
                    <td>{account.description || '-'}</td>
                    <td>
                      <span className={`badge badge-${account.isActive ? 'success' : 'secondary'}`}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="btn btn-outline-primary"
                >
                  Previous
                </button>
                <span>
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className="btn btn-outline-primary"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .chart-of-accounts {
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .filters {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #eee;
        }

        .modal-body {
          padding: 20px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .form-control {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .code-suggestions {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 15px;
        }

        .suggestions-list {
          margin-top: 10px;
        }

        .suggestion-item {
          padding: 5px 0;
          border-bottom: 1px solid #eee;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-outline-primary {
          background: transparent;
          color: #007bff;
          border: 1px solid #007bff;
        }

        .btn-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        .table th,
        .table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .table th {
          background: #f8f9fa;
          font-weight: 600;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-asset { background: #d4edda; color: #155724; }
        .badge-liability { background: #f8d7da; color: #721c24; }
        .badge-equity { background: #d1ecf1; color: #0c5460; }
        .badge-income { background: #d4edda; color: #155724; }
        .badge-expense { background: #fff3cd; color: #856404; }
        .badge-success { background: #d4edda; color: #155724; }
        .badge-secondary { background: #6c757d; color: white; }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
          margin-top: 20px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .alert {
          padding: 12px 16px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .alert-danger {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
      `}</style>
    </div>
  );
};

export default ChartOfAccounts; 