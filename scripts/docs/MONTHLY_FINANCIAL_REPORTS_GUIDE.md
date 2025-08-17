# 📊 **Monthly Financial Reports Guide**

## 🎯 **Get January to December Breakdown for All Financial Reports**

You now have access to **monthly breakdowns** for all three major financial reports showing January to December in comprehensive tables!

---

## 🚀 **Available Monthly Endpoints:**

### **1. Monthly Income Statement**
```javascript
GET /api/financial-reports/monthly-income-statement?period=2025&basis=cash
```

### **2. Monthly Balance Sheet**
```javascript
GET /api/financial-reports/monthly-balance-sheet?period=2025&basis=cash
```

### **3. Monthly Cash Flow**
```javascript
GET /api/financial-reports/monthly-cash-flow?period=2025&basis=cash
```

---

## 📋 **Frontend Usage:**

### **Using Finance Service:**
```javascript
import { 
  getMonthlyIncomeStatement, 
  getMonthlyBalanceSheet, 
  getMonthlyCashFlow 
} from './financeService';

// Fetch all monthly reports
const fetchAllMonthlyReports = async (period = '2025', basis = 'cash') => {
  try {
    const [incomeStatement, balanceSheet, cashFlow] = await Promise.all([
      getMonthlyIncomeStatement(period, basis),
      getMonthlyBalanceSheet(period, basis),
      getMonthlyCashFlow(period, basis)
    ]);
    
    return { incomeStatement, balanceSheet, cashFlow };
  } catch (error) {
    console.error('Error fetching monthly reports:', error);
  }
};
```

### **Using Fetch:**
```javascript
const fetchMonthlyReport = async (reportType, period = '2025', basis = 'cash') => {
  try {
    const response = await fetch(`/api/financial-reports/monthly-${reportType}?period=${period}&basis=${basis}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`Error fetching monthly ${reportType}:`, error);
  }
};

// Usage examples:
const monthlyIncome = await fetchMonthlyReport('income-statement', '2025', 'cash');
const monthlyBalance = await fetchMonthlyReport('balance-sheet', '2025', 'cash');
const monthlyCashFlow = await fetchMonthlyReport('cash-flow', '2025', 'cash');
```

---

## 📊 **What You Should See:**

### **1. Monthly Income Statement Response:**
```javascript
{
  "success": true,
  "data": {
    "period": "2025",
    "basis": "cash",
    "monthly_breakdown": {
      "January": {
        "revenue": {
          "4001 - Rental Income - School Accommodation": 150,
          "total_revenue": 150
        },
        "expenses": {
          "5000 - Maintenance Expense": 10,
          "5200 - Cleaning Expense": 8,
          "total_expenses": 18
        },
        "net_income": 132
      },
      "February": {
        "revenue": {
          "4001 - Rental Income - School Accommodation": 150,
          "total_revenue": 150
        },
        "expenses": {
          "5000 - Maintenance Expense": 12,
          "5200 - Cleaning Expense": 8,
          "total_expenses": 20
        },
        "net_income": 130
      },
      // ... March through December
    },
    "yearly_totals": {
      "revenue": {
        "4001 - Rental Income - School Accommodation": 1800,
        "total_revenue": 1800
      },
      "expenses": {
        "5000 - Maintenance Expense": 127,
        "5200 - Cleaning Expense": 96,
        "total_expenses": 223
      },
      "net_income": 1577
    }
  }
}
```

### **2. Monthly Balance Sheet Response:**
```javascript
{
  "success": true,
  "data": {
    "period": "2025",
    "basis": "cash",
    "monthly_breakdown": {
      "January": {
        "assets": {
          "current_assets": {
            "1000 - Cash": 5000,
            "1100 - Accounts Receivable": 1200,
            "total_current_assets": 6200
          },
          "fixed_assets": {
            "1500 - Buildings": 500000,
            "1600 - Equipment": 25000,
            "total_fixed_assets": 525000
          },
          "total_assets": 531200
        },
        "liabilities": {
          "current_liabilities": {
            "2000 - Accounts Payable": 800,
            "2100 - Accrued Expenses": 300,
            "total_current_liabilities": 1100
          },
          "long_term_liabilities": {
            "2500 - Long-term Loans": 200000,
            "total_long_term_liabilities": 200000
          },
          "total_liabilities": 201100
        },
        "equity": {
          "3000 - Retained Earnings": 330100,
          "total_equity": 330100
        }
      },
      "February": {
        // Similar structure for each month
      },
      // ... March through December
    },
    "yearly_totals": {
      "assets": {
        "total_assets": 545000
      },
      "liabilities": {
        "total_liabilities": 198000
      },
      "equity": {
        "total_equity": 347000
      }
    }
  }
}
```

### **3. Monthly Cash Flow Response:**
```javascript
{
  "success": true,
  "data": {
    "period": "2025",
    "basis": "cash",
    "monthly_breakdown": {
      "January": {
        "operating_activities": {
          "cash_received_from_rent": 150,
          "cash_paid_for_expenses": -18,
          "net_operating_cash_flow": 132
        },
        "investing_activities": {
          "purchase_of_equipment": -500,
          "net_investing_cash_flow": -500
        },
        "financing_activities": {
          "loan_repayment": -100,
          "net_financing_cash_flow": -100
        },
        "net_cash_flow": -468,
        "beginning_cash_balance": 5000,
        "ending_cash_balance": 4532
      },
      "February": {
        // Similar structure for each month
      },
      // ... March through December
    },
    "yearly_totals": {
      "operating_activities": {
        "net_operating_cash_flow": 1577
      },
      "investing_activities": {
        "net_investing_cash_flow": -2500
      },
      "financing_activities": {
        "net_financing_cash_flow": -1200
      },
      "net_cash_flow": -2123
    }
  }
}
```

---

## 📊 **React Component for All Monthly Reports:**

```javascript
// src/components/Finance/MonthlyFinancialReports.jsx
import React, { useState, useEffect } from 'react';
import { 
  getMonthlyIncomeStatement, 
  getMonthlyBalanceSheet, 
  getMonthlyCashFlow 
} from '../../services/financeService';

const MonthlyFinancialReports = () => {
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState('income-statement');
  const [period, setPeriod] = useState('2025');
  const [basis, setBasis] = useState('cash');

  const fetchAllReports = async () => {
    try {
      setLoading(true);
      const [incomeStatement, balanceSheet, cashFlow] = await Promise.all([
        getMonthlyIncomeStatement(period, basis),
        getMonthlyBalanceSheet(period, basis),
        getMonthlyCashFlow(period, basis)
      ]);
      
      setReports({
        'income-statement': incomeStatement.data,
        'balance-sheet': balanceSheet.data,
        'cash-flow': cashFlow.data
      });
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllReports();
  }, [period, basis]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const renderIncomeStatementTable = () => {
    const data = reports['income-statement'];
    if (!data) return null;

    const revenueCategories = new Set();
    const expenseCategories = new Set();

    months.forEach(month => {
      if (data.monthly_breakdown[month]) {
        Object.keys(data.monthly_breakdown[month].revenue || {}).forEach(cat => {
          if (cat !== 'total_revenue') revenueCategories.add(cat);
        });
        Object.keys(data.monthly_breakdown[month].expenses || {}).forEach(cat => {
          if (cat !== 'total_expenses') expenseCategories.add(cat);
        });
      }
    });

    return (
      <table className="min-w-full bg-white border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left">Month</th>
            {Array.from(revenueCategories).map(category => (
              <th key={category} className="border px-4 py-2 text-right">
                {category.split(' - ')[1] || category}
              </th>
            ))}
            <th className="border px-4 py-2 text-right font-bold">Total Revenue</th>
            {Array.from(expenseCategories).map(category => (
              <th key={category} className="border px-4 py-2 text-right text-red-600">
                {category.split(' - ')[1] || category}
              </th>
            ))}
            <th className="border px-4 py-2 text-right font-bold text-red-600">Total Expenses</th>
            <th className="border px-4 py-2 text-right font-bold">Net Income</th>
          </tr>
        </thead>
        <tbody>
          {months.map(month => {
            const monthData = data.monthly_breakdown[month];
            if (!monthData) return null;

            return (
              <tr key={month} className="hover:bg-gray-50">
                <td className="border px-4 py-2 font-medium">{month}</td>
                {Array.from(revenueCategories).map(category => (
                  <td key={category} className="border px-4 py-2 text-right">
                    ${(monthData.revenue?.[category] || 0).toLocaleString()}
                  </td>
                ))}
                <td className="border px-4 py-2 text-right font-bold">
                  ${(monthData.revenue?.total_revenue || 0).toLocaleString()}
                </td>
                {Array.from(expenseCategories).map(category => (
                  <td key={category} className="border px-4 py-2 text-right text-red-600">
                    ${(monthData.expenses?.[category] || 0).toLocaleString()}
                  </td>
                ))}
                <td className="border px-4 py-2 text-right font-bold text-red-600">
                  ${(monthData.expenses?.total_expenses || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right font-bold">
                  ${(monthData.net_income || 0).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderBalanceSheetTable = () => {
    const data = reports['balance-sheet'];
    if (!data) return null;

    return (
      <table className="min-w-full bg-white border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left">Month</th>
            <th className="border px-4 py-2 text-right">Total Assets</th>
            <th className="border px-4 py-2 text-right">Total Liabilities</th>
            <th className="border px-4 py-2 text-right">Total Equity</th>
            <th className="border px-4 py-2 text-right">Cash Balance</th>
            <th className="border px-4 py-2 text-right">Accounts Receivable</th>
            <th className="border px-4 py-2 text-right">Accounts Payable</th>
          </tr>
        </thead>
        <tbody>
          {months.map(month => {
            const monthData = data.monthly_breakdown[month];
            if (!monthData) return null;

            return (
              <tr key={month} className="hover:bg-gray-50">
                <td className="border px-4 py-2 font-medium">{month}</td>
                <td className="border px-4 py-2 text-right">
                  ${(monthData.assets?.total_assets || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right">
                  ${(monthData.liabilities?.total_liabilities || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right">
                  ${(monthData.equity?.total_equity || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right">
                  ${(monthData.assets?.current_assets?.['1000 - Cash'] || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right">
                  ${(monthData.assets?.current_assets?.['1100 - Accounts Receivable'] || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right">
                  ${(monthData.liabilities?.current_liabilities?.['2000 - Accounts Payable'] || 0).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderCashFlowTable = () => {
    const data = reports['cash-flow'];
    if (!data) return null;

    return (
      <table className="min-w-full bg-white border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left">Month</th>
            <th className="border px-4 py-2 text-right">Operating Cash Flow</th>
            <th className="border px-4 py-2 text-right">Investing Cash Flow</th>
            <th className="border px-4 py-2 text-right">Financing Cash Flow</th>
            <th className="border px-4 py-2 text-right">Net Cash Flow</th>
            <th className="border px-4 py-2 text-right">Beginning Balance</th>
            <th className="border px-4 py-2 text-right">Ending Balance</th>
          </tr>
        </thead>
        <tbody>
          {months.map(month => {
            const monthData = data.monthly_breakdown[month];
            if (!monthData) return null;

            return (
              <tr key={month} className="hover:bg-gray-50">
                <td className="border px-4 py-2 font-medium">{month}</td>
                <td className="border px-4 py-2 text-right">
                  ${(monthData.operating_activities?.net_operating_cash_flow || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right">
                  ${(monthData.investing_activities?.net_investing_cash_flow || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right">
                  ${(monthData.financing_activities?.net_financing_cash_flow || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right font-bold">
                  ${(monthData.net_cash_flow || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right">
                  ${(monthData.beginning_cash_balance || 0).toLocaleString()}
                </td>
                <td className="border px-4 py-2 text-right font-bold">
                  ${(monthData.ending_cash_balance || 0).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  if (loading) return <div>Loading monthly financial reports...</div>;

  return (
    <div className="monthly-financial-reports">
      <h2>Monthly Financial Reports - {period}</h2>
      
      {/* Controls */}
      <div className="controls mb-4">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="mr-2">
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>
        <select value={basis} onChange={(e) => setBasis(e.target.value)} className="mr-4">
          <option value="cash">Cash Basis</option>
          <option value="accrual">Accrual Basis</option>
        </select>
        
        {/* Report Type Selector */}
        <div className="inline-flex rounded-md shadow-sm">
          <button
            onClick={() => setActiveReport('income-statement')}
            className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
              activeReport === 'income-statement'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Income Statement
          </button>
          <button
            onClick={() => setActiveReport('balance-sheet')}
            className={`px-4 py-2 text-sm font-medium ${
              activeReport === 'balance-sheet'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border-t border-b border-gray-300 hover:bg-gray-50'
            }`}
          >
            Balance Sheet
          </button>
          <button
            onClick={() => setActiveReport('cash-flow')}
            className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
              activeReport === 'cash-flow'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Cash Flow
          </button>
        </div>
      </div>

      {/* Report Tables */}
      <div className="overflow-x-auto">
        {activeReport === 'income-statement' && renderIncomeStatementTable()}
        {activeReport === 'balance-sheet' && renderBalanceSheetTable()}
        {activeReport === 'cash-flow' && renderCashFlowTable()}
      </div>
    </div>
  );
};

export default MonthlyFinancialReports;
```

---

## 🧪 **Test All Monthly Endpoints:**

```javascript
// Test all monthly reports
const testAllMonthlyReports = async () => {
  const token = 'your-auth-token';
  const period = '2025';
  const basis = 'cash';
  
  const endpoints = [
    'monthly-income-statement',
    'monthly-balance-sheet', 
    'monthly-cash-flow'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`/api/financial-reports/${endpoint}?period=${period}&basis=${basis}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      console.log(`${endpoint}:`, data.data);
    } catch (error) {
      console.error(`Error testing ${endpoint}:`, error);
    }
  }
};

testAllMonthlyReports();
```

---

## ✅ **What You'll Get:**

### **Monthly Income Statement:**
- Revenue and expenses broken down by month
- Individual category tracking (rental income, maintenance, cleaning, etc.)
- Monthly and yearly net income calculations

### **Monthly Balance Sheet:**
- Assets, liabilities, and equity by month
- Cash balance tracking throughout the year
- Accounts receivable and payable monthly changes

### **Monthly Cash Flow:**
- Operating, investing, and financing activities by month
- Net cash flow and cash balance changes
- Beginning and ending cash balances for each month

This gives you a complete **monthly view** of your financial performance across all three major financial statements! 🎉 