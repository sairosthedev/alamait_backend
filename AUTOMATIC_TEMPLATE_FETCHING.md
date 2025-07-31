# Automatic Template Fetching - Monthly Requests

## Overview

The system now automatically fetches and displays templates when a residence is selected for monthly request creation.

## New Endpoint

**GET** `/api/monthly-requests/residence/:residenceId/templates`

Returns all templates for a residence with:
- Template details and items
- Upcoming months for quick creation
- Quick actions for template management

## Automatic Template Usage

When creating monthly requests:

1. **If templates exist and no items provided:** Automatically uses first template
2. **If templates exist and items provided:** Uses provided items (manual override)
3. **If no templates exist:** Requires manual item creation

## Frontend Integration

```javascript
// When user selects a residence
const getTemplatesForResidence = async (residenceId) => {
    const response = await axios.get(`/api/monthly-requests/residence/${residenceId}/templates`);
    return response.data;
};

// Create monthly request (auto-uses template if no items)
const createMonthlyRequest = async (residenceId, month, year, items = []) => {
    const requestData = {
        residence: residenceId,
        month: month,
        year: year,
        items: items // If empty, auto-uses template
    };
    
    const response = await axios.post('/api/monthly-requests', requestData);
    return response.data;
};
```

## Benefits

- **Automatic Discovery:** Templates shown when selecting residence
- **Recurring Usage:** Templates automatically used for all months
- **Flexible:** Can still create manual requests
- **Residence-Specific:** Each residence has its own templates

## Testing

Use `test-template-fetching.js` to test the functionality. 