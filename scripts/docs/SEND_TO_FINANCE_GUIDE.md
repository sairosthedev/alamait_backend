# Send to Finance Guide

## 🎯 Overview

The "Send to Finance" functionality allows admins to send draft monthly requests to finance for approval. This changes the request status from `draft` to `pending`.

## 📊 Status Flow

### **Request Status Workflow:**
```
draft → pending → approved/rejected
  ↑        ↑           ↑
Admin   Admin      Finance
Creates  Sends     Approves/Rejects
```

### **Status Definitions:**
- **`draft`** - Initial state when admin creates request
- **`pending`** - Sent to finance, waiting for approval
- **`approved`** - Finance approved the request
- **`rejected`** - Finance rejected the request
- **`completed`** - Request has been fulfilled

## 🔄 API Endpoints

### **1. Send to Finance**
```javascript
PUT /api/monthly-requests/:id/send-to-finance
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:** (Empty - no body required)

**Response:**
```javascript
{
  "success": true,
  "message": "Request sent to finance successfully",
  "monthlyRequest": {
    "_id": "688b79ce2af26ca41a8574ad",
    "title": "Monthly Requests",
    "status": "pending", // Changed from "draft"
    "requestHistory": [
      {
        "date": "2025-01-15T10:30:00.000Z",
        "action": "Sent to finance for approval",
        "user": "67c023adae5e27657502e887",
        "changes": [
          {
            "field": "status",
            "oldValue": "draft",
            "newValue": "pending"
          }
        ]
      }
    ]
  }
}
```

### **2. Approve Request (Finance)**
```javascript
PATCH /api/monthly-requests/:id/approve
```

**Request Body:**
```javascript
{
  "approved": true,
  "notes": "Approved after review"
}
```

### **3. Reject Request (Finance)**
```javascript
PATCH /api/monthly-requests/:id/reject
```

**Request Body:**
```javascript
{
  "rejectionReason": "Costs too high, need to reduce budget"
}
```

## 🎯 Frontend Implementation

### **1. Send to Finance Button**
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
      // Update UI to show pending status
      updateRequestStatus(requestId, 'pending');
      showSuccessMessage('Request sent to finance successfully');
    } else {
      showErrorMessage(data.message);
    }
  } catch (error) {
    console.error('Error sending to finance:', error);
    showErrorMessage('Failed to send request to finance');
  }
};
```

### **2. Status-Based Button Display**
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

  // Finance actions
  if (['finance', 'finance_admin', 'finance_user'].includes(userRole)) {
    if (request.status === 'pending') {
      buttons.push(
        {
          label: 'Approve',
          action: () => approveRequest(request._id),
          color: 'success',
          icon: '✅'
        },
        {
          label: 'Reject',
          action: () => rejectRequest(request._id),
          color: 'danger',
          icon: '❌'
        }
      );
    }
  }

  return buttons;
};
```

### **3. Status Indicators**
```javascript
const getStatusColor = (status) => {
  switch (status) {
    case 'draft': return '#6c757d'; // Gray
    case 'pending': return '#ffc107'; // Yellow
    case 'approved': return '#28a745'; // Green
    case 'rejected': return '#dc3545'; // Red
    case 'completed': return '#17a2b8'; // Blue
    default: return '#6c757d';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'draft': return '📝';
    case 'pending': return '⏳';
    case 'approved': return '✅';
    case 'rejected': return '❌';
    case 'completed': return '🏁';
    default: return '📝';
  }
};
```

## 🔒 Permissions

### **Send to Finance:**
- **Allowed Roles:** `admin` only
- **Required Status:** `draft` only
- **Error if:** Not admin or status not draft

### **Approve/Reject:**
- **Allowed Roles:** `finance`, `finance_admin`, `finance_user`
- **Required Status:** `pending` only
- **Error if:** Not finance user or status not pending

## 📋 Error Handling

### **Common Error Responses:**

#### **404 - Request Not Found**
```javascript
{
  "success": false,
  "message": "Monthly request not found"
}
```

#### **403 - Permission Denied**
```javascript
{
  "success": false,
  "message": "Only admins can send requests to finance"
}
```

#### **400 - Invalid Status**
```javascript
{
  "success": false,
  "message": "Cannot send request to finance. Current status: approved. Only draft requests can be sent to finance."
}
```

#### **500 - Server Error**
```javascript
{
  "success": false,
  "message": "Error sending request to finance",
  "error": "Database connection failed"
}
```

## 🎯 Usage Examples

### **Example 1: Admin Sends Draft Request**
```javascript
// Request
PUT /api/monthly-requests/688b79ce2af26ca41a8574ad/send-to-finance

// Response
{
  "success": true,
  "message": "Request sent to finance successfully",
  "monthlyRequest": {
    "status": "pending",
    "requestHistory": [
      {
        "action": "Sent to finance for approval",
        "changes": [
          {
            "field": "status",
            "oldValue": "draft",
            "newValue": "pending"
          }
        ]
      }
    ]
  }
}
```

### **Example 2: Finance Approves Request**
```javascript
// Request
PATCH /api/monthly-requests/688b79ce2af26ca41a8574ad/approve
{
  "approved": true,
  "notes": "Budget approved for Q1 2025"
}

// Response
{
  "success": true,
  "message": "Monthly request approved successfully",
  "monthlyRequest": {
    "status": "approved",
    "approvedBy": "67c023adae5e27657502e887",
    "approvedAt": "2025-01-15T10:35:00.000Z"
  }
}
```

### **Example 3: Finance Rejects Request**
```javascript
// Request
PATCH /api/monthly-requests/688b79ce2af26ca41a8574ad/reject
{
  "rejectionReason": "Costs exceed budget by 20%"
}

// Response
{
  "success": true,
  "message": "Monthly request rejected successfully",
  "monthlyRequest": {
    "status": "rejected",
    "notes": "Rejected: Costs exceed budget by 20%"
  }
}
```

## 🎯 Key Features

1. **Status Validation**: Only draft requests can be sent to finance
2. **Permission Control**: Only admins can send, only finance can approve/reject
3. **History Tracking**: All status changes are logged in requestHistory
4. **Error Handling**: Comprehensive error messages for different scenarios
5. **Audit Trail**: Complete tracking of who did what and when

This ensures a proper approval workflow with full audit trail and permission control! 🎉 