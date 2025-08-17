# Request System Documentation

## Overview
The Request System is a comprehensive approval workflow that allows users to submit requests for various purposes (financial, maintenance, administrative, etc.) and manages the approval process through multiple levels: Admin → Finance → CEO.

## User Roles & Permissions

### **Student Role**
- **Can**: Submit requests, view own requests, track request status
- **Cannot**: Approve requests, view other users' requests

### **Admin Role**
- **Can**: View all requests, approve/reject requests, manage request categories
- **Cannot**: Final approval (must go through Finance and CEO)

### **Finance Role** (`finance_admin`, `finance_user`)
- **Can**: View all requests, approve/reject requests after admin approval
- **Cannot**: Final approval (must go through CEO)

### **CEO Role**
- **Can**: View all requests, give final approval/rejection, change quotations with reasons
- **Cannot**: Create or modify financial records directly

## Request Approval Workflow

### **1. Request Submission**
```
Student → Submits Request → Status: "pending_admin_approval"
```

### **2. Admin Approval**
```
Admin → Reviews Request → Approves/Rejects → Status: "pending_finance_approval" or "rejected"
```

### **3. Finance Approval**
```
Finance → Reviews Request → Approves/Rejects → Status: "pending_ceo_approval" or "rejected"
```

### **4. CEO Final Approval**
```
CEO → Reviews Request → Final Decision → Status: "approved" or "rejected"
```

### **5. Quotation Management (CEO Only)**
```
CEO → Can change approved quotation → Must provide reason → Status: "approved_with_changes"
```

## Request Model Schema

```javascript
{
  _id: ObjectId,
  title: String,                    // Request title
  description: String,              // Detailed description
  type: String,                     // "financial", "maintenance", "administrative"
  amount: Number,                   // Requested amount
  status: String,                   // Current status
  priority: String,                 // "low", "medium", "high"
  category: String,                 // Request category
  submittedBy: ObjectId,           // Reference to User
  submittedDate: Date,             // Submission timestamp
  
  // Approval tracking
  approval: {
    admin: {
      approved: Boolean,
      approvedBy: ObjectId,
      approvedDate: Date,
      notes: String
    },
    finance: {
      approved: Boolean,
      approvedBy: ObjectId,
      approvedDate: Date,
      notes: String
    },
    ceo: {
      approved: Boolean,
      approvedBy: ObjectId,
      approvedDate: Date,
      notes: String,
      quotationChanges: [{
        originalQuotation: Number,
        newQuotation: Number,
        changeReason: String,
        changedDate: Date
      }]
    }
  },
  
  // Quotations
  quotations: [{
    provider: String,
    amount: Number,
    description: String,
    isApproved: Boolean,
    approvedBy: String  // "admin", "finance", "ceo"
  }],
  
  // Additional fields
  attachments: [String],            // File URLs
  dueDate: Date,                   // Requested completion date
  residence: ObjectId,             // Related residence
  room: String,                    // Related room
  tags: [String],                  // Search tags
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### **General Request Routes** (`/api/requests`)

#### **GET /api/requests**
- **Description**: Get all requests (filtered by user role)
- **Access**: All authenticated users
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `status`: Filter by status
  - `type`: Filter by request type
  - `priority`: Filter by priority
  - `category`: Filter by category
  - `search`: Search in title/description

#### **GET /api/requests/:id**
- **Description**: Get specific request by ID
- **Access**: All authenticated users (own requests or admin/finance/ceo)

#### **POST /api/requests**
- **Description**: Create new request
- **Access**: Students only
- **Body**:
  ```json
  {
    "title": "Kitchen Renovation",
    "description": "Need to renovate the kitchen area",
    "type": "maintenance",
    "amount": 25000,
    "priority": "high",
    "category": "renovation",
    "dueDate": "2024-12-31",
    "residence": "residence_id",
    "room": "Kitchen A",
    "tags": ["renovation", "kitchen"]
  }
  ```

#### **PUT /api/requests/:id**
- **Description**: Update request (only if pending)
- **Access**: Request owner only

#### **DELETE /api/requests/:id**
- **Description**: Delete request (only if pending)
- **Access**: Request owner only

### **Admin Request Routes** (`/api/admin/requests`)

#### **GET /api/admin/requests**
- **Description**: Get all requests for admin review
- **Access**: Admin only

#### **PATCH /api/admin/requests/:id/approve**
- **Description**: Approve request as admin
- **Access**: Admin only
- **Body**:
  ```json
  {
    "notes": "Approved after review"
  }
  ```

#### **PATCH /api/admin/requests/:id/reject**
- **Description**: Reject request as admin
- **Access**: Admin only
- **Body**:
  ```json
  {
    "notes": "Rejected due to budget constraints"
  }
  ```

### **Finance Request Routes** (`/api/finance/requests`)

#### **GET /api/finance/requests**
- **Description**: Get all requests for finance review
- **Access**: Finance roles only

#### **PATCH /api/finance/requests/:id/approve**
- **Description**: Approve request as finance
- **Access**: Finance roles only

#### **PATCH /api/finance/requests/:id/reject**
- **Description**: Reject request as finance
- **Access**: Finance roles only

### **CEO Request Routes** (`/api/ceo/requests`)

#### **GET /api/ceo/requests**
- **Description**: Get all requests for CEO review
- **Access**: CEO only

#### **GET /api/ceo/requests/pending-ceo-approval**
- **Description**: Get requests pending CEO approval
- **Access**: CEO only

#### **PATCH /api/ceo/requests/:id/approve**
- **Description**: Final approval by CEO
- **Access**: CEO only
- **Body**:
  ```json
  {
    "notes": "Final approval granted"
  }
  ```

#### **PATCH /api/ceo/requests/:id/reject**
- **Description**: Final rejection by CEO
- **Access**: CEO only
- **Body**:
  ```json
  {
    "notes": "Rejected due to strategic considerations"
  }
  ```

#### **PATCH /api/ceo/requests/:id/change-quotation**
- **Description**: Change approved quotation (CEO only)
- **Access**: CEO only
- **Body**:
  ```json
  {
    "quotationId": "quotation_id",
    "reason": "Better warranty terms and faster delivery"
  }
  ```

## Request Status Flow

```
pending_admin_approval
    ↓ (Admin approves)
pending_finance_approval
    ↓ (Finance approves)
pending_ceo_approval
    ↓ (CEO approves)
approved
    ↓ (CEO changes quotation)
approved_with_changes
```

**Rejection can happen at any stage:**
```
pending_admin_approval → rejected
pending_finance_approval → rejected
pending_ceo_approval → rejected
```

## Quotation Management

### **Quotation Structure**
```javascript
{
  _id: ObjectId,
  provider: String,           // Vendor/contractor name
  amount: Number,             // Quoted amount
  description: String,        // Detailed quote description
  isApproved: Boolean,        // Whether this quote is selected
  approvedBy: String,         // Role that approved: "admin", "finance", "ceo"
  submittedDate: Date,        // When quote was submitted
  validUntil: Date,          // Quote expiry date
  terms: String,             // Terms and conditions
  attachments: [String]      // Supporting documents
}
```

### **CEO Quotation Change Process**
1. **Review**: CEO reviews all approved quotations
2. **Decision**: CEO can:
   - Approve the finance-approved quotation
   - Select a different quotation
   - Reject all quotations
3. **Change**: If changing quotation, CEO must provide:
   - New quotation ID
   - Detailed reason for change
   - Impact assessment

## Audit Trail

### **Request Actions Logged**
- Request creation
- Status changes
- Approval/rejection actions
- Quotation changes
- File attachments
- Comments/notes

### **Audit Log Structure**
```javascript
{
  _id: ObjectId,
  requestId: ObjectId,        // Reference to request
  user: ObjectId,             // User who performed action
  action: String,             // "created", "approved", "rejected", "quotation_changed"
  details: {
    fromStatus: String,       // Previous status
    toStatus: String,         // New status
    notes: String,            // Action notes
    quotationChanges: Object  // Quotation change details
  },
  timestamp: Date,
  ipAddress: String,
  userAgent: String
}
```

## Frontend Integration

### **Request Dashboard Components**

#### **1. Request List Component**
```javascript
const RequestList = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/requests');
      setRequests(response.data.requests);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Component logic
};
```

#### **2. Request Approval Component**
```javascript
const RequestApproval = ({ requestId, userRole }) => {
  const approveRequest = async (notes) => {
    try {
      await api.patch(`/${userRole}/requests/${requestId}/approve`, { notes });
      // Handle success
    } catch (error) {
      // Handle error
    }
  };
  
  const rejectRequest = async (notes) => {
    try {
      await api.patch(`/${userRole}/requests/${requestId}/reject`, { notes });
      // Handle success
    } catch (error) {
      // Handle error
    }
  };
};
```

#### **3. Quotation Management Component**
```javascript
const QuotationManager = ({ requestId }) => {
  const changeQuotation = async (quotationId, reason) => {
    try {
      await api.patch(`/ceo/requests/${requestId}/change-quotation`, {
        quotationId,
        reason
      });
      // Handle success
    } catch (error) {
      // Handle error
    }
  };
};
```

## Error Handling

### **Common Error Responses**

#### **400 Bad Request**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

#### **401 Unauthorized**
```json
{
  "error": "Authentication required",
  "message": "Please login to access this resource"
}
```

#### **403 Forbidden**
```json
{
  "error": "Access denied",
  "message": "You don't have permission to perform this action"
}
```

#### **404 Not Found**
```json
{
  "error": "Request not found",
  "message": "The requested resource does not exist"
}
```

#### **409 Conflict**
```json
{
  "error": "Request already processed",
  "message": "This request has already been approved/rejected"
}
```

## Security Features

### **Role-Based Access Control (RBAC)**
- All endpoints validate user roles
- Users can only access appropriate data
- Approval actions restricted by role hierarchy

### **Data Validation**
- Input sanitization and validation
- File upload restrictions
- SQL injection prevention

### **Audit Logging**
- All actions logged with user details
- Timestamp and IP address tracking
- Immutable audit trail

### **Request Rate Limiting**
- API rate limiting to prevent abuse
- Request throttling for large operations

## Performance Considerations

### **Database Optimization**
- Indexed queries on frequently accessed fields
- Pagination for large result sets
- Efficient aggregation pipelines

### **Caching Strategy**
- Cache frequently accessed request data
- Redis caching for dashboard metrics
- CDN for file attachments

### **Monitoring**
- Request processing time tracking
- Error rate monitoring
- User activity analytics

## Testing Guide

### **Unit Tests**
```javascript
describe('Request Approval', () => {
  test('Admin can approve pending requests', async () => {
    // Test implementation
  });
  
  test('CEO can change quotations with reason', async () => {
    // Test implementation
  });
});
```

### **Integration Tests**
```javascript
describe('Request Workflow', () => {
  test('Complete approval workflow', async () => {
    // Test full workflow from submission to final approval
  });
});
```

### **API Testing**
```bash
# Test request creation
curl -X POST http://localhost:3000/api/requests \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Request",
    "description": "Test description",
    "type": "maintenance",
    "amount": 1000
  }'

# Test admin approval
curl -X PATCH http://localhost:3000/api/admin/requests/<ID>/approve \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Approved"}'
```

## Future Enhancements

### **Planned Features**
1. **Email Notifications**: Automatic email alerts for status changes
2. **SMS Notifications**: SMS alerts for urgent requests
3. **Mobile App**: Native mobile application for request management
4. **Advanced Analytics**: Request processing analytics and insights
5. **Workflow Automation**: Automated approval for low-value requests
6. **Integration**: Integration with external systems (accounting, project management)

### **Performance Improvements**
1. **Real-time Updates**: WebSocket integration for live updates
2. **Offline Support**: Offline request submission and sync
3. **Bulk Operations**: Bulk approval/rejection capabilities
4. **Advanced Search**: Full-text search with filters

## Conclusion

The Request System provides a robust, secure, and scalable solution for managing approval workflows across different user roles. With comprehensive audit trails, role-based access control, and flexible quotation management, it ensures transparency and accountability throughout the approval process.

The system is designed to handle high-volume request processing while maintaining data integrity and providing excellent user experience across all roles. 