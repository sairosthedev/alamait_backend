# Vendor/Supplier Management System

## Overview

The system has been transformed from a simple staff management system to a comprehensive vendor/supplier management system with full chart of accounts integration and double-entry bookkeeping.

## 🎯 Key Features

### **1. Vendor/Supplier Management**
- **Replace "Add Staff"** with "Add Vendor/Supplier"
- **Complete vendor profiles** with business details, contact information, and banking details
- **Auto-code generation** for chart of accounts integration
- **Category-based classification** (maintenance, utilities, supplies, etc.)

### **2. Enhanced Quotation System**
- **Auto-fill vendor data** from chart of accounts
- **Auto-add new vendors** when quotations are submitted
- **Admin selection** of preferred quotations
- **Finance approval** with quote selection capabilities

### **3. Chart of Accounts Integration**
- **Automatic account creation** for new vendors
- **Double-entry bookkeeping** when quotations are approved
- **Payment method integration** with chart of accounts
- **Supplier accounts** and expense accounts

### **4. Double-Entry Bookkeeping**
- **Automatic transaction entries** when quotations are approved
- **Payment method integration** with chart of accounts
- **Supplier accounts** and expense accounts

## 🎯 System Architecture

### **📋 Vendor Schema (`src/models/Vendor.js`)**

#### **Basic Information**
```javascript
{
  vendorCode: "V25001", // Auto-generated
  businessName: "ABC Plumbing Services",
  tradingName: "ABC Plumbing",
  category: "plumbing"
}
```

#### **Contact Information**
```javascript
{
  contactPerson: {
    firstName: "John",
    lastName: "Smith",
    email: "john@abcplumbing.com",
    phone: "+27 11 123 4567"
  },
  businessAddress: {
    street: "123 Main Street",
    city: "Johannesburg",
    country: "South Africa"
  }
}
```

#### **Chart of Accounts Integration**
```javascript
{
  chartOfAccountsCode: "2001", // Accounts Payable
  expenseAccountCode: "5000",  // Repairs and Maintenance
  bankDetails: {
    bankName: "Standard Bank",
    accountNumber: "1234567890",
    branchCode: "051001"
  }
}
```

### **📋 Enhanced Quotation Schema (`src/models/EnhancedQuotation.js`)**

#### **Vendor Integration**
```javascript
{
  vendor: {
    vendorId: "ObjectId",
    vendorCode: "V25001",
    businessName: "ABC Plumbing Services",
    contactPerson: { /* vendor contact details */ },
    category: "plumbing"
  },
  quotationNumber: "QT25010001", // Auto-generated
  amount: 1500,
  totalAmount: 1710, // Including VAT
  expenseAccountCode: "5000",
  vendorAccountCode: "2001"
}
```

#### **Approval Tracking**
```javascript
{
  isAdminSelected: true,    // Admin's preferred choice
  isFinanceSelected: true,  // Finance's approved choice
  isApproved: true,         // Final approval status
  adminSelectedBy: "ObjectId",
  financeSelectedBy: "ObjectId",
  approvedBy: "ObjectId"
}
```

## 🎯 Workflow

### **1. Vendor Creation**
```
Admin/Finance → Create Vendor → Auto-generate Chart of Accounts Codes → Vendor Added
```

### **2. Quotation Submission**
```
Admin → Search/Select Vendor → Submit Quotation → Auto-fill Vendor Data → Quotation Created
```

### **3. Admin Selection**
```
Admin → Review Quotations → Select Preferred Quotation → Mark as Admin Selected
```

### **4. Finance Approval**
```
Finance → Review Quotations → Select Different Quotation (if needed) → Approve → Auto-create Transactions
```

### **5. Payment Processing**
```
Finance → Set Payment Method → Create Double-Entry Transactions → Update Vendor Balance
```

## 🎯 API Endpoints

### **Vendor Management**

#### **Create Vendor**
```http
POST /api/vendors
Content-Type: application/json

{
  "businessName": "ABC Plumbing Services",
  "contactPerson": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@abcplumbing.com",
    "phone": "+27 11 123 4567"
  },
  "businessAddress": {
    "street": "123 Main Street",
    "city": "Johannesburg"
  },
  "category": "plumbing"
}
```

#### **Search Vendors**
```http
GET /api/vendors/search?query=plumbing&category=plumbing&limit=10
```

#### **Get Vendors by Category**
```http
GET /api/vendors/category/plumbing
```

### **Enhanced Quotations**

#### **Create Quotation**
```http
POST /api/enhanced-quotations
Content-Type: application/json

{
  "vendorId": "vendor_object_id",
  "title": "Plumbing Repair - Blocked Drain",
  "description": "Repair blocked drain in Unit 101",
  "amount": 1500,
  "vatAmount": 210,
  "validFrom": "2025-01-15T00:00:00.000Z",
  "validUntil": "2025-02-15T00:00:00.000Z"
}
```

#### **Select Quotation (Admin)**
```http
PATCH /api/enhanced-quotations/:id/select-admin
Content-Type: application/json

{
  "notes": "Best price and quality"
}
```

#### **Select Quotation (Finance)**
```http
PATCH /api/enhanced-quotations/:id/select-finance
Content-Type: application/json

{
  "notes": "Approved for payment",
  "paymentMethod": "Bank Transfer"
}
```

## 🎯 Chart of Accounts Integration

### **Automatic Account Creation**

#### **Vendor Account (Liability)**
```javascript
{
  code: "2001",
  name: "Accounts Payable - ABC Plumbing Services",
  type: "Liability"
}
```

#### **Expense Account**
```javascript
{
  code: "5000",
  name: "Repairs and Maintenance",
  type: "Expense"
}
```

### **Double-Entry Transactions**

#### **When Quotation is Approved**
```javascript
// Transaction 1: Debit Expense, Credit Accounts Payable
{
  date: "2025-01-15",
  description: "Plumbing repair - ABC Plumbing",
  entries: [
    {
      accountCode: "5000", // Repairs and Maintenance
      debit: 1710,
      credit: 0
    },
    {
      accountCode: "2001", // Accounts Payable - ABC Plumbing
      debit: 0,
      credit: 1710
    }
  ]
}
```

#### **When Payment is Made**
```javascript
// Transaction 2: Debit Accounts Payable, Credit Bank
{
  date: "2025-01-20",
  description: "Payment to ABC Plumbing",
  entries: [
    {
      accountCode: "2001", // Accounts Payable - ABC Plumbing
      debit: 1710,
      credit: 0
    },
    {
      accountCode: "1000", // Bank - Main Account
      debit: 0,
      credit: 1710
    }
  ]
}
```

## 🎯 Frontend Integration

### **Vendor Search (Auto-complete)**
```javascript
// Search vendors as admin types
const searchVendors = async (query) => {
  const response = await fetch(`/api/vendors/search?query=${query}`);
  const vendors = await response.json();
  return vendors;
};

// Auto-fill vendor data when selected
const selectVendor = (vendor) => {
  setQuotationData({
    ...quotationData,
    vendorId: vendor._id,
    vendorCode: vendor.vendorCode,
    businessName: vendor.businessName,
    contactPerson: vendor.contactPerson,
    category: vendor.category,
    expenseAccountCode: vendor.expenseAccountCode
  });
};
```

### **Quotation Management**
```javascript
// Admin selects preferred quotation
const selectQuotation = async (quotationId) => {
  await fetch(`/api/enhanced-quotations/${quotationId}/select-admin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'Selected as preferred' })
  });
};

// Finance approves quotation
const approveQuotation = async (quotationId, paymentMethod) => {
  await fetch(`/api/enhanced-quotations/${quotationId}/select-finance`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      notes: 'Approved for payment',
      paymentMethod: paymentMethod
    })
  });
};
```

## 🎯 Benefits

### **✅ Automation**
- **Auto-fill vendor data** from chart of accounts
- **Auto-create accounts** for new vendors
- **Auto-generate transaction entries** for approvals

### **✅ Financial Integration**
- **Seamless chart of accounts** integration
- **Double-entry bookkeeping** compliance
- **Payment method tracking** with accounts

### **✅ Audit Trail**
- **Complete history** of vendor interactions
- **Quotation approval tracking** (admin vs finance)
- **Transaction audit trail** for all payments

### **✅ Vendor Management**
- **Comprehensive vendor profiles** with all necessary details
- **Performance tracking** and rating system
- **Document management** for vendor files

## 🎯 Migration from Staff System

### **Current Staff Data**
- **Maintenance Staff** → **Vendors** (with enhanced details)
- **Staff Specializations** → **Vendor Categories**
- **Staff Contact Info** → **Vendor Contact Information**

### **New Features Added**
- **Chart of accounts integration**
- **Enhanced quotation system**
- **Double-entry bookkeeping**
- **Payment method management**
- **Vendor performance tracking**

The vendor/supplier system provides a complete solution for managing external service providers with full financial integration! 🎉 