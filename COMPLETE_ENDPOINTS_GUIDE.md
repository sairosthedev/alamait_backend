# 🎯 **Complete Endpoints Guide - All Scenarios**

## 📋 **Table of Contents**
1. [Request Management Endpoints](#request-management-endpoints)
2. [Maintenance Request Endpoints](#maintenance-request-endpoints)
3. [Monthly Request Endpoints](#monthly-request-endpoints)
4. [Finance Approval Endpoints](#finance-approval-endpoints)
5. [Quotation Management Endpoints](#quotation-management-endpoints)
6. [Payment & Financial Endpoints](#payment--financial-endpoints)
7. [Student Management Endpoints](#student-management-endpoints)
8. [Admin Management Endpoints](#admin-management-endpoints)

---

## 🏢 **Request Management Endpoints**

### **Base URL:** `/api/requests`

#### **📊 Get Requests**
```http
GET /api/requests
GET /api/requests/:id
GET /api/requests/:id/quotations
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `status` - Filter by status
- `type` - Filter by request type
- `priority` - Filter by priority
- `category` - Filter by category
- `search` - Search in title/description

#### **📝 Create Request**
```http
POST /api/requests
Content-Type: multipart/form-data OR application/json
```

**Request Body (JSON):**
```javascript
{
  "title": "Request Title",
  "description": "Request Description",
  "type": "operational|maintenance|financial",
  "priority": "low|medium|high",
  "department": "Operations",
  "requestedBy": "User Name",
  "deliveryLocation": "Location",
  "residence": "residence_id",
  "items": [
    {
      "description": "Item Description",
      "quantity": 1,
      "unitCost": 100,
      "totalCost": 100,
      "purpose": "Item Purpose",
      "provider": "Vendor Name" // Optional
    }
  ],
  "proposedVendor": "Vendor Name", // Optional
  "totalEstimatedCost": 100
}
```

**Request Body (FormData):**
- All JSON fields + file uploads for quotations

#### **✏️ Update Request**
```http
PUT /api/requests/:id
```

**Access:** Admin, Finance, CEO

#### **🗑️ Delete Request**
```http
DELETE /api/requests/:id
```

**Access:** Request owner or admin

---

## 🔧 **Maintenance Request Endpoints**

### **Base URL:** `/api/finance/maintenance`

#### **📊 Get Maintenance Requests**
```http
GET /api/finance/maintenance/requests
GET /api/finance/maintenance/requests/:id
GET /api/finance/maintenance/requests/status/:status
GET /api/finance/maintenance/statistics
```

#### **✅ Approve Maintenance Request**
```http
PATCH /api/finance/maintenance/requests/:id/approve
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "notes": "Approval notes",
  "amount": 500, // Optional: override amount
  "maintenanceAccount": "account_id", // Optional
  "apAccount": "account_id" // Optional
}
```

**Access:** Admin, Finance Admin

#### **✏️ Update Maintenance Finance Details**
```http
PUT /api/finance/maintenance/requests/:id/finance
```

---

## 📅 **Monthly Request Endpoints**

### **Base URL:** `/api/monthly-requests`

#### **📊 Get Monthly Requests**
```http
GET /api/monthly-requests
GET /api/monthly-requests/:id
GET /api/monthly-requests/finance/dashboard
GET /api/monthly-requests/finance/pending-approvals
```

#### **📝 Create Monthly Request**
```http
POST /api/monthly-requests
POST /api/monthly-requests/templates/:templateId
```

#### **✅ Approve Monthly Request**
```http
PATCH /api/monthly-requests/:id/approve
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "approved": true,
  "notes": "Approval notes",
  "month": 1, // Required for templates
  "year": 2025 // Required for templates
}
```

**Access:** Admin, Finance, Finance Admin, Finance User

#### **📤 Send to Finance**
```http
PUT /api/monthly-requests/:id/send-to-finance
POST /api/monthly-requests/:id/send-to-finance
```

**Access:** Admin

---

## 💰 **Finance Approval Endpoints**

### **For Request Documents:**

#### **✅ Finance Approval**
```http
PATCH /api/requests/:id/finance-approval
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "approved": true,
  "rejected": false,
  "waitlisted": false,
  "notes": "Finance approval notes"
}
```

**Access:** Finance, Finance Admin, Finance User

#### **✅ Admin Approval**
```http
PATCH /api/requests/:id/admin-approval
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "approved": true,
  "notes": "Admin approval notes"
}
```

**Access:** Admin, Finance, Finance Admin, Finance User

#### **✅ CEO Approval**
```http
PATCH /api/requests/:id/ceo-approval
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "approved": true,
  "notes": "CEO approval notes"
}
```

**Access:** CEO

### **For Maintenance Documents:**

#### **✅ Finance Maintenance Approval**
```http
PATCH /api/finance/maintenance/requests/:id/approve
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "notes": "Approval notes",
  "amount": 500,
  "maintenanceAccount": "account_id",
  "apAccount": "account_id"
}
```

**Access:** Admin, Finance Admin

---

## 📄 **Quotation Management Endpoints**

### **Upload Quotations**
```http
POST /api/requests/:id/quotations
Content-Type: multipart/form-data
```

**Form Data:**
- `quotation` - File (PDF, DOC, DOCX, images)
- `provider` - Provider name
- `amount` - Quotation amount
- `description` - Quotation description

**Access:** Admin, Finance, Finance Admin, Finance User

### **Approve Quotations**
```http
PATCH /api/requests/:id/quotations/approve
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "quotationIndex": 0,
  "approved": true,
  "notes": "Quotation approval notes"
}
```

**Access:** Finance, Finance Admin, Finance User

### **Item-Level Quotations**
```http
POST /api/requests/:id/items/:itemIndex/quotations
PATCH /api/requests/:id/items/:itemIndex/quotations/:quotationIndex/approve
PUT /api/requests/:id/items/:itemIndex/quotations/:quotationIndex
```

### **Quotation Selection**
```http
POST /api/requests/:requestId/items/:itemIndex/quotations/:quotationIndex/select
POST /api/requests/:requestId/quotations/:quotationIndex/select
POST /api/requests/:requestId/items/:itemIndex/quotations/:quotationIndex/override
```

### **Finance Override**
```http
POST /api/requests/:id/finance-override-quotation
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "quotationIndex": 0,
  "reason": "Override reason"
}
```

**Access:** Finance, Finance Admin, Finance User

### **CEO Override**
```http
POST /api/requests/:id/ceo-override-quotation
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "quotationIndex": 0,
  "strategicReason": "Strategic reasoning"
}
```

**Access:** CEO

---

## 💳 **Payment & Financial Endpoints**

### **Student Payments**
```http
POST /api/student/payments
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "studentId": "student_id",
  "residenceId": "residence_id",
  "amount": 300,
  "method": "Cash|Bank Transfer|Mobile Money",
  "date": "2025-01-15",
  "description": "January 2025 Rent"
}
```

### **Mark Expense as Paid**
```http
POST /api/requests/expenses/:expenseId/mark-paid
Content-Type: application/json
```

**Request Body:**
```javascript
{
  "paymentMethod": "Bank Transfer|Cash|Online Payment",
  "paidDate": "2025-01-20",
  "notes": "Payment notes"
}
```

**Access:** Finance, Finance Admin, Finance User

### **Financial Reports**
```http
GET /api/financial-reports/income-statement?period=2025&basis=cash
GET /api/financial-reports/balance-sheet?asOf=2025-12-31&basis=cash
GET /api/financial-reports/cash-flow?period=2025&basis=cash
GET /api/financial-reports/monthly-income-statement?period=2025&basis=cash
GET /api/financial-reports/monthly-balance-sheet?period=2025&basis=cash
GET /api/financial-reports/monthly-cash-flow?period=2025&basis=cash
```

### **Transactions**
```http
GET /api/finance/transactions
GET /api/finance/transactions/:id
GET /api/finance/transactions/:id/entries
```

---

## 🎓 **Student Management Endpoints**

### **Base URL:** `/api/students`

```http
GET /api/students
GET /api/students/:id
POST /api/students
PUT /api/students/:id
DELETE /api/students/:id
```

### **Student Dashboard**
```http
GET /api/student/dashboard
GET /api/student/bookings
GET /api/student/payments
```

---

## 👨‍💼 **Admin Management Endpoints**

### **Base URL:** `/api/admin`

#### **User Management**
```http
GET /api/admin/users
GET /api/admin/users/:id
POST /api/admin/users
PUT /api/admin/users/:id
DELETE /api/admin/users/:id
```

#### **Application Management**
```http
GET /api/admin/applications
PUT /api/admin/applications/:id/approve
PUT /api/admin/applications/:id/reject
```

#### **Expense Management**
```http
GET /api/admin/expenses
POST /api/admin/expenses/:id/approve
```

---

## 🔐 **Authentication & Authorization**

### **All endpoints require authentication:**
```http
Authorization: Bearer <jwt_token>
```

### **Role-based access:**
- **Admin**: Full access to all endpoints
- **Finance**: Access to finance-related endpoints
- **Finance Admin**: Extended finance permissions
- **Finance User**: Basic finance operations
- **CEO**: Strategic decision endpoints
- **Student**: Limited to own data

---

## 📊 **Response Formats**

### **Success Response:**
```javascript
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ }
}
```

### **Error Response:**
```javascript
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error"
  }
}
```

---

## 🎯 **Key Scenarios & Endpoints**

### **1. Request with Vendor but No Quotations**
```http
POST /api/requests
PATCH /api/requests/:id/finance-approval
```

### **2. Request without Vendor or Quotations**
```http
POST /api/requests
PATCH /api/requests/:id/finance-approval
```

### **3. Mixed Request (Some items with vendors, some without)**
```http
POST /api/requests
PATCH /api/requests/:id/finance-approval
```

### **4. Request with Quotations**
```http
POST /api/requests
POST /api/requests/:id/quotations
PATCH /api/requests/:id/quotations/approve
PATCH /api/requests/:id/finance-approval
```

### **5. Maintenance Request Approval**
```http
PATCH /api/finance/maintenance/requests/:id/approve
```

### **6. Monthly Request Approval**
```http
PATCH /api/monthly-requests/:id/approve
```

---

## 🚀 **Quick Reference**

### **Most Common Endpoints:**
- `POST /api/requests` - Create request
- `PATCH /api/requests/:id/finance-approval` - Finance approve request
- `PATCH /api/finance/maintenance/requests/:id/approve` - Approve maintenance
- `PATCH /api/monthly-requests/:id/approve` - Approve monthly request
- `POST /api/requests/:id/quotations` - Upload quotation
- `PATCH /api/requests/:id/quotations/approve` - Approve quotation

### **Double-Entry Accounting:**
All approval endpoints automatically create proper double-entry accounting transactions based on the request type and vendor information.
