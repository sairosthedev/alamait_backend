# Petty Cash Payment Date Fix

## Issue
When paying with petty cash, the system was using the current date (`new Date()`) instead of the `datePaid` field provided in the request body.

**Example Problem:**
- Request body: `{ datePaid: "2025-08-06", ... }`
- Transaction date: `2025-09-09T13:11:04.506+00:00` (current date instead of provided date)

## Root Cause
The `recordPettyCashExpense` function in `DoubleEntryAccountingService` was hardcoded to use `new Date()` for both:
1. The transaction date
2. The transaction entry date

Both were ignoring the `date` parameter from the request body.

## Solution
Updated both the controller and service to properly handle the `date` field:

### 1. Controller Changes (`src/controllers/financeController.js`)
- **Line 660**: Extract `date` from request body
- **Line 661**: Add `date` to debug logging
- **Line 740**: Pass `date` parameter to service function

```javascript
// Before
const { userId, amount, description, expenseCategory, residence, expenseId } = req.body;

// After  
const { userId, amount, description, expenseCategory, residence, expenseId, date } = req.body;
```

### 2. Service Changes (`src/services/doubleEntryAccountingService.js`)
- **Line 165**: Add `date` parameter to function signature
- **Line 233**: Use provided date or fallback to current date
- **Line 234-238**: Add debug logging for date processing
- **Line 241**: Use `expenseDate` instead of `new Date()` for transaction
- **Line 319**: Use `expenseDate` instead of `new Date()` for transaction entry

```javascript
// Before
static async recordPettyCashExpense(userId, amount, description, expenseCategory, approvedBy, residence = null, expenseId = null) {
    // ...
    date: new Date(), // Transaction
    // ...
    date: new Date(), // TransactionEntry

// After
static async recordPettyCashExpense(userId, amount, description, expenseCategory, approvedBy, residence = null, expenseId = null, date = null) {
    // ...
    const expenseDate = date ? new Date(date) : new Date();
    date: expenseDate, // Transaction
    // ...
    date: expenseDate, // TransactionEntry
```

## Testing
The fix includes debug logging to verify:
- `providedDate`: The date from the request body
- `expenseDate`: The processed date used for the transaction
- `usingProvidedDate`: Boolean indicating if a date was provided

## Deployment Required
**IMPORTANT**: This fix requires deployment to Render for the production server to use the correct dates.

## Expected Result
After deployment, petty cash payments will use the `date` field from the request body instead of the current date:

```javascript
// Request
{
    "userId": "685bf8273a7b8a38526cfe6d",
    "amount": 30,
    "description": "lol",
    "date": "2025-08-06",  // ✅ This date will now be used
    "residence": "67d723cf20f89c4ae69804f3",
    "expenseCategory": "Maintenance"
}

// Response (after fix)
{
    "success": true,
    "message": "Petty cash expense recorded successfully",
    "transaction": {
        "date": "2025-08-06T00:00:00.000Z", // ✅ Correct date
        "transactionId": "TXN1757423464139MZ0JW"
    }
}

// Transaction Entry (after fix)
{
    "transactionId": "TXN1757423464139MZ0JW",
    "date": "2025-08-06T00:00:00.000Z", // ✅ Correct date (not current date)
    "description": "Petty cash expense: lol"
}
```

## Related Functions
This fix also applies to:
- Petty cash expense recording
- Petty cash payment processing
- Any transaction that uses the `recordPettyCashExpense` function
