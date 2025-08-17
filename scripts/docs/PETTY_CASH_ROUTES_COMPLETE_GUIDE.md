# 🚀 Complete Petty Cash Routes Guide

## 💰 **All Petty Cash Endpoints for Finance & User Transactions**

---

## 📋 **FINANCE ROUTES** (`/api/finance/`)

### **1. Petty Cash Allocation**
```javascript
// Allocate petty cash to a user
POST /api/finance/allocate-petty-cash
{
  "userId": "user_id_here",
  "amount": 500,
  "description": "Monthly petty cash allocation"
}
```

### **2. Petty Cash Replenishment**
```javascript
// Replenish petty cash for a user
POST /api/finance/replenish-petty-cash
{
  "userId": "user_id_here",
  "amount": 200,
  "description": "Top up petty cash"
}
```

### **3. Record Petty Cash Expense**
```javascript
// Record petty cash expense
POST /api/finance/record-petty-cash-expense
{
  "userId": "user_id_here",
  "amount": 50,
  "description": "Office supplies",
  "expenseCategory": "Supplies"
}
```

### **4. Get User Petty Cash Balance**
```javascript
// Get specific user's petty cash balance
GET /api/finance/petty-cash-balance/:userId

// Response:
{
  "success": true,
  "message": "Successfully retrieved petty cash balance for User Name",
  "data": {
    "user": {
      "_id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "admin"
    },
    "pettyCashBalance": {
      "totalAllocated": 500,
      "totalExpenses": 50,
      "totalReplenished": 0,
      "currentBalance": 450,
      "formattedBalance": "$450.00"
    },
    "summary": {
      "totalTransactions": 550,
      "lastUpdated": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

### **5. Get All Petty Cash Balances (Finance Dashboard)**
```javascript
// Get all users' petty cash balances
GET /api/finance/all-petty-cash-balances

// Response:
{
  "success": true,
  "data": {
    "balances": [
      {
        "user": {
          "_id": "user_id",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com",
          "role": "admin",
          "fullName": "John Doe"
        },
        "pettyCashBalance": {
          "totalAllocated": 500,
          "totalExpenses": 50,
          "totalReplenished": 0,
          "currentBalance": 450,
          "formattedBalance": "$450.00"
        }
      }
    ],
    "summary": {
      "totalUsers": 5,
      "totalSystemBalance": 1250,
      "totalAllocated": 2000,
      "totalExpenses": 750,
      "totalReplenished": 0
    }
  }
}
```

### **6. Get User Petty Cash Transactions**
```javascript
// Get user's petty cash transaction history
GET /api/finance/petty-cash-transactions/:userId

// With date filters
GET /api/finance/petty-cash-transactions/:userId?startDate=2025-01-01&endDate=2025-01-31

// Response:
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "admin"
    },
    "transactions": [
      {
        "transactionId": "TXN123456789",
        "date": "2025-01-15T10:30:00.000Z",
        "description": "Petty cash allocation: Monthly allocation",
        "type": "allocation",
        "amount": 500,
        "balance": 500,
        "metadata": {
          "pettyCashUserRole": "admin",
          "pettyCashAccountCode": "1011",
          "transactionType": "petty_cash_allocation"
        }
      },
      {
        "transactionId": "TXN123456790",
        "date": "2025-01-16T14:20:00.000Z",
        "description": "Petty cash expense: Office supplies",
        "type": "expense",
        "amount": -50,
        "balance": 450,
        "metadata": {
          "pettyCashUserRole": "admin",
          "pettyCashAccountCode": "1011",
          "transactionType": "petty_cash_expense",
          "expenseCategory": "Supplies"
        }
      }
    ],
    "summary": {
      "totalTransactions": 2,
      "totalAllocated": 500,
      "totalExpenses": 50,
      "currentBalance": 450
    }
  }
}
```

### **7. Get Eligible Users for Petty Cash**
```javascript
// Get users eligible for petty cash allocation
GET /api/finance/eligible-users-for-petty-cash

// Response:
{
  "success": true,
  "eligibleUsers": [
    {
      "_id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "admin",
      "status": "active"
    }
  ],
  "total": 5
}
```

### **8. Get Petty Cash Accounts**
```javascript
// Get all petty cash accounts (role-based)
GET /api/finance/petty-cash-accounts

// Response:
{
  "success": true,
  "accounts": [
    {
      "code": "1010",
      "name": "General Petty Cash",
      "type": "Asset",
      "balance": 1000,
      "role": "general",
      "displayName": "General Petty Cash"
    },
    {
      "code": "1011",
      "name": "Admin Petty Cash",
      "type": "Asset",
      "balance": 450,
      "role": "admin",
      "displayName": "Admin Petty Cash"
    },
    {
      "code": "1012",
      "name": "Finance Petty Cash",
      "type": "Asset",
      "balance": 800,
      "role": "finance",
      "displayName": "Finance Petty Cash"
    }
  ],
  "total": 5
}
```

---

## 👤 **ADMIN ROUTES** (`/api/admin/`)

### **1. Admin Petty Cash Allocation**
```javascript
// Admin can allocate petty cash to users
POST /api/admin/petty-cash/allocate
{
  "userId": "user_id_here",
  "amount": 500,
  "description": "Monthly petty cash allocation"
}
```

### **2. Admin Petty Cash Replenishment**
```javascript
// Admin can replenish petty cash for users
POST /api/admin/petty-cash/replenish
{
  "userId": "user_id_here",
  "amount": 200,
  "description": "Top up petty cash"
}
```

### **3. Admin Record Petty Cash Expense**
```javascript
// Admin can record petty cash expenses
POST /api/admin/petty-cash/expense
{
  "userId": "user_id_here",
  "amount": 50,
  "description": "Office supplies",
  "expenseCategory": "Supplies"
}
```

### **4. Admin View All Petty Cash Balances**
```javascript
// Admin can view all petty cash balances
GET /api/admin/petty-cash/balances
```

### **5. Admin View User Petty Cash Balance**
```javascript
// Admin can view specific user's petty cash balance
GET /api/admin/petty-cash/balance/:userId
```

### **6. Admin View User Petty Cash Transactions**
```javascript
// Admin can view user's petty cash transactions
GET /api/admin/petty-cash/transactions/:userId
```

### **7. Admin Get Eligible Users**
```javascript
// Admin can get eligible users for petty cash
GET /api/admin/petty-cash/eligible-users
```

### **8. Admin Get Petty Cash Accounts**
```javascript
// Admin can get petty cash accounts
GET /api/admin/petty-cash/accounts
```

---

## 🔄 **TRANSACTION TYPES & METADATA**

### **Transaction Types:**
- `petty_cash_allocation` - Initial allocation of petty cash
- `petty_cash_expense` - Expense paid from petty cash
- `petty_cash_replenishment` - Top up of petty cash

### **Metadata Fields:**
```javascript
{
  "pettyCashUserId": "user_id",
  "pettyCashUserRole": "admin",
  "pettyCashAccountCode": "1011",
  "transactionType": "petty_cash_allocation",
  "allocationType": "initial",
  "expenseCategory": "Supplies", // Only for expenses
  "expenseDescription": "Office supplies", // Only for expenses
  "expenseAmount": 50, // Only for expenses
  "replenishmentType": "top_up" // Only for replenishments
}
```

---

## 🎯 **ROLE-BASED PETTY CASH ACCOUNTS**

| User Role | Account Code | Account Name | Purpose |
|-----------|--------------|--------------|---------|
| `admin` | `1011` | Admin Petty Cash | Admin expenses |
| `finance_admin` | `1012` | Finance Petty Cash | Finance expenses |
| `finance_user` | `1012` | Finance Petty Cash | Finance expenses |
| `property_manager` | `1013` | Property Manager Petty Cash | Property expenses |
| `maintenance` | `1014` | Maintenance Petty Cash | Maintenance expenses |
| `default` | `1010` | General Petty Cash | General expenses |

---

## 📊 **FRONTEND IMPLEMENTATION EXAMPLES**

### **1. Finance Dashboard - Allocate Petty Cash**
```javascript
// Frontend function to allocate petty cash
const allocatePettyCash = async (userId, amount, description) => {
  try {
    const response = await fetch('/api/finance/allocate-petty-cash', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId,
        amount,
        description
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Petty cash allocated successfully');
      console.log('Transaction ID:', result.allocation.transactionId);
      console.log('User:', result.allocation.userName);
      console.log('Amount:', result.allocation.amount);
    }
  } catch (error) {
    console.error('❌ Error allocating petty cash:', error);
  }
};
```

### **2. User Dashboard - View Petty Cash Balance**
```javascript
// Frontend function to get user's petty cash balance
const getPettyCashBalance = async (userId) => {
  try {
    const response = await fetch(`/api/finance/petty-cash-balance/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      const balance = result.data.pettyCashBalance;
      console.log('💰 Current Balance:', balance.formattedBalance);
      console.log('📊 Total Allocated:', balance.totalAllocated);
      console.log('💸 Total Expenses:', balance.totalExpenses);
      console.log('🔄 Total Replenished:', balance.totalReplenished);
    }
  } catch (error) {
    console.error('❌ Error getting petty cash balance:', error);
  }
};
```

### **3. Finance Dashboard - View All Balances**
```javascript
// Frontend function to get all petty cash balances
const getAllPettyCashBalances = async () => {
  try {
    const response = await fetch('/api/finance/all-petty-cash-balances', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      const balances = result.data.balances;
      const summary = result.data.summary;
      
      console.log('📊 System Summary:');
      console.log('Total Users:', summary.totalUsers);
      console.log('Total System Balance:', summary.totalSystemBalance);
      console.log('Total Allocated:', summary.totalAllocated);
      console.log('Total Expenses:', summary.totalExpenses);
      
      balances.forEach(balance => {
        console.log(`${balance.user.fullName}: ${balance.pettyCashBalance.formattedBalance}`);
      });
    }
  } catch (error) {
    console.error('❌ Error getting all petty cash balances:', error);
  }
};
```

### **4. User Dashboard - View Transaction History**
```javascript
// Frontend function to get user's transaction history
const getPettyCashTransactions = async (userId, startDate, endDate) => {
  try {
    let url = `/api/finance/petty-cash-transactions/${userId}`;
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      const transactions = result.data.transactions;
      const summary = result.data.summary;
      
      console.log('📋 Transaction Summary:');
      console.log('Total Transactions:', summary.totalTransactions);
      console.log('Current Balance:', summary.currentBalance);
      
      transactions.forEach(transaction => {
        console.log(`${transaction.date}: ${transaction.description} - $${transaction.amount}`);
      });
    }
  } catch (error) {
    console.error('❌ Error getting petty cash transactions:', error);
  }
};
```

---

## 🔐 **PERMISSIONS & ROLES**

### **Finance Routes Permissions:**
- `finance_admin` - Full access to all petty cash operations
- `finance_user` - Can view balances and record expenses
- `admin` - Full access to all petty cash operations

### **Admin Routes Permissions:**
- `admin` - Full access to all petty cash operations
- `admin_assistant` - Limited access (view only)

### **User Access:**
- Users can only view their own petty cash balance and transactions
- Users cannot allocate or replenish petty cash (finance/admin only)
- Users can request expenses but cannot approve them

---

## 🎯 **SUMMARY**

### **Finance Operations:**
1. **Allocate** petty cash to users
2. **Replenish** petty cash for users
3. **Record** petty cash expenses
4. **View** all petty cash balances
5. **View** user transaction history
6. **Manage** role-based petty cash accounts

### **User Operations:**
1. **View** their own petty cash balance
2. **View** their transaction history
3. **Request** petty cash expenses (pending approval)

### **Key Features:**
- ✅ **Role-based petty cash accounts** (admin, finance, property manager, maintenance)
- ✅ **Double-entry accounting** for all transactions
- ✅ **Comprehensive audit trail** with metadata
- ✅ **Balance validation** before expenses
- ✅ **Date filtering** for transaction history
- ✅ **Real-time balance updates**

**All petty cash operations now properly allocate to role-specific accounts and maintain proper financial tracking!** 🚀
