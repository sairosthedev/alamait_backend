# Standardized Expense System Implementation

## 🎯 **Overview**

Both **Admin Expenses** (`/admin/expenses`) and **Finance Expenses** (`/finance/expenses`) now use the **same data schema** and **same chart of accounts logic** to ensure all expenses properly create transaction entries with full debiting and crediting.

## 📊 **Unified Data Schema**

### **Required Fields** (Both Admin & Finance):
```javascript
{
  residence: ObjectId,        // Required - Residence ID
  category: String,          // Required - Expense category
  amount: Number,            // Required - Expense amount
  description: String,       // Required - Expense description
  expenseDate: Date,         // Required - Date of expense
  period: String,            // Required - 'weekly' or 'monthly'
  paymentStatus: String,     // Optional - 'Pending', 'Approved', 'Paid'
  paymentMethod: String,     // Optional - Payment method if paid
  paidDate: Date,           // Optional - Date when paid
  paidBy: ObjectId,         // Optional - User who paid
  receiptImage: Object,     // Optional - Receipt image data
  maintenanceRequestId: ObjectId // Optional - Linked maintenance request
}
```

### **Valid Categories** (Both Systems):
- `'Maintenance'` → Account Code: `'5003'` (Transportation Expense)
- `'Utilities'` → Account Code: `'5099'` (Other Operating Expenses)
- `'Taxes'` → Account Code: `'5099'` (Other Operating Expenses)
- `'Insurance'` → Account Code: `'5099'` (Other Operating Expenses)
- `'Salaries'` → Account Code: `'5099'` (Other Operating Expenses)
- `'Supplies'` → Account Code: `'5099'` (Other Operating Expenses)
- `'Other'` → Account Code: `'5099'` (Other Operating Expenses)

### **Valid Payment Methods** (Both Systems):
- `'Cash'` → Account Code: `'1011'` (Admin Petty Cash)
- `'Bank Transfer'` → Account Code: `'1000'` (Bank - Main Account)
- `'Ecocash'` → Account Code: `'1011'` (Admin Petty Cash)
- `'Innbucks'` → Account Code: `'1011'` (Admin Petty Cash)
- `'Petty Cash'` → Account Code: `'1011'` (Admin Petty Cash)
- `'Online Payment'` → Account Code: `'1000'` (Bank - Main Account)
- `'MasterCard'` → Account Code: `'1000'` (Bank - Main Account)
- `'Visa'` → Account Code: `'1000'` (Bank - Main Account)
- `'PayPal'` → Account Code: `'1000'` (Bank - Main Account)

## 🔄 **Transaction Entry Creation Logic**

### **1. When Expense is Created (Pending Status)**:
```javascript
// Creates AP Liability
Transaction Entry 1: Debit Expense Account (e.g., 5003 for Maintenance)
Transaction Entry 2: Credit Accounts Payable (2000) - Creates liability
```

### **2. When Expense is Approved (Approved Status)**:
```javascript
// Creates AP Liability (if not already created)
Transaction Entry 1: Debit Expense Account (e.g., 5003 for Maintenance)
Transaction Entry 2: Credit Accounts Payable (2000) - Creates liability
```

### **3. When Expense is Paid (Paid Status)**:
```javascript
// Reduces AP Liability and Records Payment
Transaction Entry 1: Debit Accounts Payable (2000) - Reduces liability
Transaction Entry 2: Credit Source Account (e.g., 1000 for Bank) - Records payment
```

## 🛠️ **Implementation Details**

### **Admin Expense Controller** (`src/controllers/admin/expenseController.js`):

#### **addExpense Function**:
- ✅ Uses same `CATEGORY_TO_ACCOUNT_CODE` mapping
- ✅ Uses same `PAYMENT_METHOD_TO_ACCOUNT_CODE` mapping
- ✅ Creates transaction entries for both pending and paid expenses
- ✅ Creates AP liability for pending expenses
- ✅ Creates payment transactions for paid expenses
- ✅ Includes audit logging

#### **approveExpense Function**:
- ✅ Updates expense status to 'Paid'
- ✅ Creates AP reduction transaction
- ✅ Records payment from source account
- ✅ Includes audit logging

### **Finance Expense Controller** (`src/controllers/finance/expenseController.js`):

#### **createExpense Function**:
- ✅ Uses same `CATEGORY_TO_ACCOUNT_CODE` mapping
- ✅ Uses same `PAYMENT_METHOD_TO_ACCOUNT_CODE` mapping
- ✅ Creates transaction entries for both pending and paid expenses
- ✅ Creates AP liability for pending expenses
- ✅ Creates payment transactions for paid expenses
- ✅ Includes audit logging

#### **approveExpense Function**:
- ✅ Updates expense status to 'Approved' (creates AP liability)
- ✅ Creates expense and AP liability entries
- ✅ Includes audit logging

#### **markExpenseAsPaid Function**:
- ✅ Updates expense status to 'Paid'
- ✅ Creates AP reduction transaction
- ✅ Records payment from source account
- ✅ Includes audit logging

## 📈 **Financial Impact**

### **Chart of Accounts Integration**:
- ✅ **All expenses** create proper transaction entries
- ✅ **Category mapping** ensures correct expense account debits
- ✅ **Payment method mapping** ensures correct source account credits
- ✅ **AP liability** properly tracked for pending expenses
- ✅ **AP reduction** properly recorded when expenses are paid

### **Balance Sheet Impact**:
- **Assets**: Source accounts (bank/cash) reduced when payments made
- **Liabilities**: AP account shows outstanding expense obligations
- **Expenses**: Properly categorized and recorded

### **Income Statement Impact**:
- **Expenses**: Recognized when approved (accrual basis)
- **Categories**: Properly mapped to chart of accounts

## 🔍 **Transaction Flow Examples**

### **Example 1: Admin Creates Pending Maintenance Expense**
```
Expense: $500 Maintenance (Pending)
↓
Transaction Entry 1: Debit Maintenance Expense (5003) - $500
Transaction Entry 2: Credit Accounts Payable (2000) - $500
↓
Result: AP liability created, expense recognized
```

### **Example 2: Admin Approves and Pays Expense**
```
Expense: $500 Maintenance (Paid via Bank Transfer)
↓
Transaction Entry 1: Debit Accounts Payable (2000) - $500
Transaction Entry 2: Credit Bank Account (1000) - $500
↓
Result: AP liability reduced, bank account reduced
```

### **Example 3: Finance Creates Paid Utility Expense**
```
Expense: $200 Utilities (Paid via Cash)
↓
Transaction Entry 1: Debit Other Operating Expenses (5099) - $200
Transaction Entry 2: Credit Admin Petty Cash (1011) - $200
↓
Result: Expense recorded, petty cash reduced
```

## ✅ **Verification Checklist**

### **Data Schema Consistency**:
- [x] Both controllers use same required fields
- [x] Both controllers use same category validation
- [x] Both controllers use same payment method validation
- [x] Both controllers use same ID generation logic

### **Transaction Entry Creation**:
- [x] Both controllers create transaction entries
- [x] Both controllers use same account mappings
- [x] Both controllers handle AP liability properly
- [x] Both controllers record payments correctly

### **Audit Logging**:
- [x] Both controllers create audit logs
- [x] Both controllers track user actions
- [x] Both controllers record before/after states

### **Error Handling**:
- [x] Both controllers validate account existence
- [x] Both controllers handle transaction failures gracefully
- [x] Both controllers provide meaningful error messages

## 🎯 **Benefits**

1. **Consistency**: Both admin and finance systems work identically
2. **Accuracy**: All expenses create proper transaction entries
3. **Compliance**: Full double-entry bookkeeping maintained
4. **Traceability**: Complete audit trail for all expenses
5. **Reporting**: Accurate financial statements from transaction entries
6. **Maintenance**: Single source of truth for expense logic

## 📋 **API Endpoints**

### **Admin Expense Endpoints**:
- `POST /admin/expenses` - Create expense (with transaction entries)
- `PUT /admin/expenses/:id/approve` - Approve and pay expense
- `GET /admin/expenses` - List expenses

### **Finance Expense Endpoints**:
- `POST /finance/expenses` - Create expense (with transaction entries)
- `PATCH /finance/expenses/:id/approve` - Approve expense (creates AP)
- `PATCH /finance/expenses/:id/mark-paid` - Mark expense as paid
- `GET /finance/expenses` - List expenses

**All endpoints now create proper transaction entries that feed into balance sheets, income statements, and cash flow statements!** 🎯 