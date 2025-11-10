# Request Finance Approval Flow

This document explains what happens when finance approves a regular request (not a monthly request).

## Overview

When finance approves a request, the system:
1. Updates the request's finance approval status
2. Changes the overall request status to `pending-ceo-approval`
3. Creates double-entry accounting transactions (for non-financial requests)
4. Creates expense records
5. Handles monthly request deductions (if applicable)

## Approval Process

### 1. **Immediate Status Updates** (Synchronous)

When `financeApproval` is called:

```javascript
// Update finance approval object
request.approval.finance = {
    approved: isApproved,
    rejected: isRejected,
    waitlisted: isWaitlisted,
    approvedBy: user._id,
    approvedByEmail: user.email,
    approvedAt: approvalDate,
    notes: notes || reason || ''
};

// Update finance status
if (isApproved) {
    request.financeStatus = 'approved';
    request.status = 'pending-ceo-approval'; // Moves to CEO approval
} else if (isRejected) {
    request.financeStatus = 'rejected';
    request.status = 'rejected';
} else if (isWaitlisted) {
    request.financeStatus = 'waitlisted';
    request.status = 'waitlisted';
}

// Set dateApproved if provided
if (isApproved && dateApproved) {
    request.dateApproved = dateApproved;
}

// Map totalEstimatedCost to amount for expense creation
if (request.totalEstimatedCost && request.totalEstimatedCost > 0) {
    request.amount = request.totalEstimatedCost;
}

// Add to request history
request.requestHistory.push({
    date: approvalDate,
    action: `Finance ${actionDescription}`,
    user: user._id,
    changes: [`Finance ${actionDescription} the request`]
});

// Save immediately
await request.save();
```

### 2. **Expense and Transaction Creation** (Synchronous - Only for Non-Financial Requests)

**Important**: Financial requests (`type === 'financial'`) do NOT create expenses at this stage. They wait for CEO approval.

For non-financial requests that are approved:

#### A. **Requests with Items** (Complex Requests)

```javascript
// Uses DoubleEntryAccountingService
const financialResult = await DoubleEntryAccountingService.recordMaintenanceApproval(
    request, 
    user, 
    approvalDate
);

// Creates:
// 1. Double-entry transaction (Accrual: Accounts Payable + Expense)
// 2. Expense record linked to the transaction
// 3. Transaction entries for each item

// Updates request
request.convertedToExpense = true;
request.expenseId = financialResult.expense._id;
```

**What gets created:**
- **Double-Entry Transaction**: 
  - Debit: Expense Account (based on item category)
  - Credit: Accounts Payable
- **Expense Record**: One expense per request with itemized details
- **Transaction Entries**: Individual entries for each item

#### B. **Simple Requests** (Without Items)

```javascript
await createSimpleExpenseForRequest(request, user, approvalDate);
```

**What gets created:**
- **Expense Record**: Simple expense with basic details
- **Double-Entry Transaction** (if financial type): Only for financial requests

#### C. **Monthly Request Deductions** (If Applicable)

If the request is linked to a monthly request:

```javascript
if (request.linkedMonthlyRequestId && request.linkedMonthlyRequestItemIndex !== undefined) {
    await MonthlyRequestDeductionService.processDeductionOnApproval(
        request.linkedMonthlyRequestId,
        request.linkedMonthlyRequestItemIndex,
        request.amount,
        request._id,
        user._id
    );
}
```

**What happens:**
- Deducts the amount from the monthly request
- Updates the monthly request's deduction tracking
- Links the maintenance request to the monthly request

### 3. **Error Handling**

If expense creation fails:
- Request status is still updated to `pending-ceo-approval`
- `convertedToExpense` is set to `true` to prevent retry loops
- Error is logged but doesn't block the approval
- Manual expense creation may be needed

## Status Flow

```
pending → pending-ceo-approval (after finance approval)
         ↓
      rejected (if finance rejects)
         ↓
      waitlisted (if finance waitlists)
```

**Note**: For financial requests, expense creation is deferred until CEO approval.

## Request Types and Behavior

### 1. **Non-Financial Requests** (maintenance, operational, administrative)
- ✅ Creates expenses immediately
- ✅ Creates double-entry transactions
- ✅ Status: `pending-ceo-approval`
- ✅ Ready for CEO approval

### 2. **Financial Requests** (`type === 'financial'`)
- ❌ Does NOT create expenses at finance approval
- ❌ Does NOT create double-entry transactions
- ✅ Status: `pending-ceo-approval`
- ✅ Expenses created after CEO approval

### 3. **Requests with Items**
- ✅ Creates itemized expenses
- ✅ Creates double-entry transactions for each item
- ✅ Links all expenses to the request

### 4. **Simple Requests** (No Items)
- ✅ Creates single expense record
- ✅ Creates double-entry transaction (if applicable)

## Accounting Flow

### Double-Entry Transaction Structure

For each approved request:

```
Debit:  Expense Account (e.g., Maintenance, Utilities)
Credit: Accounts Payable
```

**Example:**
- Request: "Fix broken window" - $500
- Debit: Maintenance Expense - $500
- Credit: Accounts Payable - $500

This follows **accrual accounting** principles:
- Expense is recorded when approved (not when paid)
- Liability (Accounts Payable) is created
- Payment will reduce Accounts Payable later

## API Endpoint

```
PATCH /api/requests/:id/finance-approval
```

**Request Body:**
```json
{
  "approved": true,
  "notes": "Approved for payment",
  "dateApproved": "2025-01-15",
  "createDoubleEntryTransactions": true
}
```

**Response:**
```json
{
  "financeStatus": "approved",
  "status": "pending-ceo-approval",
  "convertedToExpense": true,
  "financial": {
    "transactionId": "TXN-123456",
    "expenseId": "EXP-123456",
    "entriesCount": 3,
    "totalAmount": 1500,
    "status": "created",
    "message": "Double-entry transactions and expense created successfully"
  }
}
```

## Permissions

Only users with these roles can approve requests:
- `finance`
- `finance_admin`
- `finance_user`

## Key Differences from Monthly Request Approval

| Feature | Regular Request | Monthly Request |
|---------|----------------|----------------|
| Expense Creation | ✅ Immediate (non-financial) | ❌ Disabled by default |
| Status After Approval | `pending-ceo-approval` | `approved` |
| Double-Entry Transactions | ✅ Created | ❌ Not created |
| CEO Approval Required | ✅ Yes | ❌ No |
| Monthly Request Deduction | ✅ If linked | N/A |

## Important Notes

1. **Financial Requests**: Expenses are NOT created until CEO approval
2. **Error Recovery**: If expense creation fails, approval still succeeds
3. **Monthly Request Links**: Deductions are processed automatically
4. **Date Handling**: Uses `dateApproved` if provided, otherwise uses current date
5. **Amount Mapping**: `totalEstimatedCost` is mapped to `amount` field

## Related Files

- `src/controllers/requestController.js` - Main finance approval controller
- `src/services/doubleEntryAccountingService.js` - Creates accounting entries
- `src/services/monthlyRequestDeductionService.js` - Handles monthly request deductions
- `src/models/Request.js` - Request model
- `src/models/Expense.js` - Expense model

