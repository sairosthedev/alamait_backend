# 📋 Monthly Request Status Logic Implementation

## 🎯 Overview

The monthly request system now implements intelligent status logic based on the month/year of the request:

- **Past/Current Months**: Automatically `approved` (no finance approval needed)
- **Future Months**: Set as `pending` (requires finance approval)
- **Templates**: Always `draft` (for management purposes)

## 🔄 Status Logic Rules

### **1. Past/Current Month Requests**
```javascript
// Auto-approved for historical data
if (year < currentYear || (year === currentYear && month <= currentMonth)) {
    status = 'approved';
}
```

**Examples:**
- January 2024 (past month) → `approved`
- December 2024 (current month) → `approved`
- Any month in 2023 or earlier → `approved`

### **2. Future Month Requests**
```javascript
// Pending for finance approval
if (year > currentYear || (year === currentYear && month > currentMonth)) {
    status = 'pending';
}
```

**Examples:**
- February 2025 (future month) → `pending`
- January 2025 (next month) → `pending`
- Any month in 2026 or later → `pending`

### **3. Template Requests**
```javascript
// Always draft for management
if (isTemplate) {
    status = 'draft';
}
```

## 🛠️ Implementation Details

### **Controller Changes (`src/controllers/monthlyRequestController.js`)**

#### **Helper Functions Added:**
```javascript
// Determine if request is for past/current month
function isPastOrCurrentMonth(month, year) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    if (year < currentYear) return true;
    if (year === currentYear && month <= currentMonth) return true;
    return false;
}

// Get appropriate status based on month/year
function getDefaultStatusForMonth(month, year, userRole) {
    const isPastOrCurrent = isPastOrCurrentMonth(month, year);
    
    if (isPastOrCurrent) {
        return 'approved'; // Auto-approve historical requests
    } else {
        return 'pending'; // Require finance approval for future
    }
}
```

#### **MonthlyRequest Creation Updated:**
```javascript
// Determine appropriate status based on month/year
let requestStatus = 'draft';
if (!isTemplateValue) {
    requestStatus = getDefaultStatusForMonth(parseInt(month), parseInt(year), user.role);
}

const monthlyRequest = new MonthlyRequest({
    // ... other fields
    status: requestStatus,
    // ... rest of fields
});
```

### **Model Changes (`src/models/MonthlyRequest.js`)**

#### **createFromTemplate Method Updated:**
```javascript
monthlyRequestSchema.statics.createFromTemplate = function(templateId, month, year, submittedBy) {
    return this.findById(templateId).then(template => {
        // Determine appropriate status based on month/year
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        let requestStatus = 'draft';
        if (year < currentYear || (year === currentYear && month <= currentMonth)) {
            requestStatus = 'approved'; // Past/current month
        } else {
            requestStatus = 'pending'; // Future month
        }
        
        const monthlyRequest = new this({
            // ... other fields
            status: requestStatus,
            // ... rest of fields
        });
        
        return monthlyRequest.save();
    });
};
```

## 📊 Status Workflow

### **Complete Status Flow:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     draft       │    │    pending      │    │   approved      │
│   (templates)   │    │  (future months)│    │(past/current)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   rejected      │              │
         │              │ (finance only)  │              │
         │              └─────────────────┘              │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   completed     │    │   completed     │    │   completed     │
│ (finance only)  │    │ (finance only)  │    │ (finance only)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Role-Based Status Management:**

#### **Admin Actions:**
- **Create Past/Current Month**: Auto-`approved`
- **Create Future Month**: Auto-`pending`
- **Create Template**: Always `draft`
- **Update**: Only `draft` and `pending` requests
- **Submit**: `draft` → `pending`

#### **Finance Actions:**
- **Approve**: `pending` → `approved`
- **Reject**: `pending` → `rejected`
- **Complete**: `approved` → `completed`

## 🧪 Testing

### **Test Script: `test-status-logic.js`**

The test script demonstrates all status logic scenarios:

1. **Past Month Request** → Should be `approved`
2. **Current Month Request** → Should be `approved`
3. **Future Month Request** → Should be `pending`
4. **Template Creation** → Should be `draft`
5. **Create from Template (Past)** → Should be `approved`
6. **Create from Template (Future)** → Should be `pending`

### **Running the Test:**
```bash
# 1. Replace token in test script
# 2. Ensure residence ID exists
# 3. Run the test
node test-status-logic.js
```

## 📈 Business Logic Benefits

### **1. Historical Data Management**
- Past/current month requests are automatically approved
- No need for finance to approve historical data
- Maintains data integrity for reporting

### **2. Future Planning**
- Future month requests require finance approval
- Ensures proper budget control
- Allows for cost review before approval

### **3. Template Management**
- Templates remain in draft status
- Allows for ongoing template management
- No automatic approval for templates

### **4. Workflow Efficiency**
- Reduces unnecessary approval steps for historical data
- Focuses finance attention on future planning
- Maintains proper audit trail

## 🔧 API Endpoints Affected

### **Creation Endpoints:**
- `POST /api/monthly-requests` - Now uses intelligent status logic
- `POST /api/monthly-requests/templates/:templateId` - Now uses intelligent status logic

### **Status-Specific Endpoints:**
- `GET /api/monthly-requests?status=pending` - Future month requests
- `GET /api/monthly-requests?status=approved` - Past/current month requests
- `GET /api/monthly-requests/finance/pending-approvals` - Only future requests

## 🚀 Migration Notes

### **Existing Data:**
- Existing requests maintain their current status
- New requests follow the new logic
- No automatic migration of existing data

### **Backward Compatibility:**
- All existing endpoints continue to work
- Status enum values remain the same
- No breaking changes to API contracts

## 📋 Summary

The new status logic provides:

✅ **Intelligent Automation**: Past/current months auto-approved  
✅ **Future Control**: Future months require finance approval  
✅ **Template Management**: Templates remain in draft status  
✅ **Workflow Efficiency**: Reduces unnecessary approval steps  
✅ **Data Integrity**: Maintains proper audit trail  
✅ **Backward Compatibility**: No breaking changes  

This implementation ensures that the monthly request system properly handles historical data while maintaining proper approval workflows for future planning. 