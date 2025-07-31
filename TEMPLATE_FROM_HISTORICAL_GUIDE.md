# 📊 Creating Templates from Historical Data Guide

## 🎯 Your Scenario Explained

### **Current Situation:**
- You have **historical monthly requests** (past months) with various items
- You want to **create a template** for the first time
- Some items from past months are **still relevant**, some have **changed**
- Past months should be **auto-approved** (since they're historical)

### **What Will Happen:**

1. **Historical Data Analysis**: System analyzes your past requests
2. **Smart Item Detection**: Identifies recurring vs one-time items
3. **Cost Analysis**: Tracks cost changes over time
4. **Template Creation**: Creates template with current items/costs
5. **Future Planning**: New months use template, old months stay as-is

## 🛠️ Implementation Process

### **Step 1: Analyze Historical Data**

**API Endpoint:** `GET /api/monthly-requests/residence/:residenceId/analyze-historical`

This analyzes your historical data and suggests template items:

```javascript
// Example request
GET /api/monthly-requests/residence/67d723cf20f89c4ae69804f3/analyze-historical?months=6

// Response
{
    "success": true,
    "message": "Analyzed 6 historical requests",
    "suggestedItems": [
        {
            "title": "WiFi Service",
            "description": "Monthly WiFi service",
            "estimatedCost": 200, // Most recent cost
            "quantity": 1,
            "category": "utilities",
            "isRecurring": true,
            "priority": "medium",
            "notes": "Recurring item (appeared 6 times in last 6 months)",
            "costHistory": [
                {
                    "date": "2024-08-01",
                    "cost": 100,
                    "note": "Historical cost from month 1"
                },
                {
                    "date": "2025-01-01", 
                    "cost": 200,
                    "note": "Historical cost from month 6"
                }
            ]
        },
        {
            "title": "Cleaning Service",
            "description": "Monthly cleaning",
            "estimatedCost": 150,
            "quantity": 1,
            "category": "maintenance",
            "isRecurring": true,
            "priority": "medium",
            "notes": "Recurring item (appeared 4 times in last 6 months)"
        },
        {
            "title": "Emergency Repair",
            "description": "One-time emergency repair",
            "estimatedCost": 300,
            "quantity": 1,
            "category": "maintenance",
            "isRecurring": false,
            "priority": "low",
            "notes": "One-time item (last seen: 12/2024)"
        }
    ],
    "analysis": {
        "totalRequests": 6,
        "totalItems": 3,
        "recurringItems": 2,
        "oneTimeItems": 1,
        "dateRange": {
            "from": "8/2024",
            "to": "1/2025"
        }
    }
}
```

### **Step 2: Create Template from Historical Data**

**API Endpoint:** `POST /api/monthly-requests/residence/:residenceId/create-template-from-historical`

This creates a template based on the analysis:

```javascript
// Example request
POST /api/monthly-requests/residence/67d723cf20f89c4ae69804f3/create-template-from-historical

{
    "title": "Monthly Services Template",
    "description": "Template based on historical data analysis",
    "templateName": "St Kilda Monthly Services",
    "templateDescription": "Recurring monthly services for St Kilda residence",
    "items": [
        // You can add/modify items here
        {
            "title": "WiFi Service",
            "estimatedCost": 200,
            "quantity": 1,
            "category": "utilities"
        }
    ]
}

// Response
{
    "success": true,
    "template": {
        "_id": "template_id_here",
        "title": "Monthly Services Template",
        "isTemplate": true,
        "status": "draft",
        "items": [
            // All suggested items + your custom items
        ],
        "templateMetadata": {
            "createdFromHistoricalAnalysis": true,
            "analysisDate": "2025-01-31T...",
            "historicalRequestsAnalyzed": 6,
            "dateRange": {
                "from": "8/2024",
                "to": "1/2025"
            }
        }
    },
    "analysis": {
        // Same as analysis response above
    },
    "message": "Template created with 3 items based on historical analysis"
}
```

## 📊 What Happens After Template Creation

### **1. Historical Data (Past Months)**
- **Remains unchanged** with original items/costs
- **Status**: Auto-approved (since they're historical)
- **Items**: Keep their original costs and details

```javascript
// January 2025 - Original data preserved
{
    "title": "January 2025 Services",
    "month": 1,
    "year": 2025,
    "status": "approved", // Auto-approved for historical
    "items": [
        {
            "title": "WiFi Service",
            "estimatedCost": 100, // Original cost
            "quantity": 1
        }
    ]
}
```

### **2. Current/Future Months**
- **Use template** for consistent items
- **Status**: Pending (requires finance approval)
- **Items**: Use template costs and structure

```javascript
// March 2025 - Uses template
{
    "title": "March 2025 Services",
    "month": 3,
    "year": 2025,
    "status": "pending", // Requires finance approval
    "items": [
        {
            "title": "WiFi Service",
            "estimatedCost": 200, // Template cost
            "quantity": 1,
            "isFromTemplate": true,
            "templateId": "template_id_here"
        }
    ]
}
```

### **3. Template Management**
- **Template status**: Draft (for management)
- **Cost history**: Tracks all cost changes
- **Item tracking**: Monitors recurring vs one-time items

## 🎯 Smart Features

### **1. Recurring Item Detection**
- **Analyzes frequency** of items across months
- **Identifies patterns** in recurring services
- **Suggests priority** based on frequency

### **2. Cost Trend Analysis**
- **Tracks cost changes** over time
- **Uses most recent cost** for template
- **Maintains cost history** for reporting

### **3. Item Categorization**
- **Recurring items**: High priority, included in template
- **One-time items**: Lower priority, optional inclusion
- **Cost variations**: Tracked and documented

### **4. Historical Preservation**
- **Original data untouched**
- **Audit trail maintained**
- **Cost history preserved**

## 📋 Step-by-Step Workflow

### **For You (Admin/Finance):**

1. **Analyze Historical Data**
   ```bash
   GET /api/monthly-requests/residence/67d723cf20f89c4ae69804f3/analyze-historical
   ```

2. **Review Suggested Items**
   - Check recurring vs one-time items
   - Verify costs and quantities
   - Review item descriptions

3. **Create Template**
   ```bash
   POST /api/monthly-requests/residence/67d723cf20f89c4ae69804f3/create-template-from-historical
   ```

4. **Customize Template** (if needed)
   - Add/modify items
   - Adjust costs
   - Update descriptions

### **For the System:**

1. **Historical Analysis**
   - Scans past 6 months (configurable)
   - Identifies item patterns
   - Analyzes cost trends

2. **Template Creation**
   - Merges suggested items
   - Uses most recent costs
   - Maintains cost history

3. **Future Processing**
   - New months use template
   - Historical months preserved
   - Seamless transition

## 🔄 What Happens Next

### **Immediate:**
- Template created with suggested items
- Historical data remains unchanged
- System ready for future months

### **Future Months:**
- Automatically use template items
- Require finance approval
- Maintain consistency

### **Ongoing:**
- Template can be updated
- Cost changes tracked
- Historical data preserved

## 📈 Benefits

✅ **Data-Driven**: Template based on actual usage  
✅ **Historical Preservation**: Original data untouched  
✅ **Smart Analysis**: Identifies patterns automatically  
✅ **Cost Tracking**: Maintains cost change history  
✅ **Future Planning**: Consistent recurring items  
✅ **Audit Trail**: Complete record of changes  

## 🚀 Getting Started

1. **Run the analysis** to see what items are suggested
2. **Review the suggestions** and customize if needed
3. **Create the template** from historical data
4. **Start using templates** for current/future months
5. **Monitor and update** as needed

This approach ensures you create a template that reflects your actual usage patterns while preserving all historical data for audit and reporting purposes. 