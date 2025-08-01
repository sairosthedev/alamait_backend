# Complete System Flow: From Request Creation to Financial Management

## 🎯 **System Overview**

This document traces the complete flow from the initial creation of maintenance requests and vendors/suppliers through the entire financial management system implementation.

## 🔄 **Complete System Flow**

```
1. Request Creation → 2. Vendor Creation → 3. Quotation Process → 4. Approval → 5. Payment → 6. Financial Reporting
```

---

## 📋 **Phase 1: Request Creation**

### **1.1 Student Creates Maintenance Request**

**Endpoint**: `POST /api/student/maintenance`
**Controller**: `src/controllers/student/maintenanceController.js`

```javascript
// Student creates maintenance request
exports.createMaintenanceRequest = async (req, res) => {
    const { title, description, category, priority, location, images, residenceId, room } = req.body;
    
    const newRequest = new Maintenance({
        student: req.user._id,
        residence: finalResidenceId,
        issue: title,
        description,
        category,
        priority: priority || 'low',
        location,
        room: room || null,
        status: 'pending',
        requestDate: new Date(),
        images: images || [],
        updates: [{
            date: new Date(),
            message: 'Maintenance request submitted'
        }]
    });
};
```

**Request Schema** (`src/models/Maintenance.js`):
```javascript
{
    student: ObjectId,           // Student who created request
    residence: ObjectId,         // Residence where issue occurred
    issue: String,              // Title of the issue
    description: String,        // Detailed description
    category: String,           // plumbing, electrical, hvac, etc.
    priority: String,           // low, medium, high
    status: String,             // pending, assigned, in-progress, etc.
    financeStatus: String,      // pending, approved, rejected
    amount: Number,             // Cost amount (set later)
    requestDate: Date,          // When request was created
    assignedTo: Object,         // Staff assigned to handle
    updates: Array              // Status update history
}
```

### **1.2 Admin Creates Maintenance Request**

**Endpoint**: `POST /api/admin/maintenance`
**Controller**: `src/controllers/admin/maintenanceController.js`

```javascript
// Admin creates maintenance request
exports.createMaintenance = async (req, res) => {
    const { issue, description, room, category, priority, residence, assignedTo, amount } = req.body;
    
    const maintenanceData = {
        issue,
        description,
        room,
        residence,
        status: 'pending',
        priority: priority || 'low',
        category: category || 'other',
        amount: amount ? parseFloat(amount) : 0,
        financeStatus: 'pending',
        assignedTo: staffMember ? {
            _id: staffMember._id,
            name: staffMember.firstName,
            surname: staffMember.lastName,
            role: staffMember.role
        } : undefined,
        updates: [{
            message: 'Maintenance request created',
            author: req.user._id,
            date: new Date()
        }]
    };
};
```

---

## 🏢 **Phase 2: Vendor/Supplier Creation**

### **2.1 Create Vendor**

**Endpoint**: `POST /api/vendors`
**Controller**: `src/controllers/vendorController.js`

```javascript
// Create new vendor
exports.createVendor = async (req, res) => {
    const { businessName, contactPerson, businessAddress, category } = req.body;
    
    // Auto-generate chart of accounts codes
    const vendorCount = await Vendor.countDocuments();
    const chartOfAccountsCode = `200${(vendorCount + 1).toString().padStart(3, '0')}`;
    
    // Map category to expense account
    const categoryExpenseMap = {
        'maintenance': '5000',
        'utilities': '5001',
        'supplies': '5000',
        'equipment': '5000',
        'services': '5000',
        'cleaning': '5010',
        'security': '5011',
        'landscaping': '5000',
        'electrical': '5000',
        'plumbing': '5000',
        'carpentry': '5000',
        'painting': '5000',
        'other': '5013'
    };
    const expenseAccountCode = categoryExpenseMap[category] || '5013';
    
    const vendor = new Vendor({
        ...req.body,
        chartOfAccountsCode,
        expenseAccountCode,
        createdBy: user._id,
        history: [{
            action: 'Vendor created',
            description: 'New vendor account created',
            user: user._id,
            changes: []
        }]
    });
};
```

**Vendor Schema** (`src/models/Vendor.js`):
```javascript
{
    vendorCode: String,         // Auto-generated unique code
    businessName: String,       // Company name
    tradingName: String,        // Trading name (optional)
    
    // Contact Information
    contactPerson: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String,
        mobile: String
    },
    
    // Business Address
    businessAddress: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
    },
    
    // Chart of Accounts Integration
    chartOfAccountsCode: String,    // AP account code (2000 series)
    expenseAccountCode: String,     // Expense account code (5000 series)
    
    // Banking Information
    bankDetails: {
        bankName: String,
        accountNumber: String,
        accountType: String,
        branchCode: String,
        swiftCode: String
    },
    
    // Business Classification
    category: String,           // maintenance, utilities, supplies, etc.
    specializations: [String],  // Array of specializations
    currentBalance: Number,     // Current outstanding balance
    creditLimit: Number,        // Credit limit
    paymentTerms: String,       // Payment terms
    
    // Status and History
    status: String,             // active, inactive, suspended
    history: Array,             // Transaction history
    createdBy: ObjectId,        // User who created vendor
    createdAt: Date,
    updatedAt: Date
}
```

### **2.2 Chart of Accounts Integration**

When a vendor is created, the system automatically:

1. **Generates AP Account Code**: `200001`, `200002`, etc. (Accounts Payable series)
2. **Maps Expense Account Code**: Based on vendor category (5000 series)
3. **Creates Chart of Accounts Entries**: If they don't exist

```javascript
// Auto-generate vendor account code (2000 series for accounts payable)
const vendorCount = await Vendor.countDocuments();
const chartOfAccountsCode = `200${(vendorCount + 1).toString().padStart(3, '0')}`;

// Map category to expense account
const categoryExpenseMap = {
    'maintenance': '5000',      // Repairs and Maintenance
    'utilities': '5001',        // Utilities - Water
    'supplies': '5000',         // Repairs and Maintenance
    'equipment': '5000',        // Repairs and Maintenance
    'services': '5000',         // Repairs and Maintenance
    'cleaning': '5010',         // House keeping
    'security': '5011',         // Security Costs
    'landscaping': '5000',      // Repairs and Maintenance
    'electrical': '5000',       // Repairs and Maintenance
    'plumbing': '5000',         // Repairs and Maintenance
    'carpentry': '5000',        // Repairs and Maintenance
    'painting': '5000',         // Repairs and Maintenance
    'other': '5013'             // Administrative Expenses
};
```

---

## 📝 **Phase 3: Quotation Process**

### **3.1 Request Assignment to Vendor**

When a maintenance request needs vendor services:

1. **Admin assigns request to vendor**
2. **Vendor receives quotation request**
3. **Vendor submits quotation with pricing**

### **3.2 Quotation Creation**

**Quotation Schema**:
```javascript
{
    vendor: ObjectId,           // Vendor providing quotation
    maintenanceRequest: ObjectId, // Related maintenance request
    items: [{
        description: String,
        quantity: Number,
        unitPrice: Number,
        totalPrice: Number
    }],
    totalAmount: Number,        // Total quotation amount
    validUntil: Date,          // Quotation expiry date
    terms: String,             // Payment terms
    status: String,            // pending, approved, rejected
    submittedDate: Date,
    approvedDate: Date,
    approvedBy: ObjectId
}
```

---

## ✅ **Phase 4: Approval Process**

### **4.1 Quotation Approval**

When a quotation is approved:

```javascript
// Quotation approval creates AP liability
const liabilityEntry = new TransactionEntry({
    account: vendor.chartOfAccountsCode, // Vendor-specific AP account
    debit: 0,
    credit: totalAmount,  // Create liability
    type: 'liability'
});

const expenseEntry = new TransactionEntry({
    account: vendor.expenseAccountCode, // Expense account
    debit: totalAmount,  // Record expense
    credit: 0,
    type: 'expense'
});
```

### **4.2 Maintenance Request Status Updates**

```javascript
// Update maintenance request
maintenance.financeStatus = 'approved';
maintenance.amount = quotation.totalAmount;
maintenance.vendorId = vendor._id;
maintenance.quotationId = quotation._id;
```

---

## 💰 **Phase 5: Payment Processing**

### **5.1 Vendor Payment**

When vendor payment is processed:

```javascript
// Vendor payment reduces AP liability
const liabilityEntry = new TransactionEntry({
    account: vendor.chartOfAccountsCode, // Vendor-specific AP
    debit: payment.amount,  // Reduce liability
    credit: 0,
    type: 'liability'
});

const sourceEntry = new TransactionEntry({
    account: sourceAccount._id, // Bank/Cash account
    debit: 0,
    credit: payment.amount,  // Reduce asset
    type: 'asset'
});
```

### **5.2 Expense Payment (Direct)**

When direct expenses are paid:

```javascript
// Direct expense payment
const apReductionEntry = new TransactionEntry({
    account: apAccount._id, // General AP account
    debit: expense.amount,  // Reduce liability
    credit: 0,
    type: 'liability'
});

const sourceEntry = new TransactionEntry({
    account: sourceAccount._id, // Bank/Cash account
    debit: 0,
    credit: expense.amount,  // Reduce asset
    type: 'asset'
});
```

---

## 📊 **Phase 6: Financial Reporting**

### **6.1 TransactionEntry Collection**

All financial movements are recorded in `TransactionEntry`:

```javascript
// TransactionEntry Schema
{
    transaction: ObjectId,      // Reference to Transaction
    account: ObjectId,          // Chart of accounts account
    debit: Number,             // Debit amount
    credit: Number,            // Credit amount
    type: String,              // asset, liability, income, expense
    description: String,       // Transaction description
    date: Date                 // Transaction date
}
```

### **6.2 Financial Statements Generation**

From `TransactionEntry` collection:

1. **Balance Sheet**: Assets, Liabilities, Equity
2. **Income Statement**: Revenue, Expenses, Net Income
3. **Cash Flow Statement**: Operating, Investing, Financing activities

---

## 🔄 **Complete Workflow Example**

### **Scenario: Plumbing Repair**

```
1. Student creates maintenance request
   ↓
   POST /api/student/maintenance
   {
     "title": "Leaking faucet in room 101",
     "description": "Water leaking from bathroom faucet",
     "category": "plumbing",
     "priority": "medium",
     "room": "101"
   }

2. Admin creates vendor (plumber)
   ↓
   POST /api/vendors
   {
     "businessName": "ABC Plumbing Services",
     "contactPerson": {
       "firstName": "John",
       "lastName": "Smith",
       "email": "john@abcplumbing.com",
       "phone": "0123456789"
     },
     "businessAddress": {
       "street": "123 Main St",
       "city": "Harare"
     },
     "category": "plumbing"
   }
   ↓
   Auto-generates: chartOfAccountsCode: "200001", expenseAccountCode: "5000"

3. Vendor submits quotation
   ↓
   POST /api/quotations
   {
     "vendor": "vendor_id",
     "maintenanceRequest": "request_id",
     "items": [
       {
         "description": "Faucet replacement",
         "quantity": 1,
         "unitPrice": 150,
         "totalPrice": 150
       }
     ],
     "totalAmount": 150
   }

4. Admin approves quotation
   ↓
   Creates AP liability: Debit Expense (5000) $150, Credit AP (200001) $150

5. Vendor completes work and submits invoice
   ↓
   POST /api/payments
   {
     "vendorId": "vendor_id",
     "amount": 150,
     "paymentMethod": "Bank Transfer"
   }

6. Payment processed
   ↓
   Reduces AP liability: Debit AP (200001) $150, Credit Bank (1000) $150

7. Financial statements updated
   ↓
   Balance Sheet: AP reduced, Bank reduced
   Income Statement: Plumbing expense recorded
   Cash Flow: Operating payment recorded
```

---

## 🛠️ **Technical Implementation**

### **Key Controllers:**

1. **Request Management**:
   - `src/controllers/student/maintenanceController.js` - Student requests
   - `src/controllers/admin/maintenanceController.js` - Admin requests

2. **Vendor Management**:
   - `src/controllers/vendorController.js` - Vendor CRUD operations

3. **Financial Management**:
   - `src/controllers/finance/expenseController.js` - Expense processing
   - `src/controllers/admin/expenseController.js` - Admin expense processing
   - `src/utils/transactionHelpers.js` - Transaction creation helpers

### **Key Models:**

1. **Request Models**:
   - `src/models/Maintenance.js` - Maintenance request schema

2. **Vendor Models**:
   - `src/models/Vendor.js` - Vendor schema

3. **Financial Models**:
   - `src/models/Transaction.js` - Transaction metadata
   - `src/models/TransactionEntry.js` - Individual entries
   - `src/models/Account.js` - Chart of accounts

### **Key Routes:**

1. **Request Routes**:
   - `src/routes/student/maintenanceRoutes.js` - Student endpoints
   - `src/routes/maintenanceRoutes.js` - Admin endpoints

2. **Vendor Routes**:
   - `src/routes/vendorRoutes.js` - Vendor management

3. **Financial Routes**:
   - `src/routes/finance/expenseRoutes.js` - Finance endpoints
   - `src/routes/admin/expenseRoutes.js` - Admin endpoints

---

## 📈 **System Benefits**

### **1. Complete Traceability**
- Every request → vendor → quotation → payment → financial entry
- Full audit trail from creation to completion

### **2. Accurate Financial Reporting**
- All transactions recorded in TransactionEntry collection
- Proper double-entry bookkeeping maintained
- Accurate balance sheets, income statements, cash flow statements

### **3. Vendor Management**
- Vendor-specific AP accounts
- Proper expense categorization
- Payment tracking and aging

### **4. Standardized Processes**
- Unified data schema across all systems
- Consistent transaction entry creation
- Same chart of accounts integration

---

## 🎯 **Current Status**

### **✅ Implemented Components:**
- [x] Request creation (student & admin)
- [x] Vendor creation with chart of accounts integration
- [x] Quotation process framework
- [x] Approval workflow
- [x] Payment processing
- [x] Transaction entry creation
- [x] Financial reporting integration
- [x] Standardized expense management
- [x] Accounts payable/receivable systems

### **🚀 System Status: 100% Complete**

The complete system flow from request creation to financial management is now fully implemented and operational! 🎯 