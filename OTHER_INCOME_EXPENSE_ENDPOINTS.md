# Other Income and Other Expense Endpoints

This document describes the new endpoints for managing Other Income and Other Expense entries in the finance module.

## Overview

The finance module now includes comprehensive endpoints for managing other income and other expense entries. These endpoints allow finance users to track additional income sources and expenses that don't fall into the standard categories.

## Authentication & Authorization

All endpoints require authentication and are restricted to users with `admin` or `finance_admin` roles.

## Other Income Endpoints

### Base URL: `/api/finance/other-income`

#### 1. Get All Other Income Entries
- **Method:** `GET`
- **URL:** `/api/finance/other-income`
- **Query Parameters:**
  - `residence` (optional): Filter by residence ID
  - `category` (optional): Filter by category
  - `paymentStatus` (optional): Filter by payment status
  - `startDate` (optional): Filter by start date (ISO string)
  - `endDate` (optional): Filter by end date (ISO string)
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 10)
  - `sortBy` (optional): Sort field (default: 'createdAt')
  - `sortOrder` (optional): Sort order - 'asc' or 'desc' (default: 'desc')

**Response:**
```json
{
  "otherIncomeEntries": [...],
  "pagination": {
    "totalOtherIncome": 25,
    "totalPages": 3,
    "currentPage": 1,
    "limit": 10
  }
}
```

#### 2. Get Other Income Summary Statistics
- **Method:** `GET`
- **URL:** `/api/finance/other-income/summary/stats`
- **Query Parameters:**
  - `residence` (optional): Filter by residence ID
  - `startDate` (optional): Filter by start date (ISO string)
  - `endDate` (optional): Filter by end date (ISO string)

**Response:**
```json
{
  "summary": {
    "totalAmount": 15000,
    "totalEntries": 25
  },
  "byCategory": [
    {
      "_id": "Investment",
      "total": 8000
    }
  ],
  "byStatus": [
    {
      "_id": "Received",
      "total": 12000,
      "count": 20
    }
  ],
  "byMonth": [
    {
      "_id": {
        "year": 2024,
        "month": 1
      },
      "total": 5000,
      "count": 8
    }
  ]
}
```

#### 3. Get Other Income by ID
- **Method:** `GET`
- **URL:** `/api/finance/other-income/:id`

**Response:**
```json
{
  "otherIncome": {
    "_id": "...",
    "incomeId": "OI20241201001",
    "residence": {
      "_id": "...",
      "name": "Residence Name"
    },
    "category": "Investment",
    "amount": 5000,
    "description": "Investment income from bonds",
    "incomeDate": "2024-12-01T00:00:00.000Z",
    "paymentStatus": "Received",
    "paymentMethod": "Bank Transfer",
    "receivedBy": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe"
    },
    "receivedDate": "2024-12-01T10:30:00.000Z",
    "receiptImage": {
      "fileUrl": "...",
      "fileName": "receipt.pdf",
      "uploadDate": "2024-12-01T10:30:00.000Z"
    },
    "createdBy": {
      "_id": "...",
      "firstName": "Jane",
      "lastName": "Smith"
    },
    "createdAt": "2024-12-01T09:00:00.000Z",
    "updatedAt": "2024-12-01T09:00:00.000Z"
  }
}
```

#### 4. Create New Other Income Entry
- **Method:** `POST`
- **URL:** `/api/finance/other-income`

**Request Body:**
```json
{
  "residence": "507f1f77bcf86cd799439011",
  "category": "Investment",
  "amount": 5000,
  "description": "Investment income from bonds",
  "incomeDate": "2024-12-01T00:00:00.000Z",
  "paymentStatus": "Pending",
  "paymentMethod": "Bank Transfer",
  "receivedBy": "507f1f77bcf86cd799439012",
  "receivedDate": "2024-12-01T10:30:00.000Z",
  "receiptImage": {
    "fileUrl": "https://example.com/receipt.pdf",
    "fileName": "receipt.pdf",
    "uploadDate": "2024-12-01T10:30:00.000Z"
  }
}
```

**Required Fields:**
- `residence`: Valid MongoDB ObjectId
- `category`: One of ['Investment', 'Interest', 'Commission', 'Rental', 'Service', 'Other']
- `amount`: Positive number
- `description`: String
- `incomeDate`: Valid date string

**Optional Fields:**
- `paymentStatus`: One of ['Pending', 'Received', 'Overdue'] (default: 'Pending')
- `paymentMethod`: Required if paymentStatus is 'Received'
- `receivedBy`: Valid MongoDB ObjectId (required if paymentStatus is 'Received')
- `receivedDate`: Date string (auto-set to current date if paymentStatus is 'Received')
- `receiptImage`: Object with fileUrl, fileName, and uploadDate

**Response:**
```json
{
  "message": "Other income entry created successfully",
  "otherIncome": {
    "_id": "...",
    "incomeId": "OI20241201001",
    ...
  }
}
```

#### 5. Update Other Income Entry
- **Method:** `PUT`
- **URL:** `/api/finance/other-income/:id`

**Request Body:** Same as create, but all fields are optional.

**Response:**
```json
{
  "message": "Other income entry updated successfully",
  "otherIncome": {
    "_id": "...",
    "incomeId": "OI20241201001",
    ...
  }
}
```

#### 6. Delete Other Income Entry
- **Method:** `DELETE`
- **URL:** `/api/finance/other-income/:id`

**Response:**
```json
{
  "message": "Other income entry deleted successfully"
}
```

## Other Expense Endpoints

### Base URL: `/api/finance/other-expenses`

#### 1. Get All Other Expense Entries
- **Method:** `GET`
- **URL:** `/api/finance/other-expenses`
- **Query Parameters:** Same as Other Income

#### 2. Get Other Expense Summary Statistics
- **Method:** `GET`
- **URL:** `/api/finance/other-expenses/summary/stats`
- **Query Parameters:** Same as Other Income

#### 3. Get Other Expense by ID
- **Method:** `GET`
- **URL:** `/api/finance/other-expenses/:id`

#### 4. Create New Other Expense Entry
- **Method:** `POST`
- **URL:** `/api/finance/other-expenses`

**Request Body:**
```json
{
  "residence": "507f1f77bcf86cd799439011",
  "category": "Office Supplies",
  "amount": 250,
  "description": "Office supplies purchase",
  "expenseDate": "2024-12-01T00:00:00.000Z",
  "paymentStatus": "Pending",
  "paymentMethod": "Cash",
  "paidBy": "507f1f77bcf86cd799439012",
  "paidDate": "2024-12-01T10:30:00.000Z",
  "receiptImage": {
    "fileUrl": "https://example.com/receipt.pdf",
    "fileName": "receipt.pdf",
    "uploadDate": "2024-12-01T10:30:00.000Z"
  }
}
```

**Required Fields:**
- `residence`: Valid MongoDB ObjectId
- `category`: One of ['Office Supplies', 'Marketing', 'Legal', 'Consulting', 'Travel', 'Entertainment', 'Miscellaneous', 'Other']
- `amount`: Positive number
- `description`: String
- `expenseDate`: Valid date string

**Optional Fields:**
- `paymentStatus`: One of ['Pending', 'Paid', 'Overdue'] (default: 'Pending')
- `paymentMethod`: Required if paymentStatus is 'Paid'
- `paidBy`: Valid MongoDB ObjectId (required if paymentStatus is 'Paid')
- `paidDate`: Date string (auto-set to current date if paymentStatus is 'Paid')
- `receiptImage`: Object with fileUrl, fileName, and uploadDate

#### 5. Update Other Expense Entry
- **Method:** `PUT`
- **URL:** `/api/finance/other-expenses/:id`

#### 6. Delete Other Expense Entry
- **Method:** `DELETE`
- **URL:** `/api/finance/other-expenses/:id`

## Data Models

### OtherIncome Schema
```javascript
{
  incomeId: String (unique, auto-generated),
  residence: ObjectId (ref: 'Residence'),
  category: String (enum: ['Investment', 'Interest', 'Commission', 'Rental', 'Service', 'Other']),
  amount: Number,
  description: String,
  incomeDate: Date,
  paymentStatus: String (enum: ['Pending', 'Received', 'Overdue']),
  paymentMethod: String (enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal']),
  receivedBy: ObjectId (ref: 'User'),
  receivedDate: Date,
  receiptImage: {
    fileUrl: String,
    fileName: String,
    uploadDate: Date
  },
  createdBy: ObjectId (ref: 'User'),
  updatedBy: ObjectId (ref: 'User'),
  createdAt: Date,
  updatedAt: Date
}
```

### OtherExpense Schema
```javascript
{
  expenseId: String (unique, auto-generated),
  residence: ObjectId (ref: 'Residence'),
  category: String (enum: ['Office Supplies', 'Marketing', 'Legal', 'Consulting', 'Travel', 'Entertainment', 'Miscellaneous', 'Other']),
  amount: Number,
  description: String,
  expenseDate: Date,
  paymentStatus: String (enum: ['Pending', 'Paid', 'Overdue']),
  paymentMethod: String (enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal']),
  paidBy: ObjectId (ref: 'User'),
  paidDate: Date,
  receiptImage: {
    fileUrl: String,
    fileName: String,
    uploadDate: Date
  },
  createdBy: ObjectId (ref: 'User'),
  updatedBy: ObjectId (ref: 'User'),
  createdAt: Date,
  updatedAt: Date
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "field": "field_name", // Optional, for validation errors
  "message": "Detailed error message" // Optional
}
```

Common HTTP Status Codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

## Testing

Use the provided test script to verify the endpoints:

```bash
node test-other-income-expense-endpoints.js
```

## Integration with Existing Finance Module

These new endpoints integrate seamlessly with the existing finance module:

1. **Dashboard Integration**: Other income and expenses are included in financial summaries
2. **Reporting**: Data is available for income statements and balance sheets
3. **Audit Trail**: All operations are logged for audit purposes
4. **Role-Based Access**: Consistent with existing finance role permissions

## Security Features

1. **Authentication Required**: All endpoints require valid JWT tokens
2. **Role-Based Authorization**: Only admin and finance_admin roles can access
3. **Input Validation**: Comprehensive validation for all input fields
4. **Audit Logging**: All CRUD operations are logged
5. **Data Sanitization**: Input data is sanitized and validated 