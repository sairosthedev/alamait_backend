# 📊 Tenant Rental & Payment History Tracking

## Overview

The system tracks tenant rental and payment history through multiple interconnected components, ensuring a complete audit trail across lease periods.

## 🔍 How History is Tracked

### 1. **Rental History (Accruals)**

Rental history is tracked through:

#### **TransactionEntry Records**
- **Monthly Rent Accruals**: `metadata.type: 'rent_accrual'`
  - Created each month via `createStudentRentAccrual()`
  - Contains: month, year, amount, room details
  - Query: `TransactionEntry.find({ 'metadata.studentId': studentId, 'metadata.type': 'rent_accrual' })`

- **Lease Start Transactions**: `metadata.type: 'lease_start'`
  - Created when a new lease begins via `processLeaseStart()`
  - Contains: prorated rent, admin fees, security deposits
  - Query: `TransactionEntry.find({ 'metadata.type': 'lease_start', 'metadata.studentId': studentId })`

#### **Debtor Model - monthsAccrued Array**
```javascript
monthsAccrued: [{
  month: "2025-12",  // YYYY-MM format
  year: 2025,
  amount: 500,
  status: "accrued",
  transactionId: "..."
}]
```

#### **Invoice Records**
- Linked to student via `student` field
- Contains billing period, amounts, due dates
- Query: `Invoice.find({ student: studentId, status: { $ne: 'cancelled' } })`

### 2. **Payment History**

Payment history is tracked through:

#### **Payment Records**
- Direct payment records linked to student
- Contains: amount, date, method, status
- Query: `Payment.find({ student: studentId, status: { $in: ['Confirmed', 'Verified'] } })`

#### **TransactionEntry Records**
- **Payment Transactions**: `source: 'payment'`
  - Created when payments are recorded
  - Contains: amount, payment method, allocation details

- **Advance Payment Transactions**: `source: 'advance_payment'`
  - Created for payments received before lease start
  - Contains: payment month, intended lease start month

#### **Debtor Model - paymentHistory Array**
```javascript
paymentHistory: [{
  paymentId: "...",
  amount: 500,
  allocatedMonth: "2025-12",  // YYYY-MM format
  components: {
    rent: 450,
    adminFee: 20,
    deposit: 30
  },
  paymentMethod: "Bank Transfer",
  paymentDate: Date,
  status: "Confirmed"
}]
```

### 3. **Balance Calculation**

The system calculates balances from **ALL transaction entries** for the debtor's account code, regardless of lease period:

```javascript
// Total Owed = Sum of all accrual transactions (debits to AR account)
totalOwed = accrualTransactions.reduce((sum, tx) => {
    return sum + (tx.entries.find(e => e.accountCode === debtor.accountCode)?.debit || 0);
}, 0);

// Total Paid = Sum of all payment transactions (credits to AR account)
totalPaid = paymentTransactions.reduce((sum, tx) => {
    return sum + (tx.entries.find(e => e.accountCode === debtor.accountCode)?.credit || 0);
}, 0);

// Current Balance = Total Owed - Total Paid
currentBalance = Math.max(0, totalOwed - totalPaid);
```

**Key Point**: The balance is **cumulative across all lease periods** for the same debtor account.

## 🔄 Lease Renewal Scenario

### Scenario: Tenant Lease Expired Dec 2025, Renewed Jan 2026, Balance BF of $300

#### **What Happens:**

1. **Debtor Record Reuse**
   - The system uses the **same Debtor record** (same `accountCode`) for the tenant
   - The debtor record is not reset or cleared
   - Previous balance ($300) remains in `currentBalance`

2. **New Lease Start (Jan 2026)**
   - `processLeaseStart()` creates new transaction entries:
     - New `lease_start` transaction for Jan 2026
     - New monthly accruals for Jan 2026 onwards
   - These are added to the **same debtor account**

3. **Balance Calculation**
   - The system calculates balance from **ALL transactions**:
     ```
     Total Owed = 
       - All 2025 accruals (including the $300 balance)
       + All 2026 accruals (new lease)
     
     Total Paid = 
       - All 2025 payments
       + All 2026 payments
     
     Current Balance = Total Owed - Total Paid
     ```

4. **Result**
   - The $300 balance from 2025 is **automatically included** in the current balance
   - No explicit "balance brought forward" entry is needed
   - The balance is cumulative and continuous

### **Example Transaction Flow:**

```
Dec 2025:
  - Accruals: $500 (rent for Dec)
  - Payments: $200
  - Balance: $300 (carried forward)

Jan 2026 (New Lease):
  - Lease Start: $500 (prorated rent + fees)
  - Accruals: $500 (rent for Jan)
  - Payments: $0
  - Balance: $300 (from 2025) + $500 (lease start) + $500 (Jan rent) = $1,300
```

## 📋 API Endpoints for History

### **Get Student Rental & Payment History**
```
GET /api/rental-accrual/student-history/:studentId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "studentId": "...",
    "totalAccrued": 5000,
    "totalPaid": 4700,
    "outstandingBalance": 300,
    "accruals": [
      {
        "month": "2025-12",
        "year": 2025,
        "amount": 500,
        "date": "2025-12-01",
        "transactionId": "..."
      }
    ],
    "invoices": [...],
    "payments": [...]
  }
}
```

### **Get Debtor Details**
```
GET /api/finance/debtors/:debtorId
```

**Response includes:**
- `currentBalance`: Current outstanding balance (includes all periods)
- `totalOwed`: Total amount owed across all periods
- `totalPaid`: Total payments received across all periods
- `paymentHistory`: Array of all payments with month allocation
- `monthsAccrued`: Array of all monthly accruals

## 🔍 Querying History by Period

### **Get Transactions for Specific Period**

```javascript
// Get all accruals for 2025
const accruals2025 = await TransactionEntry.find({
  'metadata.studentId': studentId,
  'metadata.type': 'rent_accrual',
  'metadata.accrualYear': 2025,
  status: 'posted'
});

// Get all payments for 2025
const payments2025 = await Payment.find({
  student: studentId,
  date: {
    $gte: new Date('2025-01-01'),
    $lt: new Date('2026-01-01')
  },
  status: { $in: ['Confirmed', 'Verified'] }
});
```

### **Calculate Balance for Specific Period**

```javascript
// Calculate balance as of end of 2025
const transactionsUpTo2025 = await TransactionEntry.find({
  'entries.accountCode': debtor.accountCode,
  date: { $lte: new Date('2025-12-31') },
  status: 'posted'
});

let totalOwed2025 = 0;
let totalPaid2025 = 0;

transactionsUpTo2025.forEach(tx => {
  tx.entries.forEach(entry => {
    if (entry.accountCode === debtor.accountCode) {
      if (tx.source === 'rental_accrual') {
        totalOwed2025 += entry.debit || 0;
      } else if (tx.source === 'payment') {
        totalPaid2025 += entry.credit || 0;
      }
    }
  });
});

const balanceEndOf2025 = totalOwed2025 - totalPaid2025; // Should be $300
```

## ⚠️ Important Notes

1. **No Explicit Balance Brought Forward**
   - The system doesn't create a separate "balance brought forward" transaction
   - The balance is calculated cumulatively from all transactions
   - This ensures accuracy and prevents double-counting

2. **Same Account Code Across Renewals**
   - A tenant keeps the same `accountCode` (e.g., "AR0001") across lease renewals
   - This ensures continuity of financial history
   - All transactions reference the same account code

3. **Transaction-Based Totals**
   - Debtor totals (`totalOwed`, `totalPaid`, `currentBalance`) are calculated from transaction entries
   - This ensures data integrity and provides a complete audit trail
   - Totals can be recalculated at any time using `DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactionEntries()`

4. **Month Allocation**
   - Payments are allocated to specific months via `allocatedMonth` field
   - This allows tracking which payments apply to which rental periods
   - Useful for reconciliation and reporting

## 🛠️ Recalculating Totals

If you need to recalculate debtor totals from transactions:

```javascript
const DebtorTransactionSyncService = require('./services/debtorTransactionSyncService');

const debtor = await Debtor.findOne({ user: studentId });
const result = await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactionEntries(
  debtor,
  studentId
);

console.log(`Total Owed: $${result.totalOwed}`);
console.log(`Total Paid: $${result.totalPaid}`);
console.log(`Current Balance: $${result.currentBalance}`);
```

## 📊 Reporting by Period

To generate reports showing balance by period:

1. **Query transactions by date range**
2. **Calculate totals for each period**
3. **Show balance progression over time**

Example:
- Dec 2025: Balance = $300
- Jan 2026: Balance = $300 (bf) + $500 (new accruals) - $0 (payments) = $800
- Feb 2026: Balance = $800 (bf) + $500 (new accruals) - $500 (payments) = $800

## ✅ Summary

- **Rental History**: Tracked via `TransactionEntry` records with `metadata.type: 'rent_accrual'` and `metadata.type: 'lease_start'`
- **Payment History**: Tracked via `Payment` records and `TransactionEntry` records with `source: 'payment'`
- **Balance**: Calculated cumulatively from ALL transactions for the debtor's account code
- **Lease Renewals**: Same debtor account is reused, balance carries forward automatically
- **No Separate BF Entry**: Balance brought forward is implicit in the cumulative calculation
