# 📊 **Financial Reports Fetching Guide**

## ✅ **Correct Fetching Points for Income Statement, Balance Sheet & Cash Flow**

Here are the **exact endpoints** you should use to fetch your financial reports:

---

## 🎯 **1. Income Statement**

### **Endpoint:**
```javascript
GET /api/financial-reports/income-statement?period=2025&basis=cash
```

### **Parameters:**
- `period` (required): Year (e.g., "2025")
- `basis` (optional): "cash" or "accrual" (default: "cash")

### **Frontend Usage:**
```javascript
// Using fetch
const fetchIncomeStatement = async (period = '2025', basis = 'cash') => {
  try {
    const response = await fetch(`/api/financial-reports/income-statement?period=${period}&basis=${basis}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data.data; // The actual income statement
  } catch (error) {
    console.error('Error fetching income statement:', error);
  }
};

// Using the finance service
import { getIncomeStatement } from './financeService';

const incomeStatement = await getIncomeStatement('2025', 'cash');
```

### **What You Should See:**
```javascript
{
  "success": true,
  "data": {
    "period": "2025",
    "basis": "cash",
    "revenue": {
      "4001 - Rental Income - School Accommodation": 1630,
      "total_revenue": 1630
    },
    "expenses": {
      "5000 - Maintenance Expense": 100,
      "5200 - Cleaning Expense": 80,
      "total_expenses": 180
    },
    "net_income": 1450,
    "gross_profit": 1630,
    "operating_income": 1450
  },
  "message": "Income statement generated for 2025 (cash basis)"
}
```

---

## 📋 **2. Balance Sheet**

### **Endpoint:**
```javascript
GET /api/financial-reports/balance-sheet?asOf=2025-12-31&basis=cash
```

### **Parameters:**
- `asOf` (required): Date as of which to generate the balance sheet (e.g., "2025-12-31")
- `basis` (optional): "cash" or "accrual" (default: "cash")

### **Frontend Usage:**
```javascript
// Using fetch
const fetchBalanceSheet = async (asOf = '2025-12-31', basis = 'cash') => {
  try {
    const response = await fetch(`/api/financial-reports/balance-sheet?asOf=${asOf}&basis=${basis}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data.data; // The actual balance sheet
  } catch (error) {
    console.error('Error fetching balance sheet:', error);
  }
};

// Using the finance service
import { getBalanceSheet } from './financeService';

const balanceSheet = await getBalanceSheet('2025-12-31', 'cash');
```

### **What You Should See:**
```javascript
{
  "success": true,
  "data": {
    "asOf": "2025-12-31",
    "basis": "cash",
    "assets": {
      "1012 - Finance Petty Cash": 500,
      "1017 - Ecocash": 834,
      "total_assets": 1334
    },
    "liabilities": {
      "2000 - Accounts Payable": 980,
      "total_liabilities": 980
    },
    "equity": {
      "retained_earnings": 354,
      "total_equity": 354
    }
  },
  "message": "Balance sheet generated as of 2025-12-31 (cash basis)"
}
```

---

## 💰 **3. Cash Flow Statement**

### **Endpoint:**
```javascript
GET /api/financial-reports/cash-flow?period=2025&basis=cash
```

### **Parameters:**
- `period` (required): Year (e.g., "2025")
- `basis` (optional): "cash" or "accrual" (default: "cash")

### **Frontend Usage:**
```javascript
// Using fetch
const fetchCashFlowStatement = async (period = '2025', basis = 'cash') => {
  try {
    const response = await fetch(`/api/financial-reports/cash-flow?period=${period}&basis=${basis}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data.data; // The actual cash flow statement
  } catch (error) {
    console.error('Error fetching cash flow statement:', error);
  }
};

// Using the finance service
import { getCashFlowStatement } from './financeService';

const cashFlowStatement = await getCashFlowStatement('2025', 'cash');
```

### **What You Should See:**
```javascript
{
  "success": true,
  "data": {
    "period": "2025",
    "basis": "cash",
    "operating_activities": {
      "cash_received_from_customers": 1630,
      "cash_paid_to_suppliers": -180,
      "net_cash_from_operating_activities": 1450
    },
    "investing_activities": {
      "net_cash_from_investing_activities": 0
    },
    "financing_activities": {
      "net_cash_from_financing_activities": 0
    },
    "net_change_in_cash": 1450,
    "cash_at_beginning": 0,
    "cash_at_end": 1450
  },
  "message": "Cash flow statement generated for 2025 (cash basis)"
}
```

---

## 📊 **4. Complete React Component Example**

```javascript
// src/components/Finance/FinancialReports.jsx
import React, { useState, useEffect } from 'react';
import { 
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement
} from '../../services/financeService';

const FinancialReports = () => {
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('2025');
  const [basis, setBasis] = useState('cash');

  const fetchAllReports = async () => {
    try {
      setLoading(true);
      
      // Fetch all reports in parallel
      const [incomeData, balanceData, cashFlowData] = await Promise.all([
        getIncomeStatement(period, basis),
        getBalanceSheet(`${period}-12-31`, basis),
        getCashFlowStatement(period, basis)
      ]);

      setReports({
        incomeStatement: incomeData.data,
        balanceSheet: balanceData.data,
        cashFlowStatement: cashFlowData.data
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

  if (loading) return <div>Loading financial reports...</div>;

  return (
    <div className="financial-reports">
      <h2>Financial Reports</h2>
      
      {/* Controls */}
      <div className="controls mb-4">
        <select 
          value={period} 
          onChange={(e) => setPeriod(e.target.value)}
          className="mr-2"
        >
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>
        <select 
          value={basis} 
          onChange={(e) => setBasis(e.target.value)}
        >
          <option value="cash">Cash Basis</option>
          <option value="accrual">Accrual Basis</option>
        </select>
      </div>

      {/* Income Statement */}
      {reports.incomeStatement && (
        <div className="report-section mb-6">
          <h3>Income Statement</h3>
          <div className="bg-white p-4 rounded shadow">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold">Revenue</h4>
                {Object.entries(reports.incomeStatement.revenue).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="font-mono">${value?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-bold">Expenses</h4>
                {Object.entries(reports.incomeStatement.expenses).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="font-mono">${value?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between font-bold">
                <span>Net Income:</span>
                <span className="font-mono">${reports.incomeStatement.net_income?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balance Sheet */}
      {reports.balanceSheet && (
        <div className="report-section mb-6">
          <h3>Balance Sheet</h3>
          <div className="bg-white p-4 rounded shadow">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <h4 className="font-bold">Assets</h4>
                {Object.entries(reports.balanceSheet.assets).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="font-mono">${value?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-bold">Liabilities</h4>
                {Object.entries(reports.balanceSheet.liabilities).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="font-mono">${value?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-bold">Equity</h4>
                {Object.entries(reports.balanceSheet.equity).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="font-mono">${value?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow Statement */}
      {reports.cashFlowStatement && (
        <div className="report-section mb-6">
          <h3>Cash Flow Statement</h3>
          <div className="bg-white p-4 rounded shadow">
            <div className="space-y-4">
              <div>
                <h4 className="font-bold">Operating Activities</h4>
                {Object.entries(reports.cashFlowStatement.operating_activities).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                    <span className="font-mono">${value?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between font-bold">
                  <span>Net Change in Cash:</span>
                  <span className="font-mono">${reports.cashFlowStatement.net_change_in_cash?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialReports;
```

---

## 🔧 **5. Testing Your Endpoints**

### **Quick Test Script:**
```javascript
// test-financial-reports.js
const testFinancialReports = async () => {
  const token = 'your-auth-token';
  const baseURL = 'http://localhost:5000/api';

  try {
    // Test Income Statement
    console.log('📊 Testing Income Statement...');
    const incomeResponse = await fetch(`${baseURL}/financial-reports/income-statement?period=2025&basis=cash`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const incomeData = await incomeResponse.json();
    console.log('✅ Income Statement:', incomeData.data);

    // Test Balance Sheet
    console.log('📋 Testing Balance Sheet...');
    const balanceResponse = await fetch(`${baseURL}/financial-reports/balance-sheet?asOf=2025-12-31&basis=cash`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const balanceData = await balanceResponse.json();
    console.log('✅ Balance Sheet:', balanceData.data);

    // Test Cash Flow Statement
    console.log('💰 Testing Cash Flow Statement...');
    const cashFlowResponse = await fetch(`${baseURL}/financial-reports/cash-flow?period=2025&basis=cash`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const cashFlowData = await cashFlowResponse.json();
    console.log('✅ Cash Flow Statement:', cashFlowData.data);

  } catch (error) {
    console.error('❌ Error testing financial reports:', error);
  }
};

testFinancialReports();
```

---

## 🎯 **6. What You Should See in Your Data**

### **Expected Values (Based on Your Current Data):**

**Income Statement:**
- Revenue: ~$1,630 (Rental Income)
- Expenses: ~$180 (Maintenance + Cleaning)
- Net Income: ~$1,450

**Balance Sheet:**
- Assets: ~$1,334 (Petty Cash + Ecocash)
- Liabilities: ~$980 (Accounts Payable)
- Equity: ~$354 (Retained Earnings)

**Cash Flow Statement:**
- Operating Activities: ~$1,450 (Net cash from operations)
- Net Change in Cash: ~$1,450

---

## ✅ **Summary**

**Use these exact endpoints:**

1. **Income Statement:** `GET /api/financial-reports/income-statement?period=2025&basis=cash`
2. **Balance Sheet:** `GET /api/financial-reports/balance-sheet?asOf=2025-12-31&basis=cash`
3. **Cash Flow:** `GET /api/financial-reports/cash-flow?period=2025&basis=cash`

**All endpoints require:**
- Authentication token in Authorization header
- Finance role access
- Proper query parameters

Your financial reports should now display real data from your transaction entries! 🎉 