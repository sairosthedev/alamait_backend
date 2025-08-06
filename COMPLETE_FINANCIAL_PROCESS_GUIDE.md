# Complete Financial Process Guide

## Overview
This guide explains the exact process flow for all financial transactions in the Alamait system, including what triggers double-entry accounting entries, what the frontend needs to implement, and how data flows from user actions to financial reports.

## 🏗️ System Architecture

### Core Components
1. **DoubleEntryAccountingService** - Creates all financial transactions
2. **TransactionEntry Model** - Stores double-entry accounting records
3. **FinancialReportingService** - Generates reports from transaction data
4. **Frontend Services** - API calls to fetch and display financial data

### Key Models
- `TransactionEntry` - Main financial record with double-entry entries
- `Payment` - Student rent payments
- `Expense` - Vendor payments and expenses
- `Invoice` - Student invoices
- `Request` - Maintenance and supply requests
- `Account` - Chart of accounts

---

## 💰 Student Payment Process

### 1. When Students Pay Rent

**Frontend Action:**
```javascript
// Student makes payment through frontend
const paymentData = {
  studentId: "student123",
  residenceId: "residence456",
  amount: 300,
  method: "Cash", // or "Bank Transfer", "Mobile Money"
  date: new Date(), // IMPORTANT: Use actual payment date
  description: "January 2025 Rent"
};

// Frontend calls payment API
const response = await fetch('/api/student/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(paymentData)
});
```

**Backend Process:**
1. **Payment Controller** receives payment data
2. **Creates Payment record** in database
3. **Calls DoubleEntryAccountingService.recordStudentRentPayment()**
4. **Creates TransactionEntry** with double-entry entries:

```javascript
// DEBIT: Cash/Bank Account
{
  accountCode: "1001", // Cash account
  accountName: "Cash on Hand",
  accountType: "Asset",
  debit: 300,
  credit: 0,
  description: "Rent payment via Cash"
}

// CREDIT: Rent Income Account
{
  accountCode: "4001", // Rent Income account
  accountName: "Rent Income",
  accountType: "Income",
  debit: 0,
  credit: 300,
  description: "Rent income from Student"
}
```

**Required Fields in TransactionEntry:**
- `transactionId` - Auto-generated unique ID
- `date` - Uses `payment.date` (actual payment date)
- `description` - Payment description
- `source` - "payment"
- `sourceId` - Payment document ID
- `sourceModel` - "Payment"
- `entries` - Array of debit/credit entries
- `totalDebit` - Must equal `totalCredit`
- `createdBy` - User email
- `status` - "posted"

### 2. Frontend Requirements for Student Payments

**Payment Form Fields:**
- Student selection
- Residence selection
- Amount
- Payment method (Cash/Bank Transfer/Mobile Money)
- **Payment date** (default to today but editable)
- Description/notes

**API Integration:**
```javascript
// Frontend service
const createPayment = async (paymentData) => {
  const response = await fetch('/api/student/payments', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(paymentData)
  });
  return response.json();
};
```

---

## 🏗️ Maintenance Request Process

### 1. When Maintenance is Approved

**Frontend Action:**
```javascript
// Admin approves maintenance request
const approvalData = {
  requestId: "request123",
  selectedQuotations: [
    {
      vendorId: "vendor456",
      amount: 500,
      provider: "ABC Maintenance"
    }
  ],
  approvedBy: "admin@alamait.com"
};

// Frontend calls approval API
const response = await fetch('/api/admin/maintenance/approve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(approvalData)
});
```

**Backend Process:**
1. **Maintenance Controller** receives approval
2. **Updates Request status** to "Approved"
3. **Calls DoubleEntryAccountingService.recordMaintenanceApproval()**
4. **Creates TransactionEntry** (Accrual Basis):

```javascript
// DEBIT: Maintenance Expense
{
  accountCode: "5001", // Maintenance Expense account
  accountName: "Maintenance Expense",
  accountType: "Expense",
  debit: 500,
  credit: 0,
  description: "Maintenance: Plumbing repair"
}

// CREDIT: Accounts Payable
{
  accountCode: "2001", // Vendor Payable account
  accountName: "Accounts Payable: ABC Maintenance",
  accountType: "Liability",
  debit: 0,
  credit: 500,
  description: "Payable to ABC Maintenance"
}
```

**Required Fields:**
- `date` - Uses `new Date()` (approval date)
- `source` - "expense_payment"
- `sourceId` - Request document ID
- `sourceModel` - "Request"
- `metadata.requestType` - "maintenance"

### 2. When Vendor Payment is Made

**Frontend Action:**
```javascript
// Admin pays vendor for approved maintenance
const paymentData = {
  expenseId: "expense123",
  paymentMethod: "Bank Transfer",
  paidDate: new Date(), // IMPORTANT: Use actual payment date
  amount: 500
};

// Frontend calls vendor payment API
const response = await fetch('/api/finance/expenses/pay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(paymentData)
});
```

**Backend Process:**
1. **Expense Controller** receives payment
2. **Updates Expense status** to "Paid"
3. **Calls DoubleEntryAccountingService.recordVendorPayment()**
4. **Creates TransactionEntry** (Cash Basis):

```javascript
// DEBIT: Accounts Payable
{
  accountCode: "2001", // Vendor Payable account
  accountName: "Accounts Payable: ABC Maintenance",
  accountType: "Liability",
  debit: 500,
  credit: 0,
  description: "Settle payable to ABC Maintenance"
}

// CREDIT: Bank Account
{
  accountCode: "1002", // Bank account
  accountName: "Bank Account",
  accountType: "Asset",
  debit: 0,
  credit: 500,
  description: "Payment via Bank Transfer"
}
```

**Required Fields:**
- `date` - Uses `expense.paidDate || expense.date` (actual payment date)
- `source` - "vendor_payment"
- `sourceId` - Expense document ID
- `sourceModel` - "Expense"

### 3. Frontend Requirements for Maintenance

**Maintenance Request Form:**
- Request title and description
- Items with quotations
- Vendor selection
- Cost estimates

**Approval Interface:**
- List of pending requests
- Quotation comparison
- Approval button with selected vendor

**Payment Interface:**
- List of approved expenses
- Payment method selection
- **Payment date** field (default to today but editable)
- Amount confirmation

---

## 🧾 Invoice Process

### 1. When Invoice is Issued

**Frontend Action:**
```javascript
// Admin creates invoice for student
const invoiceData = {
  studentId: "student123",
  residenceId: "residence456",
  amount: 300,
  dueDate: new Date("2025-02-15"),
  description: "February 2025 Rent"
};

// Frontend calls invoice API
const response = await fetch('/api/finance/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(invoiceData)
});
```

**Backend Process:**
1. **Invoice Controller** creates invoice
2. **Calls DoubleEntryAccountingService.recordInvoiceIssuance()**
3. **Creates TransactionEntry** (Accrual Basis):

```javascript
// DEBIT: Accounts Receivable
{
  accountCode: "1101", // Accounts Receivable account
  accountName: "Accounts Receivable",
  accountType: "Asset",
  debit: 300,
  credit: 0,
  description: "Receivable from Student"
}

// CREDIT: Rent Income
{
  accountCode: "4001", // Rent Income account
  accountName: "Rent Income",
  accountType: "Income",
  debit: 0,
  credit: 300,
  description: "Rent income from Student"
}
```

**Required Fields:**
- `date` - Uses `invoice.date` (invoice date)
- `source` - "invoice"
- `sourceId` - Invoice document ID
- `sourceModel` - "Invoice"

### 2. When Invoice is Paid

**Frontend Action:**
```javascript
// Student pays invoice
const paymentData = {
  invoiceId: "invoice123",
  paymentMethod: "Mobile Money",
  amount: 300,
  paymentDate: new Date() // IMPORTANT: Use actual payment date
};

// Frontend calls invoice payment API
const response = await fetch('/api/finance/invoices/pay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(paymentData)
});
```

**Backend Process:**
1. **Invoice Controller** receives payment
2. **Calls DoubleEntryAccountingService.recordInvoicePayment()**
3. **Creates TransactionEntry** (Cash Basis):

```javascript
// DEBIT: Cash/Bank Account
{
  accountCode: "1003", // Mobile Money account
  accountName: "Mobile Money",
  accountType: "Asset",
  debit: 300,
  credit: 0,
  description: "Payment via Mobile Money"
}

// CREDIT: Accounts Receivable
{
  accountCode: "1101", // Accounts Receivable account
  accountName: "Accounts Receivable",
  accountType: "Asset",
  debit: 0,
  credit: 300,
  description: "Settle receivable from Student"
}
```

---

## 📊 Financial Reports Process

### 1. Monthly Income Statement

**Frontend API Call:**
```javascript
// Fetch monthly income statement
const getMonthlyIncomeStatement = async (year = 2025) => {
  const response = await fetch(`/api/financial-reports/monthly-income-statement?period=${year}&basis=cash`);
  return response.json();
};
```

**Backend Process:**
1. **FinancialReportsController.generateMonthlyIncomeStatement()**
2. **FinancialReportingService.generateMonthlyIncomeStatement()**
3. **Queries TransactionEntry** by date range and account types
4. **Groups by month** and calculates totals

**Data Source:**
- **Revenue**: TransactionEntry with Income account types
- **Expenses**: TransactionEntry with Expense account types
- **Date Filter**: Uses `TransactionEntry.date` field

### 2. Monthly Balance Sheet

**Frontend API Call:**
```javascript
// Fetch monthly balance sheet
const getMonthlyBalanceSheet = async (year = 2025) => {
  const response = await fetch(`/api/financial-reports/monthly-balance-sheet?period=${year}&basis=cash`);
  return response.json();
};
```

**Backend Process:**
1. **FinancialReportsController.generateMonthlyBalanceSheet()**
2. **FinancialReportingService.generateMonthlyBalanceSheet()**
3. **Queries TransactionEntry** by account types:
   - Assets: AccountType = "Asset"
   - Liabilities: AccountType = "Liability"
   - Equity: AccountType = "Equity"

### 3. Monthly Cash Flow

**Frontend API Call:**
```javascript
// Fetch monthly cash flow
const getMonthlyCashFlow = async (year = 2025) => {
  const response = await fetch(`/api/financial-reports/monthly-cash-flow?period=${year}&basis=cash`);
  return response.json();
};
```

**Backend Process:**
1. **FinancialReportsController.generateMonthlyCashFlow()**
2. **Analyzes TransactionEntry** for cash movements
3. **Categorizes** as Operating/Investing/Financing activities

---

## 🔧 Frontend Implementation Requirements

### 1. Payment Forms

**Student Payment Form:**
```javascript
const StudentPaymentForm = () => {
  const [paymentData, setPaymentData] = useState({
    studentId: '',
    residenceId: '',
    amount: 0,
    method: 'Cash',
    date: new Date(), // IMPORTANT: Editable date field
    description: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await createPayment(paymentData);
      if (response.success) {
        // Show success message
        // Refresh financial reports
      }
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Student selection */}
      {/* Residence selection */}
      {/* Amount input */}
      {/* Payment method selection */}
      <input
        type="date"
        value={paymentData.date.toISOString().split('T')[0]}
        onChange={(e) => setPaymentData({
          ...paymentData,
          date: new Date(e.target.value)
        })}
      />
      {/* Description input */}
      <button type="submit">Record Payment</button>
    </form>
  );
};
```

### 2. Financial Reports Display

**Monthly Reports Component:**
```javascript
const MonthlyReports = () => {
  const [reports, setReports] = useState({
    incomeStatement: null,
    balanceSheet: null,
    cashFlow: null
  });
  const [year, setYear] = useState(2025);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const [income, balance, cash] = await Promise.all([
          getMonthlyIncomeStatement(year),
          getMonthlyBalanceSheet(year),
          getMonthlyCashFlow(year)
        ]);
        
        setReports({
          incomeStatement: income.data,
          balanceSheet: balance.data,
          cashFlow: cash.data
        });
      } catch (error) {
        // Handle error
      }
    };

    fetchReports();
  }, [year]);

  return (
    <div>
      <select value={year} onChange={(e) => setYear(e.target.value)}>
        <option value={2025}>2025</option>
        <option value={2024}>2024</option>
      </select>
      
      {/* Display reports in tables */}
      <MonthlyIncomeStatement data={reports.incomeStatement} />
      <MonthlyBalanceSheet data={reports.balanceSheet} />
      <MonthlyCashFlow data={reports.cashFlow} />
    </div>
  );
};
```

### 3. Transaction History

**Transaction List Component:**
```javascript
const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: 'all'
  });

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/finance/transactions?' + 
        new URLSearchParams(filters));
      const data = await response.json();
      setTransactions(data.data);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      {/* Date filters */}
      {/* Transaction type filters */}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(transaction => (
            <tr key={transaction._id}>
              <td>{new Date(transaction.date).toLocaleDateString()}</td>
              <td>{transaction.description}</td>
              <td>{transaction.type}</td>
              <td>{transaction.totalDebit}</td>
              <td>{transaction.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

## ⚠️ Critical Requirements

### 1. Date Handling
- **ALWAYS** use actual transaction dates, not current system date
- Payment forms must have editable date fields
- Backend uses source document dates (payment.date, expense.paidDate, invoice.date)

### 2. Required Fields
Every TransactionEntry must have:
- `transactionId` - Auto-generated
- `date` - Actual transaction date
- `description` - Human-readable description
- `source` - Document type ("payment", "expense_payment", "invoice")
- `sourceId` - Source document ID
- `sourceModel` - Source model name ("Payment", "Request", "Invoice")
- `entries` - Array of debit/credit entries
- `totalDebit` - Must equal `totalCredit`
- `createdBy` - User email
- `status` - "posted"

### 3. Double-Entry Validation
- Every transaction must have equal debits and credits
- Account types must be valid (Asset, Liability, Equity, Income, Expense)
- Transaction IDs must be unique

### 4. Frontend Validation
- Validate payment amounts
- Ensure required fields are filled
- Show loading states during API calls
- Handle errors gracefully
- Refresh reports after successful transactions

---

## 🔄 Data Flow Summary

1. **User Action** (Payment/Approval/Invoice)
2. **Frontend API Call** (with proper date and data)
3. **Backend Controller** (validates and processes)
4. **DoubleEntryAccountingService** (creates TransactionEntry)
5. **Database Storage** (TransactionEntry with all required fields)
6. **Financial Reports** (queries TransactionEntry by date/account type)
7. **Frontend Display** (shows reports in tables/charts)

This ensures accurate, real-time financial reporting based on actual transaction dates and proper double-entry accounting principles. 