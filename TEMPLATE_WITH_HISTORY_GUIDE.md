# 📊 Creating Templates with Historical Data Guide

## 🎯 What You Can Do Now

You can create a template manually and include **both cost history** and **item history** that you know happened, even if it's not currently in your database.

### **Two Types of History:**

1. **Cost History**: Track how costs changed over time
2. **Item History**: Track when items were added/removed/modified

## 🛠️ How to Create Template with History

### **API Endpoint:**
```
POST /api/monthly-requests/residence/:residenceId/create-template-with-history
```

### **Request Structure:**

```javascript
{
    "title": "Monthly Services Template",
    "description": "Template with complete cost and item history",
    "templateName": "St Kilda Monthly Services",
    "templateDescription": "Recurring monthly services with full historical tracking",
    
    // Current items for the template
    "items": [
        {
            "title": "WiFi Service",
            "description": "Monthly WiFi service for St Kilda",
            "estimatedCost": 100, // Current cost (most recent)
            "quantity": 1,
            "category": "utilities",
            "priority": "medium",
            "isRecurring": true,
            "notes": "Recurring monthly service"
        }
    ],
    
    // Historical cost data
    "historicalData": [
        { "itemTitle": "WiFi Service", "month": 2, "year": 2025, "cost": 100, "note": "Initial WiFi cost" },
        { "itemTitle": "WiFi Service", "month": 3, "year": 2025, "cost": 100, "note": "WiFi cost maintained" },
        { "itemTitle": "WiFi Service", "month": 4, "year": 2025, "cost": 250, "note": "WiFi cost increased due to plan upgrade" },
        { "itemTitle": "WiFi Service", "month": 5, "year": 2025, "cost": 100, "note": "WiFi cost reverted to original plan" },
        { "itemTitle": "WiFi Service", "month": 6, "year": 2025, "cost": 100, "note": "WiFi cost stable" }
    ],
    
    // Item history (when items were added/removed/modified)
    "itemHistory": [
        { 
            "itemTitle": "WiFi Service", 
            "month": 2, 
            "year": 2025, 
            "action": "added", 
            "oldValue": null, 
            "newValue": "WiFi Service", 
            "cost": 100, 
            "quantity": 1,
            "note": "WiFi service added to monthly requests" 
        },
        { 
            "itemTitle": "WiFi Service", 
            "month": 4, 
            "year": 2025, 
            "action": "modified", 
            "oldValue": 100, 
            "newValue": 250, 
            "cost": 250, 
            "quantity": 1,
            "note": "WiFi plan upgraded, cost increased" 
        },
        { 
            "itemTitle": "WiFi Service", 
            "month": 5, 
            "year": 2025, 
            "action": "modified", 
            "oldValue": 250, 
            "newValue": 100, 
            "cost": 100, 
            "quantity": 1,
            "note": "WiFi plan reverted to original, cost decreased" 
        }
    ]
}
```

## 📊 Your Specific Scenario Example

### **Timeline:**
- **February**: WiFi $100 (added)
- **March**: WiFi $100 (continued)
- **April**: WiFi $250 (cost increased)
- **May**: WiFi $100 (cost decreased)
- **June**: WiFi $100 (continued)
- **July**: Creating template with complete history

### **What the System Will Create:**

```javascript
// Template Item with Complete History
{
    "title": "WiFi Service",
    "estimatedCost": 100, // Current cost (most recent)
    "quantity": 1,
    "category": "utilities",
    "isRecurring": true,
    
    // Cost History
    "costHistory": [
        { "month": 6, "year": 2025, "cost": 100, "note": "WiFi cost stable" },
        { "month": 5, "year": 2025, "cost": 100, "note": "WiFi cost reverted to original plan" },
        { "month": 4, "year": 2025, "cost": 250, "note": "WiFi cost increased due to plan upgrade" },
        { "month": 3, "year": 2025, "cost": 100, "note": "WiFi cost maintained" },
        { "month": 2, "year": 2025, "cost": 100, "note": "Initial WiFi cost" }
    ],
    
    // Cost Variations (automatically calculated)
    "costVariations": [
        {
            "from": "3/2025",
            "to": "4/2025",
            "oldCost": 100,
            "newCost": 250,
            "change": 150,
            "changePercent": "150.0"
        },
        {
            "from": "4/2025",
            "to": "5/2025",
            "oldCost": 250,
            "newCost": 100,
            "change": -150,
            "changePercent": "-60.0"
        }
    ],
    
    // Item History
    "itemHistory": [
        {
            "month": 5,
            "year": 2025,
            "action": "modified",
            "oldValue": 250,
            "newValue": 100,
            "cost": 100,
            "quantity": 1,
            "note": "WiFi plan reverted to original, cost decreased"
        },
        {
            "month": 4,
            "year": 2025,
            "action": "modified",
            "oldValue": 100,
            "newValue": 250,
            "cost": 250,
            "quantity": 1,
            "note": "WiFi plan upgraded, cost increased"
        },
        {
            "month": 2,
            "year": 2025,
            "action": "added",
            "oldValue": null,
            "newValue": "WiFi Service",
            "cost": 100,
            "quantity": 1,
            "note": "WiFi service added to monthly requests"
        }
    ],
    
    // Cost Summary (automatically calculated)
    "costSummary": {
        "mostRecentCost": 100,
        "mostRecentMonth": "6/2025",
        "uniqueCosts": [100, 250],
        "totalVariations": 2,
        "averageCost": "130.00"
    },
    
    "notes": "Recurring monthly service. Cost history: 5 entries, 2 variations; Item history: 1 added, 0 removed, 2 modified"
}
```

## 🎯 Key Features

### **1. Cost History Tracking**
- **Complete cost timeline** for each item
- **Automatic cost variation detection**
- **Cost trend analysis**
- **Most recent cost identification**

### **2. Item History Tracking**
- **When items were added** to monthly requests
- **When items were removed** from monthly requests
- **When items were modified** (cost/quantity changes)
- **Complete audit trail** of item changes

### **3. Automatic Calculations**
- **Cost variations** automatically detected
- **Cost summaries** automatically generated
- **Historical statistics** calculated
- **Trend analysis** provided

### **4. Smart Template Creation**
- **Uses most recent cost** for template
- **Preserves complete history**
- **Maintains audit trail**
- **Provides context** for future decisions

## 📋 Step-by-Step Process

### **For You:**

1. **Prepare Current Items**
   - List all current items for the template
   - Set current costs and quantities
   - Define categories and priorities

2. **Prepare Cost History**
   - List all historical costs for each item
   - Include month/year and notes
   - Track cost changes over time

3. **Prepare Item History**
   - List when items were added/removed/modified
   - Include old and new values
   - Add explanatory notes

4. **Create Template**
   ```bash
   POST /api/monthly-requests/residence/67d723cf20f89c4ae69804f3/create-template-with-history
   ```

### **For the System:**

1. **Processes Historical Data**
   - Validates all historical entries
   - Calculates cost variations
   - Generates cost summaries

2. **Creates Smart Template**
   - Uses most recent costs
   - Preserves complete history
   - Maintains audit trail

3. **Provides Analysis**
   - Cost trend analysis
   - Item change tracking
   - Historical statistics

## 🔄 What Happens After Creation

### **Template Features:**
- **Current costs** for future months
- **Complete cost history** preserved
- **Item change history** maintained
- **Audit trail** for compliance

### **Future Monthly Requests:**
- **Use template costs** (most recent)
- **Reference historical data** when needed
- **Maintain consistency** going forward
- **Preserve historical context**

### **Reporting and Analytics:**
- **Cost trend analysis** available
- **Item change tracking** documented
- **Historical comparisons** possible
- **Complete audit trail** maintained

## 📈 Benefits

### **✅ Complete Historical Context**
- All cost changes documented
- All item changes tracked
- Full audit trail maintained

### **✅ Smart Template Creation**
- Uses most recent costs
- Preserves historical data
- Provides context for decisions

### **✅ Future Planning**
- Consistent pricing going forward
- Historical data for reference
- Easy to update when needed

### **✅ Compliance and Audit**
- Complete historical record
- Change tracking documented
- Audit trail maintained

## 🚀 Getting Started

### **1. Prepare Your Data**
```javascript
// Example: WiFi Service History
const wifiHistory = [
    { month: 2, year: 2025, cost: 100, note: "Initial cost" },
    { month: 3, year: 2025, cost: 100, note: "Cost maintained" },
    { month: 4, year: 2025, cost: 250, note: "Plan upgrade" },
    { month: 5, year: 2025, cost: 100, note: "Reverted to original" },
    { month: 6, year: 2025, cost: 100, note: "Cost stable" }
];

const wifiItemHistory = [
    { month: 2, year: 2025, action: "added", oldValue: null, newValue: "WiFi Service", cost: 100 },
    { month: 4, year: 2025, action: "modified", oldValue: 100, newValue: 250, cost: 250 },
    { month: 5, year: 2025, action: "modified", oldValue: 250, newValue: 100, cost: 100 }
];
```

### **2. Create the Template**
```bash
POST /api/monthly-requests/residence/YOUR_RESIDENCE_ID/create-template-with-history
```

### **3. Use the Template**
- Future months automatically use template costs
- Historical data preserved for reference
- Complete audit trail maintained

This approach gives you a complete historical context while creating a smart template for future months! 