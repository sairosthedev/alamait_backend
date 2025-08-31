# Complete Transaction System Documentation

## Overview

The system now implements a comprehensive double-entry accounting system for student housing with proper transaction tracking for:
- **Prorated First Month Rent** (based on actual days in the month)
- **Monthly Rent Accruals** (full months after the first)
- **Security Deposits** (typically 1 month's rent)

## Transaction Types

### 1. Lease Start Transaction (Comprehensive First Month)
- **Type**: `rental_accrual` with `metadata.type: 'lease_start'`
- **Amount**: Prorated rent + Admin fee + Security deposit
- **Components**:
  - **Prorated Rent**: `(Monthly Rent ÷ Days in Month) × Days from Start Date to End of Month`
  - **Admin Fee**: $20 (standard fee)
  - **Security Deposit**: 1 month's rent
- **Example**: Student starts May 10th with $180/month rent
  - May has 31 days
  - Days from May 10th to May 31st = 22 days
  - Prorated rent = ($180 ÷ 31) × 22 = $127.74
  - Admin fee = $20
  - Security deposit = $180
  - **Total lease start amount = $327.74**

### 2. Monthly Rent Accruals
- **Type**: `rental_accrual` with `metadata.type: 'monthly_rent_accrual'`
- **Amount**: Full monthly rent amount
- **Frequency**: Monthly from second month until lease end
- **Example**: $180/month for remaining months

### 3. Security Deposit Transaction
- **Type**: `rental_accrual` with `metadata.type: 'security_deposit'`
- **Amount**: Typically 1 month's rent
- **Purpose**: Held as liability until lease end
- **Example**: $180 deposit for $180/month rent

## Account Structure

### Student AR Account (1100-series)
- **Format**: `1100-{studentId}`
- **Type**: Asset (Accounts Receivable)
- **Purpose**: Tracks amounts owed by individual students

### Rental Income Account (4001)
- **Code**: `4001`
- **Type**: Income
- **Purpose**: Records rental revenue

### Security Deposit Liability Account (2020)
- **Code**: `2020`
- **Type**: Liability
- **Purpose**: Tracks security deposits held from tenants

## Transaction Examples

### Complete Student Example: Cindy Gwekwerere
- **Monthly Rent**: $180
- **Lease Start**: May 10, 2025
- **Lease End**: September 29, 2025 (5 months)

#### Transactions Created:
1. **Lease Start (Comprehensive)**: $327.74 (May 10-31, 2025)
   - Prorated rent: $127.74
   - Admin fee: $20
   - Security deposit: $180
2. **Monthly Accrual**: $180 (June 2025)
3. **Monthly Accrual**: $180 (July 2025)
4. **Monthly Accrual**: $180 (August 2025)
5. **Monthly Accrual**: $180 (September 2025 - full month)

#### Total Owed: $1,047.74
- Rent: $847.74 (4 months + prorated first month)
- Admin fees: $20
- Security deposit: $180

## Implementation Details

### Excel Upload Process
When uploading students via Excel, the system automatically creates:
1. **User record**
2. **Application record**
3. **Debtor record**
4. **Transaction entries**:
   - Comprehensive lease start transaction (prorated rent + admin fee + deposit)
   - Monthly accrual transactions for remaining months (up to current month only)
5. **Recalculates debtor totals** from all transactions

### Backfill Scripts
- **`fix_prorated_rent.js`**: Corrects first month to be prorated
- **`create_deposit_transactions.js`**: Adds missing deposit transactions
- **`create_missing_transactions.js`**: Creates all missing transactions (comprehensive lease start + monthly accruals up to current month)
- **`verify_debtor_totals.js`**: Verifies totals match transaction entries

### Real-time Updates
- **DebtorTransactionSyncService**: Automatically recalculates debtor totals
- **Transaction-based totals**: All financial data derived from actual transactions
- **Audit trail**: Complete history of all financial movements
- **Cron Jobs**: Handle future monthly accruals automatically

## Financial Reporting

### Debtor Totals Calculation
- **Total Owed**: Sum of all accrual transactions (rent + deposit)
- **Total Paid**: Sum of all payment transactions
- **Current Balance**: Total Owed - Total Paid
- **Overdue Amount**: Amount past due date

### Monthly Breakdown
- **Expected Amount**: Monthly rent for each month
- **Paid Amount**: Actual payments allocated to each month
- **Outstanding Amount**: Expected - Paid for each month
- **Status**: Current, overdue, or paid

## Best Practices

### For New Students
1. Use Excel upload for automatic transaction creation
2. Verify prorated amounts are correct
3. Confirm deposit transactions are created
4. Check debtor totals match expectations

### For Existing Students
1. Run backfill scripts to create missing transactions
2. Verify all totals are accurate
3. Ensure deposit transactions exist
4. Check prorated first month amounts

### For Payments
1. Create payment transactions with proper allocation
2. Update debtor totals automatically
3. Maintain audit trail
4. Track deposit refunds separately

## Common Issues and Solutions

### Issue: Totals Don't Match Transactions
**Solution**: Run `verify_debtor_totals.js` to identify and fix discrepancies

### Issue: Missing Deposit Transactions
**Solution**: Run `create_deposit_transactions.js` to add missing deposits

### Issue: First Month Not Prorated
**Solution**: Run `fix_prorated_rent.js` to correct prorated amounts

### Issue: Version Conflicts During Updates
**Solution**: Ensure only one update operation per debtor per cycle

## System Benefits

1. **Accuracy**: All totals derived from actual transactions
2. **Audit Trail**: Complete history of financial movements
3. **Flexibility**: Supports prorated rent and deposits
4. **Automation**: Automatic transaction creation and recalculation
5. **Compliance**: Proper double-entry accounting
6. **Reporting**: Detailed financial breakdowns by month

## Future Enhancements

1. **Payment Allocation**: Smart FIFO allocation to oldest charges
2. **Late Fees**: Automatic late fee accrual
3. **Deposit Refunds**: Track deposit returns and deductions
4. **Multi-currency**: Support for different currencies
5. **Advanced Reporting**: Cash flow statements and P&L reports
