# Template Functionality Guide - Monthly Requests

## Overview

The monthly request system now includes comprehensive template functionality that allows users to:
1. **Create templates** for recurring monthly requests
2. **Fetch available templates** for a specific residence
3. **Create monthly requests from templates** with automatic item population
4. **Get template suggestions** when creating requests without items

## API Endpoints

### 1. Get Available Templates for a Residence
**Endpoint:** `GET /api/monthly-requests/available-templates/:residenceId`

**Purpose:** Get all available templates for a specific residence with enhanced information.

**Response:**
```json
{
    "residence": {
        "id": "67d723cf20f89c4ae69804f3",
        "name": "St Kilda"
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
            "itemsCount": 2,
            "totalEstimatedCost": 350,
            "priority": "medium",
            "tags": ["utilities", "monthly"],
            "createdAt": "2024-12-31T13:25:25.433Z",
            "updatedAt": "2024-12-31T13:25:25.433Z",
            "sampleItems": [
                {
                    "title": "WiFi Service",
                    "description": "Monthly WiFi service",
                    "estimatedCost": 150,
                    "category": "utilities"
                },
                {
                    "title": "Electricity",
                    "description": "Monthly electricity service",
                    "estimatedCost": 200,
                    "category": "utilities"
                }
            ],
            "usageInstructions": {
                "endpoint": "POST /api/monthly-requests/templates/688b6ec53f6f1bd1301fc958",
                "requiredFields": ["month", "year"],
                "example": {
                    "month": 12,
                    "year": 2024
                }
            }
        }
    ],
    "totalTemplates": 1,
    "message": "Found 1 template(s) for St Kilda"
}
```

### 2. Create Monthly Request from Template
**Endpoint:** `POST /api/monthly-requests/templates/:templateId`

**Purpose:** Create a new monthly request using an existing template.

**Request Body:**
```json
{
    "month": 12,
    "year": 2024
}
```

**Response:**
```json
{
    "_id": "688b6ec53f6f1bd1301fc959",
    "title": "Monthly Services Template",
    "description": "Monthly Services Template for December 2024",
    "residence": {
        "id": "67d723cf20f89c4ae69804f3",
        "name": "St Kilda"
    },
    "month": 12,
    "year": 2024,
    "items": [
        {
            "title": "WiFi Service",
            "description": "Monthly WiFi service",
            "quantity": 1,
            "estimatedCost": 150,
            "category": "utilities",
            "isRecurring": true
        },
        {
            "title": "Electricity",
            "description": "Monthly electricity service",
            "quantity": 1,
            "estimatedCost": 200,
            "category": "utilities",
            "isRecurring": true
        }
    ],
    "status": "draft",
    "submittedBy": {
        "id": "67c023adae5e27657502e887",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@example.com"
    }
}
```

### 3. Create Template
**Endpoint:** `POST /api/monthly-requests`

**Purpose:** Create a new template for future use.

**Request Body:**
```json
{
    "title": "Monthly Services Template",
    "description": "Template for monthly services",
    "residence": "67d723cf20f89c4ae69804f3",
    "isTemplate": true,
    "items": [
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
        }
    ]
}
```

## Template Suggestions

When creating a monthly request without items, the system automatically checks for available templates and suggests them:

**Request (without items):**
```json
{
    "title": "Test Request",
    "description": "Test description",
    "residence": "67d723cf20f89c4ae69804f3",
    "month": 12,
    "year": 2024,
    "isTemplate": false,
    "items": []
}
```

**Response (suggesting templates):**
```json
{
    "message": "No items provided for monthly request. Please provide items or use an existing template.",
    "availableTemplates": [
        {
            "id": "688b6ec53f6f1bd1301fc958",
            "title": "Monthly Services Template",
            "description": "Template for monthly services",
            "itemsCount": 2,
            "totalEstimatedCost": 350
        }
    ],
    "suggestion": "Use POST /api/monthly-requests/templates/:templateId with month and year to create from template"
}
```

## Frontend Integration

### 1. Template Selection Flow
```javascript
// 1. Get available templates when user selects a residence
const getTemplates = async (residenceId) => {
    const response = await axios.get(`/api/monthly-requests/available-templates/${residenceId}`);
    return response.data.templates;
};

// 2. Show template options to user
const showTemplateOptions = (templates) => {
    if (templates.length > 0) {
        // Display template selection UI
        templates.forEach(template => {
            console.log(`Template: ${template.title}`);
            console.log(`Items: ${template.itemsCount}`);
            console.log(`Total Cost: $${template.totalEstimatedCost}`);
        });
    }
};

// 3. Create monthly request from selected template
const createFromTemplate = async (templateId, month, year) => {
    const response = await axios.post(`/api/monthly-requests/templates/${templateId}`, {
        month,
        year
    });
    return response.data;
};
```

### 2. Template Creation Flow
```javascript
// Create a new template
const createTemplate = async (templateData) => {
    const response = await axios.post('/api/monthly-requests', {
        ...templateData,
        isTemplate: true
    });
    return response.data;
};

// Example template data
const templateData = {
    title: 'Monthly Services Template',
    description: 'Template for monthly services',
    residence: '67d723cf20f89c4ae69804f3',
    items: [
        {
            title: 'WiFi Service',
            description: 'Monthly WiFi service',
            estimatedCost: 150,
            category: 'utilities'
        }
    ]
};
```

## Benefits

### 1. **Time Savings**
- Create templates once, use them multiple times
- Automatic item population from templates
- No need to recreate common monthly requests

### 2. **Consistency**
- Standardized monthly requests across residences
- Consistent item structure and pricing
- Reduced errors in request creation

### 3. **Flexibility**
- Templates can be customized per residence
- Easy to update templates for future requests
- Support for both template and manual creation

### 4. **User Experience**
- Smart suggestions when no items are provided
- Clear usage instructions for each template
- Preview of template contents before use

## Best Practices

### 1. **Template Naming**
- Use descriptive names: "Monthly Utilities Template"
- Include residence name if specific: "St Kilda Monthly Services"
- Add version numbers for updates: "Template v2.0"

### 2. **Template Organization**
- Create templates for common service categories
- Use tags for easy filtering and organization
- Keep templates focused on specific use cases

### 3. **Template Maintenance**
- Regularly review and update templates
- Remove outdated templates
- Validate template items and costs

## Error Handling

### Common Error Scenarios

1. **No Templates Available**
```json
{
    "message": "No templates found for St Kilda. Create a template first.",
    "templates": [],
    "totalTemplates": 0
}
```

2. **Invalid Template ID**
```json
{
    "message": "Template not found"
}
```

3. **Missing Required Fields**
```json
{
    "message": "Month and year are required"
}
```

4. **Permission Denied**
```json
{
    "message": "Students do not have access to monthly requests"
}
```

## Testing

Use the provided test script `test-template-functionality.js` to verify:
- Template creation
- Template fetching
- Monthly request creation from templates
- Template suggestions
- Error handling

## Next Steps

1. **Deploy the updated controller** with template functionality
2. **Test template creation and usage** from the frontend
3. **Implement template selection UI** in the frontend
4. **Add template management features** (edit, delete, duplicate)
5. **Consider template versioning** for future updates 