# Double-Entry Accounting Implementation Guide

## 📋 Overview

This guide explains how to implement proper **double-entry accounting** in your Student Accommodation Management System, supporting both **Cash Basis** and **Accrual Basis** accounting methods.

## 🏗️ System Architecture

### Core Models
- **`Transaction`**: High-level transaction information
- **`TransactionEntry`**: Double-entry line items with debits and credits
- **`Account`**: Chart of accounts with proper categorization

### Key Principles
1. **Every transaction must balance** (Total Debits = Total Credits)
2. **Link transactions to source documents** (requests, invoices, payments)
3. **Support both accounting bases** with proper filtering
4. **Maintain audit trail** for all financial activities

## 💡 Transaction Scenarios

### 1. Maintenance Request Approval (Accrual Basis)

**When**: Finance approves a maintenance request
**Accounting**: Records expense when incurred, not when paid

```javascript
const DoubleEntryAccountingService = require('../services/doubleEntryAccountingService');

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

### 3. Supply Purchase Approval (Accrual Basis)

**When**: Finance approves supply purchase
**Accounting**: Records expense when approved

```javascript
const result = await DoubleEntryAccountingService.recordSupplyPurchaseApproval(request, user);
```

**Double-Entry Entries**:
```
Dr. Supplies Expense            $150
Cr. Accounts Payable: Vendor     $150
```

### 4. Student Rent Payment (Cash Basis - No Invoice)

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

### 5. Invoice Issuance (Accrual Basis)

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

### 6. Invoice Payment (Cash Basis)

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

## 🔄 Complete Transaction Flow Examples

### Example 1: Maintenance Request → Approval → Payment

```javascript
// 1. Admin submits maintenance request
const request = {
  title: "Plumbing Repair",
  items: [{
    description: "Fix leaking pipe",
    quotations: [{
      provider: "Gift Plumber",
      amount: 100,
      vendorId: "vendor123",
      isSelected: true
    }]
  }]
};

// 2. Finance approves (Accrual Basis)
const approvalResult = await DoubleEntryAccountingService.recordMaintenanceApproval(request, user);
// Creates: Dr. Maintenance Expense $100, Cr. A/P: Gift Plumber $100

// 3. Later, finance pays vendor (Cash Basis)
const paymentResult = await DoubleEntryAccountingService.recordVendorPayment(expense, user, 'Ecocash');
// Creates: Dr. A/P: Gift Plumber $100, Cr. Ecocash Wallet $100
```

### Example 2: Student Rent with Invoice

```javascript
// 1. Create invoice for student (Accrual Basis)
const invoice = {
  student: { firstName: "John" },
  totalAmount: 500
};

const invoiceResult = await DoubleEntryAccountingService.recordInvoiceIssuance(invoice, user);
// Creates: Dr. Accounts Receivable $500, Cr. Rent Income $500

// 2. Student pays invoice (Cash Basis)
const paymentRecord = {
  amount: 500,
  paymentMethod: 'Bank Transfer'
};

const paymentResult = await DoubleEntryAccountingService.recordInvoicePayment(invoice, paymentRecord, user);
// Creates: Dr. Bank Account $500, Cr. Accounts Receivable $500
```

## 📊 Accounting Basis Filtering

### Cash Basis View
Shows only actual cash movements (payments received/made):

```javascript
const cashTransactions = await DoubleEntryAccountingService.getTransactionsByBasis('cash', {
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
  residence: 'residence123'
});
```

**Shows**:
- ✅ Student rent payments
- ✅ Vendor payments
- ❌ Invoice issuances (no cash movement)
- ❌ Maintenance approvals (no cash movement)

### Accrual Basis View
Shows all financial obligations and income earned:

```javascript
const accrualTransactions = await DoubleEntryAccountingService.getTransactionsByBasis('accrual', {
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31'
});
```

**Shows**:
- ✅ Student rent payments
- ✅ Vendor payments
- ✅ Invoice issuances (income earned)
- ✅ Maintenance approvals (expenses incurred)

## 🎯 Implementation Matrix

| Transaction Type | Accrual Entry | Cash Entry | When to Record |
|------------------|---------------|------------|----------------|
| Maintenance Approval | Dr: Maintenance Expense<br>Cr: A/P (Vendor) | N/A | When approved |
| Vendor Payment | N/A | Dr: A/P<br>Cr: Cash/Bank | When paid |
| Supply Purchase | Dr: Supplies Expense<br>Cr: A/P | N/A | When approved |
| Student Rent (no invoice) | N/A | Dr: Cash/Bank<br>Cr: Rent Income | When received |
| Student Rent (with invoice) | Dr: A/R<br>Cr: Rent Income | Dr: Cash/Bank<br>Cr: A/R | When invoiced / When paid |

## 🔧 Usage in Controllers

### Finance Controller Example

```javascript
const DoubleEntryAccountingService = require('../services/doubleEntryAccountingService');

// Approve maintenance request
exports.approveMaintenanceRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await Request.findById(requestId);
    
    // Update request status
    request.status = 'approved';
    await request.save();
    
    // Record accounting transaction (Accrual Basis)
    const accountingResult = await DoubleEntryAccountingService.recordMaintenanceApproval(request, req.user);
    
    res.json({
      success: true,
      message: 'Request approved and accounting recorded',
      transaction: accountingResult.transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Pay vendor
exports.payVendor = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { paymentMethod } = req.body;
    
    const expense = await Expense.findById(expenseId);
    
    // Update expense payment status
    expense.paymentStatus = 'Paid';
    expense.paymentMethod = paymentMethod;
    await expense.save();
    
    // Record accounting transaction (Cash Basis)
    const accountingResult = await DoubleEntryAccountingService.recordVendorPayment(expense, req.user, paymentMethod);
    
    res.json({
      success: true,
      message: 'Vendor paid and accounting recorded',
      transaction: accountingResult.transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### Reporting Controller Example

```javascript
// Get financial reports by accounting basis
exports.getFinancialReport = async (req, res) => {
  try {
    const { basis = 'accrual', dateFrom, dateTo, residence } = req.query;
    
    const transactions = await DoubleEntryAccountingService.getTransactionsByBasis(basis, {
      dateFrom,
      dateTo,
      residence
    });
    
    // Calculate totals
    const totals = transactions.reduce((acc, txn) => {
      if (txn.type === 'payment') {
        acc.cashOut += txn.amount;
      } else if (txn.type === 'approval') {
        acc.accruedExpenses += txn.amount;
      }
      return acc;
    }, { cashOut: 0, accruedExpenses: 0 });
    
    res.json({
      basis,
      transactions,
      totals,
      period: { dateFrom, dateTo }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

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

## 🔍 Testing Scenarios

### Test Case 1: Complete Maintenance Flow
```javascript
// Test the complete flow from request to payment
const testMaintenanceFlow = async () => {
  // 1. Create maintenance request
  const request = createTestRequest();
  
  // 2. Approve request (should create accrual entry)
  const approvalResult = await DoubleEntryAccountingService.recordMaintenanceApproval(request, user);
  expect(approvalResult.transaction.type).toBe('approval');
  
  // 3. Pay vendor (should create cash entry)
  const expense = createTestExpense(request);
  const paymentResult = await DoubleEntryAccountingService.recordVendorPayment(expense, user, 'Ecocash');
  expect(paymentResult.transaction.type).toBe('payment');
};
```

### Test Case 2: Student Rent with Invoice
```javascript
// Test student rent with invoice flow
const testStudentRentFlow = async () => {
  // 1. Create invoice (should create accrual entry)
  const invoice = createTestInvoice();
  const invoiceResult = await DoubleEntryAccountingService.recordInvoiceIssuance(invoice, user);
  expect(invoiceResult.transaction.type).toBe('approval');
  
  // 2. Receive payment (should create cash entry)
  const paymentRecord = createTestPaymentRecord();
  const paymentResult = await DoubleEntryAccountingService.recordInvoicePayment(invoice, paymentRecord, user);
  expect(paymentResult.transaction.type).toBe('payment');
};
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

## 🚀 Getting Started

1. **Initialize Chart of Accounts**:
   ```javascript
   // Run this once to set up basic accounts
   const accounts = [
     { code: '1001', name: 'Bank Account', type: 'Asset' },
     { code: '1003', name: 'Ecocash Wallet', type: 'Asset' },
     { code: '1101', name: 'Accounts Receivable', type: 'Asset' },
     { code: '4001', name: 'Rent Income', type: 'Income' },
     { code: '5001', name: 'Maintenance Expense', type: 'Expense' },
     { code: '5002', name: 'Supplies Expense', type: 'Expense' }
   ];
   ```

2. **Integrate with Existing Controllers**:
   - Add accounting calls to approval endpoints
   - Add accounting calls to payment endpoints
   - Add basis filtering to reporting endpoints

3. **Test with Sample Data**:
   - Create test maintenance requests
   - Create test student payments
   - Verify double-entry balances

This implementation provides a robust, scalable double-entry accounting system that supports both cash and accrual basis accounting while maintaining proper audit trails and transaction integrity. 