# Trade Payables Balance Sheet Implementation

## Overview
The system properly handles trade payables (accounts payable) in the balance sheet by creating liabilities when expenses are incurred and settling them when payments are made. This follows proper accrual accounting principles.

## Trade Payables Flow

### 1. **When Expense is Incurred** (Accrual Transaction)
**Date Used**: `dateRequested` (when expense was incurred)
**Transaction Type**: `expense_accrual`
**Balance Sheet Impact**: **Increases Trade Payables**

```javascript
// Accrual Transaction (recordMaintenanceApproval)
const entries = [
    // Debit: Expense Account (increases expense)
    {
        accountCode: expenseAccountCode,
        accountName: expenseAccountName,
        accountType: 'Expense',
        debit: amount,
        credit: 0,
        description: `${expenseAccountName}: ${item.description}`
    },
    // Credit: Accounts Payable (increases liability)
    {
        accountCode: await this.getOrCreateVendorPayableAccount(vendorId, provider),
        accountName: `Accounts Payable: ${provider}`,
        accountType: 'Liability',
        debit: 0,
        credit: amount,  // ← INCREASES TRADE PAYABLES
        description: `Payable to ${provider}`
    }
];
```

### 2. **When Expense is Paid** (Payment Transaction)
**Date Used**: `datePaid` (when payment was made)
**Transaction Type**: `vendor_payment`
**Balance Sheet Impact**: **Decreases Trade Payables**

```javascript
// Payment Transaction (recordVendorPayment)
const entries = [
    // Debit: Accounts Payable (decreases liability)
    {
        accountCode: await this.getOrCreateVendorPayableAccount(expense.vendorId, expense.vendorName),
        accountName: `Accounts Payable: ${expense.vendorName}`,
        accountType: 'Liability',
        debit: amount,  // ← DECREASES TRADE PAYABLES
        credit: 0,
        description: `Settle payable to ${expense.vendorName}`
    },
    // Credit: Cash/Bank (decreases asset)
    {
        accountCode: await this.getPaymentSourceAccount(paymentMethod),
        accountName: this.getPaymentAccountName(paymentMethod),
        accountType: 'Asset',
        debit: 0,
        credit: amount,
        description: `Payment via ${paymentMethod}`
    }
];
```

## Balance Sheet Impact by Date

### **January 2024 Example**
**Scenario**: Maintenance request made Jan 15, paid Feb 10

#### **January 2024 Balance Sheet** (as of Jan 31)
- **Trade Payables**: +$500 (liability created when expense incurred)
- **Cash**: No change (payment not yet made)
- **Expenses**: +$500 (expense recognized in income statement)

#### **February 2024 Balance Sheet** (as of Feb 28)
- **Trade Payables**: $0 (liability settled when payment made)
- **Cash**: -$500 (cash outflow when payment made)
- **Expenses**: No change (expense already recognized in January)

## Account Structure

### **Main Accounts Payable Account**
- **Code**: `2000`
- **Name**: `Accounts Payable`
- **Type**: `Liability`

### **Vendor-Specific Accounts Payable**
- **Code**: `2000{VendorCode}` (e.g., `2000001`, `2000002`)
- **Name**: `Accounts Payable: {VendorName}`
- **Type**: `Liability`
- **Parent**: `2000` (main AP account)

## Balance Sheet Calculation

### **Trade Payables Balance**
```javascript
// Get total trade payables including all vendor accounts
static async getAccountsPayableWithChildren(asOfDate, residenceId = null) {
    // Get main account 2000 balance
    let totalBalance = await this.getAccountBalance('2000', asOfDate, residenceId);
    
    // Add all child vendor accounts
    const childAccounts = await Account.find({ 
        parentAccount: mainAPAccount._id,
        isActive: true
    });
    
    for (const childAccount of childAccounts) {
        const childBalance = await this.getAccountBalance(childAccount.code, asOfDate, residenceId);
        totalBalance += childBalance;
    }
    
    return totalBalance;
}
```

## Financial Statement Integration

### **Balance Sheet**
- **Current Liabilities**: Trade Payables (outstanding vendor obligations)
- **Current Assets**: Cash (reduced when payments made)

### **Income Statement**
- **Operating Expenses**: Recognized when expense incurred (`dateRequested`)

### **Cash Flow Statement**
- **Operating Activities**: Cash outflow when payments made (`datePaid`)

## Example Timeline

### **Maintenance Request: $500**
1. **Jan 15**: Request submitted (`dateRequested`)
2. **Jan 20**: Request approved → Accrual transaction created
   - **Balance Sheet**: Trade Payables +$500
   - **Income Statement**: Maintenance Expense +$500
3. **Feb 10**: Payment made (`datePaid`) → Payment transaction created
   - **Balance Sheet**: Trade Payables -$500, Cash -$500
   - **Cash Flow**: Operating Cash Outflow -$500

## Key Benefits

1. **Accurate Liability Tracking**: Shows outstanding vendor obligations
2. **Proper Cash Flow**: Reflects actual payment timing
3. **Accrual Compliance**: Expenses recognized when incurred
4. **Vendor Management**: Individual vendor account tracking
5. **Financial Reporting**: Accurate balance sheet presentation

## Database Schema

### **TransactionEntry Model**
```javascript
{
    transactionId: String,
    date: Date,  // Uses dateRequested for accrual, datePaid for payment
    source: 'expense_accrual' | 'vendor_payment',
    entries: [
        {
            accountCode: String,  // 2000 or 2000{VendorCode}
            accountName: String,
            accountType: 'Liability',
            debit: Number,   // Increases when paid, decreases liability
            credit: Number,  // Increases when incurred, increases liability
            description: String
        }
    ]
}
```

### **Account Model**
```javascript
{
    code: String,        // '2000' or '2000{VendorCode}'
    name: String,        // 'Accounts Payable' or 'Accounts Payable: {Vendor}'
    type: 'Liability',
    parentAccount: ObjectId,  // Links to main 2000 account
    isActive: Boolean
}
```

## Validation Rules

### **Accrual Transaction**
- Must have `dateRequested` (when expense incurred)
- Creates liability (credit accounts payable)
- Recognizes expense (debit expense account)

### **Payment Transaction**
- Must have `datePaid` (when payment made)
- Settles liability (debit accounts payable)
- Reduces cash (credit cash account)
- `datePaid` cannot be earlier than `dateRequested`

## Testing

### **Test Scenarios**
1. **Create expense with future payment date**
2. **Verify trade payables increase on accrual date**
3. **Verify trade payables decrease on payment date**
4. **Check balance sheet shows correct trade payables balance**

### **Test Commands**
```bash
# Test trade payables flow
node test-trade-payables-flow.js

# Verify balance sheet
GET /api/financial-reports/balance-sheet?period=2024-01
GET /api/financial-reports/balance-sheet?period=2024-02
```

## Summary

The system correctly handles trade payables by:
1. **Creating liabilities** when expenses are incurred (`dateRequested`)
2. **Settling liabilities** when payments are made (`datePaid`)
3. **Using proper dates** for balance sheet calculations
4. **Maintaining vendor-specific accounts** for detailed tracking
5. **Following accrual accounting principles** for accurate financial reporting

This ensures that the balance sheet accurately reflects outstanding vendor obligations and cash flow timing.


