# Database Schema - Complete Documentation

## 📊 **Database Collections & Schemas**

### **1. Request Collection (`requests` - maintenance collection)**

#### **Core Request Schema**
```javascript
{
  _id: ObjectId,
  title: String (required),
  description: String (required),
  type: String (enum: ['maintenance', 'financial', 'operational']) (required),
  submittedBy: ObjectId (ref: 'User') (required),
  residence: ObjectId (ref: 'Residence') (required),
  
  // Student-specific fields
  room: String,
  category: String (enum: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other']),
  
  // Non-student fields
  department: String,
  requestedBy: String,
  items: [RequestItemSchema],
  totalEstimatedCost: Number,
  proposedVendor: String,
  deliveryLocation: String,
  
  // Common fields
  priority: String (enum: ['low', 'medium', 'high']) (default: 'medium'),
  status: String (enum: ['pending', 'assigned', 'in-progress', 'completed', 'rejected', 'waitlisted', 'pending-ceo-approval', 'pending-finance-approval', 'pending-admin-approval']),
  financeStatus: String (enum: ['pending', 'approved', 'rejected', 'waitlisted']),
  
  // Approval workflow
  approval: {
    admin: {
      approved: Boolean (default: false),
      approvedBy: ObjectId (ref: 'User'),
      approvedByEmail: String,
      approvedAt: Date,
      notes: String
    },
    finance: {
      approved: Boolean (default: false),
      approvedBy: ObjectId (ref: 'User'),
      approvedByEmail: String,
      approvedAt: Date,
      notes: String,
      rejected: Boolean (default: false),
      rejectedBy: ObjectId (ref: 'User'),
      rejectedAt: Date,
      waitlisted: Boolean (default: false),
      waitlistedBy: ObjectId (ref: 'User'),
      waitlistedAt: Date
    },
    ceo: {
      approved: Boolean (default: false),
      approvedBy: ObjectId (ref: 'User'),
      approvedByEmail: String,
      approvedAt: Date,
      notes: String
    }
  },
  
  // Assignment
  assignedTo: {
    _id: ObjectId (ref: 'User'),
    name: String,
    surname: String,
    role: String
  },
  
  // Quotations
  quotations: [QuotationSchema],
  
  // Financial integration
  convertedToExpense: Boolean (default: false),
  expenseId: ObjectId (ref: 'Expense'),
  amount: Number (min: 0, default: 0),
  
  // Media and updates
  images: [{
    url: String (required),
    caption: String,
    uploadedAt: Date
  }],
  updates: [{
    date: Date,
    message: String (required),
    author: ObjectId (ref: 'User')
  }],
  requestHistory: [{
    date: Date,
    action: String (required),
    user: ObjectId (ref: 'User'),
    changes: [String]
  }],
  
  createdAt: Date,
  updatedAt: Date
}
```

#### **Request Item Schema**
```javascript
{
  description: String (required),
  quantity: Number (required, min: 1),
  unitCost: Number (default: 0),
  totalCost: Number (default: 0),
  purpose: String,
  quotations: [QuotationSchema]
}
```

#### **Quotation Schema**
```javascript
{
  provider: String (required),
  amount: Number (required, min: 0),
  description: String,
  fileUrl: String,
  fileName: String,
  uploadedBy: ObjectId (ref: 'User') (required),
  uploadedAt: Date (default: Date.now),
  isApproved: Boolean (default: false),
  approvedBy: ObjectId (ref: 'User'),
  approvedAt: Date,
  
  // Vendor integration (auto-created)
  vendorId: ObjectId (ref: 'Vendor'),
  vendorCode: String,
  vendorName: String,
  vendorType: String,
  vendorContact: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String
  },
  expenseCategory: String,
  paymentMethod: String,
  hasBankDetails: Boolean
}
```

### **2. Vendor Collection (`vendors`)**

```javascript
{
  _id: ObjectId,
  vendorCode: String (required, unique),
  businessName: String (required),
  tradingName: String,
  
  // Contact Information
  contactPerson: {
    firstName: String (required),
    lastName: String (required),
    email: String (required),
    phone: String (required),
    mobile: String
  },
  
  // Business Address
  businessAddress: {
    street: String (required),
    city: String (required),
    state: String,
    postalCode: String,
    country: String (default: 'South Africa')
  },
  
  // Tax and Registration
  taxNumber: String,
  vatNumber: String,
  registrationNumber: String,
  
  // Chart of Accounts Integration
  chartOfAccountsCode: String (required),
  expenseAccountCode: String (required),
  
  // Banking Information
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountType: String,
    branchCode: String,
    swiftCode: String
  },
  
  // Business Classification
  category: String (enum: ['maintenance', 'utilities', 'supplies', 'equipment', 'services', 'cleaning', 'security', 'landscaping', 'electrical', 'plumbing', 'carpentry', 'painting', 'other']),
  
  // Auto-creation fields
  vendorType: String (enum: ['shop', 'contractor', 'service_provider', 'other']),
  businessScope: String,
  expenseCategory: String,
  defaultPaymentMethod: String (enum: ['Cash', 'Bank Transfer']),
  isAutoGenerated: Boolean (default: false),
  
  // Specializations and Service Areas
  specializations: [String],
  serviceAreas: [String],
  
  // Status and Rating
  status: String (enum: ['active', 'inactive', 'suspended', 'blacklisted']) (default: 'active'),
  rating: {
    average: Number (default: 0, min: 0, max: 5),
    totalReviews: Number (default: 0),
    lastReviewDate: Date
  },
  
  // Performance Metrics
  performance: {
    totalOrders: Number (default: 0),
    completedOrders: Number (default: 0),
    averageResponseTime: Number (default: 0),
    onTimeDelivery: Number (default: 0),
    qualityRating: Number (default: 0, min: 0, max: 5)
  },
  
  // Financial Information
  creditLimit: Number (default: 0),
  currentBalance: Number (default: 0),
  paymentTerms: Number (default: 30),
  
  // Documents
  documents: [{
    type: String (required),
    name: String (required),
    url: String (required),
    uploadedAt: Date,
    uploadedBy: ObjectId (ref: 'User')
  }],
  
  // Notes and Audit
  notes: String,
  createdBy: ObjectId (ref: 'User') (required),
  updatedBy: ObjectId (ref: 'User'),
  
  // History
  history: [{
    action: String (required),
    description: String,
    user: ObjectId (ref: 'User'),
    timestamp: Date,
    changes: [{
      field: String,
      oldValue: Mixed,
      newValue: Mixed
    }]
  }],
  
  createdAt: Date,
  updatedAt: Date
}
```

### **3. Expense Collection (`expenses`)**

```javascript
{
  _id: ObjectId,
  expenseId: String (required, unique),
  residence: ObjectId (ref: 'Residence') (required),
  category: String (enum: ['Maintenance', 'Utilities', 'Taxes', 'Insurance', 'Salaries', 'Supplies', 'Other']) (required),
  amount: Number (required),
  description: String (required),
  expenseDate: Date (required),
  paymentStatus: String (enum: ['Pending', 'Paid', 'Overdue']) (default: 'Pending'),
  period: String (enum: ['weekly', 'monthly']) (required),
  
  // Payment Information
  paymentMethod: String (enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal']),
  paymentIcon: String,
  
  // Request Integration
  maintenanceRequestId: ObjectId (ref: 'Maintenance'),
  
  // Payment Details
  paidBy: ObjectId (ref: 'User'),
  paidDate: Date,
  receiptImage: {
    fileUrl: String,
    fileName: String,
    uploadDate: Date
  },
  
  // Audit
  createdBy: ObjectId (ref: 'User') (required),
  updatedBy: ObjectId (ref: 'User'),
  
  createdAt: Date,
  updatedAt: Date
}
```

### **4. Transaction Collection (`transactions`)**

```javascript
{
  _id: ObjectId,
  transactionId: String (required, unique),
  date: Date (required),
  description: String (required),
  amount: Number (required),
  type: String (enum: ['income', 'expense', 'transfer', 'adjustment']) (required),
  category: String,
  reference: String,
  status: String (enum: ['pending', 'completed', 'cancelled']) (default: 'pending'),
  
  // Related entities
  expenseId: ObjectId (ref: 'Expense'),
  vendorId: ObjectId (ref: 'Vendor'),
  residenceId: ObjectId (ref: 'Residence'),
  
  // Audit
  createdBy: ObjectId (ref: 'User') (required),
  updatedBy: ObjectId (ref: 'User'),
  
  createdAt: Date,
  updatedAt: Date
}
```

### **5. Transaction Entry Collection (`transactionentries`)**

```javascript
{
  _id: ObjectId,
  transaction: ObjectId (ref: 'Transaction') (required),
  account: ObjectId (ref: 'Account') (required),
  debit: Number (default: 0),
  credit: Number (default: 0),
  type: String (enum: ['income', 'expense', 'other income', 'other expense', 'operating', 'investing', 'financing', 'asset', 'liability', 'equity']) (required)
}
```

### **6. Account Collection (`accounts`)**

```javascript
{
  _id: ObjectId,
  code: String (required, unique),
  name: String (required),
  type: String (enum: ['asset', 'liability', 'equity', 'income', 'expense']) (required),
  category: String,
  description: String,
  balance: Number (default: 0),
  isActive: Boolean (default: true),
  
  // Parent account relationship
  parentAccount: ObjectId (ref: 'Account'),
  
  createdAt: Date,
  updatedAt: Date
}
```

## 🔗 **Key Relationships & Indexes**

### **Indexes for Performance**
```javascript
// Request indexes
{ status: 1 }
{ type: 1 }
{ submittedBy: 1 }
{ residence: 1 }
{ createdAt: -1 }
{ priority: 1 }

// Vendor indexes
{ vendorCode: 1 }
{ businessName: 1 }
{ 'contactPerson.email': 1 }
{ category: 1 }
{ status: 1 }
{ chartOfAccountsCode: 1 }

// Expense indexes
{ expenseId: 1 }
{ residence: 1 }
{ category: 1 }
{ paymentStatus: 1 }
{ expenseDate: -1 }
{ period: 1 }

// Transaction indexes
{ transactionId: 1 }
{ date: -1 }
{ type: 1 }
{ status: 1 }

// Transaction Entry indexes
{ transaction: 1 }
{ account: 1 }
{ type: 1 }

// Account indexes
{ code: 1 }
{ type: 1 }
{ isActive: 1 }
```

### **Foreign Key Relationships**
- Request.submittedBy → User._id
- Request.residence → Residence._id
- Request.expenseId → Expense._id
- Request.quotations.vendorId → Vendor._id
- Expense.residence → Residence._id
- Expense.maintenanceRequestId → Maintenance._id
- Transaction.expenseId → Expense._id
- Transaction.vendorId → Vendor._id
- TransactionEntry.transaction → Transaction._id
- TransactionEntry.account → Account._id
- Vendor.chartOfAccountsCode → Account.code

## 📊 **Data Flow Relationships**

### **Request → Vendor → Expense → Transaction → TransactionEntry**
1. Request created with quotations
2. Vendors auto-created from quotation providers
3. Request approved and converted to expense
4. Expense payment creates transaction
5. Transaction creates transaction entries for double-entry bookkeeping

### **Chart of Accounts Integration**
- Each vendor gets unique AP account (200001, 200002, etc.)
- Expense categories map to specific expense accounts
- Payment methods determine cash/bank account debits
- All financial movements recorded in TransactionEntry collection

This schema provides the foundation for the complete request-to-payment flow with full financial integration and audit trail. 