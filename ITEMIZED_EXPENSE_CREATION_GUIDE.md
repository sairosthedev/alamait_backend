# Itemized Expense Creation System Guide

## 🎯 Overview

The system now properly handles expense creation for requests with multiple items and quotations. When `financeStatus` is set to `'approved'`, the system creates expenses based on the following logic:

## 🔄 How It Works

### **1. Simple Maintenance Requests (Legacy)**
- **Trigger**: `financeStatus = 'approved'` + `amount` provided
- **Result**: Creates **ONE expense** for the entire request
- **Location**: `src/controllers/maintenanceController.js`

```javascript
if (financeStatus === 'approved' && amount && amount > 0) {
    // Create single expense with total amount
    const expenseData = {
        expenseId,
        residence: maintenance.residence,
        category: 'Maintenance',
        amount: parseFloat(amount),
        description: `Maintenance: ${maintenance.issue} - ${maintenance.description}`,
        // ... other fields
    };
}
```

### **2. Complex Requests with Items**
- **Trigger**: `financeStatus = 'approved'` + request has items
- **Result**: Creates **ONE expense per item**
- **Location**: `src/controllers/requestController.js` → `updateRequest()`

## 📋 Expense Creation Logic

### **For Items WITH Selected Quotations:**
```javascript
// Find selected quotation for this item
const selectedQuotation = item.quotations?.find(q => q.isSelected);

if (selectedQuotation) {
    // Determine payment method based on vendor bank details
    let paymentMethod = 'Cash'; // Default to cash
    if (selectedQuotation.vendorId) {
        const vendor = await Vendor.findById(selectedQuotation.vendorId);
        if (vendor && vendor.bankDetails && vendor.bankDetails.accountNumber) {
            paymentMethod = 'Bank Transfer';
        }
    }
    
    // Create expense with quotation details
    const expenseData = {
        expenseId,
        requestId: request._id,
        residence: request.residence,
        category: item.category || 'Other',
        amount: selectedQuotation.amount,  // Use quotation amount
        description: `${request.title} - ${item.description}`,
        paymentMethod: paymentMethod,  // Determined by vendor bank details
        vendorId: selectedQuotation.vendorId,
        vendorName: selectedQuotation.vendorName,
        vendorCode: selectedQuotation.vendorCode,
        vendorType: selectedQuotation.vendorType,
        quotationId: selectedQuotation._id,
        itemIndex: i,
        notes: `Item: ${item.description} | Provider: ${selectedQuotation.provider} | Amount: $${selectedQuotation.amount} | Payment: ${paymentMethod}`
    };
}
```

### **For Items WITHOUT Quotations:**
```javascript
else {
    // Create expense with estimated cost (default to cash)
    const expenseData = {
        expenseId,
        requestId: request._id,
        residence: request.residence,
        category: item.category || 'Other',
        amount: item.estimatedCost || item.totalCost || 0,  // Use estimated cost
        description: `${request.title} - ${item.description}`,
        paymentMethod: 'Cash',  // Default to cash for items without quotations
        itemIndex: i,
        notes: `Item: ${item.description} | Estimated cost: $${item.estimatedCost || item.totalCost || 0} | Payment: Cash`
    };
}
```

## 🚀 API Endpoints

### **Update Request (Triggers Expense Creation)**
```http
PUT /api/requests/:id
Content-Type: application/json
Authorization: Bearer <token>

{
    "financeStatus": "approved"
}
```

### **Update Maintenance (Legacy)**
```http
PUT /api/maintenance/:id
Content-Type: application/json
Authorization: Bearer <token>

{
    "financeStatus": "approved",
    "amount": 500.00
}
```

## 📊 Database Schema

### **Request Model Fields:**
- `financeStatus`: `'pending' | 'approved' | 'rejected' | 'waitlisted'`
- `convertedToExpense`: `Boolean` - Prevents duplicate expense creation
- `items[]`: Array of items with quotations
- `items[].quotations[]`: Array of quotations per item
- `items[].quotations[].isSelected`: `Boolean` - Marks selected quotation

### **Expense Model Fields:**
- `requestId`: Links to original request
- `itemIndex`: Index of the item in the request
- `quotationId`: Links to selected quotation (if applicable)
- `vendorId`, `vendorName`, `vendorCode`: Vendor details from quotation
- `amount`: From selected quotation or estimated cost

## 🎯 Key Features

### ✅ **What Works:**
1. **Automatic Detection**: System detects if request has items
2. **Selected Quotations**: Uses `isSelected: true` quotations for amounts
3. **Fallback Logic**: Uses estimated costs for items without quotations
4. **Duplicate Prevention**: `convertedToExpense` flag prevents duplicates
5. **Vendor Integration**: Links expenses to vendors from quotations
6. **Item Tracking**: `itemIndex` links expenses to specific items

### 💳 **Payment Method Logic:**
1. **Items with Selected Quotations**: 
   - Check if vendor has bank details (`vendor.bankDetails.accountNumber`)
   - If yes → `Bank Transfer`
   - If no → `Cash`
2. **Items without Quotations**: 
   - Default to `Cash`
3. **Simple Maintenance Requests**: 
   - Default to `Cash`

### 🔧 **How to Use:**

#### **Frontend Integration:**
```javascript
// Update request to approved status
const response = await fetch(`/api/requests/${requestId}`, {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        financeStatus: 'approved'
    })
});

// System automatically creates expenses for each item
```

#### **Select Quotations First:**
```javascript
// Select quotation for item before approving
await fetch(`/api/requests/${requestId}/items/${itemIndex}/quotations/${quotationIndex}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        isSelected: true
    })
});
```

## 🧪 Testing

### **Test Script:**
```bash
node test-itemized-expense-creation.js
```

### **What the Test Checks:**
1. Finds approved requests with items
2. Verifies expenses were created
3. Checks quotation selection status
4. Validates expense amounts match quotations
5. Confirms vendor details are captured

## 📈 Example Workflow

### **1. Create Request with Items:**
```javascript
const request = {
    title: "Office Supplies",
    items: [
        {
            description: "Printer Paper",
            estimatedCost: 50,
            quotations: [
                { provider: "Vendor A", amount: 45, isSelected: true },
                { provider: "Vendor B", amount: 55, isSelected: false }
            ]
        },
        {
            description: "Pens",
            estimatedCost: 30,
            quotations: [] // No quotations
        }
    ]
};
```

### **2. Approve Request:**
```javascript
PUT /api/requests/:id
{ "financeStatus": "approved" }
```

### **3. Result - Two Expenses Created:**
```javascript
// Expense 1: Printer Paper with selected quotation
{
    expenseId: "EXP001",
    amount: 45, // From selected quotation
    vendorName: "Vendor A",
    description: "Office Supplies - Printer Paper"
}

// Expense 2: Pens with estimated cost
{
    expenseId: "EXP002", 
    amount: 30, // From estimated cost
    description: "Office Supplies - Pens"
}
```

## 🎉 Benefits

1. **Accurate Tracking**: Each item gets its own expense record
2. **Vendor Integration**: Expenses link to actual vendors from quotations
3. **Flexible**: Handles both quoted and non-quoted items
4. **Audit Trail**: Complete history of approvals and expense creation
5. **No Duplicates**: Prevents multiple expense creation for same request

The system now properly handles complex requests with multiple items and quotations! 🚀 