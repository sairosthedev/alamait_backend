# 💰 **Petty Cash Endpoints Complete Guide**

## 📋 **Overview**

This guide shows you **ALL** the petty cash endpoints for:
- **Finance allocating petty cash** to admin/users
- **Admin/users fetching** their petty cash balance and transactions
- **Complete workflow** from allocation to usage

---

## 🔧 **Current Status**

The petty cash functionality is **implemented** in the backend but **routes are not currently exposed**. Here's what exists and what needs to be added:

### ✅ **What's Already Implemented:**
- Petty cash allocation logic in `FinanceController`
- Double-entry accounting for petty cash
- Balance calculation and transaction tracking
- Role-based petty cash accounts

### ❌ **What's Missing:**
- Routes to expose the petty cash endpoints
- Frontend integration

---

## 🎯 **All Petty Cash Endpoints**

### **Base URL:** `/api/finance`

---

## 💸 **1. Finance Allocating Petty Cash**

### **Allocate Petty Cash to User**
```http
POST /api/finance/allocate-petty-cash
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body:**
```javascript
{
  "userId": "user_id_here",
  "amount": 1000,
  "description": "Monthly petty cash for office supplies"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Petty cash allocated successfully",
  "allocation": {
    "userId": "user_id",
    "userName": "John Doe",
    "amount": 1000,
    "description": "Petty cash allocated to John Doe",
    "transactionId": "TXN-2025-001",
    "date": "2025-01-15T10:30:00Z"
  }
}
```

**Access:** Finance, Finance Admin, Finance User

---

### **Replenish Petty Cash**
```http
POST /api/finance/replenish-petty-cash
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body:**
```javascript
{
  "userId": "user_id_here",
  "amount": 500,
  "description": "Top up petty cash for emergency expenses"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Petty cash replenished successfully",
  "replenishment": {
    "userId": "user_id",
    "userName": "John Doe",
    "amount": 500,
    "description": "Petty cash replenishment for John Doe",
    "transactionId": "TXN-2025-002",
    "newBalance": 1500
  }
}
```

**Access:** Finance, Finance Admin, Finance User

---

### **Record Petty Cash Expense**
```http
POST /api/finance/record-petty-cash-expense
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body:**
```javascript
{
  "userId": "user_id_here",
  "amount": 50,
  "description": "Office supplies purchase",
  "expenseCategory": "Office Supplies"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Petty cash expense recorded successfully",
  "expense": {
    "userId": "user_id",
    "userName": "John Doe",
    "amount": 50,
    "description": "Office supplies purchase",
    "expenseCategory": "Office Supplies",
    "transactionId": "TXN-2025-003",
    "newBalance": 1450
  }
}
```

**Access:** Finance, Finance Admin, Finance User

---

## 📊 **2. Admin/Users Fetching Petty Cash**

### **Get User's Petty Cash Balance**
```http
GET /api/finance/petty-cash-balance/:userId
Authorization: Bearer <jwt_token>
```

**Response:**
```javascript
{
  "success": true,
  "user": {
    "_id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  },
  "pettyCashBalance": {
    "currentBalance": 1450,
    "totalAllocated": 1500,
    "totalExpenses": 50,
    "totalReplenished": 0,
    "lastTransaction": "2025-01-15T10:30:00Z"
  }
}
```

**Access:** Admin, Finance, Finance Admin, Finance User (for own balance)

---

### **Get All Petty Cash Balances (Finance Only)**
```http
GET /api/finance/all-petty-cash-balances
Authorization: Bearer <jwt_token>
```

**Response:**
```javascript
{
  "success": true,
  "balances": [
    {
      "user": {
        "_id": "user_id_1",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "role": "admin"
      },
      "pettyCashBalance": {
        "currentBalance": 1450,
        "totalAllocated": 1500,
        "totalExpenses": 50,
        "totalReplenished": 0
      }
    },
    {
      "user": {
        "_id": "user_id_2",
        "firstName": "Jane",
        "lastName": "Smith",
        "email": "jane@example.com",
        "role": "manager"
      },
      "pettyCashBalance": {
        "currentBalance": 800,
        "totalAllocated": 1000,
        "totalExpenses": 200,
        "totalReplenished": 0
      }
    }
  ]
}
```

**Access:** Finance, Finance Admin, Finance User

---

### **Get User's Petty Cash Transactions**
```http
GET /api/finance/petty-cash-transactions/:userId
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `startDate` - Filter from date (optional)
- `endDate` - Filter to date (optional)

**Response:**
```javascript
{
  "success": true,
  "user": {
    "_id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  },
  "transactions": [
    {
      "_id": "transaction_entry_id",
      "transaction": {
        "_id": "transaction_id",
        "transactionId": "TXN-2025-001",
        "date": "2025-01-15T10:30:00Z",
        "description": "Petty cash allocated to John Doe"
      },
      "account": "1011",
      "accountName": "Admin Petty Cash",
      "debit": 1000,
      "credit": 0,
      "type": "asset",
      "source": "petty_cash_allocation",
      "sourceId": "user_id"
    },
    {
      "_id": "transaction_entry_id_2",
      "transaction": {
        "_id": "transaction_id_2",
        "transactionId": "TXN-2025-003",
        "date": "2025-01-16T14:20:00Z",
        "description": "Office supplies purchase"
      },
      "account": "5001",
      "accountName": "Office Supplies Expense",
      "debit": 50,
      "credit": 0,
      "type": "expense",
      "source": "petty_cash_expense",
      "sourceId": "user_id"
    }
  ]
}
```

**Access:** Admin, Finance, Finance Admin, Finance User (for own transactions)

---

## 🔄 **3. Complete Workflow Example**

### **Step 1: Finance Allocates Petty Cash**
```javascript
// Finance user allocates $1000 to admin
const allocationResponse = await fetch('/api/finance/allocate-petty-cash', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${financeToken}`
  },
  body: JSON.stringify({
    userId: "admin_user_id",
    amount: 1000,
    description: "Monthly petty cash for office supplies"
  })
});

const allocationResult = await allocationResponse.json();
console.log('Allocation result:', allocationResult);
```

### **Step 2: Admin Checks Their Balance**
```javascript
// Admin checks their petty cash balance
const balanceResponse = await fetch('/api/finance/petty-cash-balance/admin_user_id', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

const balanceResult = await balanceResponse.json();
console.log('Current balance:', balanceResult.pettyCashBalance.currentBalance);
```

### **Step 3: Admin Uses Petty Cash for Expense**
```javascript
// Admin uses petty cash for office supplies
const expenseResponse = await fetch('/api/finance/record-petty-cash-expense', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify({
    userId: "admin_user_id",
    amount: 50,
    description: "Purchased stationery",
    expenseCategory: "Office Supplies"
  })
});

const expenseResult = await expenseResponse.json();
console.log('Expense recorded:', expenseResult);
```

### **Step 4: Admin Views Transaction History**
```javascript
// Admin views their transaction history
const transactionsResponse = await fetch('/api/finance/petty-cash-transactions/admin_user_id', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

const transactionsResult = await transactionsResponse.json();
console.log('Transaction history:', transactionsResult.transactions);
```

---

## 🏗️ **4. Implementation Required**

### **Add Routes to Finance Index**

Add these routes to `src/routes/finance/index.js`:

```javascript
// Petty Cash Management Routes
router.post('/allocate-petty-cash', FinanceController.allocatePettyCash);
router.post('/replenish-petty-cash', FinanceController.replenishPettyCash);
router.post('/record-petty-cash-expense', FinanceController.recordPettyCashExpense);
router.get('/petty-cash-balance/:userId', FinanceController.getPettyCashBalance);
router.get('/all-petty-cash-balances', FinanceController.getAllPettyCashBalances);
router.get('/petty-cash-transactions/:userId', FinanceController.getPettyCashTransactions);
```

### **Import FinanceController**

Add this import at the top of `src/routes/finance/index.js`:

```javascript
const FinanceController = require('../../controllers/financeController');
```

---

## 💳 **5. Double-Entry Accounting**

### **Allocation Transaction:**
```javascript
// When finance allocates petty cash:
// DEBIT: Admin Petty Cash (1011) - $1000
// CREDIT: Bank Account (1000) - $1000
```

### **Expense Transaction:**
```javascript
// When admin uses petty cash:
// DEBIT: Office Supplies Expense (5001) - $50
// CREDIT: Admin Petty Cash (1011) - $50
```

### **Replenishment Transaction:**
```javascript
// When finance replenishes petty cash:
// DEBIT: Admin Petty Cash (1011) - $500
// CREDIT: Bank Account (1000) - $500
```

---

## 🎯 **6. Role-Based Petty Cash Accounts**

| User Role | Account Code | Account Name |
|-----------|--------------|--------------|
| `admin` | `1011` | Admin Petty Cash |
| `finance_admin` | `1012` | Finance Petty Cash |
| `finance_user` | `1012` | Finance Petty Cash |
| `property_manager` | `1013` | Property Manager Petty Cash |
| `maintenance` | `1014` | Maintenance Petty Cash |
| `default` | `1010` | General Petty Cash |

---

## 🔐 **7. Authentication & Authorization**

### **Required Headers:**
```javascript
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

### **Role Access:**
- **Finance, Finance Admin, Finance User**: Can allocate, replenish, and record expenses
- **Admin, Manager, Staff**: Can view their own balance and transactions
- **Finance roles**: Can view all balances and transactions

---

## 🚀 **8. Quick Start**

### **Enable Petty Cash Routes:**

1. **Uncomment** the routes in `src/routes/finance/index.js`
2. **Add** the FinanceController import
3. **Restart** the server

### **Test the Endpoints:**

```javascript
// Test allocation
curl -X POST http://localhost:3000/api/finance/allocate-petty-cash \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "user_id",
    "amount": 1000,
    "description": "Test allocation"
  }'

// Test balance check
curl -X GET http://localhost:3000/api/finance/petty-cash-balance/user_id \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✅ **Summary**

### **Finance Can:**
- ✅ Allocate petty cash to users
- ✅ Replenish petty cash
- ✅ Record petty cash expenses
- ✅ View all petty cash balances
- ✅ View all transaction history

### **Admin/Users Can:**
- ✅ View their petty cash balance
- ✅ View their transaction history
- ✅ Use petty cash for approved expenses

### **System Provides:**
- ✅ Double-entry accounting
- ✅ Role-based petty cash accounts
- ✅ Transaction audit trail
- ✅ Balance validation
- ✅ Automatic account mapping

The petty cash system is **fully implemented** and ready to use once the routes are exposed! 🎉
