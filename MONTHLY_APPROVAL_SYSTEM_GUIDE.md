# Monthly Approval System Guide

## 🎯 Overview

The monthly approval system separates approval status by month for templates, allowing different items and costs to be approved for each month. This ensures that finance can review and approve monthly requests on a month-by-month basis.

## 📊 Schema Structure

### **Template with Monthly Approvals:**
```javascript
{
  _id: "688c449e57271825c8910fcf",
  title: "Monthly Requests",
  description: "Monthly Requests for St Kilda",
  isTemplate: true,
  status: "draft",  // Overall template status
  items: [
    { title: "wifi", estimatedCost: 100, category: "maintenance" },
    { title: "gas", estimatedCost: 192, category: "utilities" }
  ],
  totalEstimatedCost: 1042,
  
  // Monthly-specific approvals
  monthlyApprovals: [
    {
      month: 1,
      year: 2025,
      status: "pending",  // Monthly status
      items: [
        { title: "wifi", estimatedCost: 100, category: "maintenance" },
        { title: "gas", estimatedCost: 192, category: "utilities" }
      ],
      totalCost: 1042,
      submittedAt: "2025-01-15T10:30:00.000Z",
      submittedBy: "67c023adae5e27657502e887",
      approvedBy: null,
      approvedAt: null,
      notes: ""
    },
    {
      month: 2,
      year: 2025,
      status: "approved",  // Different status for different month
      items: [
        { title: "wifi", estimatedCost: 120, category: "maintenance" },  // Different cost
        { title: "gas", estimatedCost: 200, category: "utilities" }      // Different cost
      ],
      totalCost: 1120,
      submittedAt: "2025-02-01T09:00:00.000Z",
      submittedBy: "67c023adae5e27657502e887",
      approvedBy: "67c023adae5e27657502e887",
      approvedAt: "2025-02-01T10:00:00.000Z",
      notes: "Approved with updated costs"
    }
  ]
}
```

## 🔄 API Endpoints

### **1. Send Monthly Request to Finance**
```javascript
PUT /api/monthly-requests/:id/send-to-finance
```

**Request Body:**
```javascript
{
  "month": 1,
  "year": 2025
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Monthly request for 1/2025 sent to finance successfully",
  "monthlyRequest": {
    "monthlyApprovals": [
      {
        "month": 1,
        "year": 2025,
        "status": "pending",
        "items": [...],
        "totalCost": 1042
      }
    ]
  }
}
```

### **2. Approve Monthly Request**
```javascript
PATCH /api/monthly-requests/:id/approve
```

**Request Body:**
```javascript
{
  "approved": true,
  "month": 1,
  "year": 2025,
  "notes": "Approved for January 2025"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Monthly request for 1/2025 approved successfully",
  "monthlyRequest": {
    "monthlyApprovals": [
      {
        "month": 1,
        "year": 2025,
        "status": "approved",
        "approvedBy": "67c023adae5e27657502e887",
        "approvedAt": "2025-01-15T11:00:00.000Z"
      }
    ]
  }
}
```

## 🎯 Frontend Implementation

### **Send Monthly Request to Finance:**
```javascript
const sendMonthlyToFinance = async (requestId, month, year) => {
  try {
    const response = await fetch(`/api/monthly-requests/${requestId}/send-to-finance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        month: month,
        year: year
      })
    });

    const data = await response.json();
    
    if (data.success) {
      showSuccessMessage(`Monthly request for ${month}/${year} sent to finance`);
      // Update UI to show pending status for that month
      updateMonthlyStatus(requestId, month, year, 'pending');
    } else {
      showErrorMessage(data.message);
    }
  } catch (error) {
    console.error('Error sending monthly request:', error);
    showErrorMessage('Failed to send monthly request');
  }
};
```

### **Approve Monthly Request:**
```javascript
const approveMonthlyRequest = async (requestId, month, year, approved = true) => {
  try {
    const response = await fetch(`/api/monthly-requests/${requestId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        approved: approved,
        month: month,
        year: year,
        notes: `${approved ? 'Approved' : 'Rejected'} for ${month}/${year}`
      })
    });

    const data = await response.json();
    
    if (data.success) {
      showSuccessMessage(`Monthly request for ${month}/${year} ${approved ? 'approved' : 'rejected'}`);
      // Update UI to show approved/rejected status for that month
      updateMonthlyStatus(requestId, month, year, approved ? 'approved' : 'rejected');
    } else {
      showErrorMessage(data.message);
    }
  } catch (error) {
    console.error('Error approving monthly request:', error);
    showErrorMessage('Failed to approve monthly request');
  }
};
```

### **Monthly Status Display:**
```javascript
const getMonthlyStatus = (template, month, year) => {
  const monthlyApproval = template.monthlyApprovals.find(
    approval => approval.month === month && approval.year === year
  );
  
  return monthlyApproval ? monthlyApproval.status : 'draft';
};

const renderMonthlyStatus = (template, month, year) => {
  const status = getMonthlyStatus(template, month, year);
  
  const statusColors = {
    'draft': '#6c757d',
    'pending': '#ffc107',
    'approved': '#28a745',
    'rejected': '#dc3545',
    'completed': '#17a2b8'
  };
  
  return (
    <span style={{ color: statusColors[status] }}>
      {status.toUpperCase()}
    </span>
  );
};
```

### **Monthly Action Buttons:**
```javascript
const renderMonthlyActionButtons = (template, month, year) => {
  const buttons = [];
  const monthlyStatus = getMonthlyStatus(template, month, year);

  // Admin actions
  if (userRole === 'admin') {
    if (monthlyStatus === 'draft') {
      buttons.push({
        label: `Send ${month}/${year} to Finance`,
        action: () => sendMonthlyToFinance(template._id, month, year),
        color: 'primary',
        icon: '📤'
      });
    }
  }

  // Finance actions
  if (['finance', 'finance_admin', 'finance_user'].includes(userRole)) {
    if (monthlyStatus === 'pending') {
      buttons.push(
        {
          label: `Approve ${month}/${year}`,
          action: () => approveMonthlyRequest(template._id, month, year, true),
          color: 'success',
          icon: '✅'
        },
        {
          label: `Reject ${month}/${year}`,
          action: () => approveMonthlyRequest(template._id, month, year, false),
          color: 'danger',
          icon: '❌'
        }
      );
    }
  }

  return buttons;
};
```

## 📊 Monthly Approval Table

### **Display Monthly Approvals:**
```javascript
const MonthlyApprovalsTable = ({ template }) => {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const currentYear = new Date().getFullYear();

  return (
    <table className="monthly-approvals-table">
      <thead>
        <tr>
          <th>Month/Year</th>
          <th>Status</th>
          <th>Total Cost</th>
          <th>Submitted</th>
          <th>Approved</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {months.map(month => {
          const approval = template.monthlyApprovals.find(
            a => a.month === month && a.year === currentYear
          );
          
          return (
            <tr key={`${month}-${currentYear}`}>
              <td>{month}/{currentYear}</td>
              <td>{renderMonthlyStatus(template, month, currentYear)}</td>
              <td>${approval?.totalCost || template.totalEstimatedCost}</td>
              <td>{approval?.submittedAt ? new Date(approval.submittedAt).toLocaleDateString() : '-'}</td>
              <td>{approval?.approvedAt ? new Date(approval.approvedAt).toLocaleDateString() : '-'}</td>
              <td>
                {renderMonthlyActionButtons(template, month, currentYear).map((button, index) => (
                  <button key={index} onClick={button.action} className={`btn btn-${button.color}`}>
                    {button.icon} {button.label}
                  </button>
                ))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
```

## 🎯 Status Flow

### **Monthly Approval Workflow:**
```
Template Status: draft
├── January 2025: draft → pending → approved
├── February 2025: draft → pending → rejected
├── March 2025: draft → pending → approved
└── April 2025: draft (not submitted yet)
```

### **Status Meanings:**
- **`draft`** - Monthly request not submitted yet
- **`pending`** - Sent to finance, waiting for approval
- **`approved`** - Finance approved for that month
- **`rejected`** - Finance rejected for that month
- **`completed`** - Converted to expense for that month

## 🎯 Key Benefits

### **✅ Monthly Flexibility:**
- Different items and costs per month
- Independent approval for each month
- Track changes over time

### **✅ Better Control:**
- Finance can approve/reject per month
- Admin can modify items between months
- Clear audit trail per month

### **✅ Data Integrity:**
- Monthly-specific item snapshots
- Cost tracking per month
- Approval history per month

## 🎯 Usage Examples

### **Submit January 2025:**
```javascript
sendMonthlyToFinance('688c449e57271825c8910fcf', 1, 2025);
```

### **Approve January 2025:**
```javascript
approveMonthlyRequest('688c449e57271825c8910fcf', 1, 2025, true);
```

### **Reject February 2025:**
```javascript
approveMonthlyRequest('688c449e57271825c8910fcf', 2, 2025, false);
```

This system ensures that each month's request is handled independently, allowing for different items, costs, and approval statuses per month! 🎉 