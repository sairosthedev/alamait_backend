# 📊 **Monthly Income Statement Guide**

## 🎯 **Get January to December Breakdown in One Table**

You can now fetch a monthly income statement that shows all 12 months in one comprehensive table!

---

## 🚀 **Endpoint to Use:**

```javascript
GET /api/financial-reports/monthly-income-statement?period=2025&basis=cash
```

---

## 📋 **Frontend Usage:**

### **Using Fetch:**
```javascript
const fetchMonthlyIncomeStatement = async (period = '2025', basis = 'cash') => {
  try {
    const response = await fetch(`/api/financial-reports/monthly-income-statement?period=${period}&basis=${basis}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data.data; // The monthly breakdown
  } catch (error) {
    console.error('Error fetching monthly income statement:', error);
  }
};
```

### **Using Finance Service:**
```javascript
import { getMonthlyIncomeStatement } from './financeService';

const monthlyData = await getMonthlyIncomeStatement('2025', 'cash');
```

---

## 📊 **What You Should See:**

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
      "March": {
        "revenue": {
          "4001 - Rental Income - School Accommodation": 150,
          "total_revenue": 150
        },
        "expenses": {
          "5000 - Maintenance Expense": 15,
          "5200 - Cleaning Expense": 8,
          "total_expenses": 23
        },
        "net_income": 127
      },
      "April": {
        "revenue": {
          "4001 - Rental Income - School Accommodation": 150,
          "total_revenue": 150
        },
        "expenses": {
          "5000 - Maintenance Expense": 8,
          "5200 - Cleaning Expense": 8,
          "total_expenses": 16
        },
        "net_income": 134
      },
      "May": {
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
      "June": {
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
      "July": {
        "revenue": {
          "4001 - Rental Income - School Accommodation": 150,
          "total_revenue": 150
        },
        "expenses": {
          "5000 - Maintenance Expense": 8,
          "5200 - Cleaning Expense": 8,
          "total_expenses": 16
        },
        "net_income": 134
      },
      "August": {
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
      "September": {
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
      "October": {
        "revenue": {
          "4001 - Rental Income - School Accommodation": 150,
          "total_revenue": 150
        },
        "expenses": {
          "5000 - Maintenance Expense": 8,
          "5200 - Cleaning Expense": 8,
          "total_expenses": 16
        },
        "net_income": 134
      },
      "November": {
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
      "December": {
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
      }
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
  },
  "message": "Monthly income statement generated for 2025 (cash basis)"
}
```

---

## 📊 **React Component for Monthly Table:**

```javascript
// src/components/Finance/MonthlyIncomeStatement.jsx
import React, { useState, useEffect } from 'react';
import { getMonthlyIncomeStatement } from '../../services/financeService';

const MonthlyIncomeStatement = () => {
  const [monthlyData, setMonthlyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('2025');
  const [basis, setBasis] = useState('cash');

  const fetchMonthlyData = async () => {
    try {
      setLoading(true);
      const data = await getMonthlyIncomeStatement(period, basis);
      setMonthlyData(data.data);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyData();
  }, [period, basis]);

  if (loading) return <div>Loading monthly income statement...</div>;
  if (!monthlyData) return <div>No data available</div>;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get all unique revenue and expense categories
  const revenueCategories = new Set();
  const expenseCategories = new Set();

  months.forEach(month => {
    if (monthlyData.monthly_breakdown[month]) {
      Object.keys(monthlyData.monthly_breakdown[month].revenue || {}).forEach(cat => {
        if (cat !== 'total_revenue') revenueCategories.add(cat);
      });
      Object.keys(monthlyData.monthly_breakdown[month].expenses || {}).forEach(cat => {
        if (cat !== 'total_expenses') expenseCategories.add(cat);
      });
    }
  });

  return (
    <div className="monthly-income-statement">
      <h2>Monthly Income Statement - {period}</h2>
      
      {/* Controls */}
      <div className="controls mb-4">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="mr-2">
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>
        <select value={basis} onChange={(e) => setBasis(e.target.value)}>
          <option value="cash">Cash Basis</option>
          <option value="accrual">Accrual Basis</option>
        </select>
      </div>

      {/* Monthly Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2 text-left">Month</th>
              
              {/* Revenue Headers */}
              {Array.from(revenueCategories).map(category => (
                <th key={category} className="border px-4 py-2 text-right">
                  {category.split(' - ')[1] || category}
                </th>
              ))}
              <th className="border px-4 py-2 text-right font-bold">Total Revenue</th>
              
              {/* Expense Headers */}
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
              const monthData = monthlyData.monthly_breakdown[month];
              if (!monthData) return null;

              return (
                <tr key={month} className="hover:bg-gray-50">
                  <td className="border px-4 py-2 font-medium">{month}</td>
                  
                  {/* Revenue Data */}
                  {Array.from(revenueCategories).map(category => (
                    <td key={category} className="border px-4 py-2 text-right">
                      ${(monthData.revenue?.[category] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="border px-4 py-2 text-right font-bold">
                    ${(monthData.revenue?.total_revenue || 0).toLocaleString()}
                  </td>
                  
                  {/* Expense Data */}
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
            
            {/* Yearly Totals Row */}
            <tr className="bg-gray-200 font-bold">
              <td className="border px-4 py-2">YEARLY TOTALS</td>
              
              {/* Revenue Totals */}
              {Array.from(revenueCategories).map(category => (
                <td key={category} className="border px-4 py-2 text-right">
                  ${(monthlyData.yearly_totals.revenue?.[category] || 0).toLocaleString()}
                </td>
              ))}
              <td className="border px-4 py-2 text-right">
                ${(monthlyData.yearly_totals.revenue?.total_revenue || 0).toLocaleString()}
              </td>
              
              {/* Expense Totals */}
              {Array.from(expenseCategories).map(category => (
                <td key={category} className="border px-4 py-2 text-right text-red-600">
                  ${(monthlyData.yearly_totals.expenses?.[category] || 0).toLocaleString()}
                </td>
              ))}
              <td className="border px-4 py-2 text-right text-red-600">
                ${(monthlyData.yearly_totals.expenses?.total_expenses || 0).toLocaleString()}
              </td>
              
              <td className="border px-4 py-2 text-right">
                ${(monthlyData.yearly_totals.net_income || 0).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonthlyIncomeStatement;
```

---

## 🧪 **Test the Endpoint:**

```javascript
// Test monthly income statement
fetch('/api/financial-reports/monthly-income-statement?period=2025&basis=cash', {
  headers: { 'Authorization': `Bearer ${yourToken}` }
})
.then(response => response.json())
.then(data => {
  console.log('Monthly Income Statement:', data.data);
  console.log('January Revenue:', data.data.monthly_breakdown.January?.revenue);
  console.log('December Net Income:', data.data.monthly_breakdown.December?.net_income);
});
```

---

## ✅ **What You'll Get:**

1. **Monthly Breakdown:** January to December with individual revenue and expense categories
2. **Yearly Totals:** Summary row with annual totals
3. **Detailed Categories:** Each revenue and expense category broken down by month
4. **Net Income:** Monthly and yearly net income calculations

This gives you a complete view of your financial performance throughout the year in one comprehensive table! 🎉 