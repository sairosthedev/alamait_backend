# Status Workflow Guide

## 📊 Status Types

### 1. Request Status (Monthly Request Level)
- **`draft`** - Initial state when admin creates
- **`pending`** - When admin sends to finance for approval
- **`approved`** - When finance approves
- **`rejected`** - When finance rejects
- **`completed`** - When request is fulfilled

### 2. Item Status (Individual Item Level)
- **`active`** - Item is currently active
- **`inactive`** - Item was removed and not active

### 3. Template Edit Status (Template Changes)
- **`pending`** - Admin made changes, waiting for finance approval
- **`approved`** - Finance approved the changes
- **`rejected`** - Finance rejected the changes

## 🔄 Workflow

### Monthly Request Creation

#### 1. Admin creates monthly request
```javascript
// POST /api/monthly-requests
{
  title: "Monthly Requests",
  description: "Monthly Requests for St Kilda",
  residence: "67d723cf20f89c4ae69804f3",
  month: 8,
  year: 2025,
  items: [
    {
      title: "wifi",
      description: "wifi kilda",
      estimatedCost: 100,
      quantity: 1,
      // ... other fields
    }
  ],
  isTemplate: false // Regular monthly request
}
// Status: "draft" (automatically set)
```

#### 2. Admin sends to finance
```javascript
// PUT /api/monthly-requests/:id/send-to-finance
// Status changes from "draft" to "pending"
```

#### 3. Finance approves/rejects
```javascript
// PUT /api/monthly-requests/:id/approve (Finance)
// Status changes to "approved"

// PUT /api/monthly-requests/:id/reject (Finance)
// Status changes to "rejected"
```

### Template Creation and Editing

#### 1. Admin creates template
```javascript
// POST /api/monthly-requests
{
  title: "Monthly Requests",
  description: "Monthly Requests for St Kilda",
  residence: "67d723cf20f89c4ae69804f3",
  isTemplate: true,
  items: [
    {
      title: "wifi",
      description: "wifi kilda",
      estimatedCost: 100,
      quantity: 1,
      status: "active" // Item is active
    }
  ],
  historicalData: [...],
  itemHistory: [...]
}
// Template status: "draft"
```

#### 2. Admin edits template for future months
```javascript
// PUT /api/monthly-requests/templates/:templateId
{
  items: [
    {
      title: "wifi",
      description: "wifi kilda",
      estimatedCost: 120, // Cost increased
      quantity: 1,
      status: "active"
    }
  ],
  effectiveFromMonth: 9,
  effectiveFromYear: 2025
}
// Creates pending changes with status: "pending"
```

#### 3. Finance reviews template changes
```javascript
// GET /api/monthly-requests/templates/:residence/pending-changes
// Finance sees all pending template changes

// PUT /api/monthly-requests/templates/:templateId/approve-changes
// Changes status to "approved" and takes effect

// PUT /api/monthly-requests/templates/:templateId/reject-changes
// Changes status to "rejected"
```

## 📋 API Endpoints

### Monthly Request Endpoints
- `POST /api/monthly-requests` - Create request/template
- `PUT /api/monthly-requests/:id/send-to-finance` - Send to finance
- `PUT /api/monthly-requests/:id/approve` - Finance approves
- `PUT /api/monthly-requests/:id/reject` - Finance rejects
- `GET /api/monthly-requests` - Get all requests (filtered by status)

### Template Endpoints
- `GET /api/monthly-requests/templates` - Get all templates
- `GET /api/monthly-requests/residence/:id/templates` - Get templates for residence
- `PUT /api/monthly-requests/templates/:templateId` - Edit template (creates pending changes)
- `GET /api/monthly-requests/templates/:residence/pending-changes` - Get pending changes
- `PUT /api/monthly-requests/templates/:templateId/approve-changes` - Approve changes
- `PUT /api/monthly-requests/templates/:templateId/reject-changes` - Reject changes

## 🎯 Key Points

### 1. Admin Workflow
- Creates requests/templates with status "draft"
- Sends requests to finance (status becomes "pending")
- Edits templates for future months (creates pending changes)

### 2. Finance Workflow
- Sees all pending requests and template changes
- Approves/rejects requests
- Approves/rejects template changes

### 3. Item Status
- Items can be "active" or "inactive"
- Inactive items show $0 cost when fetching for past months
- Item status is separate from request status

### 4. Template Changes
- Only affect future months
- Require finance approval
- Have their own approval workflow

## 🔧 Implementation Notes

### Status Logic
```javascript
// For monthly requests
function getDefaultStatusForMonth(month, year, userRole) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  // Past months: auto-approved
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return 'approved';
  }
  
  // Current/future months: pending for finance
  return 'pending';
}

// For templates
// Always start as "draft"
// Changes require finance approval
```

### Frontend Considerations
1. **Admin Dashboard**: Show draft and pending requests
2. **Finance Dashboard**: Show pending requests and template changes
3. **Status Indicators**: Clear visual indicators for each status
4. **Approval Workflow**: Separate flows for requests vs template changes
5. **Item Status Display**: Show active/inactive status for items

## 📊 Database Schema Updates

### MonthlyRequest Schema
```javascript
{
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'completed'],
    default: 'draft'
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  templateChanges: [{
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    // ... other change fields
  }]
}
```

### MonthlyRequestItem Schema
```javascript
{
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
  // ... other item fields
}
```

This workflow ensures proper separation of concerns and clear approval processes for both monthly requests and template changes. 