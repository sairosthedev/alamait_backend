# 🏦 Debtor Totals Calculation from Transaction Entries

## Overview

Debtor totals (total owed, total paid, current balance) are **automatically calculated from transaction entries** to ensure data accuracy and integrity. This system provides:

- **Real-time accuracy**: Totals always reflect the current state of all transactions
- **Data integrity**: No risk of manual calculation errors or inconsistencies
- **Complete audit trail**: Every total can be traced back to specific transaction entries
- **Automatic updates**: Totals are recalculated whenever transactions are created or modified

## 🔢 Calculation Logic

### **Total Owed Calculation**
```javascript
// Sum of all accrual transactions for the debtor's account
const totalOwed = accrualTransactions.reduce((sum, tx) => {
    return sum + (tx.totalDebit || 0);
}, 0);
```

**Sources:**
- `rental_accrual` transactions with `metadata.type: 'monthly_rent_accrual'`
- `lease_start` transactions (initial lease setup)

### **Total Paid Calculation**
```javascript
// Sum of all payment transactions for the debtor's account
const totalPaid = paymentTransactions.reduce((sum, tx) => {
    return sum + (tx.totalCredit || 0);
}, 0);
```

**Sources:**
- `payment` transactions with `metadata.allocationType: 'payment_allocation'`
- `accounts_receivable_collection` transactions

### **Current Balance Calculation**
```javascript
const currentBalance = Math.max(0, totalOwed - totalPaid);
```

### **Overdue Amount Calculation**
```javascript
const overdueAmount = currentBalance > 0 ? currentBalance : 0;
```

## 📊 Transaction Entry Processing

### **Accrual Transactions (Increase Total Owed)**
```javascript
// Monthly rent accruals
{
    source: 'rental_accrual',
    metadata: {
        type: 'monthly_rent_accrual',
        studentId: 'student_id',
        month: '2025-01'
    },
    entries: [
        {
            accountCode: '1100-student_id', // Debtor account
            debit: 500, // Increases total owed
            credit: 0
        },
        {
            accountCode: '4001', // Rental income account
            debit: 0,
            credit: 500 // Decreases income
        }
    ]
}
```

### **Payment Transactions (Increase Total Paid)**
```javascript
// Student payments
{
    source: 'payment',
    metadata: {
        allocationType: 'payment_allocation',
        studentId: 'student_id',
        month: '2025-01'
    },
    entries: [
        {
            accountCode: '1100-student_id', // Debtor account
            debit: 0,
            credit: 500 // Increases total paid
        },
        {
            accountCode: '1000-001', // Bank account
            debit: 500, // Increases bank balance
            credit: 0
        }
    ]
}
```

## 🔄 Automatic Recalculation

### **When Totals Are Recalculated**

1. **Transaction Creation**: Every time a new transaction is created
2. **Transaction Modification**: When existing transactions are updated
3. **Manual Trigger**: When explicitly called for data verification
4. **Real-time Updates**: Via TransactionEntry post-save hooks

### **Recalculation Methods**

#### **1. Basic Recalculation**
```javascript
await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactions(debtor, studentId);
```

#### **2. Enhanced Recalculation (Recommended)**
```javascript
await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactionEntries(debtor, studentId);
```

#### **3. Bulk Recalculation**
```javascript
await DebtorTransactionSyncService.recalculateAllDebtorTotals();
```

## 📈 Monthly Breakdown

The system also maintains detailed monthly breakdowns:

```javascript
monthlyPayments: [
    {
        month: '2025-01',
        expectedAmount: 500,
        paidAmount: 500,
        outstandingAmount: 0,
        status: 'paid',
        paymentMonths: [
            {
                paymentMonth: '2025-01',
                paymentDate: '2025-01-15',
                amount: 500,
                paymentId: 'transaction_id',
                status: 'Confirmed'
            }
        ]
    }
]
```

## 🔍 Verification and Debugging

### **Verification Script**
Run the verification script to check all debtor totals:

```bash
node scripts/verify_debtor_totals.js
```

### **Manual Verification**
```javascript
// Get transaction entries for a specific debtor
const transactionEntries = await TransactionEntry.find({
    'entries.accountCode': debtor.accountCode
});

// Calculate totals manually
let totalOwed = 0;
let totalPaid = 0;

transactionEntries.forEach(transaction => {
    transaction.entries.forEach(entry => {
        if (entry.accountCode === debtor.accountCode) {
            if (transaction.source === 'rental_accrual' || transaction.source === 'lease_start') {
                totalOwed += entry.debit || 0;
            } else if (transaction.source === 'payment' || transaction.source === 'accounts_receivable_collection') {
                totalPaid += entry.credit || 0;
            }
        }
    });
});

const currentBalance = Math.max(0, totalOwed - totalPaid);
```

## 🚨 Common Issues and Solutions

### **Issue 1: Totals Don't Match Transactions**
**Cause**: Manual updates or data inconsistencies
**Solution**: Run verification script to fix

### **Issue 2: Missing Transaction Entries**
**Cause**: Transaction creation failed or was incomplete
**Solution**: Check transaction logs and recreate if necessary

### **Issue 3: Incorrect Account Codes**
**Cause**: Debtor account code doesn't match transaction entries
**Solution**: Update debtor account code or transaction entries

### **Issue 4: Duplicate Transactions**
**Cause**: Same transaction processed multiple times
**Solution**: Remove duplicate transactions and recalculate

## 📋 Best Practices

1. **Never manually update debtor totals** - Always use transaction-based calculations
2. **Verify totals regularly** - Run verification script periodically
3. **Monitor transaction creation** - Ensure all transactions are properly created
4. **Use enhanced recalculation** - For comprehensive updates with monthly breakdowns
5. **Keep audit logs** - Maintain transaction history for troubleshooting

## 🔧 API Endpoints

### **Get Debtor with Calculated Totals**
```javascript
GET /api/finance/debtors/:debtorId
```

### **Recalculate Debtor Totals**
```javascript
POST /api/finance/debtors/:debtorId/recalculate
```

### **Bulk Recalculation**
```javascript
POST /api/finance/debtors/recalculate-all
```

## 📊 Example Output

```javascript
{
    "debtorCode": "DEBT-001",
    "totalOwed": 1500.00,        // From 3 monthly accruals
    "totalPaid": 1000.00,        // From 2 payments
    "currentBalance": 500.00,    // Outstanding amount
    "overdueAmount": 500.00,     // Same as current balance
    "status": "overdue",
    "monthlyPayments": [
        {
            "month": "2025-01",
            "expectedAmount": 500.00,
            "paidAmount": 500.00,
            "outstandingAmount": 0.00,
            "status": "paid"
        },
        {
            "month": "2025-02",
            "expectedAmount": 500.00,
            "paidAmount": 500.00,
            "outstandingAmount": 0.00,
            "status": "paid"
        },
        {
            "month": "2025-03",
            "expectedAmount": 500.00,
            "paidAmount": 0.00,
            "outstandingAmount": 500.00,
            "status": "unpaid"
        }
    ]
}
```

This system ensures that debtor totals are always accurate and reflect the true state of all financial transactions in the system.
