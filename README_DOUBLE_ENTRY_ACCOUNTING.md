# Double-Entry Accounting System for Student Accommodation Management

## 🎯 Overview

This implementation provides a comprehensive **double-entry accounting system** for your Student Accommodation Management System, supporting both **Cash Basis** and **Accrual Basis** accounting methods. It properly records all financial transactions with proper debits and credits, maintaining audit trails and supporting accurate financial reporting.

## 🏗️ Architecture

### Core Components

1. **`DoubleEntryAccountingService`** - Main service handling all accounting logic
2. **`FinanceController`** - Controller demonstrating integration with business logic
3. **`Transaction` & `TransactionEntry`** - Models for storing double-entry data
4. **`Account`** - Chart of accounts with proper categorization

### Key Features

- ✅ **Proper Double-Entry Accounting** - Every transaction balances (Debits = Credits)
- ✅ **Cash & Accrual Basis Support** - Toggle between accounting methods
- ✅ **Audit Trail** - Complete tracking of who created what when
- ✅ **Vendor Management** - Automatic vendor-specific payable accounts
- ✅ **Payment Method Tracking** - Separate accounts for Ecocash, Bank, etc.
- ✅ **Comprehensive Reporting** - Filter by accounting basis and date ranges

## 🚀 Quick Start

### 1. Initialize Chart of Accounts

```bash
# Run the test script to set up basic accounts
node src/scripts/testDoubleEntryAccounting.js
```

### 2. Integrate with Your Controllers

```javascript
const DoubleEntryAccountingService = require('../services/doubleEntryAccountingService');

// Approve maintenance request (Accrual Basis)
const result = await DoubleEntryAccountingService.recordMaintenanceApproval(request, user);

// Pay vendor (Cash Basis)
const result = await DoubleEntryAccountingService.recordVendorPayment(expense, user, 'Ecocash');

// Process student rent payment (Cash Basis)
const result = await DoubleEntryAccountingService.recordStudentRentPayment(payment, user);
```

### 3. Generate Financial Reports

```javascript
// Cash Basis Report (actual cash movements only)
const cashTransactions = await DoubleEntryAccountingService.getTransactionsByBasis('cash', {
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31'
});

// Accrual Basis Report (all financial obligations)
const accrualTransactions = await DoubleEntryAccountingService.getTransactionsByBasis('accrual', {
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31'
});
```

## 📊 Transaction Scenarios

### 1. Maintenance Request Approval (Accrual Basis)

**When**: Finance approves a maintenance request
**Accounting**: Records expense when incurred, not when paid

```javascript
// When finance approves a maintenance request
const result = await DoubleEntryAccountingService.recordMaintenanceApproval(request, user);
```

**Double-Entry Entries**:
```
Dr. Maintenance Expense          $100
Cr. Accounts Payable: Vendor     $100
```

### 2. Vendor Payment (Cash Basis)

**When**: Actually paying the vendor
**Accounting**: Records payment when cash leaves the system

```javascript
// When paying the vendor
const result = await DoubleEntryAccountingService.recordVendorPayment(expense, user, 'Ecocash');
```

**Double-Entry Entries**:
```
Dr. Accounts Payable: Vendor     $100
Cr. Ecocash Wallet              $100
```

### 3. Student Rent Payment (Cash Basis - No Invoice)

**When**: Student pays rent without invoice
**Accounting**: Records income when cash is received

```javascript
const result = await DoubleEntryAccountingService.recordStudentRentPayment(payment, user);
```

**Double-Entry Entries**:
```
Dr. Bank Account                $500
Cr. Rent Income                 $500
```

### 4. Invoice Issuance (Accrual Basis)

**When**: Creating invoice for student
**Accounting**: Records receivable when invoice is issued

```javascript
const result = await DoubleEntryAccountingService.recordInvoiceIssuance(invoice, user);
```

**Double-Entry Entries**:
```
Dr. Accounts Receivable         $500
Cr. Rent Income                 $500
```

### 5. Invoice Payment (Cash Basis)

**When**: Student pays invoice
**Accounting**: Records payment when cash is received

```javascript
const result = await DoubleEntryAccountingService.recordInvoicePayment(invoice, paymentRecord, user);
```

**Double-Entry Entries**:
```
Dr. Bank Account                $500
Cr. Accounts Receivable         $500
```

## 🔧 API Endpoints

### Finance Controller Endpoints

```javascript
// Approve maintenance request
POST /api/finance/approve-maintenance/:requestId
{
  "approvalNotes": "Approved for plumbing repair"
}

// Pay vendor
POST /api/finance/pay-vendor/:expenseId
{
  "paymentMethod": "Ecocash",
  "receiptImage": "url_to_receipt",
  "paymentNotes": "Payment for plumbing work"
}

// Process student rent payment
POST /api/finance/process-rent-payment/:paymentId
{
  "verificationNotes": "Payment verified and confirmed"
}

// Create invoice
POST /api/finance/create-invoice/:studentId/:residenceId/:roomId
{
  "billingPeriod": "2024-01",
  "charges": [
    {
      "description": "Monthly Rent",
      "amount": 500,
      "quantity": 1,
      "category": "rent"
    }
  ],
  "dueDate": "2024-01-31"
}

// Process invoice payment
POST /api/finance/process-invoice-payment/:invoiceId
{
  "amount": 500,
  "paymentMethod": "Bank Transfer",
  "reference": "REF123456",
  "notes": "Payment received"
}

// Get financial report
GET /api/finance/report?basis=accrual&dateFrom=2024-01-01&dateTo=2024-01-31

// Get transaction details
GET /api/finance/transaction/:transactionId
```

## 📈 Reporting Examples

### Cash Flow Statement (Cash Basis)

```javascript
const getCashFlowReport = async (dateFrom, dateTo) => {
  const cashTransactions = await DoubleEntryAccountingService.getTransactionsByBasis('cash', {
    dateFrom,
    dateTo
  });
  
  return {
    cashIn: cashTransactions.filter(t => t.source === 'payment').reduce((sum, t) => sum + t.amount, 0),
    cashOut: cashTransactions.filter(t => t.source === 'vendor_payment').reduce((sum, t) => sum + t.amount, 0),
    netCashFlow: cashIn - cashOut
  };
};
```

### Income Statement (Accrual Basis)

```javascript
const getIncomeStatement = async (dateFrom, dateTo) => {
  const accrualTransactions = await DoubleEntryAccountingService.getTransactionsByBasis('accrual', {
    dateFrom,
    dateTo
  });
  
  return {
    revenue: accrualTransactions.filter(t => t.source === 'invoice').reduce((sum, t) => sum + t.amount, 0),
    expenses: accrualTransactions.filter(t => t.source === 'expense_payment').reduce((sum, t) => sum + t.amount, 0),
    netIncome: revenue - expenses
  };
};
```

## 🧪 Testing

### Run Complete Test Suite

```bash
# Test all accounting scenarios
node src/scripts/testDoubleEntryAccounting.js
```

This will test:
- ✅ Maintenance Request Approval (Accrual Basis)
- ✅ Vendor Payment (Cash Basis)
- ✅ Supply Purchase Approval (Accrual Basis)
- ✅ Student Rent Payment (Cash Basis)
- ✅ Invoice Issuance (Accrual Basis)
- ✅ Invoice Payment (Cash Basis)
- ✅ Accounting Basis Filtering

### Expected Output

```
🧪 Starting Double-Entry Accounting Test...

📊 Initializing Chart of Accounts...
✅ Created account: 1001 - Bank Account
✅ Created account: 1003 - Ecocash Wallet
✅ Created account: 4001 - Rent Income
✅ Created account: 5001 - Maintenance Expense

🏗️ Testing Maintenance Request Approval (Accrual Basis)...
✅ Maintenance approval recorded:
   Transaction ID: TXN1703123456789ABC123
   Type: approval
   Amount: $100
   Double-Entry Entries:
   Dr. Maintenance Expense (5001) $100
   Cr. Accounts Payable: Gift Plumber (2001) $100

💳 Testing Vendor Payment (Cash Basis)...
✅ Vendor payment recorded:
   Transaction ID: TXN1703123456789DEF456
   Type: payment
   Amount: $100
   Double-Entry Entries:
   Dr. Accounts Payable: Gift Plumber (2001) $100
   Cr. Ecocash Wallet (1003) $100

🎉 All tests completed successfully!
```

## 📋 Implementation Matrix

| Transaction Type | Accrual Entry | Cash Entry | When to Record |
|------------------|---------------|------------|----------------|
| Maintenance Approval | Dr: Maintenance Expense<br>Cr: A/P (Vendor) | N/A | When approved |
| Vendor Payment | N/A | Dr: A/P<br>Cr: Cash/Bank | When paid |
| Supply Purchase | Dr: Supplies Expense<br>Cr: A/P | N/A | When approved |
| Student Rent (no invoice) | N/A | Dr: Cash/Bank<br>Cr: Rent Income | When received |
| Student Rent (with invoice) | Dr: A/R<br>Cr: Rent Income | Dr: Cash/Bank<br>Cr: A/R | When invoiced / When paid |

## 🛡️ Best Practices

### 1. Transaction Integrity
- Always ensure debits equal credits
- Use database transactions for multi-step operations
- Validate account codes before posting

### 2. Audit Trail
- Link every transaction to source documents
- Record who created each transaction
- Maintain timestamps for all entries

### 3. Account Management
- Use consistent account codes
- Create vendor-specific payable accounts
- Separate payment method accounts (Ecocash, Bank, etc.)

### 4. Error Handling
- Validate transaction data before posting
- Provide clear error messages
- Log all accounting activities

## 🔍 Troubleshooting

### Common Issues

1. **"Total debits must equal total credits" Error**
   - Check that all entries in a transaction balance
   - Verify account codes are correct
   - Ensure amounts are positive numbers

2. **"Account not found" Error**
   - Run the test script to initialize chart of accounts
   - Check that account codes match your chart of accounts
   - Verify account is active

3. **"Transaction already exists" Error**
   - Check for duplicate transaction IDs
   - Ensure unique transaction references
   - Verify source document IDs

### Debug Mode

Enable detailed logging by setting environment variable:
```bash
DEBUG=accounting node your-app.js
```

## 📚 Additional Resources

- [Double-Entry Accounting Guide](docs/DOUBLE_ENTRY_ACCOUNTING_GUIDE.md) - Comprehensive implementation guide
- [Finance Controller](src/controllers/financeController.js) - Complete controller implementation
- [Test Script](src/scripts/testDoubleEntryAccounting.js) - Full test suite

## 🤝 Contributing

When adding new transaction types:

1. Add new method to `DoubleEntryAccountingService`
2. Update the `recordTransaction` method with new case
3. Add corresponding controller method
4. Update test script with new test case
5. Update documentation

## 📄 License

This implementation is part of the Student Accommodation Management System and follows proper accounting principles and best practices. 