// MongoDB Shell Insert Statement for Template with Historical Data
// Run this in MongoDB shell or MongoDB Compass

db.monthlyrequests.insertOne({
  "_id": ObjectId("688b79ce2af26ca41a8574ad"),
  "title": "Monthly Requests",
  "description": "Monthly Requests for St Kilda",
  "residence": ObjectId("67d723cf20f89c4ae69804f3"),
  "isTemplate": true,
  "status": "draft",
  "priority": "medium",
  "items": [
    {
      "title": "wifi",
      "description": "wifi kilda",
      "quantity": 1,
      "estimatedCost": 100,
      "category": "maintenance",
      "priority": "medium",
      "isRecurring": true,
      "notes": "High-speed internet for residents",
      "tags": ["internet", "utilities"],
      "costHistory": [
        {
          "month": 4,
          "year": 2025,
          "cost": 100,
          "date": new Date("2025-04-01T00:00:00.000Z"),
          "note": "Started in April",
          "title": "wifi",
          "description": "wifi kilda",
          "quantity": 1,
          "category": "maintenance",
          "priority": "medium",
          "isRecurring": true,
          "notes": "High-speed internet for residents"
        },
        {
          "month": 7,
          "year": 2025,
          "cost": 0,
          "date": new Date("2025-07-01T00:00:00.000Z"),
          "note": "Removed in July",
          "title": "wifi",
          "description": "wifi kilda",
          "quantity": 1,
          "category": "maintenance",
          "priority": "medium",
          "isRecurring": true,
          "notes": "High-speed internet for residents"
        },
        {
          "month": 8,
          "year": 2025,
          "cost": 100,
          "date": new Date("2025-08-01T00:00:00.000Z"),
          "note": "Added back in August",
          "title": "wifi",
          "description": "wifi kilda",
          "quantity": 1,
          "category": "maintenance",
          "priority": "medium",
          "isRecurring": true,
          "notes": "High-speed internet for residents"
        }
      ],
             "itemHistory": [
         {
           "month": 7,
           "year": 2025,
           "date": new Date("2025-07-01T00:00:00.000Z"),
           "action": "removed",
           "status": "inactive",
           "note": "Removed in July due to service issues",
           "cost": 100,
           "quantity": 1,
           "title": "wifi",
           "description": "wifi kilda",
           "category": "maintenance",
           "priority": "medium",
           "isRecurring": true,
           "notes": "High-speed internet for residents"
         },
         {
           "month": 8,
           "year": 2025,
           "date": new Date("2025-08-01T00:00:00.000Z"),
           "action": "added",
           "status": "active",
           "note": "Added back in August with new provider",
           "cost": 100,
           "quantity": 1,
           "title": "wifi",
           "description": "wifi kilda",
           "category": "maintenance",
           "priority": "medium",
           "isRecurring": true,
           "notes": "High-speed internet for residents"
         }
       ],
      "costVariations": [
        {
          "from": "4/2025",
          "to": "7/2025",
          "oldCost": 100,
          "newCost": 0,
          "change": -100,
          "changePercent": "-100.0"
        },
        {
          "from": "7/2025",
          "to": "8/2025",
          "oldCost": 0,
          "newCost": 100,
          "change": 100,
          "changePercent": "100.0"
        }
      ],
      "costSummary": {
        "mostRecentCost": 100,
        "mostRecentMonth": "8/2025",
        "uniqueCosts": [0, 100],
        "totalVariations": 2,
        "averageCost": "66.67"
      }
    },
    {
      "title": "Gas",
      "description": "Gas for St Kilda",
      "quantity": 1,
      "estimatedCost": 192,
      "category": "maintenance",
      "priority": "high",
      "isRecurring": true,
      "notes": "Heating and cooking gas supply",
      "tags": ["heating", "utilities"],
      "costHistory": [
        {
          "month": 3,
          "year": 2025,
          "cost": 180,
          "date": new Date("2025-03-01T00:00:00.000Z"),
          "note": "Started in March",
          "title": "Gas",
          "description": "Gas for St Kilda",
          "quantity": 1,
          "category": "maintenance",
          "priority": "high",
          "isRecurring": true,
          "notes": "Heating and cooking gas supply"
        },
        {
          "month": 6,
          "year": 2025,
          "cost": 192,
          "date": new Date("2025-06-01T00:00:00.000Z"),
          "note": "Price increase in June",
          "title": "Gas",
          "description": "Gas for St Kilda",
          "quantity": 1,
          "category": "maintenance",
          "priority": "high",
          "isRecurring": true,
          "notes": "Heating and cooking gas supply"
        }
      ],
             "itemHistory": [
         {
           "month": 6,
           "year": 2025,
           "date": new Date("2025-06-01T00:00:00.000Z"),
           "action": "modified",
           "status": "active",
           "note": "Price increased from $180 to $192",
           "cost": 192,
           "quantity": 1,
           "title": "Gas",
           "description": "Gas for St Kilda",
           "category": "maintenance",
           "priority": "high",
           "isRecurring": true,
           "notes": "Heating and cooking gas supply"
         }
       ],
      "costVariations": [
        {
          "from": "3/2025",
          "to": "6/2025",
          "oldCost": 180,
          "newCost": 192,
          "change": 12,
          "changePercent": "6.7"
        }
      ],
      "costSummary": {
        "mostRecentCost": 192,
        "mostRecentMonth": "6/2025",
        "uniqueCosts": [180, 192],
        "totalVariations": 1,
        "averageCost": "186.00"
      }
    },
    {
      "title": "security",
      "description": "Security services for St Kilda",
      "quantity": 1,
      "estimatedCost": 450,
      "category": "services",
      "priority": "high",
      "isRecurring": true,
      "notes": "24/7 security monitoring and patrol",
      "tags": ["security", "safety"],
      "costHistory": [
        {
          "month": 2,
          "year": 2025,
          "cost": 400,
          "date": new Date("2025-02-01T00:00:00.000Z"),
          "note": "Started in February",
          "title": "security",
          "description": "Security services for St Kilda",
          "quantity": 1,
          "category": "services",
          "priority": "high",
          "isRecurring": true,
          "notes": "24/7 security monitoring and patrol"
        },
        {
          "month": 5,
          "year": 2025,
          "cost": 450,
          "date": new Date("2025-05-01T00:00:00.000Z"),
          "note": "Enhanced security package",
          "title": "security",
          "description": "Security services for St Kilda",
          "quantity": 1,
          "category": "services",
          "priority": "high",
          "isRecurring": true,
          "notes": "24/7 security monitoring and patrol"
        }
      ],
             "itemHistory": [
         {
           "month": 5,
           "year": 2025,
           "date": new Date("2025-05-01T00:00:00.000Z"),
           "action": "modified",
           "status": "active",
           "note": "Upgraded to enhanced security package",
           "cost": 450,
           "quantity": 1,
           "title": "security",
           "description": "Security services for St Kilda",
           "category": "services",
           "priority": "high",
           "isRecurring": true,
           "notes": "24/7 security monitoring and patrol"
         }
       ],
      "costVariations": [
        {
          "from": "2/2025",
          "to": "5/2025",
          "oldCost": 400,
          "newCost": 450,
          "change": 50,
          "changePercent": "12.5"
        }
      ],
      "costSummary": {
        "mostRecentCost": 450,
        "mostRecentMonth": "5/2025",
        "uniqueCosts": [400, 450],
        "totalVariations": 1,
        "averageCost": "425.00"
      }
    },
    {
      "title": "cleaning",
      "description": "Professional cleaning services",
      "quantity": 1,
      "estimatedCost": 300,
      "category": "services",
      "priority": "medium",
      "isRecurring": true,
      "notes": "Weekly cleaning and maintenance",
      "tags": ["cleaning", "maintenance"],
      "costHistory": [
        {
          "month": 1,
          "year": 2025,
          "cost": 280,
          "date": new Date("2025-01-01T00:00:00.000Z"),
          "note": "Started in January",
          "title": "cleaning",
          "description": "Professional cleaning services",
          "quantity": 1,
          "category": "services",
          "priority": "medium",
          "isRecurring": true,
          "notes": "Weekly cleaning and maintenance"
        },
        {
          "month": 4,
          "year": 2025,
          "cost": 300,
          "date": new Date("2025-04-01T00:00:00.000Z"),
          "note": "Price adjustment in April",
          "title": "cleaning",
          "description": "Professional cleaning services",
          "quantity": 1,
          "category": "services",
          "priority": "medium",
          "isRecurring": true,
          "notes": "Weekly cleaning and maintenance"
        }
      ],
             "itemHistory": [
         {
           "month": 4,
           "year": 2025,
           "date": new Date("2025-04-01T00:00:00.000Z"),
           "action": "modified",
           "status": "active",
           "note": "Price increased from $280 to $300",
           "cost": 300,
           "quantity": 1,
           "title": "cleaning",
           "description": "Professional cleaning services",
           "category": "services",
           "priority": "medium",
           "isRecurring": true,
           "notes": "Weekly cleaning and maintenance"
         }
       ],
      "costVariations": [
        {
          "from": "1/2025",
          "to": "4/2025",
          "oldCost": 280,
          "newCost": 300,
          "change": 20,
          "changePercent": "7.1"
        }
      ],
      "costSummary": {
        "mostRecentCost": 300,
        "mostRecentMonth": "4/2025",
        "uniqueCosts": [280, 300],
        "totalVariations": 1,
        "averageCost": "290.00"
      }
    }
  ],
  "totalEstimatedCost": 1042,
  "submittedBy": ObjectId("67c023adae5e27657502e887"),
  "templateVersion": 1,
  "lastUpdated": new Date("2025-01-15T10:30:00.000Z"),
  "effectiveFrom": new Date("2025-01-15T10:30:00.000Z"),
  "templateChanges": [],
  "templateMetadata": {
    "createdWithHistoricalData": true,
    "creationDate": new Date("2025-01-15T10:30:00.000Z"),
    "historicalDataProvided": 4,
    "itemHistoryProvided": 4,
    "templateName": "St Kilda Monthly Services",
    "templateDescription": "Recurring monthly requests with historical data",
    "totalHistoricalEntries": 8,
    "totalItemHistoryEntries": 4
  },
  "requestHistory": [
    {
      "date": new Date("2025-01-15T10:30:00.000Z"),
      "action": "Template created with historical data",
      "user": ObjectId("67c023adae5e27657502e887"),
      "changes": [
        {
          "field": "template_creation",
          "oldValue": null,
          "newValue": "Template created with historical data"
        }
      ]
    }
  ],
  "tags": ["monthly", "recurring", "st-kilda"],
  "createdAt": new Date("2025-01-15T10:30:00.000Z"),
  "updatedAt": new Date("2025-01-15T10:30:00.000Z"),
  "__v": 0
});

// Alternative: If you want to use a new ObjectId instead of the specific one above
// Replace the first line with:
// db.monthlyrequests.insertOne({
//   "_id": new ObjectId(), // This will generate a new ID automatically
//   ... rest of the document
// });

print("Template inserted successfully with 4 items and historical data!");
print("Items: wifi, gas, security, cleaning");
print("Total cost: $1042");
print("Historical data: 8 entries");
print("Item history: 4 entries"); 