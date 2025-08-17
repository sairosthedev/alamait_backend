# Residence/Entity Requirement for Transactions

## 🎯 **Overview**

All transactions and transaction entries in the system **MUST** have a `residence` or `entity` field populated. This ensures proper financial tracking, reporting, and filtering by property/residence.

## ✅ **What This Ensures**

1. **Proper Financial Tracking**: Every transaction is linked to a specific property/residence
2. **Accurate Reporting**: Financial reports can be filtered by residence
3. **Audit Trail**: Complete traceability of financial activities
4. **Multi-Property Management**: Support for multiple properties in one system

## 🔧 **Implementation Details**

### **1. Transaction Model Requirements**

```javascript
// src/models/Transaction.js
const TransactionSchema = new mongoose.Schema({
  // ... other fields
  residence: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Residence', 
    required: true  // ✅ REQUIRED
  },
  residenceName: { 
    type: String 
  },
  // ... other fields
});
```

### **2. TransactionEntry Model Requirements**

```javascript
// src/models/TransactionEntry.js
const transactionEntrySchema = new mongoose.Schema({
  // ... other fields
  residence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Residence',
    required: false // Optional for backward compatibility, but should be populated
  },
  metadata: {
    residenceId: String,    // ✅ Should contain residence ID
    residenceName: String   // ✅ Should contain residence name
  }
  // ... other fields
});
```

## 📋 **How Residence Information is Populated**

### **Option 1: From Request (Finance Approval)**

When finance approves a request, the residence comes from the request object:

```javascript
// In FinancialService.createApprovalTransaction()
const transaction = new Transaction({
  // ... other fields
  residence: request.residence._id || request.residence, // ✅ From request
  residenceName: request.residence?.name || 'Unknown Residence'
});

// Transaction entries also get residence info
const expenseEntry = new TransactionEntry({
  // ... other fields
  residence: request.residence._id || request.residence, // ✅ From request
  metadata: {
    residenceId: request.residence._id || request.residence,
    residenceName: request.residence?.name || 'Unknown'
  }
});
```

### **Option 2: From Expense Record**

When creating transactions from expenses, the residence comes from the expense:

```javascript
// In FinancialService.createPaymentTransaction()
const vendorEntry = new TransactionEntry({
  // ... other fields
  residence: expense.residence, // ✅ From expense
  metadata: {
    residenceId: expense.residence._id || expense.residence,
    residenceName: expense.residence?.name || 'Unknown'
  }
});
```

### **Option 3: Manual Selection**

When manually creating transactions, the residence must be explicitly provided:

```javascript
// In transactionController.createTransactionEntry()
const {
  description,
  reference,
  residence, // ✅ REQUIRED in request body
  entries
} = req.body;

// Validate residence is provided
if (!residence) {
  return res.status(400).json({
    success: false,
    message: 'Residence/entity is required for transaction creation'
  });
}

const transaction = new Transaction({
  // ... other fields
  residence: residence._id || residence, // ✅ From request body
  residenceName: residence?.name || 'Unknown Residence'
});
```

## 🚨 **Validation Rules**

### **1. Required Fields**

- **Transaction**: `residence` field is **REQUIRED**
- **TransactionEntry**: `residence` field should be populated (optional for backward compatibility)
- **Metadata**: Should contain `residenceId` and `residenceName`

### **2. Data Types**

- **residence**: ObjectId (reference to Residence model)
- **residenceName**: String (human-readable name)
- **metadata.residenceId**: String/ObjectId
- **metadata.residenceName**: String

### **3. Validation Checks**

```javascript
// Validate residence information exists
if (!request.residence) {
  throw new Error('Request must have residence information for transaction creation');
}

// Ensure residence ID is properly extracted
residence: request.residence._id || request.residence

// Validate residence is provided in manual creation
if (!residence) {
  return res.status(400).json({
    success: false,
    message: 'Residence/entity is required for transaction creation'
  });
}
```

## 📊 **Frontend Requirements**

### **1. Finance Approval Form**

```json
{
  "reason": "yes",
  "createDoubleEntryTransactions": true,
  "vendorDetails": [],
  "residence": {
    "_id": "67d723cf20f89c4ae69804f3",
    "name": "St Kilda Student House"
  }
}
```

### **2. Manual Transaction Creation**

```json
{
  "description": "Monthly utility payment",
  "reference": "UTIL-2025-01",
  "residence": {
    "_id": "67d723cf20f89c4ae69804f3",
    "name": "St Kilda Student House"
  },
  "entries": [
    {
      "accountCode": "5001",
      "debit": 250,
      "credit": 0
    },
    {
      "accountCode": "1000",
      "debit": 0,
      "credit": 250
    }
  ]
}
```

## 🔍 **Database Queries**

### **1. Find Transactions by Residence**

```javascript
// Find all transactions for a specific residence
const transactions = await Transaction.find({ 
  residence: residenceId 
});

// Find all transaction entries for a specific residence
const entries = await TransactionEntry.find({ 
  residence: residenceId 
});
```

### **2. Financial Reports by Residence**

```javascript
// Get expense summary by residence
const expenseSummary = await TransactionEntry.aggregate([
  { $match: { residence: residenceId, type: 'expense' } },
  { $group: { 
    _id: '$account', 
    totalDebit: { $sum: '$debit' } 
  }}
]);
```

## ✅ **Benefits of This Implementation**

1. **Complete Financial Tracking**: Every transaction is linked to a property
2. **Accurate Reporting**: Financial reports can be filtered by residence
3. **Audit Compliance**: Full traceability for compliance requirements
4. **Multi-Property Support**: Easy management of multiple properties
5. **Data Integrity**: Prevents orphaned transactions without residence info

## 🚀 **Next Steps**

1. **Update existing transactions** that don't have residence information
2. **Test the new validation** with various transaction creation scenarios
3. **Update frontend forms** to require residence selection
4. **Create migration scripts** for existing data if needed

## 📝 **Example Usage**

```javascript
// Creating a transaction from a request
const transaction = await FinancialService.createApprovalTransaction(request, user);

// Creating a manual transaction
const transaction = await Transaction.create({
  description: "Monthly maintenance",
  reference: "MAINT-2025-01",
  residence: residenceId,        // ✅ REQUIRED
  residenceName: "St Kilda",    // ✅ REQUIRED
  type: "manual",
  createdBy: userId
});

// Creating transaction entries
const entry = await TransactionEntry.create({
  transaction: transactionId,
  account: accountId,
  debit: 100,
  credit: 0,
  residence: residenceId,       // ✅ Should be populated
  metadata: {
    residenceId: residenceId,   // ✅ Should be populated
    residenceName: "St Kilda"   // ✅ Should be populated
  }
});
```

This implementation ensures that all financial transactions are properly linked to their respective properties/residences, enabling accurate financial reporting and management.

