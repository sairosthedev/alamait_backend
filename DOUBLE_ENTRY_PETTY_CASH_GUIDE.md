# 📊 Double-Entry Accounting & Petty Cash Management Guide

## 🎯 **What is Double-Entry Accounting?**

Double-entry accounting is a fundamental accounting principle where **every financial transaction affects at least two accounts** with equal and opposite entries, ensuring the accounting equation always balances:

### **📐 The Accounting Equation:**
```
Assets = Liabilities + Equity
```

### **💡 Core Principles:**

1. **Every transaction has equal debits and credits**
2. **Assets = Liabilities + Equity** (always balanced)
3. **Debits increase assets/expenses, decrease liabilities/income**
4. **Credits increase liabilities/income, decrease assets/expenses**

## 🔄 **Double-Entry Examples**

### **Example 1: Petty Cash Initialization**
```
When establishing a $500 petty cash fund:
Dr. Petty Cash: $500 (Asset increases)
Cr. Bank Account: $500 (Asset decreases)
```

### **Example 2: Petty Cash Expense**
```
When using $50 for office supplies:
Dr. Office Supplies Expense: $50 (Expense increases)
Cr. Petty Cash: $50 (Asset decreases)
```

### **Example 3: Petty Cash Replenishment**
```
When replenishing $200 from bank:
Dr. Petty Cash: $200 (Asset increases)
Cr. Bank Account: $200 (Asset decreases)
```

## 💰 **Petty Cash Management System**

### **📋 System Overview**

The petty cash system provides endpoints for:
- ✅ **Initialize petty cash fund**
- ✅ **Replenish petty cash fund**
- ✅ **Record petty cash expenses**
- ✅ **Get petty cash status**
- ✅ **Generate petty cash reports**

### **🔗 API Endpoints**

#### **1. Initialize Petty Cash Fund**
```http
POST /api/finance/petty-cash/initialize
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 500,
  "custodian": "John Doe",
  "description": "Main office petty cash fund"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Petty cash fund initialized successfully",
  "data": {
    "pettyCash": {
      "fundCode": "PC0001",
      "initialAmount": 500,
      "currentBalance": 500,
      "custodian": "John Doe",
      "status": "active"
    },
    "transactionId": "TXN1234567890"
  }
}
```

#### **2. Replenish Petty Cash Fund**
```http
POST /api/finance/petty-cash/replenish
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 200,
  "description": "Monthly replenishment",
  "receipts": ["receipt1.pdf", "receipt2.pdf"]
}
```

#### **3. Record Petty Cash Expense**
```http
POST /api/finance/petty-cash/expense
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 25.50,
  "category": "office_supplies",
  "description": "Printer paper and ink",
  "receipt": "receipt.pdf"
}
```

#### **4. Get Petty Cash Status**
```http
GET /api/finance/petty-cash/status
Authorization: Bearer <token>
```

#### **5. Get Petty Cash Report**
```http
GET /api/finance/petty-cash/report?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer <token>
```

## 🏦 **Account Codes Used**

| Account Code | Account Name | Type | Purpose |
|--------------|--------------|------|---------|
| **1010** | Petty Cash | Asset | Petty cash fund balance |
| **1000** | Bank Account | Asset | Source for replenishments |
| **5000** | General Expenses | Expense | Default expense category |
| **5001** | Office Supplies | Expense | Office supplies expenses |
| **5002** | Transportation | Expense | Transportation expenses |
| **5003** | Meals & Entertainment | Expense | Food and entertainment |
| **5004** | Maintenance | Expense | Maintenance expenses |

## 📝 **Transaction Categories**

### **Expense Categories:**
- **office_supplies**: Office supplies and stationery
- **transportation**: Travel and transportation costs
- **meals**: Food and entertainment expenses
- **maintenance**: Maintenance and repair costs
- **other**: Miscellaneous expenses

## 🔧 **Implementation Details**

### **1. Petty Cash Model (`src/models/finance/PettyCash.js`)**

```javascript
const pettyCashSchema = new mongoose.Schema({
    fundCode: { type: String, required: true, unique: true },
    initialAmount: { type: Number, required: true, min: 0 },
    currentBalance: { type: Number, required: true, min: 0, default: 0 },
    custodian: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive', 'closed'], default: 'active' },
    replenishmentHistory: [...],
    expenseHistory: [...],
    // ... other fields
});
```

### **2. Controller Methods (`src/controllers/finance/pettyCashController.js`)**

#### **Initialize Petty Cash:**
```javascript
exports.initializePettyCash = async (req, res) => {
    // 1. Validate input
    // 2. Check if fund already exists
    // 3. Create petty cash record
    // 4. Create double-entry transaction:
    //    Dr. Petty Cash, Cr. Bank Account
    // 5. Return response
};
```

#### **Record Expense:**
```javascript
exports.recordExpense = async (req, res) => {
    // 1. Validate input
    // 2. Check sufficient balance
    // 3. Update petty cash balance
    // 4. Create double-entry transaction:
    //    Dr. Expense Account, Cr. Petty Cash
    // 5. Return response
};
```

### **3. Routes (`src/routes/finance/pettyCashRoutes.js`)**

```javascript
// Initialize petty cash fund
router.post('/initialize', 
    authenticateToken, 
    checkRole(['admin', 'finance_admin']), 
    validatePettyCashInitialization,
    pettyCashController.initializePettyCash
);

// Record petty cash expense
router.post('/expense', 
    authenticateToken, 
    checkRole(['admin', 'finance_admin', 'finance_user']), 
    validatePettyCashExpense,
    pettyCashController.recordExpense
);
```

## 📊 **Double-Entry Transaction Examples**

### **Transaction 1: Petty Cash Initialization**
```javascript
const transactionEntry = new TransactionEntry({
    transactionId: "TXN1234567890",
    date: new Date(),
    description: "Petty Cash Fund Initialization: Main office petty cash fund",
    entries: [
        {
            accountCode: "1010", // Petty Cash
            debit: 500,
            credit: 0,
            description: "Petty cash fund established"
        },
        {
            accountCode: "1000", // Bank Account
            debit: 0,
            credit: 500,
            description: "Cash withdrawn from bank for petty cash"
        }
    ],
    totalDebit: 500,
    totalCredit: 500,
    source: "petty_cash_initialization",
    sourceModel: "PettyCash"
});
```

### **Transaction 2: Petty Cash Expense**
```javascript
const transactionEntry = new TransactionEntry({
    transactionId: "TXN1234567891",
    date: new Date(),
    description: "Petty Cash Expense: Printer paper and ink",
    entries: [
        {
            accountCode: "5001", // Office Supplies
            debit: 25.50,
            credit: 0,
            description: "office_supplies expense from petty cash"
        },
        {
            accountCode: "1010", // Petty Cash
            debit: 0,
            credit: 25.50,
            description: "Petty cash used for expense"
        }
    ],
    totalDebit: 25.50,
    totalCredit: 25.50,
    source: "petty_cash_expense",
    sourceModel: "PettyCash"
});
```

## 🎯 **Best Practices**

### **✅ DO:**
1. **Always create double-entry transactions** for every petty cash operation
2. **Validate input data** before processing
3. **Check sufficient balance** before recording expenses
4. **Use proper account codes** for accurate categorization
5. **Maintain detailed audit trail** with transaction IDs
6. **Reconcile petty cash regularly** to ensure accuracy

### **❌ DON'T:**
1. **Skip transaction creation** for any petty cash operation
2. **Use wrong account codes** or categories
3. **Allow expenses** without sufficient balance
4. **Forget to update petty cash balance** after operations
5. **Mix different expense categories** in single transactions

## 🔍 **Verification & Monitoring**

### **Regular Checks:**
1. **Daily**: Verify all petty cash transactions are recorded
2. **Weekly**: Reconcile petty cash balance with expected balance
3. **Monthly**: Generate petty cash reports and review expenses

### **Key Metrics:**
- **Current Balance**: Should match expected balance
- **Total Expenses**: Tracked by category
- **Replenishment Frequency**: Monitor replenishment patterns
- **Variance**: Difference between actual and expected balance

## 🚀 **Quick Start**

### **1. Initialize Petty Cash Fund:**
```bash
curl -X POST http://localhost:5000/api/finance/petty-cash/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "amount": 500,
    "custodian": "John Doe",
    "description": "Main office petty cash fund"
  }'
```

### **2. Record an Expense:**
```bash
curl -X POST http://localhost:5000/api/finance/petty-cash/expense \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "amount": 25.50,
    "category": "office_supplies",
    "description": "Printer paper and ink"
  }'
```

### **3. Check Status:**
```bash
curl -X GET http://localhost:5000/api/finance/petty-cash/status \
  -H "Authorization: Bearer <token>"
```

## 📝 **Summary**

The petty cash management system provides:

1. **✅ Complete double-entry accounting** for all petty cash operations
2. **✅ Proper account categorization** for expense tracking
3. **✅ Balance validation** to prevent overspending
4. **✅ Audit trail** with detailed transaction records
5. **✅ Role-based access control** for security
6. **✅ Comprehensive reporting** for monitoring and analysis

The system ensures that every petty cash transaction follows proper double-entry accounting principles, maintaining accurate financial records and providing complete audit trails. 