# isSelected Field Edit Functionality

## Overview

This enhancement allows **admin users** to edit the `isSelected` field of quotations directly through the update quotation routes. Previously, admins could only select/deselect quotations through dedicated selection endpoints, but now they can modify the selection status as part of the general quotation update process.

## Problem Solved

**Before**: If an admin created a quotation but forgot to select it, they would need to use a separate API call to the selection endpoint to mark it as selected.

**After**: Admins can now edit the `isSelected` field along with other quotation fields (provider, amount, description) in a single API call, making the workflow more intuitive and efficient.

## Implementation Details

### Modified Controllers

1. **`src/controllers/requestController.js`**
   - `updateRequestQuotation()` - Updated to support `isSelected` field editing
   - `updateItemQuotation()` - Updated to support `isSelected` field editing

2. **`src/controllers/monthlyRequestController.js`**
   - `updateItemQuotation()` - Updated to support `isSelected` field editing

### New Features

#### 1. **isSelected Field Support**
- Admins can now include `isSelected: true/false` in the request body when updating quotations
- The field is optional - if not provided, the current selection status remains unchanged

#### 2. **Automatic Selection Management**
- When setting `isSelected: true`, all other quotations for the same item are automatically deselected
- Only one quotation per item can be selected at a time
- Proper deselection tracking is maintained

#### 3. **Selection History Tracking**
- All selection/deselection actions are recorded in the `selectionHistory` array
- Each entry includes:
  - `action`: 'selected' or 'deselected'
  - `user`: User ID who performed the action
  - `userEmail`: Email of the user
  - `timestamp`: When the action occurred
  - `reason`: Description of the action

#### 4. **Cost Recalculation**
- When `isSelected` is modified, the system automatically recalculates:
  - Item total cost (for item-level quotations)
  - Request total estimated cost
- Cost updates are reflected in the response and logged in request history

#### 5. **Request History Updates**
- All changes are logged in the request's `requestHistory` array
- Includes detailed descriptions of what was changed

## API Usage

### Update Request-Level Quotation

```http
PUT /api/requests/:id/quotations/:quotationId
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "provider": "Updated Vendor",
  "amount": 150,
  "description": "Updated description",
  "isSelected": true
}
```

### Update Item-Level Quotation

```http
PUT /api/requests/:id/items/:itemIndex/quotations/:quotationIndex
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "provider": "Updated Vendor",
  "amount": 150,
  "description": "Updated description",
  "isSelected": true
}
```

### Update Monthly Request Quotation

```http
PUT /api/monthly-requests/:id/items/:itemIndex/quotations/:quotationIndex
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "provider": "Updated Vendor",
  "amount": 150,
  "description": "Updated description",
  "isSelected": true
}
```

## Response Examples

### Successful Update Response

```json
{
  "message": "Quotation updated successfully",
  "request": {
    "_id": "request_id",
    "title": "Test Request",
    "items": [
      {
        "description": "Test Item",
        "totalCost": 150,
        "quotations": [
          {
            "provider": "Updated Vendor",
            "amount": 150,
            "description": "Updated description",
            "isSelected": true,
            "selectedBy": "admin_user_id",
            "selectedAt": "2024-01-15T10:30:00.000Z",
            "selectedByEmail": "admin@alamait.com",
            "selectionHistory": [
              {
                "action": "selected",
                "user": "admin_user_id",
                "userEmail": "admin@alamait.com",
                "timestamp": "2024-01-15T10:30:00.000Z",
                "reason": "Selected by admin via quotation update"
              }
            ]
          },
          {
            "provider": "Other Vendor",
            "amount": 120,
            "description": "Other quotation",
            "isSelected": false,
            "deselectedBy": "admin_user_id",
            "deselectedAt": "2024-01-15T10:30:00.000Z",
            "deselectedByEmail": "admin@alamait.com",
            "selectionHistory": [
              {
                "action": "deselected",
                "user": "admin_user_id",
                "userEmail": "admin@alamait.com",
                "timestamp": "2024-01-15T10:30:00.000Z",
                "reason": "Deselected by admin when updating quotation selection"
              }
            ]
          }
        ]
      }
    ],
    "totalEstimatedCost": 150,
    "requestHistory": [
      {
        "date": "2024-01-15T10:30:00.000Z",
        "action": "Item Quotation Updated",
        "user": "admin_user_id",
        "changes": [
          "Item 1: Provider updated to: Updated Vendor, Amount updated to: 150, Description updated, Quotation selected and item cost updated, Total estimated cost recalculated to: $150"
        ]
      }
    ]
  }
}
```

## Permissions

- **Admin users only**: Only users with `admin` role can update quotations
- **Status restrictions**: Updates are only allowed when request status is `pending` or `admin-approved`
- **Monthly requests**: Updates are only allowed when status is `draft` or `pending`

## Validation Rules

1. **Single Selection**: Only one quotation per item can be selected at a time
2. **Automatic Deselection**: When selecting a quotation, all others for the same item are automatically deselected
3. **History Preservation**: All selection changes are tracked in the selection history
4. **Cost Updates**: Item and request costs are automatically recalculated based on selected quotations

## Testing

A comprehensive test script `test-isSelected-edit-functionality.js` has been created to verify:

1. ✅ Basic `isSelected` field updates
2. ✅ Multiple field updates (including `isSelected`)
3. ✅ Selection history tracking
4. ✅ Request history tracking
5. ✅ Cost recalculation
6. ✅ Automatic deselection of other quotations

## Migration Notes

- **Backward Compatible**: Existing selection endpoints continue to work
- **No Database Changes**: Uses existing schema fields
- **No Breaking Changes**: All existing functionality remains intact

## Benefits

1. **Improved UX**: Admins can edit all quotation fields in one place
2. **Reduced API Calls**: No need for separate selection calls
3. **Better Workflow**: More intuitive editing process
4. **Consistent History**: All changes tracked in one place
5. **Automatic Updates**: Cost calculations happen automatically

## Future Enhancements

Potential future improvements could include:

1. **Bulk Selection**: Allow selecting multiple quotations for different items in one call
2. **Selection Reasons**: Allow admins to provide custom reasons for selection changes
3. **Approval Integration**: Automatic approval when selecting quotations
4. **Notification System**: Notify relevant users when selections change 