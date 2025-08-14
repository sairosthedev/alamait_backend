# 🏠 Residence-Filtered Financial Statements Guide

## 🎯 **Overview**

Your financial system now supports **residence-based filtering** for all major financial statements. This means you can generate property-specific financial reports, allowing you to analyze the financial performance of individual residences separately from your overall business.

## ✅ **What's Now Available**

### **1. Income Statement (Profit & Loss)**
- **Overall**: All properties combined
- **Residence-Specific**: Individual property performance
- **Monthly Breakdown**: Property-specific monthly trends

### **2. Balance Sheet**
- **Overall**: Company-wide financial position
- **Residence-Specific**: Individual property financial position

### **3. Cash Flow Statement**
- **Overall**: Company-wide cash movements
- **Residence-Specific**: Individual property cash flows

## 🔌 **API Endpoints with Residence Filtering**

### **Income Statement**
```javascript
// Overall Income Statement (all properties)
GET /api/finance/reports/income-statement?period=2025&basis=cash

// Residence-Specific Income Statement
GET /api/finance/reports/income-statement?period=2025&basis=cash&residence=67c13eb8425a2e078f61d00e
```

### **Monthly Income Statement**
```javascript
// Overall Monthly Breakdown (all properties)
GET /api/finance/reports/monthly-income-statement?period=2025&basis=cash

// Residence-Specific Monthly Breakdown
GET /api/finance/reports/monthly-income-statement?period=2025&basis=cash&residence=67c13eb8425a2e078f61d00e
```

### **Balance Sheet**
```javascript
// Overall Balance Sheet (all properties)
GET /api/finance/reports/balance-sheet?asOf=2025-12-31&basis=cash

// Residence-Specific Balance Sheet
GET /api/finance/reports/balance-sheet?asOf=2025-12-31&basis=cash&residence=67c13eb8425a2e078f61d00e
```

### **Cash Flow Statement**
```javascript
// Overall Cash Flow (all properties)
GET /api/finance/reports/cash-flow?period=2025&basis=cash

// Residence-Specific Cash Flow
GET /api/finance/reports/cash-flow?period=2025&basis=cash&residence=67c13eb8425a2e078f61d00e
```

## 🏠 **Your Current Residences**

Based on your database, here are the available residences for filtering:

| Residence ID | Name | Type |
|--------------|------|------|
| `67c13eb8425a2e078f61d00e` | Belvedere Student House | Student Accommodation |
| `67d723cf20f89c4ae69804f3` | St Kilda Student House | Student Accommodation |
| `6859be80cabd83fabe7761de` | Fife Avenue | Student Accommodation |
| `6848258b1149b66fc94a261d` | 1ACP | Student Accommodation |
| `68927d7ad555faf9f2d06418` | Test Residence | Test Property |
| `68842effd309007c8e124a93` | System | System Property |

## 📊 **Example API Usage**

### **Frontend Implementation**
```javascript
// Function to fetch residence-filtered financial statements
const fetchResidenceFinancials = async (residenceId, period = '2025', basis = 'cash') => {
    try {
        // Fetch Income Statement
        const incomeResponse = await fetch(
            `/api/finance/reports/income-statement?period=${period}&basis=${basis}&residence=${residenceId}`
        );
        const incomeStatement = await incomeResponse.json();
        
        // Fetch Balance Sheet
        const balanceResponse = await fetch(
            `/api/finance/reports/balance-sheet?asOf=${period}-12-31&basis=${basis}&residence=${residenceId}`
        );
        const balanceSheet = await balanceResponse.json();
        
        // Fetch Cash Flow
        const cashFlowResponse = await fetch(
            `/api/finance/reports/cash-flow?period=${period}&basis=${basis}&residence=${residenceId}`
        );
        const cashFlow = await cashFlowResponse.json();
        
        return {
            incomeStatement: incomeStatement.data,
            balanceSheet: balanceSheet.data,
            cashFlow: cashFlow.data
        };
    } catch (error) {
        console.error('Error fetching residence financials:', error);
        throw error;
    }
};

// Usage example
const belvedereFinancials = await fetchResidenceFinancials('67c13eb8425a2e078f61d00e', '2025', 'cash');
```

### **React Component Example**
```jsx
import React, { useState, useEffect } from 'react';

const ResidenceFinancialDashboard = () => {
    const [selectedResidence, setSelectedResidence] = useState('');
    const [financials, setFinancials] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const residences = [
        { id: '67c13eb8425a2e078f61d00e', name: 'Belvedere Student House' },
        { id: '67d723cf20f89c4ae69804f3', name: 'St Kilda Student House' },
        { id: '6859be80cabd83fabe7761de', name: 'Fife Avenue' },
        { id: '6848258b1149b66fc94a261d', name: '1ACP' }
    ];
    
    const fetchFinancials = async (residenceId) => {
        if (!residenceId) return;
        
        setLoading(true);
        try {
            const data = await fetchResidenceFinancials(residenceId, '2025', 'cash');
            setFinancials(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        if (selectedResidence) {
            fetchFinancials(selectedResidence);
        }
    }, [selectedResidence]);
    
    return (
        <div className="residence-financial-dashboard">
            <h2>Residence Financial Dashboard</h2>
            
            {/* Residence Selector */}
            <div className="residence-selector">
                <label>Select Residence:</label>
                <select 
                    value={selectedResidence} 
                    onChange={(e) => setSelectedResidence(e.target.value)}
                >
                    <option value="">Choose a residence...</option>
                    {residences.map(res => (
                        <option key={res.id} value={res.id}>
                            {res.name}
                        </option>
                    ))}
                </select>
            </div>
            
            {/* Financial Reports */}
            {loading && <div>Loading financial data...</div>}
            
            {financials && (
                <div className="financial-reports">
                    {/* Income Statement */}
                    <div className="income-statement">
                        <h3>Income Statement - {financials.incomeStatement.residence?.name}</h3>
                        <div className="revenue">
                            <h4>Revenue</h4>
                            <p>Total Revenue: ${financials.incomeStatement.total_revenue}</p>
                        </div>
                        <div className="expenses">
                            <h4>Expenses</h4>
                            <p>Total Expenses: ${financials.incomeStatement.total_expenses}</p>
                        </div>
                        <div className="net-income">
                            <h4>Net Income</h4>
                            <p>${financials.incomeStatement.net_income}</p>
                        </div>
                    </div>
                    
                    {/* Balance Sheet */}
                    <div className="balance-sheet">
                        <h3>Balance Sheet - {financials.balanceSheet.residence?.name}</h3>
                        <div className="assets">
                            <h4>Assets</h4>
                            <p>Total Assets: ${financials.balanceSheet.total_assets}</p>
                        </div>
                        <div className="liabilities">
                            <h4>Liabilities</h4>
                            <p>Total Liabilities: ${financials.balanceSheet.total_liabilities}</p>
                        </div>
                        <div className="equity">
                            <h4>Equity</h4>
                            <p>Total Equity: ${financials.balanceSheet.total_equity}</p>
                        </div>
                    </div>
                    
                    {/* Cash Flow */}
                    <div className="cash-flow">
                        <h3>Cash Flow - {financials.cashFlow.residence?.name}</h3>
                        <div className="operating">
                            <h4>Operating Activities</h4>
                            <p>Net Operating Cash Flow: ${financials.cashFlow.operating_activities.total}</p>
                        </div>
                        <div className="net-cash-flow">
                            <h4>Net Cash Flow</h4>
                            <p>${financials.cashFlow.net_cash_flow}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResidenceFinancialDashboard;
```

## 📈 **Expected Results by Residence**

### **Belvedere Student House** (`67c13eb8425a2e078f61d00e`)
- **Revenue**: Student rent payments
- **Expenses**: Maintenance, utilities, cleaning
- **Net Income**: Revenue minus expenses
- **Assets**: Cash, bank accounts, receivables
- **Liabilities**: Payables to vendors
- **Equity**: Retained earnings

### **St Kilda Student House** (`67d723cf20f89c4ae69804f3`)
- **Revenue**: Student rent payments
- **Expenses**: Property-specific costs
- **Net Income**: Property-specific performance
- **Assets**: Property-specific assets
- **Liabilities**: Property-specific liabilities
- **Equity**: Property-specific equity

## 🔍 **Data Filtering Logic**

### **How Residence Filtering Works**
1. **Direct Field Filtering**: Uses `TransactionEntry.residence` field directly
2. **Efficient Queries**: No complex joins or population required
3. **Accurate Results**: Based on actual transaction residence data
4. **Real-time Data**: Always reflects current transaction state

### **What Gets Included**
- ✅ **All transactions** where `residence` matches the filter
- ✅ **All transaction entries** linked to those transactions
- ✅ **Complete financial calculations** for the specific residence
- ✅ **Residence metadata** (name, address) in the response

### **What Gets Excluded**
- ❌ **Transactions** from other residences
- ❌ **System-wide transactions** not tied to specific properties
- ❌ **Transactions** without residence information

## 🚀 **Advanced Usage Scenarios**

### **1. Property Performance Comparison**
```javascript
// Compare multiple residences
const compareResidences = async (residenceIds, period = '2025') => {
    const comparisons = await Promise.all(
        residenceIds.map(async (id) => {
            const financials = await fetchResidenceFinancials(id, period, 'cash');
            return {
                residenceId: id,
                netIncome: financials.incomeStatement.net_income,
                totalRevenue: financials.incomeStatement.total_revenue,
                totalExpenses: financials.incomeStatement.total_expenses
            };
        })
    );
    
    return comparisons.sort((a, b) => b.netIncome - a.netIncome);
};

// Usage
const topPerformers = await compareResidences([
    '67c13eb8425a2e078f61d00e',
    '67d723cf20f89c4ae69804f3',
    '6859be80cabd83fabe7761de'
]);
```

### **2. Monthly Trends by Residence**
```javascript
// Get monthly trends for a specific residence
const getMonthlyTrends = async (residenceId, period = '2025') => {
    const response = await fetch(
        `/api/finance/reports/monthly-income-statement?period=${period}&basis=cash&residence=${residenceId}`
    );
    const data = await response.json();
    
    return data.data.monthly_breakdown;
};

// Usage
const belvedereTrends = await getMonthlyTrends('67c13eb8425a2e078f61d00e', '2025');
```

### **3. Financial Health Dashboard**
```javascript
// Comprehensive financial health check
const getFinancialHealth = async (residenceId) => {
    const financials = await fetchResidenceFinancials(residenceId, '2025', 'cash');
    
    const health = {
        profitability: financials.incomeStatement.net_income > 0 ? 'Profitable' : 'Loss-making',
        cashFlow: financials.cashFlow.net_cash_flow > 0 ? 'Positive' : 'Negative',
        solvency: financials.balanceSheet.total_assets > financials.balanceSheet.total_liabilities ? 'Solvent' : 'At Risk',
        revenueGrowth: 'Calculate from historical data',
        expenseControl: 'Analyze expense ratios'
    };
    
    return health;
};
```

## 📊 **Response Format Examples**

### **Residence-Filtered Income Statement Response**
```json
{
  "success": true,
  "data": {
    "period": "2025",
    "residence": {
      "_id": "67c13eb8425a2e078f61d00e",
      "name": "Belvedere Student House",
      "address": "123 Main St"
    },
    "basis": "cash",
    "revenue": {
      "4001 - Rental Income - School Accommodation": 1630,
      "total_revenue": 1630
    },
    "expenses": {
      "5000 - Maintenance Expense": 1060,
      "5002 - Utilities - Electricity": 1134,
      "total_expenses": 2194
    },
    "net_income": -564,
    "gross_profit": 1630,
    "operating_income": -564
  },
  "message": "Income statement generated for 2025 (residence: 67c13eb8425a2e078f61d00e) (cash basis)"
}
```

### **Residence-Filtered Balance Sheet Response**
```json
{
  "success": true,
  "data": {
    "asOf": "2025-12-31",
    "residence": {
      "_id": "67c13eb8425a2e078f61d00e",
      "name": "Belvedere Student House",
      "address": "123 Main St"
    },
    "basis": "cash",
    "assets": {
      "1001 - Bank Account": 480,
      "1002 - Cash on Hand": 770,
      "total_assets": 1250
    },
    "liabilities": {
      "total_liabilities": 0
    },
    "equity": {
      "total_equity": -564
    },
    "total_liabilities_and_equity": -564
  }
}
```

## ⚠️ **Important Notes**

### **Data Requirements**
- **All transactions** must have residence information
- **All transaction entries** must be properly linked
- **Account types** must be correctly set (Income, Expense, Asset, Liability, Equity)

### **Performance Considerations**
- **Large datasets** may take longer to process
- **Multiple residence queries** should be batched when possible
- **Caching** recommended for frequently accessed data

### **Error Handling**
- **Invalid residence IDs** will return 400 errors
- **Missing data** will return empty results, not errors
- **Network issues** should be handled gracefully

## 🎉 **Benefits of Residence Filtering**

### **1. Property-Specific Insights**
- **Individual performance** analysis
- **Property comparison** capabilities
- **Targeted improvements** identification

### **2. Better Decision Making**
- **Investment decisions** by property
- **Resource allocation** optimization
- **Risk assessment** per property

### **3. Compliance & Reporting**
- **Property-specific** financial statements
- **Audit trail** by residence
- **Regulatory compliance** requirements

### **4. Operational Efficiency**
- **Property managers** can see their specific data
- **Maintenance budgets** by property
- **Revenue optimization** per location

## 🚀 **Next Steps**

1. **Test the endpoints** with your current residence IDs
2. **Implement frontend** components for residence selection
3. **Create dashboards** for property-specific financial views
4. **Set up automated** reporting by residence
5. **Train users** on residence-based financial analysis

Your financial system is now ready for **multi-property financial management** with complete residence-based filtering! 🎯
