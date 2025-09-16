# Expense Controller Date Approved Fix

## Issue
All expense controllers were using `new Date()` (current date) for expense creation instead of using the `dateApproved` by finance. This caused inaccurate expense dates in financial reports because expenses should be recorded with the date they were approved by finance, not when the system processed them.

## Root Cause
Multiple controllers were hardcoding `new Date()` for:
- `expenseDate` field in expense creation
- `approvedAt` field in request approval
- `requestHistory` dates

## Solution
Updated all expense-related controllers to accept and use `dateApproved` parameter:

### 1. Finance Controller (`src/controllers/financeController.js`)

**Functions Fixed:**
- `approveMaintenanceRequest`
- `approveSupplyPurchase`

**Changes:**
- **Line 24**: Added `dateApproved` to destructuring
- **Line 42**: Added `const approvalDate = dateApproved ? new Date(dateApproved) : new Date();`
- **Line 45**: Changed `request.approvedAt = new Date()` to `request.approvedAt = approvalDate`
- **Line 63**: Changed `expenseDate: new Date()` to `expenseDate: approvalDate`
- **Line 178**: Added `dateApproved` to destructuring for second function
- **Line 196**: Added `const approvalDate = dateApproved ? new Date(dateApproved) : new Date();`
- **Line 199**: Changed `request.approvedAt = new Date()` to `request.approvedAt = approvalDate`
- **Line 217**: Changed `expenseDate: new Date()` to `expenseDate: approvalDate`

```javascript
// Before
const { approvalNotes } = req.body;
request.approvedAt = new Date();
expenseDate: new Date(),

// After
const { approvalNotes, dateApproved } = req.body;
const approvalDate = dateApproved ? new Date(dateApproved) : new Date();
request.approvedAt = approvalDate;
expenseDate: approvalDate,
```

### 2. Request Controller (`src/controllers/requestController.js`)

**Function Fixed:**
- `ceoApproval`

**Changes:**
- **Line 2090**: Added `dateApproved` to destructuring
- **Line 2207**: Added `const approvalDate = dateApproved ? new Date(dateApproved) : new Date();`
- **Line 2214**: Changed `expenseDate: new Date()` to `expenseDate: approvalDate`
- **Line 2233**: Added `const approvalDate = dateApproved ? new Date(dateApproved) : new Date();`
- **Line 2235**: Changed `date: new Date()` to `date: approvalDate`

```javascript
// Before
const { approved, notes } = req.body;
expenseDate: new Date(),
date: new Date(),

// After
const { approved, notes, dateApproved } = req.body;
const approvalDate = dateApproved ? new Date(dateApproved) : new Date();
expenseDate: approvalDate,
date: approvalDate,
```

### 3. Maintenance Controller (`src/controllers/maintenanceController.js`)

**Function Fixed:**
- `updateMaintenance`

**Changes:**
- **Line 149**: Added `dateApproved` to destructuring
- **Line 167**: Added `const approvalDate = dateApproved ? new Date(dateApproved) : new Date();`
- **Line 174**: Changed `expenseDate: new Date()` to `expenseDate: approvalDate`

```javascript
// Before
const { financeStatus, amount, paymentMethod, paymentIcon } = req.body;
expenseDate: new Date(),

// After
const { financeStatus, amount, paymentMethod, paymentIcon, dateApproved } = req.body;
const approvalDate = dateApproved ? new Date(dateApproved) : new Date();
expenseDate: approvalDate,
```

### 4. Finance Maintenance Controller (`src/controllers/finance/maintenanceController.js`)

**Function Fixed:**
- `approveMaintenance`

**Changes:**
- **Line 209**: Added `dateApproved` to destructuring
- **Line 411**: Added `const approvalDate = dateApproved ? new Date(dateApproved) : new Date();`
- **Line 419**: Changed `expenseDate: new Date()` to `expenseDate: approvalDate`
- **Line 424**: Changed `approvedAt: new Date()` to `approvedAt: approvalDate`

```javascript
// Before
const { notes, amount, maintenanceAccount, apAccount, quotationId } = req.body;
expenseDate: new Date(),
approvedAt: new Date(),

// After
const { notes, amount, maintenanceAccount, apAccount, quotationId, dateApproved } = req.body;
const approvalDate = dateApproved ? new Date(dateApproved) : new Date();
expenseDate: approvalDate,
approvedAt: approvalDate,
```

## Impact on Financial Reports

### Before Fix:
- **Expense Date**: Used current date (when system processed the approval)
- **Income Statement**: Expenses appeared in wrong periods
- **Accrual Accounting**: Incorrect expense recognition timing

### After Fix:
- **Expense Date**: Uses actual `dateApproved` by finance
- **Income Statement**: Expenses appear in correct periods
- **Accrual Accounting**: Proper expense recognition timing

## Example

**Maintenance Request:**
- **Request Date**: 2025-08-15 (when maintenance was requested)
- **Finance Approval Date**: 2025-08-20 (when finance approved)
- **System Processing Date**: 2025-09-09 (when system processed)

**Expense Impact:**
- **Before**: Expense appears in September 2025 income statement ❌
- **After**: Expense appears in August 2025 income statement ✅

## API Usage

All approval endpoints now accept `dateApproved` parameter:

```javascript
// Maintenance Request Approval
POST /api/finance/approve-maintenance/:requestId
{
    "approvalNotes": "Approved for maintenance",
    "dateApproved": "2025-08-20"
}

// Supply Purchase Approval
POST /api/finance/approve-supply/:requestId
{
    "approvalNotes": "Approved for supplies",
    "dateApproved": "2025-08-20"
}

// CEO Approval
POST /api/requests/:id/ceo-approval
{
    "approved": true,
    "notes": "CEO approved",
    "dateApproved": "2025-08-20"
}

// Maintenance Update
PUT /api/maintenance/:id
{
    "financeStatus": "approved",
    "amount": 100,
    "dateApproved": "2025-08-20"
}

// Finance Maintenance Approval
POST /api/finance/maintenance/:id/approve
{
    "notes": "Approved",
    "amount": 100,
    "dateApproved": "2025-08-20"
}
```

## Testing
The fix includes fallback to current date if `dateApproved` is not provided, ensuring backward compatibility.

## Deployment Required
**IMPORTANT**: This fix requires deployment to Render for the production server to use the correct approval dates in expense creation.

## Expected Result
After deployment, all expense creation will use the actual finance approval date instead of the system processing date, ensuring accurate financial reporting and proper accrual accounting! 🎉

## Files Modified
- `src/controllers/financeController.js` - 2 functions fixed
- `src/controllers/requestController.js` - 1 function fixed  
- `src/controllers/maintenanceController.js` - 1 function fixed
- `src/controllers/finance/maintenanceController.js` - 1 function fixed

**Total**: 5 expense creation functions now use `dateApproved` instead of `new Date()` ✅


