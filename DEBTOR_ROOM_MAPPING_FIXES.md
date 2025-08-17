# Debtor Room Mapping Fixes

## Problem Summary
When creating debtors, the system was incorrectly mapping room details and prices due to several field name mismatches and incorrect data retrieval logic.

## Root Causes Identified

### 1. **Incorrect Field References in Application Model**
- **Issue**: Code was trying to access `application.roomPrice` and `application.roomNumber` which don't exist
- **Correct Fields**: 
  - `application.allocatedRoom` - for the room allocated to the student
  - `application.preferredRoom` - for the room the student preferred
  - `application.currentRoom` - for upgrade requests

### 2. **Incorrect Field References in Residence Model**
- **Issue**: Code was trying to access `residence.roomPrice` which doesn't exist
- **Correct Structure**: Room pricing is stored in `residence.rooms[].price` array

### 3. **Flawed Room Matching Logic**
- **Issue**: Code was using `r.name === roomNumber` for room matching
- **Problem**: The Residence model stores rooms with `roomNumber` field, not `name` field
- **Correct Logic**: Should use `r.roomNumber === roomNumber`

### 4. **Inconsistent Fallback Logic**
- **Issue**: Default room price was set to 150 (unrealistically low)
- **Fix**: Increased to 1200 (more realistic default)

## Files Fixed

### 1. **src/services/debtorService.js** (Main Fix)
- Fixed room number mapping to use `allocatedRoom` and `preferredRoom`
- Fixed room price retrieval from `residence.rooms` array
- Improved room matching logic to use `roomNumber` only
- Added better logging for debugging
- Increased default room price from 150 to 1200

### 2. **clear-and-rebuild-debtors.js**
- Fixed incorrect field references (`application.roomNumber` → `application.allocatedRoom`)
- Fixed room price retrieval logic
- Updated notes generation

### 3. **src/controllers/student/dashboardController.js**
- Fixed incorrect `application.roomPrice` references
- Implemented proper room price retrieval from residence
- Added room price calculation logic

### 4. **fix-debtor-room-prices.js**
- Fixed incorrect `residence.roomPrice` references
- Implemented proper room price retrieval from `residence.rooms` array
- Added fallback logic for room pricing

### 5. **src/services/rentalAccrualService.js**
- Fixed incorrect room matching using `r.name === allocatedRoom`
- Updated to use `r.roomNumber === allocatedRoom` only

### 6. **src/utils/paymentCalculation.js**
- Fixed incorrect room query using `'rooms.name'`
- Fixed room matching logic to use `roomNumber`

### 7. **check-residences-room-pricing.js**
- Fixed incorrect room matching logic

## Correct Data Flow

### Before (Incorrect):
```
Application → application.roomPrice (doesn't exist) → 0
Residence → residence.roomPrice (doesn't exist) → 0
Room Matching → r.name === roomNumber (wrong field) → no match
Fallback → 150 (too low)
```

### After (Correct):
```
Application → application.allocatedRoom → roomNumber
Residence → residence.rooms.find(r => r.roomNumber === roomNumber) → room.price
Room Matching → r.roomNumber === roomNumber (correct field) → match found
Fallback → 1200 (realistic default)
```

## Key Changes Made

1. **Field Name Corrections**:
   - `application.roomNumber` → `application.allocatedRoom`
   - `application.roomPrice` → `residence.rooms[].price`
   - `residence.roomPrice` → `residence.rooms[].price`

2. **Room Matching Logic**:
   - `r.name === roomNumber` → `r.roomNumber === roomNumber`
   - Added proper fallback to first available room with price

3. **Price Retrieval**:
   - Implemented proper room price lookup from residence rooms array
   - Added fallback logic for missing room prices
   - Increased default price from 150 to 1200

4. **Logging Improvements**:
   - Added detailed logging for room price discovery
   - Added warnings when using fallback values

## Testing Recommendations

1. **Test Debtor Creation**:
   - Create a new student with application
   - Verify correct room details and price are mapped
   - Check logs for proper room discovery

2. **Test Existing Debtors**:
   - Run the fix scripts to update existing debtors
   - Verify room prices are correctly updated

3. **Test Edge Cases**:
   - Students without allocated rooms
   - Residences without room pricing
   - Missing application data

## Prevention Measures

1. **Code Review**: Always verify field names against model schemas
2. **Data Validation**: Validate room data exists before processing
3. **Logging**: Add comprehensive logging for debugging
4. **Testing**: Test with various data scenarios
5. **Documentation**: Keep field mappings documented

## Impact

- ✅ **Fixed**: Incorrect room details in debtor creation
- ✅ **Fixed**: Wrong room prices being assigned
- ✅ **Fixed**: Missing room information mapping
- ✅ **Improved**: Fallback logic and error handling
- ✅ **Enhanced**: Logging and debugging capabilities

The debtor creation system should now correctly map room details and prices from applications and residences.
