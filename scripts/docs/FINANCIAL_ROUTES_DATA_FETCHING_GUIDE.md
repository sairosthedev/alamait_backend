# Financial Routes Data Fetching Guide

This guide explains exactly what data each financial route fetches from the database and how it processes that data.

## 📊 **1. Income Statement Route**
**Endpoint:** `GET /api/finance/income-statements/report/generate`

### **What it fetches:**
- **Source:** `TransactionEntry` collection
- **Filter:** All transaction entries within the specified period (e.g., 2024)
- **Query:** `{ date: { $gte: startDate, $lte: endDate } }`

### **Data Processing:**
1. **Revenue Calculation:**
   - Groups by account code and name
   - Sums all credits minus debits for Income accounts
   - Example: `{ "4001 - Rent Income": 25000, "4002 - Other Income": 1500 }`

2. **Expense Calculation:**
   - Groups by account code and name  
   - Sums all debits minus credits for Expense accounts
   - Example: `{ "5001 - Maintenance Expense": 3500, "5002 - Supplies Expense": 1200 }`

3. **Final Output:**
```json
{
  "period": "2024",
  "basis": "cash",
  "revenue": {
    "4001 - Rent Income": 25000,
    "4002 - Other Income": 1500,
    "total_revenue": 26500
  },
  "expenses": {
    "5001 - Maintenance Expense": 3500,
    "5002 - Supplies Expense": 1200,
    "total_expenses": 4700
  },
  "net_income": 21800,
  "gross_profit": 26500,
  "operating_income": 21800
}
```

---

## 📋 **2. Balance Sheet Route**
**Endpoint:** `GET /api/finance/balance-sheets/report/generate`

### **What it fetches:**
- **Source:** `TransactionEntry` collection
- **Filter:** All transaction entries up to the specified date (e.g., 2024-12-31)
- **Query:** `{ date: { $lte: asOfDate } }`

### **Data Processing:**
1. **Asset Calculation:**
   - Groups by account code and name
   - Sums all debits minus credits for Asset accounts
   - Example: `{ "1001 - Bank Account": 15000, "1002 - Cash on Hand": 5000 }`

2. **Liability Calculation:**
   - Groups by account code and name
   - Sums all credits minus debits for Liability accounts
   - Example: `{ "2001 - Accounts Payable": 2500 }`

3. **Equity Calculation:**
   - Groups by account code and name
   - Sums all credits minus debits for Equity accounts
   - Example: `{ "3001 - Owners Capital": 20000, "3002 - Retained Earnings": 4000 }`

4. **Final Output:**
```json
{
  "asOf": "2024-12-31",
  "basis": "cash",
  "assets": {
    "current_assets": {
      "1001 - Bank Account": 15000,
      "1002 - Cash on Hand": 5000,
      "total_current_assets": 20000
    },
    "total_assets": 20000
  },
  "liabilities": {
    "current_liabilities": {
      "2001 - Accounts Payable": 2500,
      "total_current_liabilities": 2500
    },
    "total_liabilities": 2500
  },
  "equity": {
    "3001 - Owners Capital": 20000,
    "3002 - Retained Earnings": 4000,
    "total_equity": 24000
  }
}
```

---

## 💰 **3. Cash Flow Statement Route**
**Endpoint:** `GET /api/finance/cash-flow/report/generate`

### **What it fetches:**
- **Source:** `TransactionEntry` collection
- **Filter:** All transaction entries within the specified period
- **Query:** `{ date: { $gte: startDate, $lte: endDate } }`

### **Data Processing:**
1. **Operating Activities:**
   - Cash received from customers (Income accounts)
   - Cash paid to suppliers (Expense accounts)
   - Cash paid for expenses

2. **Investing Activities:**
   - Purchase of equipment (Asset accounts)
   - Sale of assets

3. **Financing Activities:**
   - Owners contributions (Equity accounts)
   - Loan proceeds/payments (Liability accounts)

4. **Final Output:**
```json
{
  "period": "2024",
  "basis": "cash",
  "operating_activities": {
    "cash_received_from_customers": 25000,
    "cash_paid_to_suppliers": -8300,
    "net_cash_from_operating": 16700
  },
  "investing_activities": {
    "purchase_of_equipment": -2000,
    "net_cash_from_investing": -2000
  },
  "financing_activities": {
    "owners_contribution": 5000,
    "net_cash_from_financing": 5000
  },
  "net_change_in_cash": 19700,
  "cash_at_beginning": 11800,
  "cash_at_end": 31500
}
```

---

## 📈 **4. Trial Balance Route**
**Endpoint:** `GET /api/finance/trial-balance/report/generate`

### **What it fetches:**
- **Source:** `TransactionEntry` collection
- **Filter:** All transaction entries up to the specified date
- **Query:** `{ date: { $lte: asOfDate } }`

### **Data Processing:**
1. **Account Balances:**
   - Groups by account code and name
   - Calculates running balance for each account
   - Separates by account type (Asset, Liability, Equity, Income, Expense)

2. **Final Output:**
```json
{
  "asOf": "2024-12-31",
  "basis": "cash",
  "accounts": {
    "assets": [
      {
        "accountCode": "1001",
        "accountName": "Bank Account",
        "balance": 15000,
        "type": "debit"
      }
    ],
    "liabilities": [
      {
        "accountCode": "2001",
        "accountName": "Accounts Payable",
        "balance": 2500,
        "type": "credit"
      }
    ],
    "equity": [
      {
        "accountCode": "3001",
        "accountName": "Owners Capital",
        "balance": 20000,
        "type": "credit"
      }
    ]
  },
  "totals": {
    "total_debits": 20000,
    "total_credits": 20000,
    "balance": 0
  }
}
```

---

## 🔍 **5. Summary Routes**
**Endpoints:** 
- `GET /api/finance/cash-flow/summary`
- `GET /api/finance/trial-balance/summary`

### **What they fetch:**
- Same data as their respective full reports
- But with simplified/condensed output
- Useful for dashboard widgets or quick overviews

---

## 📊 **6. Existing Expense Routes**
**Endpoint:** `GET /api/finance/expenses`

### **What it fetches:**
- **Source:** `Expense` collection
- **Filter:** All expenses with optional filters (status, vendor, date range)
- **Includes:** Related vendor information, payment status, approval status

### **Data Processing:**
1. **Expense Details:**
   - Basic expense information (amount, description, vendor)
   - Payment status and history
   - Approval workflow status

2. **Final Output:**
```json
{
  "expenses": [
    {
      "_id": "expense_id",
      "title": "Maintenance Repair",
      "amount": 150,
      "vendor": "Gift Plumber",
      "status": "approved",
      "paymentStatus": "paid",
      "date": "2024-12-21"
    }
  ],
  "summary": {
    "total_expenses": 8300,
    "paid_expenses": 5800,
    "pending_expenses": 2500
  }
}
```

---

## 🔧 **Technical Details**

### **Database Collections Used:**
1. **TransactionEntry** - Main source for all financial reports
2. **Expense** - For expense-specific queries
3. **Account** - For account reference information

### **Key Features:**
- **Double-Entry Accounting:** All transactions have balanced debits and credits
- **Cash vs Accrual Basis:** Supports both accounting methods
- **Real-time Calculation:** Reports are generated from live transaction data
- **Audit Trail:** All transactions include creation and approval metadata

### **Authentication Requirements:**
- All routes require valid JWT token
- User must have finance role (admin, finance_admin, finance_user, ceo)
- Role-based access control for different operations

### **Query Parameters:**
- **period:** Year for income statement and cash flow (e.g., "2024")
- **asOf:** Date for balance sheet and trial balance (e.g., "2024-12-31")
- **basis:** Accounting basis ("cash" or "accrual")

This system provides comprehensive financial reporting capabilities while maintaining data integrity and security! 