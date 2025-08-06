# Frontend Quick Reference - Critical Changes

## 🚨 IMMEDIATE CHANGES NEEDED

### 1. **Replace Expense Fetching**
```javascript
// ❌ REMOVE THIS
const response = await fetch('/api/expenses');

// ✅ USE THIS INSTEAD
const response = await fetch('/api/finance/expenses');
```

### 2. **Replace Payment Fetching**
```javascript
// ❌ REMOVE THIS
const response = await fetch('/api/payments');

// ✅ USE THIS INSTEAD
const response = await fetch('/api/finance/payments');
```

### 3. **Replace Financial Reports**
```javascript
// ❌ REMOVE THIS
const response = await fetch('/api/reports/income');

// ✅ USE THIS INSTEAD
const response = await fetch('/api/financial-reports/income-statement');
```

### 4. **Simplify Petty Cash Forms**
```javascript
// ❌ REMOVE account selection dropdown
<select name="accountCode">
  <option value="1001">Bank Account</option>
  <option value="1002">Cash</option>
</select>

// ✅ ONLY keep user selection
<select name="userId">
  <option value="user1">John Doe</option>
  <option value="user2">Jane Smith</option>
</select>
```

### 5. **Remove Manual Account Selection**
```javascript
// ❌ REMOVE all account selection fields
<input name="debitAccount" />
<input name="creditAccount" />
<select name="accountCode" />

// ✅ System handles accounts automatically
```

## 📋 API Endpoint Mapping

| Old Endpoint | New Endpoint |
|--------------|--------------|
| `/api/expenses` | `/api/finance/expenses` |
| `/api/payments` | `/api/finance/payments` |
| `/api/reports/income` | `/api/financial-reports/income-statement` |
| `/api/reports/balance` | `/api/financial-reports/balance-sheet` |
| `/api/reports/cashflow` | `/api/financial-reports/cash-flow` |

## 🔧 Form Changes Required

### Petty Cash Allocation
```javascript
// OLD FORM
<form>
  <input name="userId" />
  <input name="amount" />
  <select name="accountCode" /> // ❌ REMOVE
</form>

// NEW FORM
<form>
  <input name="userId" />
  <input name="amount" />
  // ✅ No account selection needed
</form>
```

### Maintenance Approval
```javascript
// OLD FORM
<form>
  <input name="requestId" />
  <input name="amount" />
  <select name="accountCode" /> // ❌ REMOVE
</form>

// NEW FORM
<form>
  <input name="requestId" />
  <input name="amount" />
  <input name="vendorId" /> // ✅ Add vendor selection
</form>
```

## 📊 Data Structure Changes

### Expense Data
```javascript
// OLD STRUCTURE
{
  id: "expense123",
  amount: 100,
  description: "Plumbing"
}

// NEW STRUCTURE
{
  id: "expense123",
  transactionId: "TXN123456",
  amount: 100, // totalDebit
  description: "Plumbing",
  accountEntries: [
    { accountCode: "5001", debit: 100, credit: 0 },
    { accountCode: "2001", debit: 0, credit: 100 }
  ]
}
```

### Payment Data
```javascript
// OLD STRUCTURE
{
  id: "payment123",
  amount: 200,
  method: "Cash"
}

// NEW STRUCTURE
{
  id: "payment123",
  transactionId: "TXN789012",
  amount: 200, // totalCredit
  method: "Cash",
  accountEntries: [
    { accountCode: "1002", debit: 200, credit: 0 },
    { accountCode: "4001", debit: 0, credit: 200 }
  ]
}
```

## ✅ What Stays the Same

- User authentication
- Basic CRUD operations
- File uploads
- Date handling
- Error handling patterns

## ❌ What Must Change

- All account selection UI
- Manual transaction creation
- Direct database queries for financial data
- Manual balance calculations

## 🎯 Priority Order

1. **HIGHEST**: Update expense and payment fetching
2. **HIGH**: Remove account selection from forms
3. **MEDIUM**: Update financial reports
4. **LOW**: Update data display components

## 🚀 Quick Test

After making changes, test these endpoints:
```bash
GET /api/finance/expenses
GET /api/finance/payments
GET /api/financial-reports/income-statement
```

All should return data in the new format with `transactionId` and `accountEntries`. 