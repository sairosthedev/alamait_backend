# API Endpoints & Request Creation Flow

## 🚀 **API Endpoints Overview**

### **Base URL**: `/api`

## 📝 **Request Management Endpoints**

### **1. Create Request**
```http
POST /api/requests
Content-Type: application/json
Authorization: Bearer <token>
```

#### **Request Body Schema**
```javascript
{
  // Required fields
  title: String (required),
  description: String (required),
  type: String (enum: ['maintenance', 'financial', 'operational']) (required),
  residence: ObjectId (required),
  
  // Student-specific fields (for maintenance requests)
  room: String,
  category: String (enum: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other']),
  
  // Non-student fields (for financial/operational requests)
  department: String,
  requestedBy: String,
  items: [{
    description: String (required),
    quantity: Number (required, min: 1),
    unitCost: Number (default: 0),
    purpose: String,
    quotations: [{
      provider: String,
      amount: Number,
      description: String
    }]
  }],
  proposedVendor: String,
  deliveryLocation: String,
  
  // Optional fields
  priority: String (enum: ['low', 'medium', 'high']) (default: 'medium'),
  amount: Number (default: 0),
  dueDate: Date,
  tags: [String],
  images: [{
    url: String,
    caption: String
  }]
}
```

#### **Response Schema**
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  type: String,
  submittedBy: {
    _id: ObjectId,
    firstName: String,
    lastName: String,
    email: String,
    role: String
  },
  residence: {
    _id: ObjectId,
    name: String
  },
  status: String,
  priority: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### **Test Case - Student Maintenance Request**
```javascript
// Request
POST /api/requests
{
  "title": "Leaking Faucet in Room 101",
  "description": "The kitchen faucet in room 101 is leaking and needs repair",
  "type": "maintenance",
  "residence": "507f1f77bcf86cd799439011",
  "room": "101",
  "category": "plumbing",
  "priority": "medium"
}

// Response
{
  "_id": "507f1f77bcf86cd799439012",
  "title": "Leaking Faucet in Room 101",
  "description": "The kitchen faucet in room 101 is leaking and needs repair",
  "type": "maintenance",
  "submittedBy": {
    "_id": "507f1f77bcf86cd799439013",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@student.com",
    "role": "student"
  },
  "residence": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Student Residence A"
  },
  "status": "pending",
  "priority": "medium",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### **Test Case - Admin Operational Request**
```javascript
// Request
POST /api/requests
{
  "title": "Office Furniture Purchase",
  "description": "Need to purchase new office furniture for the admin building",
  "type": "operational",
  "residence": "507f1f77bcf86cd799439011",
  "department": "Administration",
  "requestedBy": "Jane Smith",
  "deliveryLocation": "Admin Building, Ground Floor",
  "items": [
    {
      "description": "Office Desk",
      "quantity": 5,
      "unitCost": 2500,
      "purpose": "Replacement of old desks"
    },
    {
      "description": "Office Chair",
      "quantity": 5,
      "unitCost": 1200,
      "purpose": "Ergonomic chairs for staff"
    }
  ],
  "proposedVendor": "Office Supplies Co",
  "priority": "high"
}

// Response
{
  "_id": "507f1f77bcf86cd799439014",
  "title": "Office Furniture Purchase",
  "description": "Need to purchase new office furniture for the admin building",
  "type": "operational",
  "submittedBy": {
    "_id": "507f1f77bcf86cd799439015",
    "firstName": "Admin",
    "lastName": "User",
    "email": "admin@company.com",
    "role": "admin"
  },
  "residence": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Student Residence A"
  },
  "department": "Administration",
  "requestedBy": "Jane Smith",
  "deliveryLocation": "Admin Building, Ground Floor",
  "items": [
    {
      "description": "Office Desk",
      "quantity": 5,
      "unitCost": 2500,
      "totalCost": 12500
    },
    {
      "description": "Office Chair",
      "quantity": 5,
      "unitCost": 1200,
      "totalCost": 6000
    }
  ],
  "totalEstimatedCost": 18500,
  "status": "pending",
  "priority": "high",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### **2. Get All Requests**
```http
GET /api/requests?type=maintenance&status=pending&page=1&limit=10
Authorization: Bearer <token>
```

#### **Query Parameters**
- `type`: Filter by request type
- `status`: Filter by status
- `residence`: Filter by residence
- `priority`: Filter by priority
- `category`: Filter by category
- `search`: Search in title and description
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

#### **Response Schema**
```javascript
{
  "requests": [RequestObject],
  "pagination": {
    "currentPage": Number,
    "totalPages": Number,
    "totalItems": Number,
    "itemsPerPage": Number
  }
}
```

### **3. Get Request by ID**
```http
GET /api/requests/:id
Authorization: Bearer <token>
```

### **4. Update Request**
```http
PUT /api/requests/:id
Content-Type: application/json
Authorization: Bearer <token>
```

### **5. Delete Request**
```http
DELETE /api/requests/:id
Authorization: Bearer <token>
```

## 📋 **Quotation Management Endpoints**

### **1. Upload Quotation (Request Level)**
```http
POST /api/requests/:id/quotations
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

#### **Form Data Schema**
```javascript
{
  provider: String (required),
  amount: Number (required),
  description: String,
  file: File (optional),
  validUntil: Date,
  terms: String
}
```

#### **Test Case - Upload Quotation**
```javascript
// Form Data
const formData = new FormData();
formData.append('provider', 'ABC Plumbing Services');
formData.append('amount', '2500');
formData.append('description', 'Complete faucet replacement including labor and materials');
formData.append('file', fileObject);
formData.append('validUntil', '2024-02-15');

// Response
{
  "_id": "507f1f77bcf86cd799439016",
  "quotations": [
    {
      "_id": "507f1f77bcf86cd799439017",
      "provider": "ABC Plumbing Services",
      "amount": 2500,
      "description": "Complete faucet replacement including labor and materials",
      "fileUrl": "https://s3.amazonaws.com/bucket/quotations/file.pdf",
      "fileName": "quotation_abc_plumbing.pdf",
      "uploadedBy": {
        "_id": "507f1f77bcf86cd799439015",
        "firstName": "Admin",
        "lastName": "User"
      },
      "uploadedAt": "2024-01-15T11:00:00.000Z",
      "isApproved": false,
      "vendorId": "507f1f77bcf86cd799439018",
      "vendorCode": "200001",
      "vendorName": "ABC Plumbing Services",
      "vendorType": "contractor",
      "paymentMethod": "Cash",
      "hasBankDetails": false
    }
  ]
}
```

### **2. Add Item Quotation**
```http
POST /api/requests/:id/items/:itemIndex/quotations
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

### **3. Approve Quotation**
```http
POST /api/requests/:id/quotations/:quotationId/approve
Content-Type: application/json
Authorization: Bearer <token>
```

## ✅ **Approval Workflow Endpoints**

### **1. Admin Approval**
```http
POST /api/requests/:id/admin-approval
Content-Type: application/json
Authorization: Bearer <token>
```

#### **Request Body**
```javascript
{
  approved: Boolean (required),
  notes: String
}
```

### **2. Finance Approval**
```http
POST /api/requests/:id/finance-approval
Content-Type: application/json
Authorization: Bearer <token>
```

#### **Request Body**
```javascript
{
  approved: Boolean,
  rejected: Boolean,
  waitlisted: Boolean,
  notes: String,
  quotationUpdates: [{
    quotationId: ObjectId,
    isApproved: Boolean,
    approvedBy: ObjectId,
    approvedAt: Date
  }],
  selectedQuotationId: ObjectId
}
```

### **3. CEO Approval**
```http
POST /api/requests/:id/ceo-approval
Content-Type: application/json
Authorization: Bearer <token>
```

#### **Request Body**
```javascript
{
  approved: Boolean (required),
  notes: String
}
```

## 💰 **Payment & Financial Endpoints**

### **1. Mark Expense as Paid**
```http
POST /api/expenses/:id/mark-paid
Content-Type: application/json
Authorization: Bearer <token>
```

#### **Request Body**
```javascript
{
  paymentMethod: String (enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal']),
  paidBy: ObjectId (ref: 'User'),
  paidDate: Date,
  receiptImage: {
    fileUrl: String,
    fileName: String
  }
}
```

### **2. Get Transaction Entries**
```http
GET /api/transactions/entries?account=507f1f77bcf86cd799439019&dateFrom=2024-01-01&dateTo=2024-01-31
Authorization: Bearer <token>
```

## 🔍 **Request Creation Flow - Step by Step**

### **Step 1: Request Creation**
1. **Frontend Validation**
   - Validate required fields based on user role
   - Students: title, description, type (maintenance), residence, room, category
   - Admins: title, description, type, residence, department, requestedBy, items, deliveryLocation

2. **Backend Processing**
   - Validate user permissions
   - Check for duplicate requests (students only)
   - Auto-calculate total estimated cost for items
   - Set initial status and approval state

3. **Auto-Vendor Creation**
   - If quotations include new vendor names
   - Generate unique vendor codes (200001, 200002, etc.)
   - Determine vendor type and category
   - Set payment method (Cash for auto-generated vendors)

### **Step 2: Quotation Upload**
1. **File Upload**
   - Support for PDF, DOC, DOCX, JPG, PNG
   - S3 integration for file storage
   - File validation and size limits

2. **Vendor Linking**
   - Auto-create vendor if provider name is new
   - Link quotation to vendor record
   - Set payment method based on vendor bank details

### **Step 3: Approval Workflow**
1. **Admin Approval** (automatic for admin-created requests)
2. **Finance Approval** (with quotation selection)
3. **CEO Approval** (final approval)

### **Step 4: Expense Conversion**
1. **Automatic Conversion**
   - Request converts to expense when CEO approves
   - Generate unique expense ID
   - Link to original request

2. **Transaction Creation**
   - Create transaction record
   - Generate transaction entries for double-entry bookkeeping
   - Update chart of accounts

### **Step 5: Payment Processing**
1. **Payment Method Determination**
   - Check vendor bank details
   - Set payment method (Bank Transfer vs Cash)
   - Update expense payment status

2. **Financial Recording**
   - Create transaction entries
   - Update account balances
   - Record in TransactionEntry collection

## 🎯 **Key Integration Points**

### **Frontend Integration Checklist**
- [ ] Form validation based on user role
- [ ] File upload handling for quotations
- [ ] Real-time status updates
- [ ] Approval workflow UI
- [ ] Payment method selection
- [ ] Financial reporting integration

### **Error Handling**
- [ ] Validation errors (400)
- [ ] Permission errors (403)
- [ ] Not found errors (404)
- [ ] Server errors (500)
- [ ] File upload errors
- [ ] Database constraint errors

This API documentation provides the complete interface for the request-to-payment flow system. 