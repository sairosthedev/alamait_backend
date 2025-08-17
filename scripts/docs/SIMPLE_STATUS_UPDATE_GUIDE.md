# Simple Status Update Guide

## 🎯 Overview

Instead of using a separate "Send to Finance" endpoint, you can simply update the template's status using the existing `updateMonthlyRequest` endpoint.

## 🔄 Two Approaches

### **Option 1: Use Existing Update Endpoint (Recommended)**

**Endpoint:** `PUT /api/monthly-requests/:id`

**Request Body:**
```javascript
{
  "status": "pending"  // Just update the status
}
```

**Frontend Implementation:**
```javascript
const sendToFinance = async (requestId) => {
  try {
    const response = await fetch(`/api/monthly-requests/${requestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: 'pending'
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('Status updated successfully:', data);
      // Update your UI to show pending status
      updateRequestStatus(requestId, 'pending');
    } else {
      console.error('Error updating status:', data.message);
    }
  } catch (error) {
    console.error('Error updating status:', error);
  }
};
```

### **Option 2: Fixed Send-to-Finance Endpoint**

The send-to-finance endpoint has been fixed and should now work:

**Endpoint:** `PUT /api/monthly-requests/:id/send-to-finance`

**Request Body:** (Empty - no body required)

**Frontend Implementation:**
```javascript
const sendToFinance = async (requestId) => {
  try {
    const response = await fetch(`/api/monthly-requests/${requestId}/send-to-finance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('Request sent to finance successfully:', data);
      updateRequestStatus(requestId, 'pending');
    } else {
      console.error('Error sending to finance:', data.message);
    }
  } catch (error) {
    console.error('Error sending to finance:', error);
  }
};
```

## 🎯 Button Implementation

### **Simple Status Update Button:**
```javascript
const renderActionButtons = (request) => {
  const buttons = [];

  // Admin actions
  if (userRole === 'admin') {
    if (request.status === 'draft') {
      buttons.push({
        label: 'Send to Finance',
        action: () => sendToFinance(request._id),
        color: 'primary',
        icon: '📤'
      });
    }
  }

  return buttons;
};

// Simple status update function
const sendToFinance = async (requestId) => {
  try {
    const response = await fetch(`/api/monthly-requests/${requestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: 'pending'
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Status updated to pending:', data);
      
      // Update your UI
      updateRequestStatus(requestId, 'pending');
      showSuccessMessage('Request sent to finance successfully');
    } else {
      const errorData = await response.json();
      showErrorMessage(errorData.message || 'Failed to update status');
    }
  } catch (error) {
    console.error('Error updating status:', error);
    showErrorMessage('Failed to update status');
  }
};
```

## 🎯 Key Benefits

### **Option 1 (Update Endpoint):**
- ✅ Uses existing, tested endpoint
- ✅ Simpler implementation
- ✅ Less code to maintain
- ✅ Same permissions and validation

### **Option 2 (Send-to-Finance Endpoint):**
- ✅ More descriptive endpoint name
- ✅ Specific business logic
- ✅ Better audit trail
- ✅ Dedicated error messages

## 🎯 Recommendation

**Use Option 1** (existing update endpoint) for simplicity, or **Option 2** (fixed send-to-finance endpoint) if you want more specific business logic.

Both approaches will update the template status from `draft` to `pending`! 🎉 