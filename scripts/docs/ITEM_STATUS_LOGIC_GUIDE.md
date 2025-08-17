# Item Status Logic Guide

## 🎯 Overview

The item status is automatically determined based on the `action` in `itemHistory`. This ensures that when fetching templates for specific months, the system can accurately show whether items were active or inactive at that point in time.

## 📊 Status Logic

### **Action → Status Mapping:**

| Action | Status | Description |
|--------|--------|-------------|
| `added` | `active` | Item was added and is active |
| `modified` | `active` | Item was modified but remains active |
| `removed` | `inactive` | Item was removed and is inactive |

### **Logic Implementation:**

```javascript
// In backend controller
status: h.action === 'removed' ? 'inactive' : 'active'

// In MongoDB schema
status: { 
  type: String, 
  enum: ['active', 'inactive'], 
  default: 'active' 
}
```

## 🔄 How It Works

### **1. When Creating Templates:**

```javascript
// Frontend sends itemHistory
itemHistory: [
  {
    title: "wifi",
    action: "removed",
    month: 7,
    year: 2025,
    // ... other fields
  },
  {
    title: "wifi", 
    action: "added",
    month: 8,
    year: 2025,
    // ... other fields
  }
]

// Backend automatically adds status
itemHistory: [
  {
    title: "wifi",
    action: "removed",
    status: "inactive", // Auto-set based on action
    month: 7,
    year: 2025,
    // ... other fields
  },
  {
    title: "wifi",
    action: "added", 
    status: "active", // Auto-set based on action
    month: 8,
    year: 2025,
    // ... other fields
  }
]
```

### **2. When Fetching Templates:**

```javascript
// Fetch for July 2025
GET /api/monthly-requests/residence/:id/templates?month=7&year=2025

// Response shows wifi as inactive
{
  "items": [
    {
      "title": "wifi",
      "estimatedCost": 0, // No cost when inactive
      "status": "inactive",
      "inactiveNote": "Item was removed in 7/2025 and not active in 7/2025"
    }
  ]
}

// Fetch for August 2025  
GET /api/monthly-requests/residence/:id/templates?month=8&year=2025

// Response shows wifi as active
{
  "items": [
    {
      "title": "wifi",
      "estimatedCost": 100, // Normal cost when active
      "status": "active"
    }
  ]
}
```

## 📋 Database Schema

### **itemHistory Schema:**
```javascript
itemHistory: [{
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true, min: 2020 },
  date: { type: Date, required: true },
  action: { type: String, enum: ['added', 'removed', 'modified'], required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }, // Auto-set based on action
  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  note: { type: String, trim: true },
  cost: { type: Number, min: 0 },
  quantity: { type: Number, min: 1 },
  // ... standardized fields
}]
```

## 🎯 Frontend Implementation

### **1. Sending Data:**
```javascript
// Frontend only needs to send action
const itemHistory = [
  {
    title: "wifi",
    action: "removed", // Backend will set status: "inactive"
    month: 7,
    year: 2025,
    cost: 100,
    note: "Removed in July"
  },
  {
    title: "wifi", 
    action: "added", // Backend will set status: "active"
    month: 8,
    year: 2025,
    cost: 100,
    note: "Added back in August"
  }
];
```

### **2. Displaying Status:**
```javascript
// Frontend can display status from database
const renderItemStatus = (item) => {
  if (item.status === 'inactive') {
    return (
      <div className="item-inactive">
        <span className="status-badge inactive">❌ INACTIVE</span>
        <span className="cost">$0</span>
        <span className="note">{item.inactiveNote}</span>
      </div>
    );
  } else {
    return (
      <div className="item-active">
        <span className="status-badge active">✅ ACTIVE</span>
        <span className="cost">${item.estimatedCost}</span>
      </div>
    );
  }
};
```

## 🔍 Benefits

### **1. Accurate Historical Display:**
- When fetching for July 2025, wifi shows as inactive with $0 cost
- When fetching for August 2025, wifi shows as active with $100 cost

### **2. Automatic Status Management:**
- No manual status tracking required
- Status automatically derived from action
- Consistent across all operations

### **3. Rich Context:**
- Frontend can show why item is inactive
- Historical notes explain the status
- Complete timeline tracking

## 📊 Example Timeline

### **WiFi Timeline:**
```
April 2025: Started (action: "added", status: "active", cost: $100)
July 2025:  Removed (action: "removed", status: "inactive", cost: $0)
August 2025: Added back (action: "added", status: "active", cost: $100)
```

### **Fetching Results:**
```
GET /templates?month=6&year=2025 → WiFi: Active, $100
GET /templates?month=7&year=2025 → WiFi: Inactive, $0  
GET /templates?month=8&year=2025 → WiFi: Active, $100
```

## 🎯 Key Points

1. **Action determines status**: `removed` → `inactive`, others → `active`
2. **Backend auto-sets status**: Frontend only sends action
3. **Database stores status**: Available for all queries
4. **Fetching uses stored status**: Accurate historical display
5. **Cost reflects status**: Inactive items show $0 cost

This ensures accurate historical representation when fetching templates for specific months! 🎉 