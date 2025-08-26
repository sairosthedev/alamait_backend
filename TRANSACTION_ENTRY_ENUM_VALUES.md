# TransactionEntry Valid Enum Values

This document lists all valid enum values for the TransactionEntry model to prevent validation errors.

## Source Enum Values

The `source` field must be one of these values:

```javascript
[
  'payment',                    // Student/tenant payments
  'invoice',                    // Invoices issued
  'manual',                     // Manual adjustments
  'adjustment',                 // General adjustments
  'vendor_payment',             // Payments to vendors
  'expense_payment',            // Expense payments
  'rental_accrual',             // Rental income accruals
  'rental_accrual_reversal',    // Rental accrual reversals
  'expense_accrual',            // Expense accruals
  'expense_accrual_reversal',   // Expense accrual reversals
  'petty_cash_payment',         // Petty cash payments
  'petty_cash_allocation',      // Petty cash allocations
  'petty_cash_expense',         // Petty cash expenses
  'petty_cash_replenishment'    // Petty cash replenishments
]
```

## SourceModel Enum Values

The `sourceModel` field must be one of these values:

```javascript
[
  'Payment',           // Payment records
  'Invoice',           // Invoice records
  'Request',           // Request records
  'Vendor',            // Vendor records
  'Expense',           // Expense records
  'Lease',             // Lease records
  'TransactionEntry',  // Other transaction entries
  'User',              // User records
  'PettyCash'          // Petty cash records
]
```

## Status Enum Values

The `status` field must be one of these values:

```javascript
[
  'draft',     // Transaction is in draft mode
  'posted',    // Transaction is posted to accounts
  'reversed'   // Transaction has been reversed
]
```

## Usage Examples

### Petty Cash Payment
```javascript
const pettyCashEntry = new TransactionEntry({
  source: 'petty_cash_payment',
  sourceModel: 'PettyCash',
  sourceId: pettyCashId,
  // ... other fields
});
```

### Student Payment
```javascript
const studentPayment = new TransactionEntry({
  source: 'payment',
  sourceModel: 'Payment',
  sourceId: paymentId,
  // ... other fields
});
```

### Manual Adjustment
```javascript
const manualAdjustment = new TransactionEntry({
  source: 'manual',
  sourceModel: 'Request',
  sourceId: requestId,
  // ... other fields
});
```

## Common Validation Errors

If you get a validation error like:
```
"TransactionEntry validation failed: source: `invalid_source` is not a valid enum value for path `source`."
```

Check that:
1. The `source` value is in the source enum list above
2. The `sourceModel` value is in the sourceModel enum list above
3. The `status` value is in the status enum list above

## Adding New Enum Values

To add new enum values:

1. Update the enum arrays in `src/models/TransactionEntry.js`
2. Update this documentation
3. Test with the new values
4. Consider backward compatibility for existing data

## Recent Additions

The following enum values were recently added to support petty cash operations:
- `petty_cash_payment`
- `petty_cash_allocation` 
- `petty_cash_expense`
- `petty_cash_replenishment`
- `User` (sourceModel)
- `PettyCash` (sourceModel)

