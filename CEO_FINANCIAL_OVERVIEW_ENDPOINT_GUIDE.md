# 🚀 CEO Financial Overview Endpoint Guide

## 📊 **New Endpoint: Combined Income & Expenses**

I've created a powerful new endpoint that fetches both income and expenses for the CEO in a single request, perfect for dashboard views and financial overviews.

---

## **🎯 Endpoint Details**

### **URL:**
```
GET /api/ceo/financial/overview
```

### **Authentication:**
- Requires CEO role
- JWT token in Authorization header

### **Query Parameters:**
- `period` - Year (e.g., "2024", default: current year)
- `basis` - Accounting basis ("cash" or "accrual", default: "cash")
- `startDate` - Start date for custom range (e.g., "2024-01-01")
- `endDate` - End date for custom range (e.g., "2024-12-31")
- `residence` - Filter by specific residence ID
- `page` - Page number for expenses (default: 1)
- `limit` - Items per page for expenses (default: 20)

---

## **📋 Example Requests**

### **1. Basic Overview (Current Year)**
```javascript
GET /api/ceo/financial/overview
```

### **2. Specific Year**
```javascript
GET /api/ceo/financial/overview?period=2024
```

### **3. Custom Date Range**
```javascript
GET /api/ceo/financial/overview?startDate=2024-01-01&endDate=2024-12-31
```

### **4. With Pagination**
```javascript
GET /api/ceo/financial/overview?page=1&limit=10
```

### **5. Specific Residence**
```javascript
GET /api/ceo/financial/overview?residence=residence_id&period=2024
```

### **6. Combined Filters**
```javascript
GET /api/ceo/financial/overview?period=2024&page=1&limit=15&residence=residence_id
```

---

## **📊 Response Structure**

```javascript
{
  "success": true,
  "message": "Financial overview for 2024",
  "data": {
    "period": "2024",
    "basis": "cash",
    "dateRange": null, // or { startDate, endDate }
    "residence": "all", // or specific residence ID
    
    // Income Data
    "income": {
      "summary": {
        "totalIncome": 25000,
        "incomeByType": {
          "4001 - Rental Income": 22000,
          "4002 - Other Income": 3000
        },
        "totalTransactions": 45,
        "recentTransactions": [...] // Last 10 income transactions
      },
      "transactions": [...] // Recent income transactions
    },
    
    // Expense Data
    "expenses": {
      "summary": {
        "totalExpenses": 15000,
        "paidExpenses": 12000,
        "pendingExpenses": 3000,
        "expensesByCategory": {
          "Maintenance": 8000,
          "Supplies": 4000,
          "Utilities": 3000
        },
        "expensesByStatus": {
          "approved": 12000,
          "pending": 3000
        },
        "totalCount": 25
      },
      "items": [...], // Paginated expense items
      "pagination": {
        "currentPage": 1,
        "totalPages": 2,
        "total": 25,
        "limit": 20
      }
    },
    
    // Financial Summary
    "financialSummary": {
      "totalIncome": 25000,
      "totalExpenses": 15000,
      "netIncome": 10000,
      "profitMargin": "40.00", // Percentage
      "expenseRatio": "60.00"  // Percentage
    },
    
    // Quick Stats
    "quickStats": {
      "totalTransactions": 70, // Income + Expenses
      "averageIncome": "555.56",
      "averageExpense": "600.00",
      "topIncomeSource": "4001 - Rental Income",
      "topExpenseCategory": "Maintenance"
    }
  }
}
```

---

## **🎯 Frontend Implementation**

### **1. React Hook for Financial Overview**
```javascript
// hooks/useFinancialOverview.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export const useFinancialOverview = (filters = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async (newFilters = {}) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      Object.keys({ ...filters, ...newFilters }).forEach(key => {
        const value = newFilters[key] || filters[key];
        if (value && value !== 'all') {
          params.append(key, value);
        }
      });

      const response = await api.get(`/ceo/financial/overview?${params.toString()}`);
      
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch financial overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
};
```

### **2. CEO Financial Dashboard Component**
```javascript
// components/CEOFinancialDashboard.jsx
import React, { useState } from 'react';
import { useFinancialOverview } from '../hooks/useFinancialOverview';

const CEOFinancialDashboard = () => {
  const [filters, setFilters] = useState({
    period: new Date().getFullYear().toString(),
    page: 1,
    limit: 20
  });

  const { data, loading, error, refetch } = useFinancialOverview(filters);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
    refetch(newFilters);
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
    refetch({ page });
  };

  if (loading) return <div className="loading">Loading financial overview...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="ceo-financial-dashboard">
      <h2>CEO Financial Overview</h2>
      
      {/* Filters */}
      <div className="filters">
        <select
          value={filters.period}
          onChange={(e) => handleFilterChange({ period: e.target.value })}
        >
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>
        
        <select
          value={filters.limit}
          onChange={(e) => handleFilterChange({ limit: e.target.value })}
        >
          <option value="10">10 per page</option>
          <option value="20">20 per page</option>
          <option value="50">50 per page</option>
        </select>
      </div>

      {/* Financial Summary Cards */}
      <div className="financial-summary-cards">
        <div className="card income-card">
          <h3>Total Income</h3>
          <div className="amount">${data.financialSummary.totalIncome.toLocaleString()}</div>
          <div className="subtitle">{data.income.summary.totalTransactions} transactions</div>
        </div>
        
        <div className="card expense-card">
          <h3>Total Expenses</h3>
          <div className="amount">${data.financialSummary.totalExpenses.toLocaleString()}</div>
          <div className="subtitle">{data.expenses.summary.totalCount} expenses</div>
        </div>
        
        <div className="card net-income-card">
          <h3>Net Income</h3>
          <div className={`amount ${data.financialSummary.netIncome >= 0 ? 'positive' : 'negative'}`}>
            ${data.financialSummary.netIncome.toLocaleString()}
          </div>
          <div className="subtitle">{data.financialSummary.profitMargin}% profit margin</div>
        </div>
      </div>

      {/* Income Breakdown */}
      <div className="income-breakdown">
        <h3>Income by Type</h3>
        <div className="breakdown-list">
          {Object.entries(data.income.summary.incomeByType).map(([type, amount]) => (
            <div key={type} className="breakdown-item">
              <span className="label">{type}</span>
              <span className="amount">${amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="expense-breakdown">
        <h3>Expenses by Category</h3>
        <div className="breakdown-list">
          {Object.entries(data.expenses.summary.expensesByCategory).map(([category, amount]) => (
            <div key={category} className="breakdown-item">
              <span className="label">{category}</span>
              <span className="amount">${amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="recent-expenses">
        <h3>Recent Expenses</h3>
        <div className="expenses-list">
          {data.expenses.items.map(expense => (
            <div key={expense._id} className="expense-item">
              <div className="expense-header">
                <span className="expense-id">{expense.expenseId}</span>
                <span className="amount">${expense.amount}</span>
              </div>
              <div className="expense-title">{expense.title}</div>
              <div className="expense-details">
                <span className="category">{expense.category}</span>
                <span className="vendor">{expense.vendor?.businessName}</span>
                <span className="residence">{expense.residence?.name}</span>
              </div>
              <div className="expense-status">
                <span className={`status ${expense.status}`}>{expense.status}</span>
                <span className={`payment-status ${expense.paymentStatus}`}>
                  {expense.paymentStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      {data.expenses.pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => handlePageChange(filters.page - 1)}
            disabled={filters.page === 1}
          >
            Previous
          </button>
          <span>Page {filters.page} of {data.expenses.pagination.totalPages}</span>
          <button
            onClick={() => handlePageChange(filters.page + 1)}
            disabled={filters.page === data.expenses.pagination.totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="quick-stats">
        <h3>Quick Statistics</h3>
        <div className="stats-grid">
          <div className="stat">
            <label>Total Transactions:</label>
            <span>{data.quickStats.totalTransactions}</span>
          </div>
          <div className="stat">
            <label>Average Income:</label>
            <span>${data.quickStats.averageIncome}</span>
          </div>
          <div className="stat">
            <label>Average Expense:</label>
            <span>${data.quickStats.averageExpense}</span>
          </div>
          <div className="stat">
            <label>Top Income Source:</label>
            <span>{data.quickStats.topIncomeSource}</span>
          </div>
          <div className="stat">
            <label>Top Expense Category:</label>
            <span>{data.quickStats.topExpenseCategory}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CEOFinancialDashboard;
```

### **3. CSS Styling**
```css
/* CEOFinancialDashboard.css */
.ceo-financial-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.filters {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.financial-summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.card h3 {
  margin: 0 0 10px 0;
  color: #666;
  font-size: 14px;
  text-transform: uppercase;
}

.card .amount {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 5px;
}

.card .subtitle {
  font-size: 12px;
  color: #999;
}

.income-card .amount { color: #28a745; }
.expense-card .amount { color: #dc3545; }
.net-income-card .amount.positive { color: #28a745; }
.net-income-card .amount.negative { color: #dc3545; }

.breakdown-list {
  background: white;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.breakdown-item:last-child {
  border-bottom: none;
}

.expenses-list {
  background: white;
  border-radius: 8px;
  padding: 15px;
}

.expense-item {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 10px;
}

.expense-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.expense-id {
  font-weight: bold;
  color: #666;
}

.expense-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 8px;
}

.expense-details {
  display: flex;
  gap: 15px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.expense-status {
  display: flex;
  gap: 10px;
}

.status, .payment-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status.approved { background: #d4edda; color: #155724; }
.status.pending { background: #fff3cd; color: #856404; }
.payment-status.paid { background: #d1ecf1; color: #0c5460; }
.payment-status.pending { background: #f8d7da; color: #721c24; }

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin: 20px 0;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.stat label {
  font-weight: bold;
  color: #666;
}
```

---

## **🎯 Key Features**

### **✅ Single Request Efficiency**
- Fetches both income and expenses in one API call
- Reduces frontend complexity and network requests
- Perfect for dashboard views

### **✅ Comprehensive Data**
- Complete income breakdown by type
- Detailed expense analysis by category and status
- Financial ratios and profit margins
- Quick statistics for insights

### **✅ Flexible Filtering**
- Period-based filtering (year)
- Custom date ranges
- Residence-specific filtering
- Pagination for large datasets

### **✅ Real-time Calculations**
- Net income calculation
- Profit margin percentage
- Expense ratio analysis
- Average calculations

### **✅ Rich Data Structure**
- Populated vendor information
- Residence details
- User information for audit trail
- Transaction history

---

## **🚀 Usage Examples**

### **1. Dashboard Overview**
```javascript
// Get current year overview
const overview = await api.get('/ceo/financial/overview');
```

### **2. Year Comparison**
```javascript
// Compare 2024 vs 2025
const [data2024, data2025] = await Promise.all([
  api.get('/ceo/financial/overview?period=2024'),
  api.get('/ceo/financial/overview?period=2025')
]);
```

### **3. Monthly Analysis**
```javascript
// Last 30 days
const lastMonth = await api.get('/ceo/financial/overview?startDate=2024-11-01&endDate=2024-11-30');
```

### **4. Residence-specific**
```javascript
// Specific residence performance
const residenceData = await api.get('/ceo/financial/overview?residence=residence_id&period=2024');
```

---

## **🎉 Benefits**

1. **🚀 Performance**: Single API call instead of multiple requests
2. **📊 Comprehensive**: Complete financial picture in one response
3. **🎯 Dashboard Ready**: Perfect for CEO dashboard implementation
4. **🔍 Flexible**: Multiple filtering options for different views
5. **📈 Insights**: Built-in calculations and ratios
6. **📱 Responsive**: Pagination for large datasets

**The CEO now has a powerful, efficient endpoint for comprehensive financial oversight!** 🚀

