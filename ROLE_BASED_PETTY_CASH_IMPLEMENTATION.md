# Role-Based Petty Cash Implementation

## Overview
This implementation updates the petty cash system to use different petty cash accounts based on user roles, providing better financial tracking and accountability.

## Changes Made

### 1. Database Updates
- **Original Account**: `1010 - Petty Cash` → `1010 - General Petty Cash`
- **New Role-Specific Accounts**:
  - `1011 - Admin Petty Cash` (for admin users)
  - `1012 - Finance Petty Cash` (for finance_admin and finance_user roles)
  - `1013 - Property Manager Petty Cash` (for property_manager role)
  - `1014 - Maintenance Petty Cash` (for maintenance role)

### 2. New Utility Function
Created `src/utils/pettyCashUtils.js` with:
- `getPettyCashAccountByRole(userRole)` - Returns appropriate petty cash account based on user role
- `getAllPettyCashAccounts()` - Returns all petty cash accounts

### 3. Updated Controllers

#### Petty Cash Controller (`src/controllers/finance/pettyCashController.js`)
- Updated `allocatePettyCash()` to use role-based petty cash accounts
- Updated `createPettyCashUsage()` to use role-based petty cash accounts
- Updated `createPettyCashEntry()` to use role-based petty cash accounts
- Updated `getPettyCashBalance()` to show balance for current user's role

#### Expense Controller (`src/controllers/finance/expenseController.js`)
- Updated payment method handling to use role-based petty cash accounts
- Removed hardcoded petty cash account code from payment method mapping

#### Other Income Controller (`src/controllers/finance/otherIncomeController.js`)
- Updated payment method handling to use role-based petty cash accounts
- Removed hardcoded petty cash account code from payment method mapping

### 4. Updated Seed Script
Updated `src/scripts/seedAccounts.js` to include all role-based petty cash accounts for future deployments.

## Role Mapping

| User Role | Petty Cash Account | Account Code |
|-----------|-------------------|--------------|
| admin | Admin Petty Cash | 1011 |
| finance_admin | Finance Petty Cash | 1012 |
| finance_user | Finance Petty Cash | 1012 |
| property_manager | Property Manager Petty Cash | 1013 |
| maintenance | Maintenance Petty Cash | 1014 |
| student | General Petty Cash | 1010 |
| unknown/other | General Petty Cash | 1010 |

## Benefits

1. **Better Financial Tracking**: Each role has its own petty cash account for clearer financial reporting
2. **Improved Accountability**: Transactions are properly categorized by user role
3. **Enhanced Reporting**: Can generate role-specific petty cash reports
4. **Backward Compatibility**: Existing functionality continues to work with the general petty cash account as fallback

## Testing

The implementation has been tested to ensure:
- All role-based accounts are created correctly
- Utility functions return the correct accounts for each role
- Controllers properly use role-based accounts
- Fallback to general petty cash works for unknown roles

## Usage

The system automatically uses the appropriate petty cash account based on the user's role when:
- Allocating petty cash to users
- Creating petty cash usage entries
- Processing expense payments via petty cash
- Processing income receipts via petty cash
- Viewing petty cash balances 