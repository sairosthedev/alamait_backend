# 🎯 **Exact Backend-Frontend Matching Guide**

## 📋 **Required Fields & Actions for Each Process**

---

## 🏢 **1. Admin Expense Approval**

### **Route:**
```javascript
POST /api/admin/expenses/:id/approve
```

### **Required Fields:**
```javascript
{
  "paymentMethod": "Bank Transfer" | "Cash" | "Online Payment" | "Ecocash" | "Innbucks",
  "notes": "string (optional)"
}
```

### **Frontend Form Fields:**
```javascript
// Required Fields
paymentMethod: string (dropdown)
notes: string (textarea, optional)

// Validation
- paymentMethod must be one of the allowed values
- expenseId must be valid ObjectId
```

### **Expected Response:**
```javascript
{
  "success": true,
  "message": "Expense approved successfully",
  "data": {
    "_id": "expenseId",
    "paymentStatus": "Paid",
    "paymentMethod": "Bank Transfer",
    "paidDate": "2025-01-15T10:30:00Z",
    "paidBy": "userId"
  }
}
```

---

## 📝 **2. Admin Request Approval**

### **Route:**
```javascript
POST /api/requests/:id/admin-approval
```

### **Required Fields:**
```javascript
{
  "approved": true | false,
  "notes": "string (optional)"
}
```

### **Frontend Form Fields:**
```javascript
// Required Fields
approved: boolean (radio buttons)
notes: string (textarea, optional)

// Validation
- approved must be boolean
- requestId must be valid ObjectId
```

### **Expected Response:**
```javascript
{
  "success": true,
  "message": "Request approved successfully",
  "data": {
    "_id": "requestId",
    "status": "pending",
    "approval": {
      "admin": {
        "approved": true,
        "approvedBy": "userId",
        "approvedAt": "2025-01-15T10:30:00Z",
        "notes": "Approval notes"
      }
    }
  }
}
```

---

## 💰 **3. Finance Request Approval**

### **Route:**
```javascript
POST /api/requests/:id/finance-approval
```

### **Required Fields:**
```javascript
{
  "approved": true | false,
  "rejected": false,
  "waitlisted": false,
  "notes": "string (optional)",
  "selectedQuotationId": "string (required if approved and quotations exist)"
}
```

### **Frontend Form Fields:**
```javascript
// Required Fields
approved: boolean (radio)
rejected: boolean (radio)
waitlisted: boolean (radio)
notes: string (textarea, optional)
selectedQuotationId: string (dropdown, conditional)

// Validation
- Only one of approved/rejected/waitlisted can be true
- If approved and request has quotations, selectedQuotationId is required
- requestId must be valid ObjectId
```

### **Expected Response:**
```javascript
{
  "success": true,
  "message": "Request processed successfully",
  "data": {
    "_id": "requestId",
    "financeStatus": "approved",
    "convertedToExpense": true,
    "expenseId": "expenseId",
    "approval": {
      "finance": {
        "approved": true,
        "approvedBy": "userId",
        "approvedAt": "2025-01-15T10:30:00Z",
        "notes": "Finance notes"
      }
    }
  }
}
```

---

## 🏠 **4. Residence Filtering for Financial Reports**

### **Routes (All Support Residence Parameter):**
```javascript
GET /api/financial-reports/income-statement?period=2025&residence=residenceId&basis=cash
GET /api/financial-reports/balance-sheet?asOf=2025-12-31&residence=residenceId&basis=cash
GET /api/financial-reports/cash-flow?period=2025&residence=residenceId&basis=cash
GET /api/financial-reports/monthly-income-statement?period=2025&residence=residenceId&basis=cash
GET /api/financial-reports/monthly-balance-sheet?period=2025&residence=residenceId&basis=cash
GET /api/financial-reports/monthly-cash-flow?period=2025&residence=residenceId&basis=cash
```

### **Required Query Parameters:**
```javascript
// Required
period: string (e.g., "2025")
asOf: string (for balance sheet, e.g., "2025-12-31")

// Optional
residence: string (ObjectId)
basis: "cash" | "accrual" (default: "cash")
```

### **Frontend Filter Fields:**
```javascript
// Required Fields
period: string (dropdown: 2024, 2025)
asOf: string (date picker, for balance sheet)

// Optional Fields
residence: string (dropdown, populated from /api/residences)
basis: string (dropdown: cash, accrual)
```

### **Expected Response (with residence):**
```javascript
{
  "success": true,
  "data": {
    "period": "2025",
    "residence": {
      "_id": "residenceId",
      "name": "Alamait Main Building",
      "address": "123 Main Street"
    },
    "basis": "cash",
    "revenue": {
      "january": 5000,
      "february": 5500,
      "total_revenue": 10500
    },
    "expenses": {
      "january": 2000,
      "february": 2200,
      "total_expenses": 4200
    },
    "net_income": 6300
  }
}
```

---

## 💳 **5. Student Payment Creation**

### **Route:**
```javascript
POST /api/payments
```

### **Required Fields:**
```javascript
{
  "student": "studentId (ObjectId)",
  "room": "roomId (ObjectId)",
  "residence": "residenceId (ObjectId)",
  "amount": number,
  "paymentMethod": "Cash" | "Bank Transfer" | "Online Payment",
  "description": "string (optional)",
  "date": "2025-01-15T10:30:00Z"
}
```

### **Frontend Form Fields:**
```javascript
// Required Fields
student: string (dropdown, populated from /api/students)
room: string (dropdown, populated from /api/rooms)
residence: string (dropdown, populated from /api/residences)
amount: number (input)
paymentMethod: string (dropdown)
date: string (date picker)

// Optional Fields
description: string (textarea)
```

### **Expected Response:**
```javascript
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "_id": "paymentId",
    "student": "studentId",
    "room": "roomId",
    "residence": "residenceId",
    "amount": 500,
    "paymentMethod": "Cash",
    "date": "2025-01-15T10:30:00Z",
    "description": "Rent payment"
  }
}
```

---

## 🔄 **6. Transaction Management**

### **Routes:**
```javascript
GET /api/finance/transactions - Get all transactions
GET /api/finance/transactions/summary - Get transaction summary
GET /api/finance/transactions/entries - Get transaction entries
GET /api/finance/transactions/:id - Get transaction by ID
GET /api/finance/transactions/:id/entries - Get entries for transaction
```

### **Query Parameters (for filtering):**
```javascript
// Optional filters
dateFrom: string (e.g., "2025-01-01")
dateTo: string (e.g., "2025-12-31")
source: string (e.g., "payment", "expense_payment")
residence: string (ObjectId)
```

### **Expected Response:**
```javascript
{
  "success": true,
  "data": {
    "transactions": [
      {
        "_id": "transactionId",
        "transactionId": "TXN-2025-001",
        "date": "2025-01-15T10:30:00Z",
        "description": "Student rent payment",
        "source": "payment",
        "sourceId": "paymentId",
        "residence": "residenceId",
        "totalDebit": 500,
        "totalCredit": 500,
        "entries": [
          {
            "accountCode": "1001",
            "accountName": "Cash",
            "accountType": "Asset",
            "debit": 500,
            "credit": 0
          },
          {
            "accountCode": "4001",
            "accountName": "Rental Income",
            "accountType": "Income",
            "debit": 0,
            "credit": 500
          }
        ]
      }
    ]
  }
}
```

---

## 🏗️ **7. Maintenance Request Approval**

### **Route:**
```javascript
POST /api/requests/:id/admin-approval
```

### **Required Fields:**
```javascript
{
  "approved": true | false,
  "notes": "string (optional)"
}
```

### **Frontend Form Fields:**
```javascript
// Required Fields
approved: boolean (radio buttons)
notes: string (textarea, optional)

// Validation
- approved must be boolean
- requestId must be valid ObjectId
```

### **Expected Response:**
```javascript
{
  "success": true,
  "message": "Maintenance request approved successfully",
  "data": {
    "_id": "requestId",
    "status": "pending",
    "approval": {
      "admin": {
        "approved": true,
        "approvedBy": "userId",
        "approvedAt": "2025-01-15T10:30:00Z",
        "notes": "Maintenance approved"
      }
    }
  }
}
```

---

## 📊 **8. Financial Reports Data Structure**

### **Income Statement Response:**
```javascript
{
  "success": true,
  "data": {
    "period": "2025",
    "residence": {
      "_id": "residenceId",
      "name": "Building Name",
      "address": "Address"
    },
    "basis": "cash",
    "revenue": {
      "january": 5000,
      "february": 5500,
      "march": 6000,
      "total_revenue": 16500
    },
    "expenses": {
      "january": 2000,
      "february": 2200,
      "march": 2400,
      "total_expenses": 6600
    },
    "net_income": 9900,
    "gross_profit": 16500,
    "operating_income": 9900
  }
}
```

### **Balance Sheet Response:**
```javascript
{
  "success": true,
  "data": {
    "asOf": "2025-12-31",
    "residence": {
      "_id": "residenceId",
      "name": "Building Name",
      "address": "Address"
    },
    "basis": "cash",
    "assets": {
      "1001 - Cash": 50000,
      "1002 - Bank Account": 100000,
      "total_assets": 150000
    },
    "liabilities": {
      "2001 - Accounts Payable": 5000,
      "total_liabilities": 5000
    },
    "equity": {
      "3001 - Retained Earnings": 145000,
      "total_equity": 145000
    },
    "total_liabilities_and_equity": 150000
  }
}
```

### **Cash Flow Response:**
```javascript
{
  "success": true,
  "data": {
    "period": "2025",
    "residence": {
      "_id": "residenceId",
      "name": "Building Name",
      "address": "Address"
    },
    "basis": "cash",
    "operating_activities": {
      "january": 3000,
      "february": 3300,
      "march": 3600,
      "total": 9900
    },
    "investing_activities": {
      "january": -5000,
      "february": 0,
      "march": 0,
      "total": -5000
    },
    "financing_activities": {
      "january": 0,
      "february": 0,
      "march": 0,
      "total": 0
    },
    "net_cash_flow": 4900
  }
}
```

---

## 🔧 **9. Required API Endpoints for Frontend**

### **Data Fetching:**
```javascript
GET /api/residences - Get all residences for filtering
GET /api/students - Get students for payment form
GET /api/rooms - Get rooms for payment form
GET /api/requests - Get requests for approval
GET /api/expenses - Get expenses for approval
```

### **Financial Reports:**
```javascript
GET /api/financial-reports/income-statement
GET /api/financial-reports/balance-sheet
GET /api/financial-reports/cash-flow
GET /api/financial-reports/monthly-income-statement
GET /api/financial-reports/monthly-balance-sheet
GET /api/financial-reports/monthly-cash-flow
```

### **Transactions:**
```javascript
GET /api/finance/transactions
GET /api/finance/transactions/summary
GET /api/finance/transactions/entries
```

### **Actions:**
```javascript
POST /api/admin/expenses/:id/approve
POST /api/requests/:id/admin-approval
POST /api/requests/:id/finance-approval
POST /api/payments
```

---

## ✅ **10. Validation Rules**

### **Required Field Validation:**
```javascript
// Payment Method
const validPaymentMethods = [
  "Bank Transfer", "Cash", "Online Payment", "Ecocash", "Innbucks"
];

// Amount
const amount = parseFloat(value);
if (isNaN(amount) || amount <= 0) {
  throw new Error("Amount must be a positive number");
}

// ObjectId Validation
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// Date Validation
const isValidDate = (date) => {
  return !isNaN(new Date(date).getTime());
};
```

### **Form Validation Examples:**
```javascript
// Admin Expense Approval
if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
  showError("Please select a valid payment method");
  return;
}

// Finance Request Approval
if (approved && request.quotations?.length > 0 && !selectedQuotationId) {
  showError("Please select a quotation for approved requests");
  return;
}

// Student Payment
if (!student || !room || !residence || !amount || !paymentMethod) {
  showError("Please fill in all required fields");
  return;
}
```

This guide provides the exact fields, actions, and routes that match your backend implementation. Use these specifications to build your frontend forms and API calls. 