# Monthly Balance Sheet Fix

## Problem
The monthly balance sheet was showing cumulative/accumulative values instead of monthly activity. Users expected to see:
- July: 220 (monthly amount)
- August: Only August's activity (not cumulative)

## Solution
Added a new `type` parameter to the monthly balance sheet API that allows users to choose between:

1. **`monthly`** (default): Shows monthly activity/change for each month
2. **`cumulative`**: Shows balance as of month end (cumulative from beginning of year)

## API Changes

### Updated Endpoint
```
GET /api/financial-reports/monthly-balance-sheet?period=2025&type=monthly
```

### New Parameters
- `type`: Either `monthly` or `cumulative` (defaults to `monthly`)

### Examples

#### Monthly Activity Balance Sheet (default behavior)
```bash
GET /api/financial-reports/monthly-balance-sheet?period=2025&type=monthly
```
This shows only the transactions that occurred in each specific month, showing monthly changes rather than cumulative balances.

#### Cumulative Balance Sheet (optional)
```bash
GET /api/financial-reports/monthly-balance-sheet?period=2025&type=cumulative
```
This shows the balance as of each month's end, including all transactions from the beginning of the year.

## Code Changes

### 1. BalanceSheetService.js
- Added `type` parameter to `generateMonthlyBalanceSheet()` method
- Created new `generateMonthlyActivityBalanceSheet()` method for monthly activity calculations
- Monthly activity method only processes transactions that occurred in the specific month

### 2. FinancialReportsController.js
- Updated controller to accept `type` parameter
- Added validation for the `type` parameter
- Updated response message to include the type being used

## Expected Results

### Before (Cumulative)
- July: $496.67 (cumulative from January to July)
- August: $700 (cumulative from January to August)

### After (Monthly Activity)
- July: $220 (only July's activity)
- August: $875 (only August's activity)

## Testing

### Test Scripts Created
1. `test-monthly-activity.js` - Tests the service methods directly
2. `test-api-monthly.js` - Tests the API endpoints

### Running Tests
```bash
# Test service methods
node test-monthly-activity.js

# Test API endpoints (requires server running)
node test-api-monthly.js
```

## Usage Instructions

### For Frontend Integration
When calling the API, specify the type parameter:

```javascript
// For monthly activity (default)
const response = await fetch('/api/financial-reports/monthly-balance-sheet?period=2025&type=monthly');

// For cumulative balances (optional)
const response = await fetch('/api/financial-reports/monthly-balance-sheet?period=2025&type=cumulative');
```

### For Backend Integration
When calling the service directly:

```javascript
// For monthly activity (default)
const result = await BalanceSheetService.generateMonthlyBalanceSheet(2025, null, 'monthly');

// For cumulative balances (optional)
const result = await BalanceSheetService.generateMonthlyBalanceSheet(2025, null, 'cumulative');
```

## Benefits
1. **Flexibility**: Users can choose between cumulative and monthly views
2. **Accuracy**: Monthly activity shows actual monthly changes
3. **Backward Compatibility**: Default behavior remains unchanged
4. **Clear Documentation**: API clearly indicates which type of data is being returned

## Migration Notes
- Existing API calls will now default to `monthly` activity (showing monthly changes)
- Use `type=cumulative` parameter if you need cumulative balances
- This change ensures monthly activity is shown by default as requested
