# 📋 Monthly Template Approval System Guide

## 🎯 **Overview**

Templates need **monthly approvals** where each month is submitted and approved individually. This ensures proper financial control and tracking.

## 🔄 **Template vs Regular Request**

| Feature | Template | Regular Request |
|---------|----------|-----------------|
| **Type** | `isTemplate: true` | `isTemplate: false` |
| **Approval** | `monthlyApprovals[].status` | `status` |
| **Monthly** | ✅ Each month approved separately | ❌ One-time approval |
| **Recurring** | ✅ Same template, different months | ❌ One-time use |

## 📊 **Your Template Structure**

```javascript
{
  "_id": "68950728dc56013fa18ddaeb",
  "title": "1ACP Template",
  "isTemplate": true,
  "monthlyApprovals": [
    {
      "_id": "68950733dc56013fa18ddb24",
      "month": 8,
      "year": 2025,
      "status": "pending",  // ← Needs approval
      "items": [...],
      "totalCost": 410
    }
  ]
}
```

## 🎯 **API Endpoints**

### **1. Approve Monthly Template**
```javascript
POST /api/monthly-requests/:templateId/approve-month
```

**Request:**
```javascript
{
  "month": 8,
  "year": 2025,
  "status": "approved",
  "notes": "Approved for August 2025"
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Template approved for 8/2025",
  "data": {
    "monthlyApprovals": [
      {
        "month": 8,
        "year": 2025,
        "status": "approved",
        "approvedBy": "67f4ef0fcb87ffa3fb7e2d73",
        "approvedAt": "2025-08-07T20:30:00.000Z"
      }
    ]
  }
}
```

### **2. Submit Month for Approval**
```javascript
POST /api/monthly-requests/:templateId/submit-month
```

**Request:**
```javascript
{
  "month": 9,
  "year": 2025,
  "items": [...],
  "totalEstimatedCost": 410
}
```

### **3. Check Monthly Status**
```javascript
GET /api/monthly-requests/:templateId/approval-status/:month/:year
```

## 🎨 **Frontend Implementation**

### **1. Monthly Approval Component**

```jsx
// MonthlyApprovalButtons.jsx
import React, { useState } from 'react';

const MonthlyApprovalButtons = ({ template, onApprovalChange }) => {
  const [loading, setLoading] = useState(false);

  const approveMonth = async (month, year) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/monthly-requests/${template._id}/approve-month`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          month: month,
          year: year,
          status: 'approved',
          notes: `Approved for ${month}/${year}`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        onApprovalChange();
        showSuccessMessage(`Template approved for ${month}/${year}`);
      } else {
        showErrorMessage(data.message);
      }
    } catch (error) {
      showErrorMessage('Failed to approve month');
    } finally {
      setLoading(false);
    }
  };

  const rejectMonth = async (month, year) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/monthly-requests/${template._id}/approve-month`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          month: month,
          year: year,
          status: 'rejected',
          notes: `Rejected for ${month}/${year}`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        onApprovalChange();
        showSuccessMessage(`Template rejected for ${month}/${year}`);
      } else {
        showErrorMessage(data.message);
      }
    } catch (error) {
      showErrorMessage('Failed to reject month');
    } finally {
      setLoading(false);
    }
  };

  const getMonthlyStatus = (month, year) => {
    const approval = template.monthlyApprovals.find(
      a => a.month === month && a.year === year
    );
    return approval ? approval.status : 'draft';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return '#6c757d';
      case 'pending': return '#ffc107';
      case 'approved': return '#28a745';
      case 'rejected': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <div className="monthly-approvals">
      <h3>Monthly Approvals</h3>
      
      {/* Current Month (August 2025) */}
      <div className="monthly-approval-item">
        <div className="month-info">
          <span className="month-name">August 2025</span>
          <span 
            className="status-badge"
            style={{ color: getStatusColor(getMonthlyStatus(8, 2025)) }}
          >
            {getMonthlyStatus(8, 2025).toUpperCase()}
          </span>
        </div>
        
        <div className="approval-actions">
          {getMonthlyStatus(8, 2025) === 'pending' && (
            <>
              <button 
                className="btn btn-success btn-sm"
                onClick={() => approveMonth(8, 2025)}
                disabled={loading}
              >
                {loading ? 'Approving...' : 'Approve'}
              </button>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => rejectMonth(8, 2025)}
                disabled={loading}
              >
                {loading ? 'Rejecting...' : 'Reject'}
              </button>
            </>
          )}
          
          {getMonthlyStatus(8, 2025) === 'approved' && (
            <span className="text-success">
              ✅ Approved by {template.monthlyApprovals.find(a => a.month === 8 && a.year === 2025)?.approvedByEmail}
            </span>
          )}
          
          {getMonthlyStatus(8, 2025) === 'rejected' && (
            <span className="text-danger">
              ❌ Rejected
            </span>
          )}
        </div>
      </div>

      {/* Future Months */}
      {[9, 10, 11, 12].map(month => (
        <div key={month} className="monthly-approval-item">
          <div className="month-info">
            <span className="month-name">
              {new Date(2025, month - 1).toLocaleDateString('en-US', { month: 'long' })} 2025
            </span>
            <span 
              className="status-badge"
              style={{ color: getStatusColor(getMonthlyStatus(month, 2025)) }}
            >
              {getMonthlyStatus(month, 2025).toUpperCase()}
            </span>
          </div>
          
          <div className="approval-actions">
            {getMonthlyStatus(month, 2025) === 'draft' && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => submitMonth(month, 2025)}
                disabled={loading}
              >
                Submit for Approval
              </button>
            )}
            
            {getMonthlyStatus(month, 2025) === 'pending' && (
              <>
                <button 
                  className="btn btn-success btn-sm"
                  onClick={() => approveMonth(month, 2025)}
                  disabled={loading}
                >
                  {loading ? 'Approving...' : 'Approve'}
                </button>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => rejectMonth(month, 2025)}
                  disabled={loading}
                >
                  {loading ? 'Rejecting...' : 'Reject'}
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MonthlyApprovalButtons;
```

### **2. CSS Styling**

```css
/* monthly-approvals.css */
.monthly-approvals {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.monthly-approval-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  margin: 10px 0;
  background: white;
  border-radius: 6px;
  border-left: 4px solid #dee2e6;
}

.month-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.month-name {
  font-weight: 600;
  font-size: 16px;
}

.status-badge {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.approval-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

/* Status-specific styling */
.monthly-approval-item[data-status="approved"] {
  border-left-color: #28a745;
  background: #f8fff9;
}

.monthly-approval-item[data-status="rejected"] {
  border-left-color: #dc3545;
  background: #fff8f8;
}

.monthly-approval-item[data-status="pending"] {
  border-left-color: #ffc107;
  background: #fffef8;
}
```

### **3. Integration in Template View**

```jsx
// TemplateView.jsx
import React, { useState, useEffect } from 'react';
import MonthlyApprovalButtons from './MonthlyApprovalButtons';

const TemplateView = ({ templateId }) => {
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/monthly-requests/${templateId}`);
      const data = await response.json();
      setTemplate(data);
    } catch (error) {
      console.error('Error fetching template:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplate();
  }, [templateId]);

  const handleApprovalChange = () => {
    fetchTemplate(); // Refresh template data
  };

  if (loading) return <div>Loading...</div>;
  if (!template) return <div>Template not found</div>;

  return (
    <div className="template-view">
      <h2>{template.title}</h2>
      <p>{template.description}</p>
      
      {/* Template details */}
      <div className="template-details">
        <h3>Template Information</h3>
        <p><strong>Total Cost:</strong> ${template.totalEstimatedCost}</p>
        <p><strong>Items:</strong> {template.items.length}</p>
        <p><strong>Status:</strong> {template.status}</p>
      </div>

      {/* Monthly approvals */}
      <MonthlyApprovalButtons 
        template={template} 
        onApprovalChange={handleApprovalChange}
      />
    </div>
  );
};

export default TemplateView;
```

## 🚀 **Implementation Steps**

### **1. Backend (Already Implemented)**
✅ Routes exist  
✅ Controller functions exist  
✅ Auto-expense conversion works  

### **2. Frontend (To Implement)**
1. **Add MonthlyApprovalButtons component**
2. **Add CSS styling**
3. **Integrate in template view**
4. **Add approval/rejection functionality**

### **3. Testing**
1. **Test August 2025 approval**
2. **Test future month submissions**
3. **Verify expense creation**
4. **Check double-entry transactions**

## 🎯 **For Your Current Template**

To approve August 2025:

```bash
curl -X POST http://localhost:3000/api/monthly-requests/68950728dc56013fa18ddaeb/approve-month \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "month": 8,
    "year": 2025,
    "status": "approved",
    "notes": "Approved for August 2025"
  }'
```

This will:
- ✅ Approve August 2025
- ✅ Create expenses for August
- ✅ Create double-entry transactions
- ✅ Update monthly approval status

**You'll need to add the monthly approval buttons to your frontend to make this user-friendly!** 🎨
