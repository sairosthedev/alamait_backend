# Transaction Flow Guide: How Each Scenario is Handled

This guide explains exactly how each transaction scenario is processed in the new double-entry accounting system, showing the specific database entries created.

## 1. MAINTENANCE REQUEST FLOW

### Scenario: Admin sends maintenance request to Gift Plumber, Finance approves and pays

#### Step 1: Maintenance Request Approval (Accrual Basis)
**When:** Finance approves the maintenance request
**Method:** `DoubleEntryAccountingService.recordMaintenanceApproval()`

**Database Entries Created:**

```javascript
// Transaction Record
{
  transactionId: "TXN-20241201-001",
  date: "2024-12-01T10:00:00Z",
  description: "Gift Plumber maintenance approval",
  type: "approval",
  reference: "req_12345",
  residence: "residence_id",
  createdBy: "finance_user_id"
}

// Transaction Entry Record
{
  transactionId: "TXN-20241201-001",
  date: "2024-12-01T10:00:00Z",
  description: "Maintenance approval: Fix leaking pipe",
  reference: "req_12345",
  entries: [
    {
      accountCode: "5001",
      accountName: "Maintenance Expense",
      accountType: "Expense",
      debit: 150.00,
      credit: 0,
      description: "Maintenance: Fix leaking pipe"
    },
    {
      accountCode: "2001",
      accountName: "Accounts Payable: Gift Plumber",
      accountType: "Liability",
      debit: 0,
      credit: 150.00,
      description: "Payable to Gift Plumber"
    }
  ],
  totalDebit: 150.00,
  totalCredit: 150.00,
  source: "expense_payment",
  sourceId: "req_12345",
  sourceModel: "Request",
  createdBy: "finance@company.com",
  status: "posted"
}
```

#### Step 2: Vendor Payment (Cash Basis)
**When:** Finance pays Gift Plumber via Bank/Ecocash/Innbucks
**Method:** `DoubleEntryAccountingService.recordVendorPayment()`

**Database Entries Created:**

```javascript
// Transaction Record
{
  transactionId: "TXN-20241201-002",
  date: "2024-12-01T14:00:00Z",
  description: "Payment to Gift Plumber",
  type: "payment",
  reference: "exp_67890",
  residence: "residence_id",
  createdBy: "finance_user_id"
}

// Transaction Entry Record
{
  transactionId: "TXN-20241201-002",
  date: "2024-12-01T14:00:00Z",
  description: "Payment to Gift Plumber via Bank",
  reference: "exp_67890",
  entries: [
    {
      accountCode: "2001",
      accountName: "Accounts Payable: Gift Plumber",
      accountType: "Liability",
      debit: 150.00,
      credit: 0,
      description: "Payment to Gift Plumber"
    },
    {
      accountCode: "1002",
      accountName: "Bank Account",
      accountType: "Asset",
      debit: 0,
      credit: 150.00,
      description: "Payment via Bank Transfer"
    }
  ],
  totalDebit: 150.00,
  totalCredit: 150.00,
  source: "vendor_payment",
  sourceId: "exp_67890",
  sourceModel: "Expense",
  createdBy: "finance@company.com",
  status: "posted"
}
```

## 2. SUPPLIES REQUEST FLOW

### Scenario: Admin requests supplies, Finance approves and pays

#### Step 1: Supply Purchase Approval (Accrual Basis)
**Method:** `DoubleEntryAccountingService.recordSupplyPurchaseApproval()`

**Database Entries Created:**

```javascript
// Transaction Record
{
  transactionId: "TXN-20241201-003",
  date: "2024-12-01T11:00:00Z",
  description: "Supply purchase approval",
  type: "approval",
  reference: "req_12346",
  residence: "residence_id",
  createdBy: "finance_user_id"
}

// Transaction Entry Record
{
  transactionId: "TXN-20241201-003",
  date: "2024-12-01T11:00:00Z",
  description: "Supply purchase approval: Cleaning supplies",
  reference: "req_12346",
  entries: [
    {
      accountCode: "5002",
      accountName: "Supplies Expense",
      accountType: "Expense",
      debit: 75.00,
      credit: 0,
      description: "Supplies: Cleaning materials"
    },
    {
      accountCode: "2002",
      accountName: "Accounts Payable: Supply Store",
      accountType: "Liability",
      debit: 0,
      credit: 75.00,
      description: "Payable to Supply Store"
    }
  ],
  totalDebit: 75.00,
  totalCredit: 75.00,
  source: "expense_payment",
  sourceId: "req_12346",
  sourceModel: "Request",
  createdBy: "finance@company.com",
  status: "posted"
}
```

#### Step 2: Supply Payment (Cash Basis)
**Method:** `DoubleEntryAccountingService.recordVendorPayment()`

**Database Entries Created:**

```javascript
// Transaction Entry Record
{
  transactionId: "TXN-20241201-004",
  date: "2024-12-01T15:00:00Z",
  description: "Payment to Supply Store via Ecocash",
  reference: "exp_67891",
  entries: [
    {
      accountCode: "2002",
      accountName: "Accounts Payable: Supply Store",
      accountType: "Liability",
      debit: 75.00,
      credit: 0,
      description: "Payment to Supply Store"
    },
    {
      accountCode: "1003",
      accountName: "Ecocash Account",
      accountType: "Asset",
      debit: 0,
      credit: 75.00,
      description: "Payment via Ecocash"
    }
  ],
  totalDebit: 75.00,
  totalCredit: 75.00,
  source: "vendor_payment",
  sourceId: "exp_67891",
  sourceModel: "Expense",
  createdBy: "finance@company.com",
  status: "posted"
}
```

## 3. STUDENT RENT PAYMENT FLOW

### Scenario A: Student pays rent directly (No Invoice)

#### Direct Rent Payment (Cash Basis)
**When:** Admin adds payment through "Add Payment"
**Method:** `DoubleEntryAccountingService.recordStudentRentPayment()`

**Database Entries Created:**

```javascript
// Transaction Record
{
  transactionId: "TXN-20241201-005",
  date: "2024-12-01T09:00:00Z",
  description: "Student rent payment",
  type: "payment",
  reference: "pay_12345",
  residence: "residence_id",
  createdBy: "admin_user_id"
}

// Transaction Entry Record
{
  transactionId: "TXN-20241201-005",
  date: "2024-12-01T09:00:00Z",
  description: "Rent payment from John Doe",
  reference: "pay_12345",
  entries: [
    {
      accountCode: "1001",
      accountName: "Cash on Hand",
      accountType: "Asset",
      debit: 200.00,
      credit: 0,
      description: "Cash payment received"
    },
    {
      accountCode: "4001",
      accountName: "Rent Income",
      accountType: "Income",
      debit: 0,
      credit: 200.00,
      description: "Rent income for December 2024"
    }
  ],
  totalDebit: 200.00,
  totalCredit: 200.00,
  source: "payment",
  sourceId: "pay_12345",
  sourceModel: "Payment",
  createdBy: "admin@company.com",
  status: "posted"
}
```

### Scenario B: Student Invoice Flow

#### Step 1: Invoice Issuance (Accrual Basis)
**When:** Admin creates invoice for student billing period
**Method:** `DoubleEntryAccountingService.recordInvoiceIssuance()`

**Database Entries Created:**

```javascript
// Transaction Record
{
  transactionId: "TXN-20241201-006",
  date: "2024-12-01T08:00:00Z",
  description: "Invoice issued to student",
  type: "invoice",
  reference: "inv_12345",
  residence: "residence_id",
  createdBy: "admin_user_id"
}

// Transaction Entry Record
{
  transactionId: "TXN-20241201-006",
  date: "2024-12-01T08:00:00Z",
  description: "Invoice issued to John Doe for December 2024",
  reference: "inv_12345",
  entries: [
    {
      accountCode: "1101",
      accountName: "Accounts Receivable",
      accountType: "Asset",
      debit: 200.00,
      credit: 0,
      description: "Amount owed by John Doe"
    },
    {
      accountCode: "4001",
      accountName: "Rent Income",
      accountType: "Income",
      debit: 0,
      credit: 200.00,
      description: "Rent income for December 2024"
    }
  ],
  totalDebit: 200.00,
  totalCredit: 200.00,
  source: "invoice",
  sourceId: "inv_12345",
  sourceModel: "Invoice",
  createdBy: "admin@company.com",
  status: "posted"
}
```

#### Step 2: Invoice Payment (Cash Basis)
**When:** Student pays the invoice
**Method:** `DoubleEntryAccountingService.recordInvoicePayment()`

**Database Entries Created:**

```javascript
// Transaction Record
{
  transactionId: "TXN-20241201-007",
  date: "2024-12-01T16:00:00Z",
  description: "Invoice payment received",
  type: "payment",
  reference: "pay_12346",
  residence: "residence_id",
  createdBy: "admin_user_id"
}

// Transaction Entry Record
{
  transactionId: "TXN-20241201-007",
  date: "2024-12-01T16:00:00Z",
  description: "Payment for invoice INV-12345",
  reference: "pay_12346",
  entries: [
    {
      accountCode: "1004",
      accountName: "Innbucks Account",
      accountType: "Asset",
      debit: 200.00,
      credit: 0,
      description: "Payment via Innbucks"
    },
    {
      accountCode: "1101",
      accountName: "Accounts Receivable",
      accountType: "Asset",
      debit: 0,
      credit: 200.00,
      description: "Payment received for invoice INV-12345"
    }
  ],
  totalDebit: 200.00,
  totalCredit: 200.00,
  source: "payment",
  sourceId: "pay_12346",
  sourceModel: "Payment",
  createdBy: "admin@company.com",
  status: "posted"
}
```

## 4. ITEMS WITHOUT PROVIDERS (Side Road Purchases)

### Scenario: Firewood purchase from side road vendor

#### Direct Expense Recording (Cash Basis)
**When:** Admin records direct expense without formal vendor
**Method:** `DoubleEntryAccountingService.recordTransaction()`

**Database Entries Created:**

```javascript
// Transaction Record
{
  transactionId: "TXN-20241201-008",
  date: "2024-12-01T12:00:00Z",
  description: "Direct expense: Firewood purchase",
  type: "other",
  reference: "exp_67892",
  residence: "residence_id",
  createdBy: "admin_user_id"
}

// Transaction Entry Record
{
  transactionId: "TXN-20241201-008",
  date: "2024-12-01T12:00:00Z",
  description: "Firewood purchase from roadside vendor",
  reference: "exp_67892",
  entries: [
    {
      accountCode: "5003",
      accountName: "Miscellaneous Expense",
      accountType: "Expense",
      debit: 25.00,
      credit: 0,
      description: "Firewood for heating"
    },
    {
      accountCode: "1001",
      accountName: "Cash on Hand",
      accountType: "Asset",
      debit: 0,
      credit: 25.00,
      description: "Cash payment for firewood"
    }
  ],
  totalDebit: 25.00,
  totalCredit: 25.00,
  source: "manual",
  sourceId: "exp_67892",
  sourceModel: "Expense",
  createdBy: "admin@company.com",
  status: "posted"
}
```

## 5. ACCOUNTING BASIS SUMMARY

### Cash Basis Transactions
- **Student Rent Payments** (direct)
- **Vendor Payments** (when actually paid)
- **Direct Expenses** (side road purchases)
- **Invoice Payments** (when student pays invoice)

### Accrual Basis Transactions
- **Maintenance Request Approvals** (when approved)
- **Supply Purchase Approvals** (when approved)
- **Invoice Issuance** (when invoice created)

## 6. AUTOMATIC ACCOUNT DETERMINATION

The system automatically determines accounts based on:

### Payment Methods
- **Cash** → "Cash on Hand" (1001)
- **Bank** → "Bank Account" (1002)
- **Ecocash** → "Ecocash Account" (1003)
- **Innbucks** → "Innbucks Account" (1004)

### Transaction Types
- **Maintenance** → "Maintenance Expense" (5001)
- **Supplies** → "Supplies Expense" (5002)
- **Rent Income** → "Rent Income" (4001)
- **Vendor Payables** → "Accounts Payable: [Vendor Name]" (2001, 2002, etc.)

### Vendor-Specific Accounts
- Each vendor gets their own payable account
- Account code format: `2001`, `2002`, etc.
- Account name: `Accounts Payable: [Vendor Name]`

## 7. FRONTEND IMPACT

### Before (Manual Account Selection)
```javascript
// OLD - Manual account selection required
const paymentForm = {
  amount: 150,
  method: 'Bank',
  debitAccount: '1002', // Manual selection
  creditAccount: '4001', // Manual selection
  description: 'Rent payment'
};
```

### After (Automatic Account Determination)
```javascript
// NEW - Simplified form
const paymentForm = {
  amount: 150,
  method: 'Bank', // Auto-determines account
  description: 'Rent payment'
  // System automatically creates:
  // Dr. Bank Account $150
  // Cr. Rent Income $150
};
```

## 8. API ENDPOINTS

### New Simplified Endpoints
- `POST /api/finance/approve-maintenance/:requestId` - Approves maintenance and records accrual
- `POST /api/finance/pay-vendor/:expenseId` - Pays vendor and records cash transaction
- `POST /api/finance/approve-supplies/:requestId` - Approves supplies and records accrual
- `POST /api/finance/record-payment` - Records student payment (auto-determines accounts)
- `POST /api/finance/create-invoice` - Creates invoice and records accrual
- `POST /api/finance/pay-invoice/:invoiceId` - Records invoice payment

### Reports
- `GET /api/finance/reports/cash-basis` - Cash basis transactions
- `GET /api/finance/reports/accrual-basis` - Accrual basis transactions
- `GET /api/finance/transactions/:transactionId` - Detailed transaction view

This system eliminates the need for manual account selection while ensuring proper double-entry accounting for all scenarios. 