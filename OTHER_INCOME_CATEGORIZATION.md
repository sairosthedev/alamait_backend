# What is Categorized as "Other Income" in Cash Flow

## Overview

`other_income` is the **default catch-all category** for income transactions that don't match any of the specific income categories. It includes income that doesn't fit into:
- Rental Income
- Admin Fees
- Deposits
- Utilities
- Advance Payments

## Two Processing Paths

The cash flow service processes income through two different paths:

### Path 1: Income Account Types (AccountType === 'Income')

For transactions with `accountType === 'Income'` or `accountType === 'income'`:

**Categorization Logic:**
1. **Rental Income** (`4001`):
   - Account code starts with `4001` OR
   - Account name includes `'rent'`

2. **Admin Fees** (`4002`):
   - Account code starts with `4002` OR
   - Account name includes `'admin'`

3. **Deposits** (`4003` or liability accounts):
   - Account code starts with `4003` OR
   - Account name includes `'deposit'` OR
   - Account code is `2028`, `20002`, `2020`, `2002`, `20020` OR
   - Account code starts with `200` AND account name includes both `'security'` AND `'deposit'` OR
   - Transaction is identified as a deposit transaction

4. **Utilities** (`4004`):
   - Account code starts with `4004` OR
   - Account name includes `'utilit'`

5. **Other Income** (default):
   - **Any Income account that doesn't match the above patterns**
   - Examples:
     - Account codes like `4000`, `4005`, `4006`, `4010`, etc.
     - Income accounts with names that don't include keywords like 'rent', 'admin', 'deposit', 'utilit'
     - Any other income account codes not specifically categorized

**Exclusions:**
- Balance sheet adjustments are excluded (see below)

### Path 2: Cash Account Debits (Money Received)

For cash account debits (money received into cash/bank accounts):

**Default Category:** `other_income`

**Then checks description/metadata to recategorize:**

1. **Admin Fees**:
   - Description includes `'admin'` OR
   - `metadata.paymentType === 'admin'` OR
   - `metadata.paymentType === 'advance_admin'`

2. **Advance Payments**:
   - Description includes `'advance'`, `'prepaid'`, or `'future'` OR
   - Payment date is before allocation month (for rent/admin) OR
   - Transaction source is `'advance_payment'` OR
   - `entry.sourceModel === 'AdvancePayment'`

3. **Rental Income**:
   - Description includes `'rent'`, `'rental'`, `'accommodation'` OR
   - Description includes `'payment allocation: rent'` (and not an advance payment)

4. **Other Income** (if none of the above match):
   - **Any cash receipt that doesn't match the above description patterns**
   - Examples:
     - Miscellaneous income
     - Unidentified payments
     - Income from other sources not specifically categorized

## Balance Sheet Adjustments (Excluded)

**Balance sheet adjustments are excluded from `other_income`** (and all income categories). These include transactions with:

**Description Patterns:**
- `'opening balance'`
- `'opening balances'`
- `'opening bank'`
- `'balance adjustment'`
- `'take on balances'`
- `'take on balances from excel'`
- `'funds to petty cash'`
- `'funds from vault'`
- `'funds to vault'`
- `'internal transfer'`
- `'clearing account'`
- `'journal entry'`
- `'balance sheet'`
- `'account reclassification'`
- `'account transfer'`

**Transaction ID Patterns:**
- Starts with `'ADJ-'`
- Starts with `'JE-'`
- Starts with `'BS-'`

**Reference Patterns:**
- Starts with `'ADJ-'`
- Starts with `'JE-'`
- Starts with `'BS-'`

## Summary: What Goes into Other Income

### Income Account Types:
- ✅ Income accounts with codes like `4000`, `4005`, `4006`, `4010`, etc. (not 4001-4004)
- ✅ Income accounts with names that don't include: 'rent', 'admin', 'deposit', 'utilit'
- ✅ Any other income account codes not specifically categorized

### Cash Receipts:
- ✅ Cash receipts with descriptions that don't include: 'admin', 'advance', 'prepaid', 'future', 'rent', 'rental', 'accommodation'
- ✅ Miscellaneous income
- ✅ Unidentified payments
- ✅ Income from other sources

### Excluded:
- ❌ Balance sheet adjustments
- ❌ Internal transfers
- ❌ Opening balances
- ❌ Journal entries

## Example Account Codes That Would Be "Other Income"

- `4000` - General Income (if not specifically categorized)
- `4005` - Other Revenue
- `4006` - Miscellaneous Income
- `4010` - Service Income
- `4011` - Consulting Income
- `4012` - Interest Income
- Any other income account codes not matching 4001-4004 patterns

## How to Find the Source of Other Income

In the cash flow response, check:
```
data.detailed_breakdown.income.by_source.other_income.transactions
```

This array contains all transactions contributing to `other_income`, with details:
- `transactionId`
- `date`
- `amount`
- `accountCode`
- `accountName`
- `description`
- `residence`

## Recommendations

If you see unexpected amounts in `other_income`:
1. Check the transaction details in the response
2. Review the `accountCode` and `accountName` to see if they should be categorized differently
3. Consider adding specific account codes to the categorization logic if they represent a recurring income type
4. Verify that the transactions aren't balance sheet adjustments that should be excluded

