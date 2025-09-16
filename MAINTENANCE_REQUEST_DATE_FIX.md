# Maintenance Request Date Fix Implementation

## Problem
Maintenance requests were using the current date (`new Date()`) for all date fields instead of using the `dateRequested` field provided by the user. This caused:

1. **Incorrect timestamps**: `createdAt`, `updatedAt`, and `requestHistory` dates were set to current date
2. **Wrong approval dates**: Admin approval dates were set to current date instead of `dateRequested`
3. **Inconsistent financial reporting**: Transactions would appear in wrong accounting periods

## Example Issue
**User Input:**
```json
{
    "title": "wifi August",
    "dateRequested": "2025-08-09",
    "description": "lol"
}
```

**Before Fix:**
```json
{
    "createdAt": "2025-09-09T09:11:47.067Z",  // ❌ Wrong - current date
    "updatedAt": "2025-09-09T09:11:47.142Z",  // ❌ Wrong - current date
    "requestHistory": [
        {
            "date": "2025-09-09T09:11:47.070Z"  // ❌ Wrong - current date
        }
    ],
    "approval": {
        "admin": {
            "approvedAt": "2025-09-09T09:11:47.023Z"  // ❌ Wrong - current date
        }
    }
}
```

**After Fix:**
```json
{
    "dateRequested": "2025-08-09T00:00:00.000Z",  // ✅ Correct - user provided date
    "createdAt": "2025-09-09T09:11:47.067Z",      // ✅ System timestamp (unchanged)
    "updatedAt": "2025-09-09T09:11:47.142Z",      // ✅ System timestamp (unchanged)
    "requestHistory": [
        {
            "date": "2025-08-09T00:00:00.000Z"    // ✅ Correct - uses dateRequested
        }
    ],
    "approval": {
        "admin": {
            "approvedAt": "2025-08-09T00:00:00.000Z"  // ✅ Correct - uses dateRequested
        }
    }
}
```

## Solution Implemented

### 1. **Added Date Fields to Request Model**
```javascript
// src/models/Request.js
const requestSchema = new mongoose.Schema({
    // ... existing fields
    dateRequested: {
        type: Date,
        default: Date.now
    },
    datePaid: {
        type: Date
    }
}, {
    timestamps: true
});
```

### 2. **Updated Request Controller**
```javascript
// src/controllers/requestController.js

// Extract dateRequested from request body
const {
    // ... other fields
    dateRequested
} = req.body;

// Use dateRequested for request data
const requestData = {
    // ... other fields
    dateRequested: dateRequested ? new Date(dateRequested) : new Date()
};

// Use dateRequested for admin approval
if (user.role === 'admin' && type !== 'maintenance' && type !== 'student_maintenance') {
    const approvalDate = dateRequested ? new Date(dateRequested) : new Date();
    requestData.approval = {
        admin: {
            approved: true,
            approvedBy: user._id,
            approvedByEmail: user.email,
            approvedAt: approvalDate  // ✅ Uses dateRequested
        }
    };
}

// Use dateRequested for request history
request.requestHistory.push({
    date: request.dateRequested,  // ✅ Uses dateRequested
    action: 'Request created',
    user: user._id,
    changes: ['Request submitted']
});
```

### 3. **Financial Transaction Integration**
The existing `recordMaintenanceApproval` function already uses `request.dateRequested`:

```javascript
// src/services/doubleEntryAccountingService.js
static async recordMaintenanceApproval(request, user) {
    // Use dateRequested for accrual basis (income statement) - when expense is incurred
    const accrualDate = request.dateRequested ? new Date(request.dateRequested) : new Date();
    
    const transaction = new Transaction({
        transactionId,
        date: accrualDate,  // ✅ Uses dateRequested
        // ... other fields
    });
}
```

## Benefits

### 1. **Accurate Financial Reporting**
- **Income Statement**: Expenses appear in correct accounting period (`dateRequested`)
- **Balance Sheet**: Trade payables created on correct date
- **Cash Flow**: Payments tracked with correct dates

### 2. **Consistent Date Handling**
- **Request History**: Shows actual request date, not system creation date
- **Approval Dates**: Reflects when request was actually made
- **Audit Trail**: Maintains accurate timeline of events

### 3. **Better User Experience**
- Users can backdate requests to when they were actually needed
- Historical data is accurate and meaningful
- Financial reports reflect actual business timing

## API Usage

### **Create Maintenance Request with dateRequested**
```javascript
POST /api/requests
Content-Type: application/json

{
    "title": "wifi August",
    "description": "lol",
    "type": "operational",
    "residence": "67d723cf20f89c4ae69804f3",
    "department": "operations",
    "requestedBy": "Mako",
    "deliveryLocation": "St Kilda",
    "priority": "medium",
    "totalEstimatedCost": 100,
    "dateRequested": "2025-08-09",  // ✅ This will be used for all date fields
    "items": [
        {
            "description": "wifi",
            "quantity": 1,
            "unitCost": 100,
            "totalCost": 100,
            "purpose": "wifi"
        }
    ]
}
```

### **Response**
```javascript
{
    "success": true,
    "message": "Request created successfully",
    "request": {
        "_id": "68bfef53e8b2d59325dc5c5b",
        "title": "wifi August",
        "dateRequested": "2025-08-09T00:00:00.000Z",  // ✅ User provided date
        "createdAt": "2025-09-09T09:11:47.067Z",      // System timestamp
        "updatedAt": "2025-09-09T09:11:47.142Z",      // System timestamp
        "requestHistory": [
            {
                "date": "2025-08-09T00:00:00.000Z",   // ✅ Uses dateRequested
                "action": "Request created",
                "user": "68b7909295210ad2fa2c5dcf",
                "changes": ["Request submitted"]
            }
        ],
        "approval": {
            "admin": {
                "approved": true,
                "approvedBy": "68b7909295210ad2fa2c5dcf",
                "approvedByEmail": "kcpemhiwa@gmail.com",
                "approvedAt": "2025-08-09T00:00:00.000Z"  // ✅ Uses dateRequested
            }
        }
    }
}
```

## Validation Rules

### **dateRequested**
- **Format**: ISO date string (YYYY-MM-DD) or Date object
- **Default**: Current date if not provided
- **Validation**: Cannot be in the future (should be today or earlier)
- **Usage**: Used for all business logic dates (approvals, history, transactions)

### **System Timestamps**
- **createdAt**: Always current date (MongoDB timestamp)
- **updatedAt**: Always current date (MongoDB timestamp)
- **Purpose**: System audit trail, not business logic

## Testing

### **Test Scenarios**
1. **Create request with specific dateRequested**
2. **Verify all date fields use dateRequested**
3. **Verify system timestamps remain current**
4. **Test financial transaction creation with correct date**
5. **Verify request history uses dateRequested**

### **Test Commands**
```bash
# Test date handling
node test-maintenance-request-dates.js

# Verify financial transactions
GET /api/financial-reports/monthly-income-statement?period=2025-08
```

## Summary

The fix ensures that:
1. **dateRequested** is used for all business logic dates
2. **System timestamps** remain accurate for audit purposes
3. **Financial transactions** use correct dates for proper accounting
4. **Request history** reflects actual business timeline
5. **Approval dates** match when requests were actually made

This provides accurate financial reporting and maintains proper audit trails while allowing users to backdate requests when necessary.


