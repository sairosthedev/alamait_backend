# Migration Guide: Upgrade to Double-Entry Accounting System

## 📋 Overview

This guide explains the changes made to your Student Accommodation Management System's accounting structure and provides step-by-step instructions to migrate your existing data to the new double-entry accounting system.

## 🔄 What Changed

### Before (Old System)
Your existing system had a simple transaction structure:

**Transactions:**
```json
{
  "_id": "68750390b92a5a333f157f48",
  "date": "2025-07-07T00:00:00.000Z",
  "description": "Rentals Received",
  "reference": "",
  "__v": 0
}
```

**Transaction Entries:**
```json
{
  "_id": "687e7e43585550ec80f6f366",
  "transaction": "687e7e43585550ec80f6f364",
  "account": "687a2f396a235c50a6f2a8f1",
  "debit": 300,
  "credit": 0,
  "__v": 0,
  "type": "income"
}
```

### After (New Double-Entry System)
The new system provides comprehensive double-entry accounting with:

**Enhanced Transactions:**
```json
{
  "_id": "6891395c0959c91c0ece81b9",
  "transactionId": "TXN-1754347868753-xmlmlfllj",
  "date": "2025-08-04T22:51:08.758Z",
  "description": "Maintenance Request: Toilet is blocked",
  "reference": "MR-686ee3e86af01f8b9f54ed14",
  "residence": "67d723cf20f89c4ae69804f3",
  "residenceName": "Exclusive Room",
  "type": "approval",
  "amount": 224,
  "entries": [],
  "createdBy": "67f4ef0fcb87ffa3fb7e2d73",
  "createdAt": "2025-08-04T22:51:08.762Z",
  "updatedAt": "2025-08-04T22:51:08.762Z"
}
```

**Enhanced Transaction Entries:**
```json
{
  "_id": "689146e5900535cfaf7d3ada",
  "transactionId": "TXN-1754351333485-0950",
  "date": "2025-08-04T23:48:53.485Z",
  "description": "Maintenance Approval: Toilets not working - please",
  "reference": "MAINT-686efc626f4f0fe746ac755e",
  "entries": [
    {
      "accountCode": "5001",
      "accountName": "Maintenance Expense",
      "accountType": "Expense",
      "debit": 100,
      "credit": 0,
      "description": "Maintenance: Fix toilet"
    },
    {
      "accountCode": "2001",
      "accountName": "Accounts Payable: Gift Plumber",
      "accountType": "Liability",
      "debit": 0,
      "credit": 100,
      "description": "Payable to Gift Plumber"
    }
  ],
  "totalDebit": 100,
  "totalCredit": 100,
  "source": "expense_payment",
  "sourceId": "686efc626f4f0fe746ac755e",
  "sourceModel": "Request",
  "createdBy": "admin@example.com",
  "status": "posted"
}
```

## 📊 Data Analysis

### Current Data Structure Analysis

Based on your existing data, here's what we found:

#### 1. Transactions (636 records)
- **Old Structure**: Basic transactions with minimal fields
- **Missing Fields**: `transactionId`, `type`, `createdBy`, `residence`, `amount`
- **Patterns**: 
  - Rental payments: "Rentals Received", "Rental Received"
  - Maintenance: "Cleaning supplies", "water", "supplies"
  - Payments: "Payment: [Student Name]"

#### 2. Transaction Entries (1,439 records)
- **Old Structure**: Simple debit/credit entries
- **Missing Fields**: `transactionId`, `entries` array, `source`, `sourceModel`
- **Patterns**:
  - Income entries: `type: "income"`
  - Expense entries: `type: "expense"`

#### 3. Expenses (725 records)
- **Structure**: Well-formed expense records
- **Missing**: `transactionId` links to transactions
- **Categories**: Maintenance, Supplies, Utilities

#### 4. Vendors (997 records)
- **Structure**: Comprehensive vendor information
- **Key Fields**: `vendorCode`, `businessName`, `chartOfAccountsCode`, `expenseAccountCode`
- **Categories**: electrical, plumbing, cleaning, etc.

## 🚀 Migration Process

### Step 1: Backup Your Data

**⚠️ CRITICAL: Always backup before migration**

```bash
# Create database backup
mongodump --db your_database_name --out ./backup_$(date +%Y%m%d_%H%M%S)

# Or export collections
mongoexport --db your_database_name --collection transactions --out transactions_backup.json
mongoexport --db your_database_name --collection transactionentries --out transactionentries_backup.json
mongoexport --db your_database_name --collection expenses --out expenses_backup.json
mongoexport --db your_database_name --collection vendors --out vendors_backup.json
```

### Step 2: Run the Migration Script

```bash
# Navigate to your project directory
cd /path/to/your/project

# Run the migration script
node src/scripts/migrateToDoubleEntryAccounting.js
```

### Step 3: Verify Migration Results

The migration script will provide detailed statistics:

```
🎉 Migration completed successfully!

📊 Migration Statistics:
   Transactions processed: 636
   Transaction entries processed: 1439
   Accounts created: 12
   Errors encountered: 0
   Records skipped: 0
```

## 🔧 Migration Script Details

The migration script performs the following steps:

### Step 1: Initialize Chart of Accounts
Creates the basic chart of accounts:

```javascript
const accounts = [
  // Assets
  { code: '1001', name: 'Bank Account', type: 'Asset' },
  { code: '1002', name: 'Cash on Hand', type: 'Asset' },
  { code: '1003', name: 'Ecocash Wallet', type: 'Asset' },
  { code: '1004', name: 'Innbucks Wallet', type: 'Asset' },
  { code: '1101', name: 'Accounts Receivable', type: 'Asset' },
  
  // Liabilities
  { code: '2001', name: 'Accounts Payable', type: 'Liability' },
  
  // Income
  { code: '4001', name: 'Rent Income', type: 'Income' },
  { code: '4002', name: 'Other Income', type: 'Income' },
  
  // Expenses
  { code: '5001', name: 'Maintenance Expense', type: 'Expense' },
  { code: '5002', name: 'Supplies Expense', type: 'Expense' },
  { code: '5003', name: 'Utilities Expense', type: 'Expense' },
  { code: '5004', name: 'Cleaning Expense', type: 'Expense' }
];
```

### Step 2: Migrate Transactions
Updates existing transactions with new required fields:

- **transactionId**: Generated unique identifier
- **type**: Inferred from description (payment/approval/other)
- **createdBy**: Set to system user if missing
- **residence**: Inferred from related data or set to default
- **amount**: Calculated from entries

### Step 3: Migrate Transaction Entries
Converts old simple entries to new double-entry structure:

- **transactionId**: Generated unique identifier
- **entries**: Array of debit/credit line items
- **source**: Inferred from entry type (payment/expense_payment/manual)
- **sourceModel**: Set based on source type

### Step 4: Link Transactions with Expenses
Links existing expenses to transactions:

- Matches by maintenance request ID
- Matches by description similarity
- Creates new transactions if needed

### Step 5: Validate Migration
Checks data integrity:

- Required fields present
- Transactions balanced (debits = credits)
- No orphaned records

## 📈 Vendor Integration

Your existing vendors are well-structured and will integrate seamlessly:

### Vendor Account Creation
The system will automatically create vendor-specific payable accounts:

```javascript
// For vendor "Trust Jings Electrician"
{
  code: "200001", // From vendor.chartOfAccountsCode
  name: "Accounts Payable: Trust Jings Electrician",
  type: "Liability",
  category: "Current Liabilities"
}
```

### Vendor Payment Tracking
Vendor payments will be properly tracked:

```javascript
// When paying Trust Jings
Dr. Accounts Payable: Trust Jings Electrician  $100
Cr. Ecocash Wallet                            $100
```

## 🔍 Post-Migration Verification

### 1. Check Transaction Balances
```javascript
// Verify all transactions are balanced
const transactions = await Transaction.find().populate('entries');
transactions.forEach(txn => {
  if (!txn.isBalanced()) {
    console.warn(`Unbalanced transaction: ${txn.transactionId}`);
  }
});
```

### 2. Verify Account Links
```javascript
// Check vendor account links
const vendors = await Vendor.find();
vendors.forEach(vendor => {
  const account = await Account.findOne({ 
    name: `Accounts Payable: ${vendor.businessName}` 
  });
  if (!account) {
    console.warn(`Missing account for vendor: ${vendor.businessName}`);
  }
});
```

### 3. Test New Functionality
```javascript
// Test the new double-entry service
const DoubleEntryAccountingService = require('./services/doubleEntryAccountingService');

// Test maintenance approval
const result = await DoubleEntryAccountingService.recordMaintenanceApproval(request, user);
console.log('Transaction created:', result.transaction.transactionId);
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Missing Required Fields
**Error**: "Field 'transactionId' is required"
**Solution**: Run the migration script again - it will add missing fields

#### 2. Unbalanced Transactions
**Error**: "Total debits must equal total credits"
**Solution**: Check the migration logs for specific transactions and manually adjust

#### 3. Vendor Account Mismatches
**Error**: "Vendor account not found"
**Solution**: Verify vendor.chartOfAccountsCode matches Account.code

### Manual Fixes

If the migration script encounters errors, you can manually fix specific records:

```javascript
// Fix a specific transaction
await Transaction.findByIdAndUpdate(transactionId, {
  transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
  type: 'payment',
  createdBy: systemUserId,
  residence: defaultResidenceId
});

// Fix a specific entry
await TransactionEntry.findByIdAndUpdate(entryId, {
  transactionId: `TXN-ENTRY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
  entries: [
    {
      accountCode: '1002',
      accountName: 'Cash on Hand',
      accountType: 'Asset',
      debit: 100,
      credit: 0,
      description: 'Manual fix'
    }
  ],
  totalDebit: 100,
  totalCredit: 100,
  source: 'manual',
  sourceModel: 'Manual'
});
```

## 📊 Reporting After Migration

### Cash Basis Report
```javascript
const cashTransactions = await DoubleEntryAccountingService.getTransactionsByBasis('cash', {
  dateFrom: '2025-01-01',
  dateTo: '2025-12-31'
});
```

### Accrual Basis Report
```javascript
const accrualTransactions = await DoubleEntryAccountingService.getTransactionsByBasis('accrual', {
  dateFrom: '2025-01-01',
  dateTo: '2025-12-31'
});
```

### Vendor Balance Report
```javascript
const vendorBalances = await Account.find({ 
  type: 'Liability',
  name: { $regex: 'Accounts Payable:' }
}).populate('metadata.vendor');
```

## 🎯 Next Steps

After successful migration:

1. **Update Your Controllers**: Use the new `DoubleEntryAccountingService`
2. **Test All Scenarios**: Verify maintenance, payments, invoices work correctly
3. **Train Users**: Explain the new double-entry system to your team
4. **Monitor**: Watch for any data inconsistencies in the first few weeks

## 📞 Support

If you encounter issues during migration:

1. Check the migration logs for specific error messages
2. Verify your database connection and permissions
3. Ensure all required models are properly imported
4. Contact your development team with specific error details

---

**Remember**: This migration preserves all your existing data while enhancing it with proper double-entry accounting capabilities. Your historical transactions, expenses, and vendor relationships will all be maintained and enhanced. 