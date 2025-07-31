# Template Creation Fix - Field Mapping Issue

## Problem Identified

The frontend was sending template data with incorrect field names, causing the 400 error:

### Frontend Data (Incorrect):
```javascript
{
    title: 'Monthly Requests',
    description: 'Monthly Requests St Kilda',
    residence: '67d723cf20f89c4ae69804f3',
    year: 2025,  // ❌ Should not be sent for templates
    isTemplate: true,
    templateRequests: [...]  // ❌ Should be 'items'
}
```

### Backend Expected (Correct):
```javascript
{
    title: 'Monthly Requests',
    description: 'Monthly Requests St Kilda',
    residence: '67d723cf20f89c4ae69804f3',
    isTemplate: true,
    items: [...]  // ✅ Correct field name
    // No year/month for templates
}
```

## Root Cause

1. **Field Name Mismatch**: Frontend uses `templateRequests` instead of `items`
2. **Extra Fields**: Frontend sends `year` for templates (should be omitted)
3. **Missing Field Mapping**: Backend didn't handle the field name difference

## Solution Implemented

### 1. Updated Controller to Handle Field Mapping

**File:** `src/controllers/monthlyRequestController.js`

**Changes:**
- Added `templateRequests` field to destructuring
- Created field mapping: `const finalItems = items || templateRequests || [];`
- Updated logging to show both field names
- Updated MonthlyRequest creation to use mapped items

**Code Changes:**
```javascript
// Before
const {
    title,
    description,
    residence,
    month,
    year,
    items,
    // ... other fields
} = req.body;

// After
const {
    title,
    description,
    residence,
    month,
    year,
    items,
    templateRequests, // Handle frontend field name
    // ... other fields
} = req.body;

// Map templateRequests to items if provided (frontend compatibility)
const finalItems = items || templateRequests || [];
```

### 2. Enhanced Logging

Added detailed logging to track field mapping:
```javascript
console.log('Monthly request creation attempt:', {
    // ... other fields
    hasItems: !!finalItems,
    hasTemplateRequests: !!templateRequests,
    itemsCount: finalItems.length,
    // ... other fields
});
```

### 3. Updated Error Responses

Enhanced error responses to include field mapping information:
```javascript
receivedData: { 
    title, 
    description, 
    residence, 
    month, 
    year, 
    isTemplate,
    hasItems: !!finalItems,
    hasTemplateRequests: !!templateRequests,
    itemsCount: finalItems.length
}
```

## Testing

Created test script `test-template-creation-fix.js` to verify the fix works with frontend data format.

## Expected Behavior After Fix

### ✅ Template Creation Should Work
- Frontend can send `templateRequests` field
- Backend automatically maps it to `items`
- Templates are created successfully
- No 400 error for field name mismatch

### ✅ Backward Compatibility
- Existing `items` field still works
- Both field names are supported
- No breaking changes

### ✅ Enhanced Debugging
- Clear logging shows which fields are received
- Error messages include field mapping info
- Easy to identify field-related issues

## Frontend Recommendations

### Option 1: Update Frontend (Recommended)
Change the frontend to send the correct field names:
```javascript
// Instead of
{
    templateRequests: [...],
    year: 2025
}

// Send
{
    items: [...],
    // Remove year for templates
}
```

### Option 2: Keep Current Format
The backend now supports both formats, so the frontend can continue using `templateRequests` if needed.

## Files Modified

1. **`src/controllers/monthlyRequestController.js`** - Added field mapping logic
2. **`test-template-creation-fix.js`** - Created test script for verification

## Next Steps

1. **Deploy the updated controller**
2. **Test template creation from frontend**
3. **Verify the 400 error is resolved**
4. **Consider updating frontend to use correct field names**

## Validation Rules for Templates

- ✅ `title` - Required
- ✅ `description` - Required  
- ✅ `residence` - Required
- ✅ `isTemplate` - Must be true
- ✅ `items` or `templateRequests` - Required (with items)
- ❌ `month` - Not allowed for templates
- ❌ `year` - Not allowed for templates (but backend will ignore it)

The fix ensures that templates can be created successfully regardless of whether the frontend sends `items` or `templateRequests`. 