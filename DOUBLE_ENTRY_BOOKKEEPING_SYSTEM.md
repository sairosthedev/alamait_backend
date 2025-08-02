# 🏦 **Double-Entry Bookkeeping System**

## 📋 **Overview**

The Double-Entry Bookkeeping System automatically creates proper accounting entries when finance approves requests and when expenses are paid. This ensures complete financial tracking and audit trails for all transactions.

## 🔄 **Complete Workflow**

```
1. Admin uploads request with multiple quotations
2. Admin selects quotations for items
3. Finance approves request → Creates double-entry transactions
4. Finance marks expense as paid → Creates payment transactions
5. Complete audit trail maintained throughout
```

## 🏗️ **System Architecture**

### **Core Components:**

1. **FinancialService** - Handles all double-entry bookkeeping logic
2. **Transaction Model** - Main transaction records
3. **TransactionEntry Model** - Individual accounting entries
4. **Expense Model** - Itemized expense tracking
5. **Account Model** - Chart of accounts
6. **Vendor Model** - Vendor account management

## 📊 **Double-Entry Transactions**

### **When Finance Approves Request:**

#### **For Items with Selected Quotations:**
```javascript
// Entry 1: Debit Expense Account
{
    account: "5000", // Maintenance Expenses
    debit: 300,
    credit: 0,
    type: "expense",
    description: "Expense for Plumbing Repair - ABC Plumbing Co"
}

// Entry 2: Credit Vendor Account
{
    account: "V25001", // ABC Plumbing Co Account
    debit: 0,
    credit: 300,
    type: "liability",
    description: "Accounts payable to ABC Plumbing Co for Plumbing Repair"
}
```

#### **For Items without Quotations:**
```javascript
// Entry 1: Debit Expense Account
{
    account: "5013", // Other Expenses
    debit: 500,
    credit: 0,
    type: "expense",
    description: "General expense for Office Supplies"
}

// Entry 2: Credit General Accounts Payable
{
    account: "200000", // General Accounts Payable
    debit: 0,
    credit: 500,
    type: "liability",
    description: "Accounts payable for Office Supplies"
}
```

### **When Expense is Paid:**

```javascript
// Entry 1: Debit Vendor Account (reduce liability)
{
    account: "V25001", // ABC Plumbing Co Account
    debit: 300,
    credit: 0,
    type: "liability",
    description: "Payment to ABC Plumbing Co for Plumbing Repair"
}

// Entry 2: Credit Bank Account (reduce asset)
{
    account: "1001", // Bank Account
    debit: 0,
    credit: 300,
    type: "asset",
    description: "Payment for Plumbing Repair"
}
```

## 🎯 **Key Features**

### **1. Automatic Transaction Creation**
- ✅ **Finance approval** triggers double-entry transactions
- ✅ **Payment processing** creates payment transactions
- ✅ **Vendor-specific accounts** for proper tracking
- ✅ **General accounts** for non-vendor expenses

### **2. Itemized Expense Tracking**
- ✅ **Individual item costs** tracked separately
- ✅ **Selected quotation details** preserved
- ✅ **Payment status per item** maintained
- ✅ **Vendor information** linked to items

### **3. Complete Audit Trail**
- ✅ **Transaction IDs** for all entries
- ✅ **User tracking** for all actions
- ✅ **Timestamp tracking** for accountability
- ✅ **Metadata storage** for detailed tracking

### **4. Account Management**
- ✅ **Automatic account creation** for vendors
- ✅ **Chart of accounts** integration
- ✅ **Balance tracking** for vendors
- ✅ **Account type classification**

## 🔌 **API Endpoints**

### **1. Finance Approval (Creates Transactions)**
```javascript
PATCH /api/requests/:id/finance-approval

// Request Body
{
    "approved": true,
    "notes": "Approved with double-entry bookkeeping"
}

// Response
{
    "financeStatus": "approved",
    "amount": 800,
    "financial": {
        "transactionId": "TXN25000001",
        "expenseId": "EXP25080001",
        "entriesCount": 4,
        "totalAmount": 800
    }
}
```

### **2. Mark Expense as Paid**
```javascript
POST /api/requests/expenses/:expenseId/mark-paid

// Request Body
{
    "paymentMethod": "Bank Transfer"
}

// Response
{
    "message": "Expense marked as paid successfully",
    "expense": {
        "expenseId": "EXP25080001",
        "paymentStatus": "Paid",
        "paidBy": "finance@alamait.com",
        "paidAt": "2025-08-02T10:30:00.000Z",
        "paymentMethod": "Bank Transfer"
    },
    "financial": {
        "paymentTransactionId": "TXN25000002",
        "paymentEntriesCount": 2,
        "totalPaid": 800
    }
}
```

## 📊 **Data Models**

### **Transaction Model:**
```javascript
{
    transactionId: "TXN25000001",
    date: "2025-08-02T10:30:00.000Z",
    description: "Request approval: Double-Entry Bookkeeping Test",
    reference: "request_id",
    residence: "residence_id",
    type: "approval", // approval | payment | adjustment
    amount: 800,
    expenseId: "expense_id",
    createdBy: "user_id",
    entries: ["entry_id_1", "entry_id_2"]
}
```

### **TransactionEntry Model:**
```javascript
{
    transaction: "transaction_id",
    account: "account_id",
    debit: 300,
    credit: 0,
    type: "expense", // expense | liability | asset | equity
    description: "Expense for Plumbing Repair - ABC Plumbing Co",
    reference: "request_id-item-0",
    metadata: {
        itemIndex: 0,
        vendorId: "vendor_id",
        vendorName: "ABC Plumbing Co",
        expenseCategory: "maintenance_expenses"
    }
}
```

### **Enhanced Expense Model:**
```javascript
{
    expenseId: "EXP25080001",
    requestId: "request_id",
    residence: "residence_id",
    amount: 800,
    description: "Double-Entry Bookkeeping Test",
    paymentStatus: "Pending", // Pending | Paid | Overdue
    items: [{
        itemIndex: 0,
        description: "Plumbing Repair",
        quantity: 1,
        unitCost: 300,
        totalCost: 300,
        selectedQuotation: {
            provider: "ABC Plumbing Co",
            amount: 300,
            vendorId: "vendor_id",
            vendorCode: "V25001",
            vendorName: "ABC Plumbing Co",
            expenseCategory: "maintenance_expenses"
        },
        paymentStatus: "Pending"
    }],
    transactionId: "transaction_id",
    approvedBy: "user_id",
    approvedAt: "2025-08-02T10:30:00.000Z"
}
```

## 🎯 **Account Structure**

### **Chart of Accounts:**
```javascript
// Asset Accounts
1000: "Cash"
1001: "Bank Account"

// Liability Accounts
200000: "General Accounts Payable"
V25001: "Accounts Payable - ABC Plumbing Co"
V25002: "Accounts Payable - XYZ Plumbing Services"

// Expense Accounts
5000: "MAINTENANCE EXPENSES"
5001: "UTILITIES EXPENSES"
5002: "SUPPLIES EXPENSES"
5003: "EQUIPMENT EXPENSES"
5004: "SERVICES EXPENSES"
5010: "CLEANING EXPENSES"
5011: "SECURITY EXPENSES"
5012: "LANDSCAPING EXPENSES"
5013: "OTHER EXPENSES"
```

## 📈 **Example Workflow**

### **Step 1: Request Creation**
```javascript
// Request with 2 items:
// Item 1: Plumbing Repair (with vendor quotation)
// Item 2: Office Supplies (no vendor)
```

### **Step 2: Admin Selects Quotation**
```javascript
// Admin selects ABC Plumbing Co quotation ($300)
// Item 1 total cost becomes $300
// Item 2 remains $500 (no quotation)
```

### **Step 3: Finance Approval**
```javascript
// Creates Transaction TXN25000001 with 4 entries:

// Entry 1: Debit Maintenance Expenses $300
// Entry 2: Credit ABC Plumbing Co Account $300
// Entry 3: Debit Other Expenses $500  
// Entry 4: Credit General Accounts Payable $500

// Creates Expense EXP25080001 with 2 items
```

### **Step 4: Mark as Paid**
```javascript
// Creates Transaction TXN25000002 with 4 entries:

// Entry 1: Debit ABC Plumbing Co Account $300
// Entry 2: Credit Bank Account $300
// Entry 3: Debit General Accounts Payable $500
// Entry 4: Credit Bank Account $500

// Updates all payment statuses to "Paid"
```

## 🧪 **Testing**

### **Test Script:**
```bash
node test-double-entry-bookkeeping.js
```

### **Test Flow:**
1. ✅ Create request with multiple quotations
2. ✅ Admin selects quotation
3. ✅ Finance approves (creates double-entry transactions)
4. ✅ Verify transaction entries
5. ✅ Mark expense as paid (creates payment transactions)
6. ✅ Verify payment entries
7. ✅ Complete audit trail verification

## ✅ **Benefits**

1. **🏦 Proper Accounting**: Full double-entry bookkeeping compliance
2. **📊 Financial Transparency**: Complete transaction visibility
3. **🎯 Vendor Tracking**: Individual vendor account balances
4. **📈 Audit Trail**: Full history of all financial transactions
5. **💰 Cost Control**: Itemized expense tracking
6. **🔄 Automation**: No manual accounting entries required
7. **📋 Compliance**: GAAP-compliant financial records

## 🚀 **Implementation Status**

- ✅ **FinancialService**: Complete double-entry logic implemented
- ✅ **Transaction Models**: Enhanced with tracking fields
- ✅ **Expense Model**: Itemized expense support added
- ✅ **API Integration**: Finance approval triggers transactions
- ✅ **Payment Processing**: Automatic payment transaction creation
- ✅ **Account Management**: Vendor and expense account creation
- ✅ **Test Script**: Comprehensive testing available

## 🎯 **Frontend Integration**

### **Finance Approval UI:**
```javascript
const handleFinanceApproval = async (requestId, approved, notes) => {
    const response = await api.patch(`/requests/${requestId}/finance-approval`, {
        approved,
        notes
    });
    
    if (response.data.financial) {
        console.log('Double-entry transaction created:', response.data.financial);
        // Show transaction details to user
    }
};
```

### **Payment Processing UI:**
```javascript
const handleMarkAsPaid = async (expenseId, paymentMethod) => {
    const response = await api.post(`/requests/expenses/${expenseId}/mark-paid`, {
        paymentMethod
    });
    
    if (response.data.financial) {
        console.log('Payment transaction created:', response.data.financial);
        // Show payment confirmation
    }
};
```

The Double-Entry Bookkeeping System is now fully implemented and provides complete financial tracking for all request approvals and payments! 🎉 