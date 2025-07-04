# Payment Requirements Update

## Overview
Updated the payment logic to implement residence-specific payment requirements as requested.

## Payment Requirements by Residence

### 1. St Kilda Student House
- **Admin Fee**: $20 (one-time)
- **Deposit**: Required (equal to room rent)
- **Rent**: Monthly room rent
- **Total**: Rent + Admin Fee + Deposit

### 2. Belvedere Student House
- **Admin Fee**: None
- **Deposit**: None
- **Rent**: Monthly room rent only
- **Total**: Rent only

### 3. Other Residences (Newlands, Greendale, etc.)
- **Admin Fee**: None
- **Deposit**: Required (equal to room rent)
- **Rent**: Monthly room rent
- **Total**: Rent + Deposit

## Files Modified

### 1. `src/controllers/student/paymentHistoryController.js`
- Updated payment validation logic in `uploadNewProofOfPayment` function
- Updated payment calculation logic in `getPaymentHistory` function
- Added residence-specific validation rules

### 2. `src/utils/paymentCalculation.js`
- Updated `getRequiredPaymentForStudent` function
- Added residence type detection logic
- Updated breakdown information to include residence type

## Key Changes

### Payment Validation Logic
```javascript
// Determine residence type for payment requirements
const residenceName = residenceRef.name.toLowerCase();
const isStKilda = residenceName.includes('st kilda');
const isBelvedere = residenceName.includes('belvedere');

// Set deposit requirements based on residence
if (isStKilda) {
    // St Kilda: Admin fee + Deposit required
    depositRequired = roomPrice;
} else if (!isBelvedere) {
    // Other residences: Deposit required, no admin fee
    depositRequired = roomPrice;
}
// Belvedere: No deposit, no admin fee (depositRequired remains 0)
```

### Validation Rules
1. **St Kilda**: Validates admin fee, deposit, and rent amounts
2. **Belvedere**: Only validates rent amount, rejects admin fee and deposit
3. **Other Residences**: Validates deposit and rent amounts, rejects admin fee

## Testing
Created `test-payment-logic.js` to verify the payment logic works correctly for different residences.

## Impact
- Students at St Kilda will continue to pay admin fee + deposit + rent
- Students at Belvedere will only pay rent (no admin fee, no deposit)
- Students at other residences will pay deposit + rent (no admin fee)

## Backward Compatibility
- Existing payment records are not affected
- The changes only affect new payment validations
- Students with existing payment history will continue to see their correct balances 