# Petty Cash Allocation Flow Guide

## 💰 **How Petty Cash Flows from Bank/Other Accounts to User Petty Cash**

### **Overview**
When finance allocates petty cash to a user, the system creates a double-entry transaction that moves money from a source account (Bank/Cash) to a role-specific petty cash account.

---

## 🔄 **Complete Flow Process**

### **1. Frontend Request**
```javascript
// Finance user allocates petty cash to admin
POST /api/finance/petty-cash
{
  "userId": "6889172ba1487dda41654a97",
  "amount": 200,
  "notes": "girlfriend allowance"
}
```

### **2. Backend Processing Steps**

#### **Step 1: Validation & User Check**
```javascript
// Controller validates:
// - User exists and is eligible (not student/tenant)
// - User doesn't already have active petty cash
// - Amount is positive
```

#### **Step 2: Account Determination**
```javascript
// System determines accounts:
const pettyCashAccount = await getPettyCashAccountByRole(user.role);
const bankAccount = await Account.findOne({ code: '1000' }); // Bank account
const cashAccount = await Account.findOne({ code: '1015' }); // Cash account

// Source account preference: Bank → Cash
const sourceAccount = bankAccount || cashAccount;
```

#### **Step 3: Role-Based Petty Cash Account Mapping**
```javascript
// Based on user role, system selects appropriate petty cash account:
switch (userRole) {
  case 'admin':
    accountCode = '1011'; // Admin Petty Cash
    break;
  case 'finance_admin':
  case 'finance_user':
    accountCode = '1012'; // Finance Petty Cash
    break;
  case 'property_manager':
    accountCode = '1013'; // Property Manager Petty Cash
    break;
  case 'maintenance':
    accountCode = '1014'; // Maintenance Petty Cash
    break;
  default:
    accountCode = '1010'; // General Petty Cash
}
```

### **3. Double-Entry Transaction Creation**

#### **Transaction Record**
```javascript
{
  _id: "transaction_id",
  date: "2025-06-30T00:00:00.000Z",
  description: "Petty Cash Allocation: John Doe",
  reference: "PC-ALLOC-petty_cash_id",
  residence: null
}
```

#### **Transaction Entries (Double-Entry)**
```javascript
// Entry 1: DEBIT Petty Cash Account (Asset)
{
  transaction: "transaction_id",
  account: "1011", // Admin Petty Cash (based on user role)
  debit: 200,      // Money goes INTO petty cash
  credit: 0,
  type: "asset",
  description: "Petty cash allocated to John Doe"
}

// Entry 2: CREDIT Source Account (Asset)
{
  transaction: "transaction_id", 
  account: "1000", // Bank Account (or 1015 for Cash)
  debit: 0,
  credit: 200,     // Money comes FROM bank/cash
  type: "asset", 
  description: "Bank transfer for petty cash to John Doe"
}
```

---

## 📊 **Account Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Bank Account  │    │  Petty Cash      │    │  User's Petty   │
│   (1000)        │    │  Account         │    │  Cash Balance   │
│                 │    │  (1011-1014)     │    │                 │
│  Balance: $5000 │───▶│  Balance: $0     │───▶│  Balance: $200  │
│                 │    │                  │    │                 │
│  CREDIT: -$200  │    │  DEBIT: +$200    │    │  Available:     │
│  (Decreases)    │    │  (Increases)     │    │  $200 for use   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 🔧 **Available Endpoints**

### **1. Allocate Petty Cash**
```javascript
POST /api/finance/petty-cash
{
  "userId": "user_id",
  "amount": 200,
  "notes": "Monthly petty cash"
}
```

### **2. Check Petty Cash Balance**
```javascript
GET /api/finance/petty-cash/balance/:userId
```

### **3. Get All Petty Cash Allocations**
```javascript
GET /api/finance/petty-cash
```

### **4. Update Petty Cash Allocation**
```javascript
PUT /api/finance/petty-cash/:id
{
  "allocatedAmount": 300,
  "notes": "Updated allocation"
}
```

### **5. Transfer Between Petty Cash Accounts**
```javascript
POST /api/finance/petty-cash/transfer
{
  "fromRole": "finance_admin",
  "toRole": "admin", 
  "amount": 100,
  "notes": "Transfer for admin expenses"
}
```

---

## 💳 **Source Account Options**

### **Primary Source: Bank Account**
- **Account Code**: `1000`
- **Account Name**: Bank Account
- **Type**: Asset
- **Preference**: First choice for petty cash allocation

### **Fallback Source: Cash Account**
- **Account Code**: `1015`
- **Account Name**: Cash on Hand
- **Type**: Asset
- **Preference**: Used if bank account not available

### **Account Selection Logic**
```javascript
// System automatically selects source account
const sourceAccount = bankAccount || cashAccount;

// If neither exists, allocation fails
if (!sourceAccount) {
  throw new Error('No source account available for petty cash allocation');
}
```

---

## 🎯 **Role-Based Petty Cash Accounts**

| User Role | Account Code | Account Name | Purpose |
|-----------|--------------|--------------|---------|
| `admin` | `1011` | Admin Petty Cash | Admin expenses |
| `finance_admin` | `1012` | Finance Petty Cash | Finance expenses |
| `finance_user` | `1012` | Finance Petty Cash | Finance expenses |
| `property_manager` | `1013` | Property Manager Petty Cash | Property expenses |
| `maintenance` | `1014` | Maintenance Petty Cash | Maintenance expenses |
| `default` | `1010` | General Petty Cash | General expenses |

---

## ⚠️ **Important Notes**

### **1. User Eligibility**
- **Eligible**: `admin`, `finance_admin`, `finance_user`, `property_manager`, `maintenance`
- **Not Eligible**: `student`, `tenant`

### **2. Active Allocation Check**
```javascript
// System prevents multiple active allocations
const existingPettyCash = await PettyCash.findOne({
  user: userId,
  status: 'active'
});

if (existingPettyCash) {
  return res.status(400).json({ 
    message: 'User already has an active petty cash allocation'
  });
}
```

### **3. Double-Entry Validation**
```javascript
// System ensures debits = credits
totalDebit: 200,
totalCredit: 200,
// Must always balance!
```

### **4. Audit Trail**
```javascript
// Every allocation is logged
await AuditLog.create({
  user: req.user._id,
  action: 'allocate_petty_cash',
  collection: 'PettyCash',
  recordId: pettyCash._id,
  details: {
    amount: 200,
    userName: "John Doe",
    transactionId: txn._id
  }
});
```

---

## 🔍 **Troubleshooting Common Issues**

### **Issue 1: "User already has an active petty cash allocation"**
**Solution**: Update existing allocation or close it first
```javascript
PUT /api/finance/petty-cash/:id
{
  "status": "closed"
}
```

### **Issue 2: "Students and tenants are not eligible for petty cash"**
**Solution**: Only allocate to eligible roles (admin, finance, property_manager, maintenance)

### **Issue 3: "No source account available"**
**Solution**: Ensure Bank Account (1000) or Cash Account (1015) exists in chart of accounts

### **Issue 4: "Insufficient balance in source account"**
**Solution**: Check bank/cash account balance before allocation

---

## 📈 **Financial Impact**

### **Balance Sheet Effect**
- **Bank Account**: Decreases by allocation amount
- **Petty Cash Account**: Increases by allocation amount
- **Total Assets**: No change (internal transfer)

### **Income Statement Effect**
- **No impact** - This is an asset transfer, not income or expense

### **Cash Flow Statement Effect**
- **No impact** - Internal cash movement

---

## 🚀 **Frontend Integration Example**

```javascript
// Frontend service
export const allocatePettyCash = async (allocationData) => {
  try {
    const response = await axios.post('/api/finance/petty-cash', allocationData, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    if (error.response?.data?.message === 'User already has an active petty cash allocation') {
      // Handle existing allocation
      const existingAllocation = error.response.data.existingAllocation;
      // Show user existing allocation details
      // Offer to update or close existing allocation
    }
    throw error;
  }
};

// Usage
const handleAllocation = async () => {
  try {
    const result = await allocatePettyCash({
      userId: selectedUserId,
      amount: 200,
      notes: "Monthly petty cash allocation"
    });
    
    console.log('Petty cash allocated successfully:', result);
    // Update UI, show success message
    
  } catch (error) {
    console.error('Allocation failed:', error);
    // Handle error, show error message
  }
};
```

This completes the petty cash allocation flow from bank/other accounts to user petty cash accounts! 