# Residence Field Fix for Petty Cash Allocation

## Problem Identified

The residence field was being sent correctly from the frontend but was not being returned in the backend response for petty cash operations. This caused a mismatch between what was sent and what was received.

**Frontend sends:**
```javascript
{
  userId: "67c023adae5e27657502e887",
  amount: 200,
  description: "water",
  residence: "67d723cf20f89c4ae69804f3",  // ✅ This was being sent
  date: "2025-08-14",
  sourceAccount: "...",
  targetAccount: "..."
}
```

**Backend was returning:**
```javascript
{
  success: true,
  message: "Petty cash allocated successfully",
  allocation: {
    userId: "67c023adae5e27657502e887",
    userName: "Makomborero Madziwa",
    amount: 200,
    // ❌ Missing: residence field
    date: "2025-08-15T00:42:19.018Z",
    description: "Petty cash allocation: water",
    transactionId: "TXN17552185390181K720"
  }
}
```

## Root Cause

The issue was in two places:

1. **Finance Controller**: The `residence` field was not being extracted from `req.body`
2. **DoubleEntryAccountingService**: The service methods were using hardcoded `getDefaultResidence()` instead of accepting the residence from the request

## Files Modified

### 1. `src/controllers/financeController.js`

**Updated `allocatePettyCash` method:**
- Added `residence` to destructured request body
- Added residence logging for debugging
- Pass residence to the service method
- Include residence in the response

**Updated `recordPettyCashExpense` method:**
- Added `residence` to destructured request body
- Added residence logging for debugging
- Pass residence to the service method
- Include residence in the response

**Updated `replenishPettyCash` method:**
- Added `residence` to destructured request body
- Added residence logging for debugging
- Pass residence to the service method
- Include residence in the response

### 2. `src/services/doubleEntryAccountingService.js`

**Updated `allocatePettyCash` method:**
- Added `residence` parameter with default value
- Use provided residence or fallback to `getDefaultResidence()`
- Added residence logging for debugging

**Updated `recordPettyCashExpense` method:**
- Added `residence` parameter with default value
- Use provided residence or fallback to `getDefaultResidence()`
- Added residence logging for debugging

**Updated `replenishPettyCash` method:**
- Added `residence` parameter with default value
- Use provided residence or fallback to `getDefaultResidence()`
- Added residence logging for debugging

## Changes Made

### Before (Problematic Code):
```javascript
// Controller - missing residence extraction
const { userId, amount, description } = req.body;

// Service - hardcoded default residence
residence: await this.getDefaultResidence(),

// Response - missing residence
allocation: {
    userId,
    userName: `${user.firstName} ${user.lastName}`,
    amount,
    // ❌ Missing residence
}
```

### After (Fixed Code):
```javascript
// Controller - now extracts residence
const { userId, amount, description, residence, sourceAccount, targetAccount } = req.body;

// Service - uses provided residence or falls back to default
residence: residence || await this.getDefaultResidence(),

// Response - now includes residence
allocation: {
    userId,
    userName: `${user.firstName} ${user.lastName}`,
    amount,
    residence: result.transaction.residence // ✅ Now included
}
```

## Testing

Created `test-residence-fix.js` to verify the fix works correctly. The test script:

1. Sends a test allocation request with residence
2. Checks if residence is returned in the response
3. Verifies residence ID matches between request and response
4. Provides detailed debugging information

## Expected Result

After this fix, when you allocate petty cash from the frontend:

1. **Frontend sends**: `residence: "67d723cf20f89c4ae69804f3"`
2. **Backend receives**: Correctly extracts residence from request body
3. **Backend processes**: Uses the provided residence in the transaction
4. **Backend returns**: Includes residence in the response
5. **Frontend receives**: Complete response with residence field

## Benefits

1. **Data Consistency**: Residence field is now properly tracked end-to-end
2. **Better Debugging**: Added logging to help troubleshoot future issues
3. **Flexibility**: Can specify different residences for different allocations
4. **Fallback Safety**: Still works if no residence is provided (uses default)

## Next Steps

1. **Test the fix** using the provided test script
2. **Verify in frontend** that residence is now being returned
3. **Check backend logs** to confirm residence is being processed
4. **Monitor** other petty cash operations to ensure consistency

## Files to Monitor

- `src/controllers/financeController.js` - Main controller logic
- `src/services/doubleEntryAccountingService.js` - Business logic
- Frontend console logs for debugging
- Backend console logs for residence processing

This fix ensures that the residence field is properly handled throughout the entire petty cash allocation flow, from frontend request to backend processing to frontend response.
