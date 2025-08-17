# 🗑️ Expense Deletion with Transaction Cleanup Guide

## 📋 **Overview**

This tool ensures that when you delete an expense, **ALL related transaction entries are also deleted** to maintain data integrity and prevent orphaned records that can cause balance sheet imbalances.

## 🚨 **Why This Matters**

### **The Problem**
When you delete an expense without deleting its transaction entries:
- ❌ Transaction entries become orphaned
- ❌ Account balances remain incorrect
- ❌ Balance sheet won't balance
- ❌ Data integrity is compromised

### **The Solution**
This tool automatically:
- ✅ Finds all related transaction entries
- ✅ Deletes transaction entries first (maintaining referential integrity)
- ✅ Deletes the expense record
- ✅ Shows you exactly what will be deleted before doing it

## 🛠️ **Features**

### **1. Comprehensive Transaction Detection**
Finds transactions by:
- Direct source ID reference
- Source model matching
- Description pattern matching

### **2. Account Impact Analysis**
Shows how deletion will affect account balances:
- Which accounts will be impacted
- How much each account balance will change
- Reverses the original transaction posting

### **3. Safety Features**
- **Dry Run Mode**: See what would be deleted without actually deleting
- **Confirmation Required**: Explicit confirmation for actual deletions
- **Detailed Logging**: Complete audit trail of what was deleted

### **4. Multiple Deletion Modes**
- Single expense deletion
- Batch expense deletion
- Expense search and filtering

## 📖 **Usage Examples**

### **1. Single Expense Deletion (Dry Run)**
```bash
# See what would be deleted without actually deleting
node delete-expense-with-transactions.js 507f1f77bcf86cd799439011 dry-run
```

### **2. Single Expense Deletion (Actual)**
```bash
# Actually delete the expense and all related transactions
node delete-expense-with-transactions.js 507f1f77bcf86cd799439011
```

### **3. Multiple Expense Deletion**
```bash
# Delete multiple expenses at once
node delete-expense-with-transactions.js multiple 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012
```

### **4. Find Expenses by Criteria**
```bash
# Find all pending water expenses
node delete-expense-with-transactions.js find pending water

# Find expenses in date range
node delete-expense-with-transactions.js find pending water 2025-01-01 2025-12-31
```

## 🔍 **What the Tool Shows You**

### **Before Deletion**
```
📋 EXPENSE DETAILS:
   Description: Water request: water
   Amount: $250.00
   Date: 8/13/2025
   Status: approved
   Category: water

💳 RELATED TRANSACTIONS:
   1. Transaction ID: TXN1755091541306
      Description: Payment for Expense EXP1755091541306 - Water request: water
      Date: 8/13/2025
      Source: expense_payment
      Entries: 2
         Entry 1: 1000 - Debit: $0, Credit: $250.00
         Entry 2: 1000 - Debit: $250.00, Credit: $0

💰 ACCOUNT BALANCE IMPACT:
   Account 1000: +$250.00
```

### **After Deletion**
```
✅ DELETION COMPLETED
   Expenses deleted: 1
   Transactions deleted: 1
   Errors: 0
```

## ⚠️ **Important Considerations**

### **1. Data Integrity**
- **Always use dry-run first** to see what will be deleted
- **Review the account impact** to ensure it's what you expect
- **Check for related records** that might be affected

### **2. Balance Sheet Impact**
Deleting an expense will:
- Remove the expense from your income statement
- Reverse the account balance changes from the original posting
- Potentially fix balance sheet imbalances

### **3. Audit Trail**
- All deletions are logged
- You can see exactly what was deleted
- Account balance impacts are calculated and shown

## 🚀 **Integration with Balance Sheet Fixes**

### **How This Helps Fix Your Balance Sheet**
1. **Identify Problem Expenses**: Use the tool to find expenses with incorrect transaction postings
2. **Clean Up Orphaned Records**: Remove expenses and their malformed transactions
3. **Restore Account Balances**: Deleting incorrect transactions can fix negative asset balances
4. **Verify Fixes**: Re-run balance sheet after deletions to see improvements

### **Example Scenario**
If you have an expense with incorrect double-entry:
```
INCORRECT:
DEBIT: Bank Account (1000) - $300
CREDIT: Bank Account (1000) - $300

RESULT: Bank Account shows negative balance
```

Using this tool to delete the expense will:
1. Remove the incorrect transaction entries
2. Restore the Bank Account balance
3. Fix the balance sheet imbalance

## 📊 **Best Practices**

### **1. Always Start with Dry Run**
```bash
# First, see what would happen
node delete-expense-with-transactions.js <expenseId> dry-run

# Review the output carefully
# Then proceed with actual deletion if correct
node delete-expense-with-transactions.js <expenseId>
```

### **2. Batch Operations for Multiple Issues**
```bash
# If you have multiple problematic expenses
node delete-expense-with-transactions.js multiple <id1> <id2> <id3>
```

### **3. Regular Cleanup**
- Use the search functionality to find orphaned or problematic expenses
- Clean up regularly to prevent data integrity issues
- Monitor account balances after deletions

## 🔧 **Troubleshooting**

### **Common Issues**

#### **"Expense not found"**
- Verify the expense ID is correct
- Check if the expense was already deleted
- Ensure you're connected to the right database

#### **"No related transactions found"**
- The expense might not have generated transaction entries
- Check if the expense was properly posted to the accounting system
- Verify the expense status and posting date

#### **"Failed to delete transaction"**
- Check database permissions
- Ensure no other processes are using the transaction
- Verify the transaction ID is valid

### **Recovery Options**
- **Database Backup**: Always have a recent backup before bulk deletions
- **Transaction Logs**: Review the deletion logs to see what was removed
- **Account Reconciliation**: Verify account balances after deletions

## 📞 **Support**

### **Files Created**
- `delete-expense-with-transactions.js` - Main deletion tool
- `EXPENSE_DELETION_GUIDE.md` - This guide

### **Key Models Used**
- `Expense` - Expense records
- `TransactionEntry` - Double-entry accounting transactions

### **Database Collections**
- `expenses` - Expense records
- `transactionentries` - Transaction entries

---

**⚠️  REMEMBER**: Always use dry-run mode first to see exactly what will be deleted before proceeding with actual deletion!
