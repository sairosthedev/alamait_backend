# Request System Implementation

## Overview

The Request System handles two distinct workflows:

1. **Student Maintenance Request Flow** - Students submit maintenance issues that are managed by admins
2. **Admin Operational/Financial Request Flow** - Admins submit requests that go through Finance → CEO approval

## Database Structure

### Request Model (`src/models/Request.js`)

```javascript
{
  _id: ObjectId,
  title: String,                    // Request title
  description: String,              // Detailed description
  type: String,                     // 'maintenance' | 'financial' | 'operational'
  submittedBy: ObjectId,            // Reference to User
  residence: ObjectId,              // Reference to Residence (required)
  room: String,                     // Room number (for maintenance)
  category: String,                 // For maintenance: 'plumbing', 'electrical', etc.
  priority: String,                 // 'low' | 'medium' | 'high'
  status: String,                   // 'pending' | 'assigned' | 'in_progress' | 'completed' | 'rejected'
  
  // Approval flow for admin requests
  approval: {
    admin: {
      approved: Boolean,
      approvedBy: ObjectId,
      approvedAt: Date,
      notes: String
    },
    finance: {
      approved: Boolean,
      approvedBy: ObjectId,
      approvedAt: Date,
      notes: String
    },
    ceo: {
      approved: Boolean,
      approvedBy: ObjectId,
      approvedAt: Date,
      notes: String
    }
  },
  
  // Assignment for maintenance requests
  assignedTo: {
    _id: ObjectId,
    name: String,
    surname: String,
    role: String
  },
  
  // Quotations (max 3)
  quotations: [{
    provider: String,
    amount: Number,
    description: String,
    fileUrl: String,
    fileName: String,
    uploadedBy: ObjectId,
    uploadedAt: Date,
    isApproved: Boolean,
    approvedBy: ObjectId,
    approvedAt: Date
  }],
  
  // Expense conversion
  convertedToExpense: Boolean,
  expenseId: ObjectId,
  amount: Number,
  
  // Additional fields
  images: [{
    url: String,
    caption: String,
    uploadedAt: Date
  }],
  updates: [{
    date: Date,
    message: String,
    author: ObjectId
  }],
  requestHistory: [{
    date: Date,
    action: String,
    user: ObjectId,
    changes: [String]
  }],
  
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Base URL: `/api/requests`

All endpoints require authentication via JWT token.

#### 1. Get All Requests
```
GET /api/requests
```

**Query Parameters:**
- `type` - Filter by request type
- `status` - Filter by status
- `residence` - Filter by residence

**Role-based Filtering:**
- **Students**: See their own requests AND requests from other students in their residence
- **Admins**: See all requests
- **Finance**: See admin requests that have been approved by admin
- **CEO**: See admin requests that have been approved by both admin and finance

#### 2. Get Request by ID
```
GET /api/requests/:id
```

**Permissions:**
- Students can view their own requests or requests from their residence
- Admins, Finance, and CEO can view any request

#### 3. Create New Request
```
POST /api/requests
```

**Request Body:**
```json
{
  "title": "Request Title",
  "description": "Detailed description",
  "type": "maintenance|financial|operational",
  "residence": "residenceId",
  "room": "101",
  "category": "plumbing",
  "priority": "medium",
  "images": [
    {
      "url": "https://example.com/image.jpg",
      "caption": "Image description"
    }
  ]
}
```

**Role Restrictions:**
- Students can only create maintenance requests for their assigned residence
- Admins can create any type of request

#### 4. Update Request Status (Admin Only)
```
PATCH /api/requests/:id/status
```

**Request Body:**
```json
{
  "status": "assigned|in_progress|completed|rejected",
  "assignedTo": "userId",
  "notes": "Status update notes"
}
```

**Valid Status Transitions:**
- `pending` → `assigned` or `rejected`
- `assigned` → `in_progress` or `rejected`
- `in_progress` → `completed` or `rejected`

#### 5. Admin Approval (Admin Only)
```
PATCH /api/requests/:id/admin-approval
```

**Request Body:**
```json
{
  "approved": true,
  "notes": "Approval notes"
}
```

#### 6. Finance Approval (Finance Only)
```
PATCH /api/requests/:id/finance-approval
```

**Request Body:**
```json
{
  "approved": true,
  "notes": "Finance approval notes"
}
```

#### 7. CEO Approval (CEO Only)
```
PATCH /api/requests/:id/ceo-approval
```

**Request Body:**
```json
{
  "approved": true,
  "notes": "CEO approval notes"
}
```

**Note:** If approved, the request is automatically converted to an expense.

#### 8. Upload Quotation (Admin Only)
```
POST /api/requests/:id/quotations
```

**Form Data:**
- `quotation` - File (PDF, DOC, DOCX, or image)
- `provider` - Provider name
- `amount` - Quotation amount
- `description` - Quotation description

**Limits:**
- Maximum 3 quotations per request
- File size: 10MB
- Allowed formats: PDF, DOC, DOCX, JPEG, PNG, GIF

#### 9. Approve Quotation (Finance Only)
```
PATCH /api/requests/:id/quotations/:quotationIndex/approve
```

**Request Body:**
```json
{
  "quotationIndex": 0
}
```

#### 10. Add Update Message
```
POST /api/requests/:id/updates
```

**Request Body:**
```json
{
  "message": "Update message"
}
```

#### 11. Delete Request
```
DELETE /api/requests/:id
```

**Permissions:**
- Students can only delete their own pending requests
- Admins can delete any pending request

## Workflow Examples

### Student Maintenance Request Flow

1. **Student submits request:**
```javascript
POST /api/requests
{
  "title": "Leaky Faucet",
  "description": "Faucet in bathroom is leaking",
  "type": "maintenance",
  "room": "101",
  "category": "plumbing",
  "priority": "medium"
}
```

2. **Admin assigns task:**
```javascript
PATCH /api/requests/:id/status
{
  "status": "assigned",
  "assignedTo": "staffUserId",
  "notes": "Assigned to maintenance staff"
}
```

3. **Work starts:**
```javascript
PATCH /api/requests/:id/status
{
  "status": "in_progress",
  "notes": "Work has begun"
}
```

4. **Work completed:**
```javascript
PATCH /api/requests/:id/status
{
  "status": "completed",
  "notes": "Faucet repaired successfully"
}
```

### Admin Financial Request Flow

1. **Admin submits request:**
```javascript
POST /api/requests
{
  "title": "New Furniture Purchase",
  "description": "Need furniture for common areas",
  "type": "financial",
  "amount": 5000
}
```

2. **Admin uploads quotations:**
```javascript
POST /api/requests/:id/quotations
// Form data with quotation file and details
```

3. **Finance reviews and approves quotation:**
```javascript
PATCH /api/requests/:id/quotations/0/approve
{
  "quotationIndex": 0
}
```

4. **Finance approves request:**
```javascript
PATCH /api/requests/:id/finance-approval
{
  "approved": true,
  "notes": "Approved after budget review"
}
```

5. **CEO gives final approval:**
```javascript
PATCH /api/requests/:id/ceo-approval
{
  "approved": true,
  "notes": "Final approval granted"
}
```

6. **System automatically creates expense record**

## Frontend Status Mappings

### Student Maintenance Requests
- `pending` → "Pending"
- `assigned` → "Assigned"
- `in_progress` → "In Progress"
- `completed` → "Completed"
- `rejected` → "Rejected"

### Admin Requests
- `admin_pending` → "Admin Review"
- `finance_pending` → "Finance Review"
- `ceo_pending` → "CEO Review"
- `approved` → "Approved"

## Security Features

1. **Role-based Access Control**
   - Each endpoint checks user permissions
   - Students can access their own requests and requests from their residence
   - Role-specific filtering on GET requests

2. **Duplicate Prevention**
   - System checks for similar requests by same user
   - Prevents spam and duplicate submissions

3. **Status Transition Validation**
   - Only valid status transitions are allowed
   - Prevents invalid workflow states

4. **File Upload Security**
   - File type validation
   - File size limits
   - Secure S3 storage

## Testing

Run the test script to verify all functionality:

```bash
node test-request-system.js
```

This will test:
- Request creation for different user types
- Status updates and workflow transitions
- Approval flows
- Quotation upload and approval
- Role-based filtering
- Expense conversion

## Environment Variables

Ensure these environment variables are set:

```env
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your_bucket_name
MONGODB_URI=your_mongodb_connection_string
```

## Future Enhancements

1. **Notifications**
   - Email notifications for status changes
   - In-app notifications
   - WhatsApp integration

2. **File Uploads**
   - Multiple image uploads for requests
   - Progress tracking for file uploads

3. **Analytics**
   - Request statistics dashboard
   - Performance metrics
   - Cost analysis

4. **Mobile Support**
   - Mobile-optimized interface
   - Push notifications
   - Offline capability

5. **Integration**
   - Calendar integration for scheduling
   - Payment system integration
   - External vendor management