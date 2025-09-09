# Petty Cash Allocation Date Fix

## Issue
The petty cash allocation was using the current date (`new Date()`) instead of the `date` field provided in the request body.

**Example Problem:**
- Request body: `{ date: "2025-08-08", ... }`
- Response: `{ date: "2025-09-09T13:04:07.343Z" }` (current date instead of provided date)

## Root Cause
The `allocatePettyCash` function in `DoubleEntryAccountingService` was hardcoded to use `new Date()` for both:
1. The transaction date
2. The transaction entry date

Both were ignoring the `date` parameter from the request body.

## Solution
Updated both the controller and service to properly handle the `date` field:

### 1. Controller Changes (`src/controllers/financeController.js`)
- **Line 585**: Extract `date` from request body
- **Line 586**: Add `date` to debug logging
- **Line 625**: Pass `date` parameter to service function

```javascript
// Before
const { userId, amount, description, residence, sourceAccount, targetAccount } = req.body;

// After  
const { userId, amount, description, residence, sourceAccount, targetAccount, date } = req.body;
```

### 2. Service Changes (`src/services/doubleEntryAccountingService.js`)
- **Line 36**: Add `date` parameter to function signature
- **Line 77**: Use provided date or fallback to current date
- **Line 78-82**: Add debug logging for date processing
- **Line 85**: Use `allocationDate` instead of `new Date()` for transaction
- **Line 123**: Use `allocationDate` instead of `new Date()` for transaction entry

```javascript
// Before
static async allocatePettyCash(userId, amount, description, allocatedBy, residence = null) {
    // ...
    date: new Date(), // Transaction
    // ...
    date: new Date(), // TransactionEntry

// After
static async allocatePettyCash(userId, amount, description, allocatedBy, residence = null, date = null) {
    // ...
    const allocationDate = date ? new Date(date) : new Date();
    date: allocationDate, // Transaction
    // ...
    date: allocationDate, // TransactionEntry
```

## Testing
The fix includes debug logging to verify:
- `providedDate`: The date from the request body
- `allocationDate`: The processed date used for the transaction
- `usingProvidedDate`: Boolean indicating if a date was provided

## Deployment Required
**IMPORTANT**: This fix requires deployment to Render for the production server to use the correct dates.

## Expected Result
After deployment, petty cash allocations will use the `date` field from the request body instead of the current date:

```javascript
// Request
{
    "userId": "685bf8273a7b8a38526cfe6d",
    "amount": 45,
    "description": "yes",
    "date": "2025-08-08",
    "residence": "67d723cf20f89c4ae69804f3"
}

// Response (after fix)
{
    "success": true,
    "allocation": {
        "date": "2025-08-08T00:00:00.000Z", // ✅ Uses provided date
        "transactionId": "TXN1757423047343GADP2",
        // ... other fields
    }
}
```
