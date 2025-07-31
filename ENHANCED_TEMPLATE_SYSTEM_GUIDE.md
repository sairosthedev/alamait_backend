# Enhanced Template System Guide - Monthly Requests

## Overview

The enhanced template system provides a sophisticated workflow for managing recurring monthly requests with:
- **Automatic template usage** for recurring monthly requests
- **Admin-controlled template updates** (add/remove/modify items)
- **Finance approval workflow** for template changes
- **Future-month-only changes** (changes don't affect current/past months)
- **Comprehensive change tracking** and audit trail
- **Table format display** for template items

## Key Features

### 1. **Template Versioning & Change Tracking**
- Each template has a version number that increments with changes
- All changes are tracked with timestamps, user info, and approval status
- Changes are effective from the next month only (not retroactive)

### 2. **Role-Based Access Control**
- **Admin**: Can create, modify, and update templates
- **Finance**: Can view and approve/reject template changes
- **Students**: Cannot access template functionality

### 3. **Approval Workflow**
- All template changes require finance approval
- Changes are marked as "pending" until approved/rejected
- Finance can approve or reject changes with reasons

## API Endpoints

### Template Management

#### 1. Get Template Items as Table
**Endpoint:** `GET /api/monthly-requests/templates/:templateId/table`

**Purpose:** Get template items in a structured table format with change tracking.

**Response:**
```json
{
    "template": {
        "id": "688b6ec53f6f1bd1301fc958",
        "title": "Monthly Services Template",
        "description": "Template for monthly services",
        "residence": {
            "id": "67d723cf20f89c4ae69804f3",
            "name": "St Kilda"
        },
        "submittedBy": {
            "id": "67c023adae5e27657502e887",
            "firstName": "Admin",
            "lastName": "User",
            "email": "admin@example.com"
        },
        "templateVersion": 3,
        "lastUpdated": "2024-12-31T13:25:25.433Z",
        "totalEstimatedCost": 580
    },
    "items": [
        {
            "index": 1,
            "title": "WiFi Service",
            "description": "Monthly WiFi service",
            "quantity": 1,
            "estimatedCost": 180,
            "totalCost": 180,
            "category": "utilities",
            "priority": "medium",
            "isRecurring": true,
            "notes": "",
            "tags": [],
            "pendingChanges": []
        },
        {
            "index": 2,
            "title": "Security Fees",
            "description": "Monthly security service fees",
            "quantity": 1,
            "estimatedCost": 250,
            "totalCost": 250,
            "category": "services",
            "priority": "high",
            "isRecurring": true,
            "notes": "Increased security fees starting next month",
            "tags": [],
            "pendingChanges": [
                {
                    "date": "2024-12-31T13:25:25.433Z",
                    "action": "added",
                    "field": "new_item",
                    "status": "pending",
                    "description": "Added new item: Security Fees"
                }
            ]
        }
    ],
    "pendingChanges": [
        {
            "date": "2024-12-31T13:25:25.433Z",
            "action": "item_added",
            "itemIndex": 1,
            "field": "new_item",
            "oldValue": null,
            "newValue": {
                "title": "Security Fees",
                "description": "Monthly security service fees",
                "estimatedCost": 250
            },
            "changedBy": {
                "id": "67c023adae5e27657502e887",
                "firstName": "Admin",
                "lastName": "User"
            },
            "effectiveFrom": "2025-02-01T00:00:00.000Z",
            "status": "pending",
            "description": "Added new item: Security Fees - Monthly security service fees"
        }
    ],
    "summary": {
        "totalItems": 2,
        "totalCost": 580,
        "pendingChangesCount": 1
    }
}
```

#### 2. Add Item to Template (Admin Only)
**Endpoint:** `POST /api/monthly-requests/templates/:templateId/items`

**Purpose:** Add a new item to a template (effective from next month).

**Request Body:**
```json
{
    "title": "Security Fees",
    "description": "Monthly security service fees",
    "estimatedCost": 250,
    "category": "services",
    "priority": "high",
    "notes": "Increased security fees starting next month"
}
```

**Response:**
```json
{
    "message": "Item added to template successfully. Changes will be effective from next month and require finance approval.",
    "template": {
        // Updated template with new item and pending change
    },
    "addedItem": {
        "title": "Security Fees",
        "description": "Monthly security service fees",
        "estimatedCost": 250
    }
}
```

#### 3. Modify Template Item (Admin Only)
**Endpoint:** `PUT /api/monthly-requests/templates/:templateId/items/:itemIndex`

**Purpose:** Modify an existing item in a template (effective from next month).

**Request Body:**
```json
{
    "field": "estimatedCost",
    "newValue": 180
}
```

**Allowed Fields:** `title`, `description`, `quantity`, `estimatedCost`, `category`, `priority`, `notes`

#### 4. Remove Template Item (Admin Only)
**Endpoint:** `DELETE /api/monthly-requests/templates/:templateId/items/:itemIndex`

**Purpose:** Remove an item from a template (effective from next month).

### Finance Approval Workflow

#### 1. Get Templates with Pending Changes (Finance Only)
**Endpoint:** `GET /api/monthly-requests/templates/:residenceId/pending-changes`

**Purpose:** Get all templates with pending changes that require finance approval.

**Response:**
```json
{
    "residence": {
        "id": "67d723cf20f89c4ae69804f3"
    },
    "templates": [
        {
            "id": "688b6ec53f6f1bd1301fc958",
            "title": "Monthly Services Template",
            "templateChanges": [
                {
                    "date": "2024-12-31T13:25:25.433Z",
                    "action": "item_added",
                    "description": "Added new item: Security Fees - Monthly security service fees",
                    "changedBy": {
                        "firstName": "Admin",
                        "lastName": "User"
                    },
                    "effectiveFrom": "2025-02-01T00:00:00.000Z",
                    "status": "pending"
                }
            ]
        }
    ],
    "totalTemplates": 1,
    "pendingChangesCount": 1
}
```

#### 2. Approve Template Changes (Finance Only)
**Endpoint:** `POST /api/monthly-requests/templates/:templateId/changes/:changeIndex/approve`

**Purpose:** Approve a pending template change.

#### 3. Reject Template Changes (Finance Only)
**Endpoint:** `POST /api/monthly-requests/templates/:templateId/changes/:changeIndex/reject`

**Purpose:** Reject a pending template change with a reason.

**Request Body:**
```json
{
    "reason": "Cost increase not justified"
}
```

## Workflow Examples

### Scenario 1: Admin Adds Security Fees

1. **Admin adds new item to template:**
```javascript
// Admin action
const response = await axios.post(
    '/api/monthly-requests/templates/688b6ec53f6f1bd1301fc958/items',
    {
        title: 'Security Fees',
        description: 'Monthly security service fees',
        estimatedCost: 250,
        category: 'services',
        priority: 'high',
        notes: 'Increased security fees starting next month'
    }
);
```

2. **Finance sees pending change:**
```javascript
// Finance action
const pendingChanges = await axios.get(
    '/api/monthly-requests/templates/67d723cf20f89c4ae69804f3/pending-changes'
);
```

3. **Finance approves the change:**
```javascript
// Finance action
const approval = await axios.post(
    '/api/monthly-requests/templates/688b6ec53f6f1bd1301fc958/changes/0/approve'
);
```

4. **Change takes effect from next month:**
- Current month (January): No change
- Next month (February): Security fees included in template

### Scenario 2: Admin Modifies Existing Item

1. **Admin modifies WiFi cost:**
```javascript
// Admin action
const response = await axios.put(
    '/api/monthly-requests/templates/688b6ec53f6f1bd1301fc958/items/0',
    {
        field: 'estimatedCost',
        newValue: 180
    }
);
```

2. **Finance reviews and approves:**
```javascript
// Finance action
const approval = await axios.post(
    '/api/monthly-requests/templates/688b6ec53f6f1bd1301fc958/changes/1/approve'
);
```

3. **Change applies to future months only**

## Frontend Integration

### Template Table Display
```javascript
// Get template items as table
const getTemplateTable = async (templateId) => {
    const response = await axios.get(`/api/monthly-requests/templates/${templateId}/table`);
    return response.data;
};

// Display table
const displayTemplateTable = (tableData) => {
    console.log('Template:', tableData.template.title);
    console.log('Version:', tableData.template.templateVersion);
    console.log('Total Cost:', tableData.template.totalEstimatedCost);
    
    console.log('\nItems:');
    tableData.items.forEach(item => {
        console.log(`${item.index}. ${item.title} - $${item.totalCost}`);
        if (item.pendingChanges.length > 0) {
            console.log(`   ⚠️  Pending changes: ${item.pendingChanges.length}`);
        }
    });
    
    if (tableData.pendingChanges.length > 0) {
        console.log(`\n⚠️  ${tableData.pendingChanges.length} pending changes require finance approval`);
    }
};
```

### Admin Template Management
```javascript
// Add item to template
const addTemplateItem = async (templateId, itemData) => {
    const response = await axios.post(
        `/api/monthly-requests/templates/${templateId}/items`,
        itemData
    );
    return response.data;
};

// Modify template item
const modifyTemplateItem = async (templateId, itemIndex, field, newValue) => {
    const response = await axios.put(
        `/api/monthly-requests/templates/${templateId}/items/${itemIndex}`,
        { field, newValue }
    );
    return response.data;
};

// Remove template item
const removeTemplateItem = async (templateId, itemIndex) => {
    const response = await axios.delete(
        `/api/monthly-requests/templates/${templateId}/items/${itemIndex}`
    );
    return response.data;
};
```

### Finance Approval Interface
```javascript
// Get pending changes
const getPendingChanges = async (residenceId) => {
    const response = await axios.get(
        `/api/monthly-requests/templates/${residenceId}/pending-changes`
    );
    return response.data;
};

// Approve change
const approveChange = async (templateId, changeIndex) => {
    const response = await axios.post(
        `/api/monthly-requests/templates/${templateId}/changes/${changeIndex}/approve`
    );
    return response.data;
};

// Reject change
const rejectChange = async (templateId, changeIndex, reason) => {
    const response = await axios.post(
        `/api/monthly-requests/templates/${templateId}/changes/${changeIndex}/reject`,
        { reason }
    );
    return response.data;
};
```

## Benefits

### 1. **Controlled Change Management**
- All changes require approval before taking effect
- Changes only apply to future months
- Complete audit trail of all modifications

### 2. **Role-Based Workflow**
- Clear separation of admin and finance responsibilities
- Finance has oversight of all template changes
- Admin can make changes but cannot bypass approval

### 3. **Data Integrity**
- No retroactive changes to existing monthly requests
- Version control for templates
- Comprehensive change tracking

### 4. **User Experience**
- Table format for easy viewing of template items
- Clear indication of pending changes
- Structured approval workflow

## Best Practices

### 1. **Change Planning**
- Plan template changes well in advance
- Consider the impact on future monthly requests
- Communicate changes to relevant stakeholders

### 2. **Approval Process**
- Finance should review changes promptly
- Provide clear reasons for rejections
- Keep track of approval timelines

### 3. **Template Maintenance**
- Regularly review template effectiveness
- Remove outdated items promptly
- Update costs and descriptions as needed

## Testing

Use the provided test script `test-enhanced-template-system.js` to verify:
- Template creation and management
- Item addition, modification, and removal
- Change approval workflow
- Table format display
- Error handling and validation

## Next Steps

1. **Deploy the enhanced template system**
2. **Train users on the new workflow**
3. **Implement frontend interfaces for template management**
4. **Set up monitoring for pending approvals**
5. **Consider automated notifications for pending changes** 