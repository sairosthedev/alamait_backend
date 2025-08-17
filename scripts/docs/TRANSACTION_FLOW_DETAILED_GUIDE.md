# Detailed Transaction Flow Guide: Complete Double-Entry System

This guide shows exactly how each transaction type flows through the system, from request to payment, including both accrual and cash basis accounting.

## 🏗️ **1. Maintenance Request Flow**

### **Scenario: Admin sends maintenance request to Gift Plumber**

#### **Step 1: Admin Creates Maintenance Request**
```javascript
// Admin creates maintenance request
const maintenanceRequest = {
  title: "Fix toilet in Room 101",
  description: "Toilet is not flushing properly",
  vendor: "Gift Plumber", // Supplier
  estimatedCost: 150,
  priority: "High",
  residence: "Newlands",
  createdBy: "admin_user_id"
};
```

#### **Step 2: Finance Approves Request (Accrual Basis)**
```javascript
// Finance approves the request
POST /api/finance/approve-maintenance/:requestId
{
  "approvedAmount": 150,
  "paymentMethod": "Bank Transfer", // Will be paid later
  "notes": "Approved for immediate repair"
}
```

**System automatically creates transaction:**
```javascript
// Transaction Entry Created
{
  transactionId: "TXN1703123456789ABC",
  date: "2024-12-21",
  description: "Maintenance approval: Fix toilet in Room 101",
  reference: "MAINT-2024-001",
  entries: [
    {
      accountCode: "5001", // Maintenance Expense
      accountName: "Maintenance Expense",
      accountType: "Expense",
      debit: 150,
      credit: 0,
      description: "Toilet repair - Gift Plumber"
    },
    {
      accountCode: "2001", // Accounts Payable: Gift Plumber
      accountName: "Accounts Payable: Gift Plumber",
      accountType: "Liability",
      debit: 0,
      credit: 150,
      description: "Payable to Gift Plumber"
    }
  ],
  totalDebit: 150,
  totalCredit: 150,
  source: "maintenance_approval",
  sourceId: "maintenance_request_id",
  accountingBasis: "accrual"
}
```

#### **Step 3: Finance Pays Vendor (Cash Basis)**
```javascript
// Finance pays the vendor
POST /api/finance/pay-vendor/:expenseId
{
  "paymentMethod": "Bank Transfer",
  "paymentDate": "2024-12-22",
  "reference": "BANK-REF-12345"
}
```

**System automatically creates transaction:**
```javascript
// Transaction Entry Created
{
  transactionId: "TXN1703123456789DEF",
  date: "2024-12-22",
  description: "Payment to Gift Plumber for toilet repair",
  reference: "PAY-2024-001",
  entries: [
    {
      accountCode: "2001", // Accounts Payable: Gift Plumber
      accountName: "Accounts Payable: Gift Plumber",
      accountType: "Liability",
      debit: 150,
      credit: 0,
      description: "Payment to Gift Plumber"
    },
    {
      accountCode: "1001", // Bank Account
      accountName: "Bank Account",
      accountType: "Asset",
      debit: 0,
      credit: 150,
      description: "Bank transfer to Gift Plumber"
    }
  ],
  totalDebit: 150,
  totalCredit: 150,
  source: "vendor_payment",
  sourceId: "expense_id",
  accountingBasis: "cash"
}
```

## 📦 **2. Supplies Request Flow**

### **Scenario: Admin requests supplies (with or without vendor)**

#### **Case A: With Vendor (e.g., Office Supplies Co.)**
```javascript
// Admin creates supplies request
const suppliesRequest = {
  title: "Office supplies for December",
  description: "Paper, pens, printer cartridges",
  vendor: "Office Supplies Co.",
  estimatedCost: 200,
  items: ["A4 Paper", "Blue Pens", "Printer Cartridges"]
};
```

**Finance Approval (Accrual):**
```javascript
// Same flow as maintenance - creates payable
{
  entries: [
    { accountCode: "5002", debit: 200, credit: 0 }, // Supplies Expense
    { accountCode: "2002", debit: 0, credit: 200 }  // Accounts Payable: Office Supplies Co.
  ]
}
```

#### **Case B: Without Vendor (e.g., Firewood from roadside)**
```javascript
// Admin creates supplies request
const suppliesRequest = {
  title: "Firewood for winter",
  description: "Firewood from roadside vendor",
  vendor: null, // No specific vendor
  estimatedCost: 50,
  items: ["Firewood bundles"]
};
```

**Finance Approval (Cash Basis - paid immediately):**
```javascript
// Direct payment transaction
{
  entries: [
    { accountCode: "5002", debit: 50, credit: 0 },  // Supplies Expense
    { accountCode: "1002", debit: 0, credit: 50 }   // Cash on Hand
  ]
}
```

## 💰 **3. Student Rent Payment Flow**

### **Scenario: Student pays rent**

#### **Step 1: Admin Records Payment**
```javascript
// Admin records student payment
POST /api/finance/record-payment
{
  "studentId": "student_123",
  "amount": 500,
  "method": "Ecocash",
  "description": "Rent payment for December 2024",
  "paymentMonth": "December 2024"
}
```

**System automatically creates transaction:**
```javascript
// Transaction Entry Created
{
  transactionId: "TXN1703123456789GHI",
  date: "2024-12-21",
  description: "Rent payment from John Doe",
  reference: "PAY-2024-002",
  entries: [
    {
      accountCode: "1003", // Ecocash Wallet
      accountName: "Ecocash Wallet",
      accountType: "Asset",
      debit: 500,
      credit: 0,
      description: "Payment via Ecocash"
    },
    {
      accountCode: "4001", // Rent Income
      accountName: "Rent Income",
      accountType: "Income",
      debit: 0,
      credit: 500,
      description: "Rent income for December 2024"
    }
  ],
  totalDebit: 500,
  totalCredit: 500,
  source: "student_payment",
  sourceId: "payment_id",
  accountingBasis: "cash"
}
```

## 📄 **4. Student Invoice Flow**

### **Scenario: Finance sends invoice to student**

#### **Step 1: Finance Creates Invoice**
```javascript
// Finance creates invoice for student
POST /api/finance/create-invoice
{
  "studentId": "student_123",
  "amount": 500,
  "dueDate": "2024-12-31",
  "description": "Rent for January 2025",
  "billingPeriod": "January 2025"
}
```

**System automatically creates transaction (Accrual):**
```javascript
// Transaction Entry Created
{
  transactionId: "TXN1703123456789JKL",
  date: "2024-12-21",
  description: "Invoice issued to John Doe for January rent",
  reference: "INV-2025-001",
  entries: [
    {
      accountCode: "1101", // Accounts Receivable
      accountName: "Accounts Receivable",
      accountType: "Asset",
      debit: 500,
      credit: 0,
      description: "Receivable from John Doe"
    },
    {
      accountCode: "4001", // Rent Income
      accountName: "Rent Income",
      accountType: "Income",
      debit: 0,
      credit: 500,
      description: "Rent income for January 2025"
    }
  ],
  totalDebit: 500,
  totalCredit: 500,
  source: "invoice_issuance",
  sourceId: "invoice_id",
  accountingBasis: "accrual"
}
```

#### **Step 2: Student Pays Invoice**
```javascript
// Student pays the invoice
POST /api/finance/pay-invoice/:invoiceId
{
  "paymentMethod": "Bank Transfer",
  "paymentDate": "2025-01-05",
  "reference": "BANK-REF-67890"
}
```

**System automatically creates transaction (Cash):**
```javascript
// Transaction Entry Created
{
  transactionId: "TXN1703123456789MNO",
  date: "2025-01-05",
  description: "Payment received for invoice INV-2025-001",
  reference: "PAY-2025-001",
  entries: [
    {
      accountCode: "1001", // Bank Account
      accountName: "Bank Account",
      accountType: "Asset",
      debit: 500,
      credit: 0,
      description: "Bank transfer from John Doe"
    },
    {
      accountCode: "1101", // Accounts Receivable
      accountName: "Accounts Receivable",
      accountType: "Asset",
      debit: 0,
      credit: 500,
      description: "Payment for invoice INV-2025-001"
    }
  ],
  totalDebit: 500,
  totalCredit: 500,
  source: "invoice_payment",
  sourceId: "payment_id",
  accountingBasis: "cash"
}
```

## 💵 **5. Petty Cash Management Flow**

### **Scenario: Finance gives petty cash to admin**

#### **Step 1: Finance Allocates Petty Cash**
```javascript
// Finance allocates petty cash to admin
POST /api/finance/allocate-petty-cash
{
  "userId": "admin_user_id",
  "amount": 200,
  "description": "Initial petty cash allocation for office expenses"
}
```

**System automatically creates transaction:**
```javascript
// Transaction Entry Created
{
  transactionId: "TXN1703123456789PQR",
  date: "2024-12-21",
  description: "Petty cash allocation to Admin User",
  reference: "PC-2024-001",
  entries: [
    {
      accountCode: "1008", // Petty Cash
      accountName: "Petty Cash",
      accountType: "Asset",
      debit: 200,
      credit: 0,
      description: "Petty cash allocation to Admin User"
    },
    {
      accountCode: "1002", // Cash on Hand
      accountName: "Cash on Hand",
      accountType: "Asset",
      debit: 0,
      credit: 200,
      description: "Cash withdrawal for petty cash"
    }
  ],
  totalDebit: 200,
  totalCredit: 200,
  source: "petty_cash_allocation",
  sourceId: "allocation_id",
  accountingBasis: "cash"
}
```

#### **Step 2: Admin Records Petty Cash Expense**
```javascript
// Admin records petty cash expense
POST /api/finance/record-petty-cash-expense
{
  "userId": "admin_user_id",
  "amount": 25,
  "description": "Office supplies purchase",
  "expenseCategory": "Office"
}
```

**System automatically creates transaction:**
```javascript
// Transaction Entry Created
{
  transactionId: "TXN1703123456789STU",
  date: "2024-12-22",
  description: "Petty cash expense: Office supplies",
  reference: "PC-EXP-2024-001",
  entries: [
    {
      accountCode: "5006", // Office Expense
      accountName: "Office Expense",
      accountType: "Expense",
      debit: 25,
      credit: 0,
      description: "Office supplies purchase"
    },
    {
      accountCode: "1008", // Petty Cash
      accountName: "Petty Cash",
      accountType: "Asset",
      debit: 0,
      credit: 25,
      description: "Petty cash expense for office supplies"
    }
  ],
  totalDebit: 25,
  totalCredit: 25,
  source: "petty_cash_expense",
  sourceId: "expense_id",
  accountingBasis: "cash"
}
```

## 📊 **6. Financial Statements Generation**

### **Income Statement Generation**
```javascript
// Generate Income Statement
GET /api/finance/reports/income-statement?period=2024&basis=cash

// Response
{
  "period": "2024",
  "basis": "cash",
  "revenue": {
    "rent_income": 25000,
    "other_income": 1500,
    "total_revenue": 26500
  },
  "expenses": {
    "maintenance_expense": 3500,
    "supplies_expense": 1200,
    "utilities_expense": 2800,
    "office_expense": 800,
    "total_expenses": 8300
  },
  "net_income": 18200
}
```

### **Balance Sheet Generation**
```javascript
// Generate Balance Sheet
GET /api/finance/reports/balance-sheet?asOf=2024-12-31&basis=cash

// Response
{
  "asOf": "2024-12-31",
  "basis": "cash",
  "assets": {
    "current_assets": {
      "cash_on_hand": 5000,
      "bank_account": 15000,
      "ecocash_wallet": 2000,
      "innbucks_wallet": 1000,
      "petty_cash": 500,
      "accounts_receivable": 3000,
      "total_current_assets": 26500
    },
    "total_assets": 26500
  },
  "liabilities": {
    "current_liabilities": {
      "accounts_payable": 2500,
      "total_current_liabilities": 2500
    },
    "total_liabilities": 2500
  },
  "equity": {
    "owners_capital": 20000,
    "retained_earnings": 4000,
    "total_equity": 24000
  }
}
```

### **Cash Flow Statement Generation**
```javascript
// Generate Cash Flow Statement
GET /api/finance/reports/cash-flow?period=2024&basis=cash

// Response
{
  "period": "2024",
  "basis": "cash",
  "operating_activities": {
    "cash_received_from_customers": 25000,
    "cash_paid_to_suppliers": -8300,
    "cash_paid_for_expenses": -5000,
    "net_cash_from_operating": 11700
  },
  "investing_activities": {
    "purchase_of_equipment": -2000,
    "net_cash_from_investing": -2000
  },
  "financing_activities": {
    "owners_contribution": 5000,
    "net_cash_from_financing": 5000
  },
  "net_change_in_cash": 14700,
  "cash_at_beginning": 11800,
  "cash_at_end": 26500
}
```

## 🔄 **7. Accrual vs Cash Basis Comparison**

### **Accrual Basis Transactions**
```javascript
// When expense is incurred (not paid)
{
  "date": "2024-12-21",
  "entries": [
    { "accountCode": "5001", "debit": 150, "credit": 0 }, // Maintenance Expense
    { "accountCode": "2001", "debit": 0, "credit": 150 }  // Accounts Payable
  ],
  "accountingBasis": "accrual"
}

// When payment is made
{
  "date": "2024-12-22",
  "entries": [
    { "accountCode": "2001", "debit": 150, "credit": 0 }, // Accounts Payable
    { "accountCode": "1001", "debit": 0, "credit": 150 }  // Bank Account
  ],
  "accountingBasis": "cash"
}
```

### **Cash Basis Transactions**
```javascript
// When payment is made immediately
{
  "date": "2024-12-21",
  "entries": [
    { "accountCode": "5002", "debit": 50, "credit": 0 },  // Supplies Expense
    { "accountCode": "1002", "debit": 0, "credit": 50 }   // Cash on Hand
  ],
  "accountingBasis": "cash"
}
```

## 📋 **8. API Endpoints for Financial Reports**

```javascript
// Income Statement
GET /api/finance/reports/income-statement?period=2024&basis=cash
GET /api/finance/reports/income-statement?period=2024&basis=accrual

// Balance Sheet
GET /api/finance/reports/balance-sheet?asOf=2024-12-31&basis=cash
GET /api/finance/reports/balance-sheet?asOf=2024-12-31&basis=accrual

// Cash Flow Statement
GET /api/finance/reports/cash-flow?period=2024&basis=cash

// Trial Balance
GET /api/finance/reports/trial-balance?asOf=2024-12-31&basis=cash

// General Ledger
GET /api/finance/reports/general-ledger?account=5001&period=2024&basis=cash

// Account Balances
GET /api/finance/reports/account-balances?asOf=2024-12-31&basis=cash
```

## 🎯 **Key Benefits of This System**

1. **Automatic Double-Entry**: Every transaction creates balanced entries
2. **Dual Basis Support**: Same data supports both cash and accrual reporting
3. **Audit Trail**: Complete transaction history for all activities
4. **Real-time Balances**: Always up-to-date account balances
5. **Flexible Reporting**: Generate any financial statement on demand
6. **Duplicate Prevention**: No more 4 debit entries for 1 request
7. **Simplified Interface**: Finance only selects user for petty cash

This system ensures accurate, compliant financial reporting while maintaining simplicity for users! 