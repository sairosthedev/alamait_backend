# 📋 Itemized Expense System Guide

## 📋 Overview

The system now creates individual expense items for each request item, with proper vendor and expense account mapping. This ensures accurate double-entry bookkeeping for both vendor payments and general expenses.

## 🎯 How It Works

### **1. Request Creation with Items and Quotations**
When a request is created with items and quotations:
- Each item can have multiple quotations
- One quotation can be selected per item
- Selected quotations include vendor information

### **2. Finance Approval Process**
When finance approves a request:
- **Individual expenses created** for each item (not one per request)
- **Vendor information preserved** for items with selected quotations
- **Expense accounts assigned** for items without quotations

### **3. Payment Processing**
When paying expenses:
- **Vendor expenses**: Use vendor-specific accounts payable
- **General expenses**: Use appropriate expense accounts

## 📊 Expense Creation Logic

### **Items with Selected Quotations**
```javascript
// Creates expense with vendor information
{
  expenseId: "EXP123456",
  requestId: "request_id",
  itemIndex: 0,
  category: "maintenance",
  amount: 500,
  description: "Request - Plumbing repair",
  vendorId: "vendor_id",
  vendorCode: "200001",
  vendorName: "ABC Plumbing Co",
  vendorType: "contractor",
  quotationId: "quotation_id",
  paymentMethod: "Bank Transfer", // Based on vendor bank details
  paymentStatus: "Pending"
}
```

### **Items without Quotations**
```javascript
// Creates expense with expense account code
{
  expenseId: "EXP123457",
  requestId: "request_id",
  itemIndex: 1,
  category: "maintenance",
  amount: 200,
  description: "Request - General maintenance",
  expenseAccountCode: "5000", // Repairs and Maintenance
  paymentMethod: "Cash", // Default for items without quotations
  paymentStatus: "Pending"
}
```

## 🏗️ Account Mapping

### **Vendor Accounts (Items with Quotations)**
| Vendor Type | Account Code | Account Name |
|-------------|--------------|--------------|
| Any Vendor | `200001` | Accounts Payable - Vendor 1 |
| Any Vendor | `200002` | Accounts Payable - Vendor 2 |
| Any Vendor | `200003` | Accounts Payable - Vendor 3 |

### **Expense Accounts (Items without Quotations)**
| Category | Account Code | Account Name |
|----------|--------------|--------------|
| maintenance | `5000` | Repairs and Maintenance |
| utilities | `5001` | Utilities - Water |
| electrical | `5002` | Utilities - Electricity |
| supplies | `5013` | Administrative Expenses |
| cleaning | `5010` | House keeping |
| security | `5011` | Security Costs |
| other | `5013` | Administrative Expenses |

## 💰 Payment Processing

### **Vendor Expense Payment**
```javascript
// System automatically detects vendor account
POST /api/expenses/expense_id/payments
{
  "amount": 500,
  "paymentMethod": "Bank Transfer",
  "payingAccount": "1000",      // Bank Account
  "receivingAccount": "2000"    // System uses vendor's 200001
}

// Transaction created:
// Debit: 1000 (Bank Account) - $500
// Credit: 200001 (Vendor AP) - $500
```

### **General Expense Payment**
```javascript
// System uses expense account code
POST /api/expenses/expense_id/payments
{
  "amount": 200,
  "paymentMethod": "Cash",
  "payingAccount": "1011",      // Admin Petty Cash
  "receivingAccount": "2000"    // System uses 5000 (Repairs & Maintenance)
}

// Transaction created:
// Debit: 1011 (Admin Petty Cash) - $200
// Credit: 5000 (Repairs & Maintenance) - $200
```

## 🔧 Implementation Details

### **Expense Model Fields**
```javascript
// Vendor information for items with quotations
vendorId: ObjectId,           // Reference to Vendor
vendorCode: String,           // Vendor's chart of accounts code
vendorName: String,           // Vendor business name
vendorType: String,           // Vendor type (contractor, service_provider, etc.)

// Item and quotation tracking
itemIndex: Number,            // Index of item in request
quotationId: ObjectId,        // Reference to selected quotation

// Expense account for items without quotations
expenseAccountCode: String,   // Account code for expense category
```

### **Payment Method Logic**
```javascript
// For items with quotations
if (vendor.bankDetails.accountNumber) {
  paymentMethod = 'Bank Transfer';
} else {
  paymentMethod = 'Cash';
}

// For items without quotations
paymentMethod = 'Cash'; // Default
```

## 📈 Benefits

### **For Finance Team**
- **Accurate tracking**: Each item has its own expense record
- **Vendor-specific payments**: Proper accounts payable per vendor
- **Category-based expenses**: Correct expense account mapping
- **Detailed reporting**: Item-level expense tracking

### **For System**
- **Proper double-entry**: Correct account mapping for all transactions
- **Vendor management**: Individual vendor account tracking
- **Expense categorization**: Proper expense account assignment
- **Audit trail**: Complete item-level transaction history

## 🔍 Example Workflow

### **1. Request Creation**
```javascript
// Admin creates request with items and quotations
{
  title: "Building Maintenance",
  items: [
    {
      description: "Plumbing repair",
      category: "maintenance",
      quotations: [
        {
          provider: "ABC Plumbing Co",
          amount: 500,
          isSelected: true,
          vendorId: "vendor_1_id"
        }
      ]
    },
    {
      description: "General cleaning",
      category: "cleaning",
      estimatedCost: 200
      // No quotations
    }
  ]
}
```

### **2. Finance Approval**
```javascript
// System creates individual expenses
// Expense 1: Plumbing repair with vendor
{
  expenseId: "EXP001",
  vendorId: "vendor_1_id",
  vendorCode: "200001",
  amount: 500,
  paymentMethod: "Bank Transfer"
}

// Expense 2: General cleaning without vendor
{
  expenseId: "EXP002",
  expenseAccountCode: "5010",
  amount: 200,
  paymentMethod: "Cash"
}
```

### **3. Payment Processing**
```javascript
// Pay vendor expense
// Uses vendor-specific account 200001

// Pay general expense
// Uses expense account 5010 (House keeping)
```

## ✅ Summary

1. **Individual Expenses**: Each request item becomes its own expense
2. **Vendor Mapping**: Items with quotations get vendor-specific accounts
3. **Expense Mapping**: Items without quotations get category-based accounts
4. **Proper Payments**: System uses correct accounts for each payment type
5. **Complete Tracking**: Full audit trail for all transactions

**The system now properly handles both vendor-specific and general expense payments! 🎉** 