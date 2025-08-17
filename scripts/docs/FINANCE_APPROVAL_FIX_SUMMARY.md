# Finance Approval Fix Summary

## Issue Description

The user reported an inconsistency in the request approval system where:

1. **Field Mismatch**: The data showed `"financeStatus": "approved"` but `"approval.finance.approved": false`
2. **Quotation Approval**: Quotations showed `"isApproved": false` even though finance had approved the request

## Root Cause Analysis

The issue was caused by **two different models** being used incorrectly:

1. **Maintenance Model** - Uses `financeStatus` field
2. **Request Model** - Uses `approval.finance.approved` field

The Request model was incorrectly receiving a `financeStatus` field, which should not exist for Request documents.

## Solution Implemented

### 1. Fixed Finance Approval Logic

**File**: `src/controllers/requestController.js`

**Changes Made**:
- Removed automatic quotation approval when finance approves a request
- Finance approval now only sets `approval.finance.approved = true`
- Quotations remain unapproved until finance manually selects and approves them

**Before**:
```javascript
// ❌ WRONG: Automatically approved first quotation
if (approved) {
    request.quotations[0].isApproved = true;
    request.amount = request.quotations[0].amount;
}
```

**After**:
```javascript
// ✅ CORRECT: Only updates approval status
if (approved) {
    request.status = 'pending-ceo-approval';
    // Quotations remain unapproved until finance manually approves them
}
```

### 2. Correct Finance Approval Flow

The correct flow is now:

1. **Finance approves the request** → Sets `approval.finance.approved = true`
2. **Finance manually selects quotations** → Uses separate endpoints to approve specific quotations
3. **Only selected quotations get approved** → `isApproved = true` for chosen quotations only

### 3. Available Endpoints for Finance

- **`POST /api/requests/:id/finance-approval`** - Approve/reject entire request
- **`POST /api/requests/:id/approve-quotation`** - Approve request-level quotation
- **`POST /api/requests/:id/items/:itemIndex/quotations/:quotationIndex/approve`** - Approve item-level quotation

### 4. Data Fix Script

**File**: `fix-request-finance-approval.js`

**Purpose**: Fixes existing data by:
- Removing incorrect `financeStatus` field from Request documents
- Setting `approval.finance.approved` based on `financeStatus` value
- Ensuring proper approval structure
- **NOT** automatically approving quotations (finance must do this manually)

## Testing

### Test Scripts Created

1. **`test-specific-request.js`** - Tests specific request by ID
2. **`search-gazebo-request.js`** - Searches for gazebo construction request
3. **`test-finance-approval-flow.js`** - Tests the correct approval flow

### Expected Behavior

When finance approves a request:
- ✅ `approval.finance.approved` = `true`
- ✅ `approval.finance.approvedAt` = current timestamp
- ❌ `financeStatus` field should NOT exist (incorrect field)
- ❌ Quotations remain `isApproved = false` until manually approved

## Files Modified

1. **`src/controllers/requestController.js`** - Fixed financeApproval function
2. **`fix-request-finance-approval.js`** - Data fix script
3. **`test-specific-request.js`** - Test script
4. **`search-gazebo-request.js`** - Search script
5. **`test-finance-approval-flow.js`** - Flow test script

## Next Steps

1. **Run the fix script** on production data if needed:
   ```bash
   node fix-request-finance-approval.js
   ```

2. **Test the updated flow** by creating a new request and testing finance approval

3. **Update frontend** to use the correct endpoints for quotation approval

4. **Train finance users** on the correct approval process:
   - First approve the request
   - Then manually select and approve specific quotations

## Key Takeaway

**Finance approval of a request and quotation approval are separate processes**:
- Request approval = `approval.finance.approved = true`
- Quotation approval = `quotation.isApproved = true` (manual selection required)

This ensures finance has full control over which quotations to approve rather than automatic approval of the first quotation. 