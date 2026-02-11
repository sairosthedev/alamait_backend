# Debtor Duplicate Prevention Guide

This document outlines all the protections in place to prevent duplicate debtors and ensure all debtors are properly linked to users.

## Database-Level Protections

1. **Unique User Constraint**: The `user` field in the Debtor schema has `unique: true`, preventing multiple debtors for the same user ID at the database level.

2. **Unique Account Code**: The `accountCode` field has `unique: true`, ensuring each debtor has a unique account code.

3. **Unique Debtor Code**: The `debtorCode` field has `unique: true`, ensuring each debtor has a unique code.

## Application-Level Protections

### 1. `createDebtorForStudent` Service (Primary Method)

**Location**: `src/services/debtorService.js`

**Protections**:
- ✅ Checks for existing debtor by **user ID**
- ✅ Checks for existing debtor by **account code** (`1100-{userId}`)
- ✅ Checks for existing debtor by **email address** (case-insensitive)
- ✅ If found by email but different user ID, updates the debtor to use the correct user ID
- ✅ Final race condition check before creating
- ✅ Always links debtor to user (required field)
- ✅ Uses correct account code format: `1100-{userId}`

**Used by**:
- Application approval process
- Student creation (admin)
- Payment processing
- Invoice creation
- User registration (auto-linking)

### 2. `createDebtor` Controller (Manual Creation)

**Location**: `src/controllers/finance/debtorController.js`

**Protections** (Updated):
- ✅ Checks for existing debtor by **user ID**
- ✅ Checks for existing debtor by **email address** (case-insensitive)
- ✅ Always links debtor to user (required field)
- ✅ Uses correct account code format: `1100-{userId}`

**Note**: This endpoint is for manual debtor creation and should be used sparingly. Most debtor creation should go through `createDebtorForStudent`.

## Prevention Strategy

### For Duplicates:
1. **Email Check**: All debtor creation paths check for existing debtors by email
2. **User ID Check**: All paths check for existing debtors by user ID
3. **Account Code Check**: The primary service also checks by account code
4. **Database Constraints**: Unique constraints prevent duplicates at DB level

### For Unlinked Debtors:
1. **Required Field**: The `user` field is required in the schema
2. **Always Set**: All creation paths explicitly set the `user` field
3. **Account Code Extraction**: Scripts can extract user ID from account code (`1100-{userId}`) to link existing debtors

## Maintenance Scripts

### 1. `scripts/fixDuplicateDebtors.js`
- Finds duplicate debtors by email
- Keeps the best one (active, has user, most recent)
- Deletes duplicates

### 2. `scripts/linkDebtorsToUsers.js`
- Finds debtors without user links
- Links them by extracting user ID from account code
- Falls back to email or name matching

### 3. `scripts/fixDebtorAccountCodes.js`
- Fixes incorrect account codes
- Ensures all use format: `1100-{userId}`

## Best Practices

1. **Always use `createDebtorForStudent`**: This is the recommended method for creating debtors as it has all the duplicate checks.

2. **Avoid Direct Debtor Creation**: Don't use `new Debtor()` directly unless absolutely necessary and you've added duplicate checks.

3. **Run Maintenance Scripts**: Periodically run the maintenance scripts to fix any issues:
   ```bash
   node scripts/fixDuplicateDebtors.js --fix
   node scripts/linkDebtorsToUsers.js --fix
   node scripts/fixDebtorAccountCodes.js --fix
   ```

4. **Monitor for Issues**: Check for:
   - Debtors with `user: null` or missing user
   - Multiple debtors with the same email
   - Debtors with incorrect account codes

## Code Paths That Create Debtors

All these paths use `createDebtorForStudent` (with protections):
- ✅ `src/controllers/admin/applicationController.js` - Application approval
- ✅ `src/controllers/admin/studentController.js` - Student creation
- ✅ `src/controllers/finance/paymentController.js` - Payment processing
- ✅ `src/controllers/invoiceController.js` - Invoice creation
- ✅ `src/services/paymentService.js` - Payment service
- ✅ `src/models/User.js` - User auto-linking
- ✅ `src/middleware/autoCreateDebtor.js` - Auto-creation middleware

Manual creation (now with protections):
- ✅ `src/controllers/finance/debtorController.js` - Manual debtor creation

## Future Prevention

To ensure no duplicates or unlinked debtors in the future:

1. **All new code** that creates debtors must use `createDebtorForStudent`
2. **Code reviews** should check for direct `new Debtor()` usage
3. **Database migrations** should validate data integrity
4. **Automated tests** should verify duplicate prevention

## Summary

✅ **Duplicate Prevention**: Multiple layers of checks (user ID, email, account code) + database constraints
✅ **User Linking**: Required field + always set in all creation paths
✅ **Maintenance Tools**: Scripts available to fix existing issues
✅ **Code Standardization**: All paths use the protected service method

The system is now protected against duplicates and unlinked debtors at multiple levels.
