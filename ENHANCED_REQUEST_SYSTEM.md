# Enhanced Request System - Complete Implementation

## Overview
The request system has been enhanced to handle different request types based on user roles. Students can only submit maintenance requests, while non-student users (admin, finance, CEO) can submit comprehensive requests with detailed item specifications, costs, and vendor information.

## Request Types by User Role

### 🎓 **Student Requests (Maintenance Only)**
Students can only submit maintenance requests with simplified fields:

**Required Fields:**
- `title` - Request title
- `description` - Detailed description of the issue
- `type` - Must be "maintenance"
- `residence` - Student's assigned residence
- `room` - Room number where issue occurs
- `category` - Issue category (plumbing, electrical, hvac, appliance, structural, other)
- `priority` - Priority level (low, medium, high)

**Optional Fields:**
- `images` - Array of image URLs
- `tags` - Array of tags for categorization

**Example Student Request:**
```json
{
  "title": "Broken Heater in Room A1",
  "description": "The heater is not working properly and makes strange noises",
  "type": "maintenance",
  "residence": "507f1f77bcf86cd799439011",
  "room": "A1",
  "category": "hvac",
  "priority": "high",
  "images": ["https://example.com/image1.jpg"],
  "tags": ["heating", "urgent"]
}
```

### 👨‍💼 **Non-Student Requests (Admin, Finance, CEO)**
Non-student users can submit comprehensive requests with detailed specifications:

**Required Fields:**
- `title` - Request title
- `description` - Overall request description
- `type` - Request type (financial, operational)
- `residence` - Target residence
- `department` - Department making the request
- `requestedBy` - Name of person requesting
- `deliveryLocation` - Where items should be delivered
- `items` - Array of items/services (at least one required)

**Item Structure (Required for each item):**
- `description` - Item/service description
- `quantity` - Quantity needed (minimum 1)
- `estimatedCost` - Estimated cost per unit (minimum 0)
- `purpose` - Purpose/justification for the item

**Optional Fields:**
- `proposedVendor` - Preferred vendor/supplier
- `priority` - Priority level (low, medium, high)
- `images` - Array of image URLs
- `tags` - Array of tags for categorization

**Example Non-Student Request:**
```json
{
  "title": "Office Equipment Purchase",
  "description": "Need to purchase new office equipment for the admin department",
  "type": "operational",
  "residence": "507f1f77bcf86cd799439011",
  "department": "Administration",
  "requestedBy": "John Smith",
  "deliveryLocation": "Main Office, Belvedere Residence",
  "items": [
    {
      "description": "HP LaserJet Printer",
      "quantity": 2,
      "estimatedCost": 250.00,
      "purpose": "Replace old printers that are no longer working"
    },
    {
      "description": "Office Chairs",
      "quantity": 5,
      "estimatedCost": 120.00,
      "purpose": "New chairs for the reception area"
    }
  ],
  "proposedVendor": "Office Supplies Co.",
  "priority": "medium",
  "images": ["https://example.com/printer.jpg"],
  "tags": ["office", "equipment"]
}
```

## Approval Workflow

### 📋 **Student Maintenance Requests**
1. **Student submits** → Status: `pending`
2. **Admin reviews** → Can approve/reject or assign to maintenance staff
3. **Maintenance staff works** → Status: `in-progress`
4. **Maintenance completed** → Status: `completed`

### 📋 **Non-Student Requests**
1. **User submits** → Status: `pending`
2. **Admin approval** → Admin reviews and approves/rejects
3. **Finance approval** → Finance reviews budget and approves/rejects
4. **CEO approval** → CEO gives final approval/rejection
5. **Request completed** → Status: `completed`

## Approval Tracking

Each approval level now tracks:
- `approved` - Boolean approval status
- `approvedBy` - User ID who approved
- `approvedByEmail` - Email address of approver
- `approvedAt` - Timestamp of approval
- `notes` - Approval notes/comments

**Example Approval Object:**
```json
{
  "approval": {
    "admin": {
      "approved": true,
      "approvedBy": "507f1f77bcf86cd799439011",
      "approvedByEmail": "admin@alamait.com",
      "approvedAt": "2024-01-15T10:30:00Z",
      "notes": "Approved after review"
    },
    "finance": {
      "approved": true,
      "approvedBy": "507f1f77bcf86cd799439012",
      "approvedByEmail": "finance@alamait.com",
      "approvedAt": "2024-01-16T14:20:00Z",
      "notes": "Budget approved"
    },
    "ceo": {
      "approved": true,
      "approvedBy": "507f1f77bcf86cd799439013",
      "approvedByEmail": "ceo@alamait.com",
      "approvedAt": "2024-01-17T09:15:00Z",
      "notes": "Final approval granted"
    }
  }
}
```

## Automatic Calculations

### 💰 **Total Cost Calculation**
For non-student requests, the system automatically calculates the total estimated cost:

```javascript
totalEstimatedCost = items.reduce((total, item) => {
    return total + (item.estimatedCost * item.quantity);
}, 0);
```

**Example:**
- Item 1: 2 printers × $250 = $500
- Item 2: 5 chairs × $120 = $600
- **Total Estimated Cost: $1,100**

## API Endpoints

### 📝 **Create Request**
```
POST /api/requests
```

**Request Body:** Varies by user role (see examples above)

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "title": "Office Equipment Purchase",
  "description": "Need to purchase new office equipment",
  "type": "operational",
  "status": "pending",
  "totalEstimatedCost": 1100.00,
  "items": [...],
  "approval": {...},
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### ✅ **Approval Endpoints**
```
PATCH /api/requests/:id/admin-approval
PATCH /api/requests/:id/finance-approval
PATCH /api/requests/:id/ceo-approval
```

**Request Body:**
```json
{
  "approved": true,
  "notes": "Approval notes here"
}
```

### 📊 **Get Requests**
```
GET /api/requests
GET /api/requests/:id
```

**Query Parameters:**
- `type` - Filter by request type
- `status` - Filter by status
- `residence` - Filter by residence
- `priority` - Filter by priority
- `category` - Filter by category (maintenance only)
- `search` - Search in title and description
- `page` - Page number for pagination
- `limit` - Items per page

## Validation Rules

### 🎓 **Student Validation**
- Can only submit maintenance requests
- Must have assigned residence
- Can only submit for their assigned residence
- Room and category are required

### 👨‍💼 **Non-Student Validation**
- Can submit financial or operational requests
- Department, requestedBy, and deliveryLocation are required
- At least one item is required
- Each item must have description, quantity, estimatedCost, and purpose
- Quantity must be at least 1
- Estimated cost must be 0 or greater

### 🔄 **General Validation**
- Title and description are required for all requests
- Duplicate requests (same title/description by same user) are prevented
- Status must be valid enum value
- Priority defaults to 'medium' if not specified

## Status Values

### 📊 **Available Statuses**
- `pending` - Request is pending approval
- `assigned` - Request has been assigned to someone
- `in-progress` - Request is being worked on
- `completed` - Request has been completed
- `rejected` - Request has been rejected

## Role-Based Access

### 👀 **View Access**
- **Students:** Can view their own requests and requests from their residence
- **Admin:** Can view all requests
- **Finance:** Can view financial/operational requests approved by admin
- **CEO:** Can view financial/operational requests approved by admin and finance

### ✏️ **Create Access**
- **Students:** Can create maintenance requests only
- **Admin/Finance/CEO:** Can create any type of request

### ✅ **Approval Access**
- **Admin:** Can approve any request
- **Finance:** Can approve requests after admin approval
- **CEO:** Can approve requests after admin and finance approval

## Quotation System

### 📄 **Admin Quotations**
Admins can still upload quotations for requests:

```
POST /api/requests/:id/quotations
```

**Request Body:**
```json
{
  "provider": "Vendor Name",
  "amount": 1000.00,
  "description": "Quotation description",
  "fileUrl": "https://example.com/quotation.pdf",
  "fileName": "quotation.pdf"
}
```

### 📋 **Quotation Tracking**
Each quotation tracks:
- Provider name
- Amount
- Description
- File URL and name
- Upload date and user
- Approval status and approver

## Error Handling

### ❌ **Common Error Responses**

**Missing Required Fields:**
```json
{
  "message": "Department is required for non-student requests"
}
```

**Invalid Item Data:**
```json
{
  "message": "Item 1: Quantity must be at least 1"
}
```

**Permission Denied:**
```json
{
  "message": "Students can only submit maintenance requests"
}
```

**Duplicate Request:**
```json
{
  "message": "A similar request already exists"
}
```

## Database Schema Changes

### 📊 **New Fields Added**
- `department` - Department making the request
- `requestedBy` - Name of person requesting
- `items` - Array of request items
- `totalEstimatedCost` - Calculated total cost
- `proposedVendor` - Preferred vendor
- `deliveryLocation` - Delivery location
- `approvedByEmail` - Email of approver (for each approval level)

### 🔄 **Updated Fields**
- `status` enum updated to use hyphens instead of underscores
- `approval` object enhanced with email tracking

## Frontend Integration

### 🎨 **UI Considerations**
- Different forms for student vs non-student requests
- Dynamic item addition/removal for non-student requests
- Real-time cost calculation
- Approval workflow visualization
- Email display for approvers

### 📱 **Form Validation**
- Client-side validation matching server rules
- Real-time feedback for required fields
- Cost calculation updates
- Duplicate request detection

## Testing

### 🧪 **Test Scenarios**
1. **Student creates maintenance request** ✅
2. **Admin creates operational request** ✅
3. **Finance creates financial request** ✅
4. **Invalid student request (non-maintenance)** ❌
5. **Missing required fields** ❌
6. **Invalid item data** ❌
7. **Approval workflow** ✅
8. **Cost calculation** ✅
9. **Email tracking** ✅

## Migration Notes

### 🔄 **Existing Data**
- Existing requests continue to work
- No data migration required
- New fields are optional for existing records
- Status values are automatically normalized

### ⚠️ **Breaking Changes**
- Status enum values changed from underscores to hyphens
- Some validation rules are now stricter
- Approval workflow simplified

## Future Enhancements

### 🚀 **Potential Improvements**
1. **Email Notifications** - Send emails on approval status changes
2. **File Attachments** - Support for multiple file types
3. **Budget Tracking** - Integration with budget management
4. **Vendor Management** - Vendor database and ratings
5. **Reporting** - Request analytics and reporting
6. **Mobile App** - Mobile-optimized request submission
7. **Workflow Customization** - Configurable approval workflows
8. **Integration** - Integration with external systems

## Conclusion

The enhanced request system provides:
- **Role-based request types** with appropriate complexity
- **Comprehensive approval workflow** with email tracking
- **Automatic cost calculations** for non-student requests
- **Flexible item management** for detailed specifications
- **Robust validation** ensuring data integrity
- **Backward compatibility** with existing functionality

This implementation ensures that students have a simple, focused experience while non-student users have the detailed control they need for complex requests. 