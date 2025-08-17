# Monthly Request to Expense Conversion Guide

## 🎯 Overview

When a monthly request (template or regular) status becomes `approved`, it needs to be converted to an expense for financial tracking. This system handles both templates and regular monthly requests.

## 📊 Conversion Logic

### **Template Conversion:**
- **Single Expense:** Creates one expense with total cost
- **Amount:** `totalEstimatedCost` from the template
- **Category:** Mapped from template items
- **Description:** Template title and description

### **Regular Monthly Request Conversion:**
- **Multiple Expenses:** Creates one expense per item
- **Amount:** Approved quotation amount or estimated cost
- **Category:** Mapped from each item's category
- **Description:** Individual item details

## 🔄 API Endpoints

### **1. Convert Specific Request**
```javascript
POST /api/monthly-requests/convert-to-expenses
```

**Request Body:**
```javascript
{
  "requestId": "688c449e57271825c8910fcf"  // Specific request to convert
}
```

### **2. Convert Multiple Requests by Month/Year**
```javascript
POST /api/monthly-requests/convert-to-expenses
```

**Request Body:**
```javascript
{
  "month": 1,
  "year": 2025,
  "residence": "67d723cf20f89c4ae69804f3"  // Optional: specific residence
}
```

## 🎯 Frontend Implementation

### **Auto-Convert on Approval:**
```javascript
// When finance approves a request, automatically convert to expense
const approveAndConvert = async (requestId) => {
  try {
    // First approve the request
    const approveResponse = await fetch(`/api/monthly-requests/${requestId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        approved: true,
        notes: 'Approved and converted to expense'
      })
    });

    if (approveResponse.ok) {
      // Then convert to expense
      const convertResponse = await fetch('/api/monthly-requests/convert-to-expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: requestId
        })
      });

      if (convertResponse.ok) {
        const convertData = await convertResponse.json();
        console.log('Converted to expense:', convertData);
        showSuccessMessage(`Request approved and converted to ${convertData.createdExpenses} expense(s)`);
      }
    }
  } catch (error) {
    console.error('Error approving and converting:', error);
  }
};
```

### **Manual Convert Button:**
```javascript
const convertToExpense = async (requestId) => {
  try {
    const response = await fetch('/api/monthly-requests/convert-to-expenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        requestId: requestId
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      showSuccessMessage(`Successfully converted to ${data.createdExpenses} expense(s)`);
      // Update UI to show completed status
      updateRequestStatus(requestId, 'completed');
    } else {
      showErrorMessage(data.message || 'Failed to convert to expense');
    }
  } catch (error) {
    console.error('Error converting to expense:', error);
    showErrorMessage('Failed to convert to expense');
  }
};

// Button for approved requests
const renderActionButtons = (request) => {
  const buttons = [];

  // Finance actions
  if (['finance', 'finance_admin', 'finance_user'].includes(userRole)) {
    if (request.status === 'approved') {
      buttons.push({
        label: 'Convert to Expense',
        action: () => convertToExpense(request._id),
        color: 'success',
        icon: '💰'
      });
    }
  }

  return buttons;
};
```

## 📊 Data Mapping

### **Template to Expense Mapping:**
```javascript
// Template data
{
  title: "Monthly Requests",
  description: "Monthly Requests for St Kilda",
  totalEstimatedCost: 1042,
  items: [
    { title: "wifi", estimatedCost: 100, category: "maintenance" },
    { title: "gas", estimatedCost: 192, category: "utilities" }
  ]
}

// Converted to expense
{
  expenseId: "EXP_ABC123_DEF456",
  title: "Monthly Request - Monthly Requests",
  description: "Monthly Requests for St Kilda",
  amount: 1042,  // Total from all items
  category: "Maintenance",  // Mapped from first item
  period: "monthly",
  paymentStatus: "Pending",
  monthlyRequestId: "688c449e57271825c8910fcf",
  notes: "Converted from monthly request template: Monthly Requests. Total items: 2"
}
```

### **Regular Request to Expense Mapping:**
```javascript
// Regular request data
{
  title: "January 2025 Requests",
  items: [
    { 
      title: "wifi", 
      estimatedCost: 100, 
      category: "maintenance",
      quotations: [{ amount: 95, isApproved: true }]
    }
  ]
}

// Converted to expense
{
  expenseId: "EXP_ABC123_DEF456_item_0",
  title: "January 2025 Requests - wifi",
  description: "wifi description",
  amount: 95,  // Approved quotation amount
  category: "Maintenance",
  period: "monthly",
  paymentStatus: "Pending",
  monthlyRequestId: "688c449e57271825c8910fcf",
  itemIndex: 0,
  quotationId: "approved_quotation_id"
}
```

## 🎯 Category Mapping

### **Monthly Request → Expense Categories:**
```javascript
const categoryMap = {
  'utilities': 'Utilities',
  'maintenance': 'Maintenance', 
  'supplies': 'Supplies',
  'equipment': 'Other',
  'services': 'Other',
  'other': 'Other'
};
```

## 🎯 Status Flow

### **Complete Workflow:**
```
draft → pending → approved → completed
  ↑        ↑         ↑         ↑
Admin   Admin    Finance   Finance
Creates  Sends   Approves  Converts
                & Converts to Expense
```

### **Status Changes:**
1. **Admin creates:** `status: 'draft'`
2. **Admin sends:** `status: 'pending'`
3. **Finance approves:** `status: 'approved'`
4. **Finance converts:** `status: 'completed'`

## 🎯 Response Examples

### **Successful Conversion:**
```javascript
{
  "message": "Successfully converted 1 items to expenses",
  "createdExpenses": 1,
  "requestId": "688c449e57271825c8910fcf",
  "errors": undefined
}
```

### **Error Response:**
```javascript
{
  "message": "Cannot convert request with status: draft. Only approved requests can be converted.",
  "createdExpenses": 0,
  "requestId": "688c449e57271825c8910fcf",
  "errors": [
    {
      "requestId": "688c449e57271825c8910fcf",
      "error": "Request not approved"
    }
  ]
}
```

## 🎯 Key Features

### **✅ Automatic Features:**
- **Unique Expense IDs:** Generated automatically
- **Category Mapping:** Automatic conversion
- **Status Updates:** Request marked as completed
- **History Tracking:** Conversion logged in request history

### **✅ Validation:**
- **Status Check:** Only approved requests can be converted
- **Permission Check:** Only finance users can convert
- **Data Validation:** Required fields checked

### **✅ Error Handling:**
- **Graceful Failures:** Individual request failures don't stop batch conversion
- **Detailed Errors:** Specific error messages for each failure
- **Partial Success:** Reports successful and failed conversions

## 🎯 Usage Examples

### **Convert Single Template:**
```javascript
// Convert your template
const response = await fetch('/api/monthly-requests/convert-to-expenses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    requestId: "688c449e57271825c8910fcf"
  })
});
```

### **Convert All January 2025 Requests:**
```javascript
// Convert all approved requests for January 2025
const response = await fetch('/api/monthly-requests/convert-to-expenses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    month: 1,
    year: 2025
  })
});
```

This system ensures that approved monthly requests are properly tracked as expenses in your financial system! 🎉 