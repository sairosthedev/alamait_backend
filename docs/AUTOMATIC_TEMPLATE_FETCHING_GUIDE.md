# Automatic Template Fetching Guide - Monthly Requests

## Overview

The system now automatically fetches and displays templates when a residence is selected for monthly request creation. This provides a seamless experience where templates are automatically used for recurring monthly requests across all months.

## Key Features

### 1. **Automatic Template Discovery**
- When selecting a residence, the system automatically fetches all available templates
- Templates are displayed with detailed information and quick actions
- Shows upcoming months for easy template application

### 2. **Automatic Template Usage**
- When creating monthly requests without items, the system automatically uses the first available template
- Templates are applied to all months (current and future)
- Manual items can still be provided to override template usage

### 3. **Residence-Specific Templates**
- Each residence can have its own templates
- Templates are automatically filtered by residence
- Clear indication of which templates belong to which residence

## API Endpoints

### Get Templates for Residence Selection
**Endpoint:** `GET /api/monthly-requests/residence/:residenceId/templates`

**Purpose:** Get all templates for a specific residence when creating monthly requests.

**Response:**
```json
{
    "residence": {
        "id": "67d723cf20f89c4ae69804f3",
        "name": "St Kilda",
        "address": "123 St Kilda Road"
    },
    "templates": [
        {
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
            "itemsCount": 3,
            "totalEstimatedCost": 650,
            "priority": "medium",
            "tags": ["utilities", "services"],
            "createdAt": "2024-12-31T13:25:25.433Z",
            "lastUpdated": "2024-12-31T13:25:25.433Z",
            "templateVersion": 1,
            "pendingChangesCount": 0,
            "sampleItems": [
                {
                    "title": "WiFi Service",
                    "description": "Monthly WiFi service",
                    "estimatedCost": 150,
                    "category": "utilities",
                    "priority": "medium"
                },
                {
                    "title": "Electricity",
                    "description": "Monthly electricity service",
                    "estimatedCost": 200,
                    "category": "utilities",
                    "priority": "medium"
                },
                {
                    "title": "Cleaning Service",
                    "description": "Monthly cleaning service",
                    "estimatedCost": 300,
                    "category": "services",
                    "priority": "high"
                }
            ],
            "usageInstructions": {
                "endpoint": "POST /api/monthly-requests/templates/688b6ec53f6f1bd1301fc958",
                "requiredFields": ["month", "year"],
                "example": {
                    "month": 12,
                    "year": 2024
                }
            },
            "quickCreateOptions": [
                {
                    "month": 12,
                    "year": 2024,
                    "monthName": "December",
                    "isCurrentMonth": true,
                    "endpoint": "POST /api/monthly-requests/templates/688b6ec53f6f1bd1301fc958",
                    "requestBody": {
                        "month": 12,
                        "year": 2024
                    }
                },
                {
                    "month": 1,
                    "year": 2025,
                    "monthName": "January",
                    "isCurrentMonth": false,
                    "endpoint": "POST /api/monthly-requests/templates/688b6ec53f6f1bd1301fc958",
                    "requestBody": {
                        "month": 1,
                        "year": 2025
                    }
                }
            ]
        }
    ],
    "totalTemplates": 1,
    "currentMonth": 12,
    "currentYear": 2024,
    "upcomingMonths": [
        {
            "month": 12,
            "year": 2024,
            "monthName": "December",
            "isCurrentMonth": true
        },
        {
            "month": 1,
            "year": 2025,
            "monthName": "January",
            "isCurrentMonth": false
        }
    ],
    "message": "Found 1 template(s) for St Kilda. Select a template to create monthly requests.",
    "quickActions": {
        "createTemplate": {
            "endpoint": "POST /api/monthly-requests",
            "description": "Create a new template for this residence",
            "example": {
                "title": "Monthly Services Template",
                "description": "Template for monthly services",
                "residence": "67d723cf20f89c4ae69804f3",
                "isTemplate": true,
                "items": [
                    {
                        "title": "WiFi Service",
                        "description": "Monthly WiFi service",
                        "estimatedCost": 150,
                        "category": "utilities"
                    }
                ]
            }
        },
        "createManualRequest": {
            "endpoint": "POST /api/monthly-requests",
            "description": "Create a manual monthly request without template",
            "example": {
                "title": "Custom Monthly Request",
                "description": "Custom monthly request",
                "residence": "67d723cf20f89c4ae69804f3",
                "month": 12,
                "year": 2024,
                "isTemplate": false,
                "items": []
            }
        }
    }
}
```

## Automatic Template Usage

### When Creating Monthly Requests

When creating a monthly request, the system automatically checks for templates:

1. **If templates exist and no items provided:**
   - Automatically uses the first available template
   - Applies all template items to the monthly request
   - Creates the request with template items

2. **If templates exist and items provided:**
   - Uses the provided items (manual override)
   - Templates are available but not used

3. **If no templates exist:**
   - Requires manual item creation
   - Suggests creating a template for future use

### Example: Automatic Template Usage

```javascript
// Create monthly request without items (auto-uses template)
const monthlyRequestData = {
    title: 'Monthly Request',
    description: 'Monthly request',
    residence: '67d723cf20f89c4ae69804f3',
    month: 12,
    year: 2024,
    isTemplate: false,
    items: [] // Empty items array - will auto-use template
};

const response = await axios.post('/api/monthly-requests', monthlyRequestData);
// Result: Monthly request created with all template items automatically included
```

## Frontend Integration

### 1. Residence Selection Flow
```javascript
// When user selects a residence
const onResidenceSelect = async (residenceId) => {
    try {
        // Get templates for the selected residence
        const response = await axios.get(`/api/monthly-requests/residence/${residenceId}/templates`);
        const { templates, residence, upcomingMonths } = response.data;
        
        // Display templates
        if (templates.length > 0) {
            displayTemplates(templates, residence, upcomingMonths);
        } else {
            showCreateTemplatePrompt(residence);
        }
    } catch (error) {
        console.error('Error fetching templates:', error);
    }
};
```

### 2. Template Display
```javascript
const displayTemplates = (templates, residence, upcomingMonths) => {
    console.log(`Templates for ${residence.name}:`);
    
    templates.forEach(template => {
        console.log(`📋 ${template.title}`);
        console.log(`   Items: ${template.itemsCount}`);
        console.log(`   Total Cost: $${template.totalEstimatedCost}`);
        console.log(`   Version: ${template.templateVersion}`);
        
        if (template.pendingChangesCount > 0) {
            console.log(`   ⚠️  ${template.pendingChangesCount} pending changes`);
        }
        
        // Show sample items
        template.sampleItems.forEach(item => {
            console.log(`     • ${item.title} - $${item.estimatedCost}`);
        });
        
        // Show quick create options
        upcomingMonths.forEach(month => {
            console.log(`   📅 ${month.monthName} ${month.year}${month.isCurrentMonth ? ' (Current)' : ''}`);
        });
    });
};
```

### 3. Automatic Template Usage
```javascript
const createMonthlyRequest = async (residenceId, month, year, items = []) => {
    try {
        const requestData = {
            title: 'Monthly Request',
            description: 'Monthly request',
            residence: residenceId,
            month: month,
            year: year,
            isTemplate: false,
            items: items // If empty, will auto-use template
        };
        
        const response = await axios.post('/api/monthly-requests', requestData);
        
        if (items.length === 0) {
            console.log('✅ Monthly request created automatically from template');
        } else {
            console.log('✅ Monthly request created with manual items');
        }
        
        return response.data;
    } catch (error) {
        console.error('Error creating monthly request:', error);
    }
};
```

### 4. Quick Template Actions
```javascript
const quickCreateFromTemplate = async (templateId, month, year) => {
    try {
        const response = await axios.post(`/api/monthly-requests/templates/${templateId}`, {
            month: month,
            year: year
        });
        
        console.log('✅ Quick monthly request created from template');
        return response.data;
    } catch (error) {
        console.error('Error creating quick request:', error);
    }
};
```

## Workflow Examples

### Scenario 1: Residence with Templates

1. **User selects residence:**
   ```javascript
   // Frontend calls
   GET /api/monthly-requests/residence/67d723cf20f89c4ae69804f3/templates
   ```

2. **System returns templates:**
   - Shows all available templates for the residence
   - Displays upcoming months for quick creation
   - Provides quick actions for template management

3. **User creates monthly request:**
   ```javascript
   // Frontend calls (no items provided)
   POST /api/monthly-requests
   {
     "residence": "67d723cf20f89c4ae69804f3",
     "month": 12,
     "year": 2024,
     "items": [] // Empty - auto-uses template
   }
   ```

4. **System automatically uses template:**
   - Fetches the first available template
   - Applies all template items to the monthly request
   - Creates the request with template items

### Scenario 2: Residence without Templates

1. **User selects residence:**
   ```javascript
   GET /api/monthly-requests/residence/67d723cf20f89c4ae69804f3/templates
   ```

2. **System returns no templates:**
   ```json
   {
     "templates": [],
     "message": "No templates found for St Kilda. Create a template first to enable recurring monthly requests.",
     "quickActions": {
       "createTemplate": { ... }
     }
   }
   ```

3. **User creates template first:**
   ```javascript
   POST /api/monthly-requests
   {
     "title": "Monthly Services Template",
     "residence": "67d723cf20f89c4ae69804f3",
     "isTemplate": true,
     "items": [ ... ]
   }
   ```

4. **Future monthly requests auto-use the template**

## Benefits

### 1. **Seamless User Experience**
- Templates are automatically discovered when selecting residences
- No need to manually search for templates
- Clear indication of available templates and their contents

### 2. **Automatic Recurring Requests**
- Templates are automatically used for all months
- Consistent monthly requests across residences
- Reduces manual work for recurring items

### 3. **Flexible Usage**
- Can still create manual requests with custom items
- Templates are suggestions, not forced usage
- Easy to override template items when needed

### 4. **Residence-Specific Management**
- Each residence has its own templates
- Clear separation of templates by residence
- Easy to manage different service requirements per residence

## Testing

Use the provided test script `test-template-fetching.js` to verify:
- Template fetching when selecting residences
- Automatic template usage for monthly requests
- Template display and quick actions
- Manual override functionality

## Next Steps

1. **Deploy the automatic template fetching functionality**
2. **Update frontend to use the new residence selection endpoint**
3. **Implement template display UI in the frontend**
4. **Add quick create buttons for upcoming months**
5. **Consider adding template preview functionality** 