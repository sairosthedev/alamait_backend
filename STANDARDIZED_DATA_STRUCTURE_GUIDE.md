# 📊 Standardized Data Structure Guide

## 🎯 Overview

This guide explains the standardized data structure for monthly request templates, ensuring consistency between historical data and current template items to avoid data differences.

## 📋 Standardized Data Fields

### **✅ All Items (Current & Historical) Use These Fields:**

```javascript
{
    // Core fields (required)
    title: "WiFi Service",                    // Item title
    description: "Monthly WiFi service",      // Item description
    quantity: 1,                             // Item quantity
    estimatedCost: 100,                      // Item cost
    category: "utilities",                   // Item category
    priority: "medium",                      // Item priority
    isRecurring: true,                      // Is recurring item
    notes: "Monthly WiFi service",           // Item notes
    
    // Optional fields
    tags: ["wifi", "monthly"],              // Item tags
    purpose: "Resident internet access"      // Item purpose
}
```

## 🔄 Data Structure Comparison

### **📊 Before Standardization (Inconsistent):**

#### **Historical Data:**
```javascript
// historicalData
{
    itemTitle: "WiFi Service",    // ❌ Different field name
    month: 2,
    year: 2025,
    cost: 100,                   // ❌ Different field name
    note: "Initial WiFi cost"     // ❌ Different field name
}

// itemHistory
{
    itemTitle: "WiFi Service",    // ❌ Different field name
    month: 2,
    year: 2025,
    action: "added",
    cost: 100,                   // ❌ Different field name
    quantity: 1,
    note: "WiFi service added"   // ❌ Different field name
}
```

#### **Current Template Items:**
```javascript
{
    title: "WiFi Service",        // ✅ Standard field name
    description: "Monthly WiFi",  // ✅ Standard field name
    estimatedCost: 100,          // ✅ Standard field name
    quantity: 1,                 // ✅ Standard field name
    notes: "Monthly service"     // ✅ Standard field name
}
```

### **📊 After Standardization (Consistent):**

#### **Historical Data:**
```javascript
// historicalData
{
    title: "WiFi Service",        // ✅ Standard field name
    month: 2,
    year: 2025,
    cost: 100,                   // ✅ Kept for historical context
    note: "Initial WiFi cost",    // ✅ Kept for historical context
    description: "Monthly WiFi service",  // ✅ Standard field name
    quantity: 1,                 // ✅ Standard field name
    category: "utilities",       // ✅ Standard field name
    priority: "medium",          // ✅ Standard field name
    isRecurring: true,          // ✅ Standard field name
    notes: "Initial WiFi service" // ✅ Standard field name
}

// itemHistory
{
    title: "WiFi Service",        // ✅ Standard field name
    month: 2,
    year: 2025,
    action: "added",
    cost: 100,                   // ✅ Kept for historical context
    quantity: 1,                 // ✅ Standard field name
    note: "WiFi service added",  // ✅ Kept for historical context
    description: "Monthly WiFi service",  // ✅ Standard field name
    category: "utilities",       // ✅ Standard field name
    priority: "medium",          // ✅ Standard field name
    isRecurring: true,          // ✅ Standard field name
    notes: "WiFi service added"  // ✅ Standard field name
}
```

#### **Current Template Items:**
```javascript
{
    title: "WiFi Service",        // ✅ Standard field name
    description: "Monthly WiFi service",  // ✅ Standard field name
    quantity: 1,                 // ✅ Standard field name
    estimatedCost: 100,          // ✅ Standard field name
    category: "utilities",       // ✅ Standard field name
    priority: "medium",          // ✅ Standard field name
    isRecurring: true,          // ✅ Standard field name
    notes: "Monthly WiFi service" // ✅ Standard field name
}
```

## 🎯 Key Benefits of Standardization

### **✅ Consistent Field Names:**
- **Historical data** and **current items** use the same field names
- No more `itemTitle` vs `title` confusion
- No more `cost` vs `estimatedCost` confusion
- No more `note` vs `notes` confusion

### **✅ Complete Data Structure:**
- Historical entries include all standard fields
- Current items include all standard fields
- No missing fields when processing data

### **✅ Easy Data Processing:**
- Same validation logic for both historical and current data
- Same field mapping for both data types
- Consistent data transformation

### **✅ Future-Proof:**
- Adding new fields only requires updating one structure
- Historical data automatically includes new fields
- No data migration needed for new fields

## 📋 Field Requirements

### **🟢 Required Fields (Always Present):**
```javascript
{
    title: "string",           // Item title
    description: "string",     // Item description
    quantity: "number",        // Item quantity (min: 1)
    estimatedCost: "number",   // Item cost (min: 0)
    category: "string",        // Item category
    priority: "string",        // Item priority
    isRecurring: "boolean"     // Is recurring item
}
```

### **🟡 Optional Fields (May Be Present):**
```javascript
{
    notes: "string",           // Item notes
    tags: ["string"],          // Item tags array
    purpose: "string"          // Item purpose
}
```

### **🟠 Historical-Specific Fields (Only in Historical Data):**
```javascript
{
    month: "number",           // Historical month (1-12)
    year: "number",            // Historical year
    cost: "number",            // Historical cost (for cost history)
    note: "string",            // Historical note (for cost history)
    action: "string",          // Historical action (for item history)
    oldValue: "mixed",         // Previous value (for item history)
    newValue: "mixed",         // New value (for item history)
    date: "Date"               // Historical date
}
```

## 🔄 Data Processing Logic

### **📊 When Creating Templates with Historical Data:**

```javascript
// 1. Process current items
const currentItems = items.map(item => ({
    title: item.title,
    description: item.description,
    quantity: item.quantity || 1,
    estimatedCost: item.estimatedCost,
    category: item.category || 'other',
    priority: item.priority || 'medium',
    isRecurring: item.isRecurring !== undefined ? item.isRecurring : true,
    notes: item.notes || '',
    tags: item.tags || []
}));

// 2. Process historical data (same structure)
const historicalItems = historicalData.map(h => ({
    title: h.title,
    description: h.description,
    quantity: h.quantity || 1,
    estimatedCost: h.cost, // Map historical cost to estimatedCost
    category: h.category || 'other',
    priority: h.priority || 'medium',
    isRecurring: h.isRecurring !== undefined ? h.isRecurring : true,
    notes: h.notes || '',
    tags: h.tags || [],
    // Historical-specific fields
    month: h.month,
    year: h.year,
    cost: h.cost,
    note: h.note
}));

// 3. Process item history (same structure)
const itemHistoryItems = itemHistory.map(h => ({
    title: h.title,
    description: h.description,
    quantity: h.quantity || 1,
    estimatedCost: h.cost, // Map historical cost to estimatedCost
    category: h.category || 'other',
    priority: h.priority || 'medium',
    isRecurring: h.isRecurring !== undefined ? h.isRecurring : true,
    notes: h.notes || '',
    tags: h.tags || [],
    // Historical-specific fields
    month: h.month,
    year: h.year,
    action: h.action,
    oldValue: h.oldValue,
    newValue: h.newValue,
    note: h.note
}));
```

## 📊 Example: Complete Standardized Structure

### **🎯 Creating Template with Historical Data:**

```javascript
{
    "title": "Monthly Services Template",
    "description": "Template with complete cost and item history",
    "residence": "67d723cf20f89c4ae69804f3",
    "isTemplate": true,
    
    // Current items (standardized structure)
    "items": [
        {
            "title": "WiFi Service",
            "description": "Monthly WiFi service for St Kilda",
            "estimatedCost": 100,
            "quantity": 1,
            "category": "utilities",
            "priority": "medium",
            "isRecurring": true,
            "notes": "Recurring monthly service"
        }
    ],
    
    // Historical data (standardized structure)
    "historicalData": [
        {
            "title": "WiFi Service",
            "description": "Monthly WiFi service for St Kilda",
            "quantity": 1,
            "category": "utilities",
            "priority": "medium",
            "isRecurring": true,
            "notes": "Initial WiFi service",
            // Historical-specific fields
            "month": 2,
            "year": 2025,
            "cost": 100,
            "note": "Initial WiFi cost"
        }
    ],
    
    // Item history (standardized structure)
    "itemHistory": [
        {
            "title": "WiFi Service",
            "description": "Monthly WiFi service for St Kilda",
            "quantity": 1,
            "category": "utilities",
            "priority": "medium",
            "isRecurring": true,
            "notes": "WiFi service added",
            // Historical-specific fields
            "month": 2,
            "year": 2025,
            "action": "added",
            "oldValue": null,
            "newValue": "WiFi Service",
            "cost": 100,
            "note": "WiFi service added to monthly requests"
        }
    ]
}
```

## 🎯 Key Points

### **✅ Month/Year Requirement:**
- **Historical data**: `month` and `year` are **required** (for historical context)
- **Current items**: `month` and `year` are **not required** (templates don't have specific months)
- **Templates**: Use `effectiveFrom` date instead of month/year

### **✅ Field Mapping:**
- Historical `cost` maps to current `estimatedCost`
- Historical `note` maps to current `notes`
- All other fields use the same names

### **✅ Data Consistency:**
- Same validation rules for all data
- Same field requirements for all data
- Same processing logic for all data

This standardized structure ensures that you won't face data differences issues when working with historical data and current template items! 