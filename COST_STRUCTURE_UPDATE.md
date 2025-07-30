# Cost Structure Update for Requests

## Overview

The cost structure for requests has been updated to provide clearer and more intuitive cost management. This update eliminates confusion about what "estimated cost" means and makes the cost calculation transparent.

## New Cost Structure

### Item Level Cost Fields

Each item in a request now has the following cost fields:

1. **`unitCost`** (Number, required)
   - The cost per unit/item
   - Example: $20 per broom

2. **`quantity`** (Number, required)
   - How many units are needed
   - Example: 5 brooms

3. **`totalCost`** (Number, calculated automatically)
   - Total cost for this item (unitCost × quantity)
   - Example: $20 × 5 = $100

### Request Level Cost Fields

1. **`totalEstimatedCost`** (Number, calculated automatically)
   - Sum of all item totalCosts
   - Example: $100 (brooms) + $50 (buckets) = $150

2. **`amount`** (Number, optional)
   - Final approved amount (may differ from totalEstimatedCost after quotations)

## Example Request Structure

```json
{
  "title": "Cleaning Supplies Request",
  "description": "Purchase cleaning supplies for St Kilda",
  "type": "operational",
  "items": [
    {
      "description": "brooms",
      "quantity": 5,
      "unitCost": 20,
      "totalCost": 100,
      "purpose": "cleaning"
    },
    {
      "description": "buckets",
      "quantity": 10,
      "unitCost": 5,
      "totalCost": 50,
      "purpose": "cleaning"
    }
  ],
  "totalEstimatedCost": 150,
  "amount": 150
}
```

## Migration from Old Structure

### Before (Old Structure)
```json
{
  "items": [
    {
      "description": "brooms",
      "quantity": 5,
      "estimatedCost": 20  // This was confusing - was it per unit or total?
    }
  ]
}
```

### After (New Structure)
```json
{
  "items": [
    {
      "description": "brooms",
      "quantity": 5,
      "unitCost": 20,      // Clear: $20 per broom
      "totalCost": 100     // Clear: $100 total for brooms
    }
  ],
  "totalEstimatedCost": 100
}
```

## Benefits of New Structure

1. **Clarity**: No confusion about whether cost is per unit or total
2. **Transparency**: Automatic calculation of totals
3. **Consistency**: Standardized cost structure across all requests
4. **Audit Trail**: Clear breakdown of costs for approval processes
5. **Flexibility**: Easy to modify quantities and see cost impact

## API Changes

### Creating Requests

When creating a request, use the new structure:

```javascript
// Frontend request body
{
  "title": "Supply Request",
  "description": "Office supplies needed",
  "type": "operational",
  "items": [
    {
      "description": "pens",
      "quantity": 50,
      "unitCost": 2.50,  // $2.50 per pen
      "purpose": "office supplies"
    }
  ]
}
```

### Response Structure

The API now returns the calculated totals:

```json
{
  "items": [
    {
      "description": "pens",
      "quantity": 50,
      "unitCost": 2.50,
      "totalCost": 125,  // Automatically calculated
      "purpose": "office supplies"
    }
  ],
  "totalEstimatedCost": 125,  // Automatically calculated
  "costBreakdown": {          // New virtual property
    "totalItems": 1,
    "totalCost": 125,
    "items": [...]
  }
}
```

## Migration Script

A migration script has been provided to update existing requests:

```bash
node migrate-cost-structure.js
```

This script will:
1. Find all requests with the old `estimatedCost` field
2. Convert `estimatedCost` to `unitCost`
3. Calculate `totalCost` for each item
4. Update `totalEstimatedCost` for the request
5. Remove the old `estimatedCost` field

## Validation Rules

- `unitCost` must be 0 or greater
- `quantity` must be at least 1
- `totalCost` is automatically calculated and cannot be manually set
- `totalEstimatedCost` is automatically calculated from all items

## Frontend Implementation

Update your frontend forms to use the new structure:

```javascript
// Old form structure
const item = {
  description: "pens",
  quantity: 50,
  estimatedCost: 2.50  // Remove this
};

// New form structure
const item = {
  description: "pens",
  quantity: 50,
  unitCost: 2.50,      // Use this instead
  purpose: "office supplies"
};
```

## Cost Breakdown Virtual Property

The API now includes a `costBreakdown` virtual property that provides a clean summary:

```json
{
  "costBreakdown": {
    "totalItems": 2,
    "totalCost": 150,
    "items": [
      {
        "description": "brooms",
        "quantity": 5,
        "unitCost": 20,
        "totalCost": 100,
        "purpose": "cleaning"
      },
      {
        "description": "buckets",
        "quantity": 10,
        "unitCost": 5,
        "totalCost": 50,
        "purpose": "cleaning"
      }
    ]
  }
}
```

This makes it easy to display cost summaries in the frontend without additional calculations. 