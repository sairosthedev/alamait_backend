# 💰 Expense Payment Account Selection Guide

## 📋 Overview

When recording expense payments, you need to select the correct accounts for proper double-entry bookkeeping. The system now automatically detects vendor-specific accounts when available.

## 🎯 Account Selection Logic

### **1. Paying Account (Debit)**
**Always Required**: The account you're paying FROM
- **`1011`** - Admin Petty Cash (for cash payments)
- **`1000`** - Bank - Main Account (for bank transfers)
- **`1012`** - Finance Petty Cash (for finance users)
- **`1013`** - Property Manager Petty Cash (for property managers)

### **2. Receiving Account (Credit)**
**Automatically Determined**: The account you're paying TO

#### **For Expenses with Vendors:**
- **Vendor-Specific Account**: `200001`, `200002`, etc. (vendor's chart of accounts code)
- **Example**: `200001` - Accounts Payable - ABC Plumbing Co

#### **For Expenses without Vendors:**
- **General Account**: `2000` - Accounts Payable

## 🔧 How It Works

### **Automatic Vendor Detection**
```javascript
// The system automatically:
1. Checks if expense has vendorId
2. Finds vendor's chartOfAccountsCode (e.g., "200001")
3. Uses vendor-specific account instead of generic "2000"
4. Falls back to generic "2000" if vendor account not found
```

### **Example Payment Request**
```javascript
POST /api/expenses/688abb6888733afeb85b854c/payments
{
  "amount": 150,
  "paymentMethod": "Cash",
  "reference": "Payment reference",
  "notes": "Payment notes",
  "payingAccount": "1011",      // Admin Petty Cash
  "receivingAccount": "2000"    // Will be overridden with vendor account if available
}
```

## 📊 Account Codes Reference

### **Paying Accounts (Assets)**
| Code | Name | Type | Usage |
|------|------|------|-------|
| `1000` | Bank - Main Account | Asset | Bank transfers |
| `1011` | Admin Petty Cash | Asset | Cash payments (admin) |
| `1012` | Finance Petty Cash | Asset | Cash payments (finance) |
| `1013` | Property Manager Petty Cash | Asset | Cash payments (property manager) |

### **Receiving Accounts (Liabilities)**
| Code | Name | Type | Usage |
|------|------|------|-------|
| `2000` | Accounts Payable | Liability | General expenses |
| `200001` | Accounts Payable - Vendor 1 | Liability | Vendor-specific |
| `200002` | Accounts Payable - Vendor 2 | Liability | Vendor-specific |
| `200003` | Accounts Payable - Vendor 3 | Liability | Vendor-specific |

## 🎯 Best Practices

### **1. Always Use Correct Paying Account**
- **Cash payments**: Use appropriate petty cash account
- **Bank transfers**: Use bank account
- **Match payment method**: Cash → Petty Cash, Bank → Bank Account

### **2. Let System Handle Receiving Account**
- **Send generic `2000`**: System will auto-detect vendor account
- **System logs**: Shows which account was actually used
- **Error details**: Provides vendor information if account not found

### **3. Check Payment Response**
```javascript
// Response includes account details
{
  "message": "Expense payment recorded successfully",
  "transactionEntry": {
    "transactionId": "TXN123456",
    "totalDebit": 150,
    "totalCredit": 150,
    "date": "2025-08-03T15:30:00.000Z"
  },
  "expense": {
    "paymentStatus": "Paid",
    "amountPaid": 150,
    "balanceDue": 0
  }
}
```

## 🔍 Troubleshooting

### **"Invalid account codes" Error**
**Check the error details:**
```javascript
{
  "message": "Invalid account codes",
  "details": {
    "payingAccount": "1011",
    "receivingAccount": "200001",
    "vendorSpecificAccount": "200001",
    "vendorId": "vendor_id_here"
  }
}
```

**Solutions:**
1. **Verify paying account exists**: Check if `1011` exists in chart of accounts
2. **Check vendor account**: Verify vendor's chart of accounts code exists
3. **Use generic account**: If vendor account missing, use `2000`

### **Vendor Account Not Found**
**System automatically falls back to generic account:**
```
Using vendor-specific account: 200001 instead of generic: 2000
Vendor account 200001 not found, using generic: 2000
```

## 📝 Example Scenarios

### **Scenario 1: Vendor Expense Payment**
```javascript
// Expense has vendorId, system uses vendor-specific account
{
  "payingAccount": "1011",    // Admin Petty Cash
  "receivingAccount": "2000"  // System uses vendor's 200001
}
// Result: Debit 1011, Credit 200001 (vendor-specific)
```

### **Scenario 2: General Expense Payment**
```javascript
// Expense has no vendor, system uses generic account
{
  "payingAccount": "1000",    // Bank Account
  "receivingAccount": "2000"  // System uses generic 2000
}
// Result: Debit 1000, Credit 2000 (general)
```

### **Scenario 3: Finance User Payment**
```javascript
// Finance user making payment
{
  "payingAccount": "1012",    // Finance Petty Cash
  "receivingAccount": "2000"  // System determines based on vendor
}
// Result: Debit 1012, Credit vendor-specific or generic
```

## ✅ Summary

1. **Paying Account**: Always specify the correct account you're paying FROM
2. **Receiving Account**: Send `2000`, system auto-detects vendor account
3. **System Intelligence**: Automatically uses vendor-specific accounts when available
4. **Error Handling**: Provides detailed error information for troubleshooting
5. **Logging**: System logs which accounts were actually used

**The system now handles vendor-specific accounts automatically! 🎉** 