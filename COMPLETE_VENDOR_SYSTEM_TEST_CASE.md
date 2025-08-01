# 🧪 COMPLETE VENDOR/SUPPLIER SYSTEM TEST CASE

## **📊 CURRENT BACKEND IMPLEMENTATION STATUS**

### **✅ IMPLEMENTED FEATURES**

#### **1. Vendor Management System**
- ✅ **Vendor Model** (`src/models/Vendor.js`) - Complete with all fields
- ✅ **Vendor Controller** (`src/controllers/vendorController.js`) - Full CRUD operations
- ✅ **Vendor Routes** (`src/routes/vendorRoutes.js`) - All endpoints
- ✅ **Chart of Accounts Integration** - Auto-creates AP accounts
- ✅ **Creditors/Debtors Endpoints** - For financial reporting

#### **2. Request System (Basic)**
- ✅ **Request Model** (`src/models/Request.js`) - Has quotation support
- ✅ **Request Controller** (`src/controllers/requestController.js`) - Basic CRUD
- ✅ **File Upload Support** - S3 integration for quotations

#### **3. Transaction System (Basic)**
- ✅ **Transaction Model** (`src/models/Transaction.js`) - Basic structure
- ✅ **TransactionEntry Model** (`src/models/TransactionEntry.js`) - Double-entry support

### **❌ MISSING FEATURES**

#### **1. Enhanced Request with Vendor Integration**
- ❌ **Vendor auto-fill in quotations**
- ❌ **Enhanced quotation workflow**
- ❌ **Quote selection and approval system**

#### **2. Finance Approval Workflow**
- ❌ **Finance approval endpoints**
- ❌ **Quote selection by finance**
- ❌ **Request status updates**

#### **3. Payment Processing**
- ❌ **Payment processing endpoints**
- ❌ **Automated double-entry transactions**
- ❌ **Payment method selection**

#### **4. Enhanced Quotation System**
- ❌ **EnhancedQuotation model** (referenced but not implemented)
- ❌ **Vendor integration in quotations**

---

## **🧪 COMPLETE TEST CASE WORKFLOW**

### **STEP 1: CREATE VENDOR**

```bash
# Test Case 1.1: Create Plumbing Vendor
curl -X POST https://alamait-backend.onrender.com/api/vendors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "businessName": "ABC Plumbing Services",
    "tradingName": "ABC Plumbing",
    "contactPerson": {
      "firstName": "John",
      "lastName": "Smith",
      "email": "john@abcplumbing.com",
      "phone": "+27 11 123 4567",
      "mobile": "+27 82 123 4567"
    },
    "businessAddress": {
      "street": "123 Main Street",
      "city": "Johannesburg",
      "state": "Gauteng",
      "postalCode": "2000",
      "country": "South Africa"
    },
    "category": "plumbing",
    "specializations": ["plumbing", "drainage", "water_heating"],
    "serviceAreas": ["Johannesburg", "Pretoria"],
    "creditLimit": 50000,
    "paymentTerms": 30,
    "notes": "Reliable plumbing services"
  }'
```

**Expected Response:**
```json
{
  "message": "Vendor created successfully",
  "vendor": {
    "_id": "vendor_id_here",
    "vendorCode": "V25001",
    "businessName": "ABC Plumbing Services",
    "chartOfAccountsCode": "2001",
    "expenseAccountCode": "5000",
    "status": "active",
    "currentBalance": 0,
    "createdAt": "2025-01-20T10:00:00.000Z"
  }
}
```

### **STEP 2: SEARCH VENDORS (for quotation system)**

```bash
# Test Case 2.1: Search for plumbing vendors
curl -X GET "https://alamait-backend.onrender.com/api/vendors/search?query=plumbing&category=plumbing&limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "vendors": [
    {
      "_id": "vendor_id_here",
      "vendorCode": "V25001",
      "businessName": "ABC Plumbing Services",
      "tradingName": "ABC Plumbing",
      "contactPerson": {
        "firstName": "John",
        "lastName": "Smith",
        "email": "john@abcplumbing.com",
        "phone": "+27 11 123 4567"
      },
      "category": "plumbing",
      "chartOfAccountsCode": "2001",
      "expenseAccountCode": "5000"
    }
  ],
  "total": 1
}
```

### **STEP 3: CREATE ENHANCED REQUEST WITH VENDOR QUOTATIONS**

```bash
# Test Case 3.1: Create request with vendor quotations
curl -X POST https://alamait-backend.onrender.com/api/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "title": "Plumbing Repair Request",
    "description": "Fix blocked drain in Unit 101",
    "type": "operational",
    "residence": "residence_id_here",
    "priority": "medium",
    "category": "maintenance",
    "department": "Maintenance",
    "requestedBy": "Admin User",
    "deliveryLocation": "Unit 101, St Kilda",
    "items": [
      {
        "description": "Fix blocked drain",
        "quantity": 1,
        "unitCost": 0,
        "totalCost": 0,
        "quotations": [
          {
            "provider": "ABC Plumbing Services",
            "amount": 500,
            "description": "Professional drain cleaning service",
            "vendorId": "vendor_id_here",
            "vendorCode": "V25001",
            "vendorName": "ABC Plumbing Services",
            "vendorContact": {
              "firstName": "John",
              "lastName": "Smith",
              "email": "john@abcplumbing.com",
              "phone": "+27 11 123 4567"
            },
            "isSelected": true,
            "isApproved": false
          },
          {
            "provider": "XYZ Plumbing",
            "amount": 450,
            "description": "Standard drain cleaning",
            "isSelected": false,
            "isApproved": false
          }
        ]
      },
      {
        "description": "Replace faucet",
        "quantity": 1,
        "unitCost": 200,
        "totalCost": 200,
        "quotations": []
      }
    ],
    "totalEstimatedCost": 700
  }'
```

**Expected Response:**
```json
{
  "message": "Request created successfully",
  "request": {
    "_id": "request_id_here",
    "title": "Plumbing Repair Request",
    "status": "pending",
    "financeStatus": "pending",
    "totalEstimatedCost": 700,
    "items": [
      {
        "description": "Fix blocked drain",
        "quantity": 1,
        "quotations": [
          {
            "provider": "ABC Plumbing Services",
            "amount": 500,
            "vendorId": "vendor_id_here",
            "isSelected": true
          }
        ]
      }
    ]
  }
}
```

### **STEP 4: FINANCE APPROVAL WORKFLOW**

**❌ MISSING ENDPOINT - NEEDS IMPLEMENTATION**

```bash
# Test Case 4.1: Finance approves request with quote selection
curl -X PUT https://alamait-backend.onrender.com/api/requests/request_id_here/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FINANCE_TOKEN" \
  -d '{
    "approved": true,
    "selectedQuotes": {
      "0": 0
    },
    "approvalNotes": "Approved ABC Plumbing quote",
    "approvedTotal": 500
  }'
```

**Expected Response (After Implementation):**
```json
{
  "message": "Request approved successfully",
  "request": {
    "_id": "request_id_here",
    "status": "approved",
    "financeStatus": "approved",
    "approvedTotal": 500,
    "approvedAt": "2025-01-20T10:30:00.000Z",
    "approvedBy": "finance_user_id"
  },
  "transaction": {
    "_id": "transaction_id_here",
    "description": "Plumbing Repair Request - ABC Plumbing Services",
    "entries": [
      {
        "account": "5000",
        "debit": 500,
        "credit": 0,
        "type": "expense"
      },
      {
        "account": "2001",
        "debit": 0,
        "credit": 500,
        "type": "liability"
      }
    ]
  }
}
```

### **STEP 5: PAYMENT PROCESSING**

**❌ MISSING ENDPOINT - NEEDS IMPLEMENTATION**

```bash
# Test Case 5.1: Process payment to vendor
curl -X POST https://alamait-backend.onrender.com/api/payments/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FINANCE_TOKEN" \
  -d '{
    "payments": [
      {
        "requestId": "request_id_here",
        "vendorId": "vendor_id_here",
        "amount": 500,
        "paymentMethod": "bank_transfer",
        "description": "Payment for plumbing repair"
      }
    ],
    "paymentDate": "2025-01-20T11:00:00.000Z"
  }'
```

**Expected Response (After Implementation):**
```json
{
  "message": "Payments processed successfully",
  "payments": [
    {
      "_id": "payment_id_here",
      "requestId": "request_id_here",
      "vendorId": "vendor_id_here",
      "amount": 500,
      "status": "completed"
    }
  ],
  "transaction": {
    "_id": "transaction_id_here",
    "description": "Payment to ABC Plumbing Services",
    "entries": [
      {
        "account": "2001",
        "debit": 500,
        "credit": 0,
        "type": "liability"
      },
      {
        "account": "1000",
        "debit": 0,
        "credit": 500,
        "type": "asset"
      }
    ]
  }
}
```

### **STEP 6: VERIFY VENDOR BALANCE**

```bash
# Test Case 6.1: Check vendor balance after payment
curl -X GET https://alamait-backend.onrender.com/api/vendors/vendor_id_here \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "_id": "vendor_id_here",
  "vendorCode": "V25001",
  "businessName": "ABC Plumbing Services",
  "currentBalance": 0,
  "creditLimit": 50000,
  "performance": {
    "totalOrders": 1,
    "completedOrders": 1,
    "averageResponseTime": 2.5
  }
}
```

---

## **🔧 BACKEND IMPLEMENTATION NEEDED**

### **1. Enhanced Request Controller Updates**

```javascript
// Add to src/controllers/requestController.js

// Finance approval endpoint
exports.approveRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { approved, selectedQuotes, approvalNotes, approvedTotal } = req.body;
        const user = req.user;

        const request = await Request.findById(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Update request status
        request.status = approved ? 'approved' : 'rejected';
        request.financeStatus = approved ? 'approved' : 'rejected';
        request.approvedTotal = approvedTotal;
        request.approvedAt = new Date();
        request.approvedBy = user._id;

        // Update selected quotes
        if (selectedQuotes) {
            Object.keys(selectedQuotes).forEach(itemIndex => {
                const quoteIndex = selectedQuotes[itemIndex];
                if (request.items[itemIndex] && request.items[itemIndex].quotations[quoteIndex]) {
                    request.items[itemIndex].quotations[quoteIndex].isSelected = true;
                    request.items[itemIndex].quotations[quoteIndex].isApproved = true;
                    request.items[itemIndex].quotations[quoteIndex].approvedBy = user._id;
                    request.items[itemIndex].quotations[quoteIndex].approvedAt = new Date();
                }
            });
        }

        await request.save();

        // Create double-entry transaction if approved
        if (approved) {
            const transaction = await createApprovalTransaction(request, user);
        }

        res.status(200).json({
            message: 'Request approved successfully',
            request,
            transaction
        });

    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ message: 'Error approving request' });
    }
};

// Payment processing endpoint
exports.processPayments = async (req, res) => {
    try {
        const { payments, paymentMethod, paymentDate } = req.body;
        const user = req.user;

        const processedPayments = [];
        const transactions = [];

        for (const payment of payments) {
            // Process each payment
            const processedPayment = await processSinglePayment(payment, user);
            processedPayments.push(processedPayment);

            // Create payment transaction
            const transaction = await createPaymentTransaction(payment, user);
            transactions.push(transaction);
        }

        res.status(200).json({
            message: 'Payments processed successfully',
            payments: processedPayments,
            transactions
        });

    } catch (error) {
        console.error('Error processing payments:', error);
        res.status(500).json({ message: 'Error processing payments' });
    }
};
```

### **2. Transaction Helper Functions**

```javascript
// Add to src/utils/transactionHelpers.js

const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Vendor = require('../models/Vendor');

exports.createApprovalTransaction = async (request, user) => {
    const entries = [];
    
    // Calculate total from selected quotes
    let totalAmount = 0;
    request.items.forEach(item => {
        const selectedQuote = item.quotations.find(q => q.isSelected);
        if (selectedQuote) {
            totalAmount += selectedQuote.amount;
        } else {
            totalAmount += (item.quantity * item.unitCost);
        }
    });

    // Create expense entry
    const expenseEntry = new TransactionEntry({
        account: request.items[0].quotations[0].expenseAccountCode,
        debit: totalAmount,
        credit: 0,
        type: 'expense'
    });
    await expenseEntry.save();
    entries.push(expenseEntry._id);

    // Create liability entry (Accounts Payable)
    const selectedQuote = request.items[0].quotations.find(q => q.isSelected);
    const vendor = await Vendor.findById(selectedQuote.vendorId);
    
    const liabilityEntry = new TransactionEntry({
        account: vendor.chartOfAccountsCode,
        debit: 0,
        credit: totalAmount,
        type: 'liability'
    });
    await liabilityEntry.save();
    entries.push(liabilityEntry._id);

    // Create transaction
    const transaction = new Transaction({
        date: new Date(),
        description: `${request.title} - ${vendor.businessName}`,
        reference: `REQ-${request._id}`,
        residence: request.residence,
        entries
    });

    return await transaction.save();
};

exports.createPaymentTransaction = async (payment, user) => {
    const vendor = await Vendor.findById(payment.vendorId);
    
    const entries = [];

    // Debit Accounts Payable (reduce liability)
    const liabilityEntry = new TransactionEntry({
        account: vendor.chartOfAccountsCode,
        debit: payment.amount,
        credit: 0,
        type: 'liability'
    });
    await liabilityEntry.save();
    entries.push(liabilityEntry._id);

    // Credit Bank Account (reduce asset)
    const bankEntry = new TransactionEntry({
        account: '1000', // Bank account code
        debit: 0,
        credit: payment.amount,
        type: 'asset'
    });
    await bankEntry.save();
    entries.push(bankEntry._id);

    // Create transaction
    const transaction = new Transaction({
        date: new Date(),
        description: `Payment to ${vendor.businessName}`,
        reference: `PAY-${payment._id}`,
        residence: payment.residence,
        entries
    });

    return await transaction.save();
};
```

### **3. Route Updates**

```javascript
// Add to src/routes/requestRoutes.js

// Finance approval route
router.put('/:id/approve', checkRole(['finance', 'finance_admin', 'finance_user']), requestController.approveRequest);

// Payment processing route
router.post('/payments/process', checkRole(['finance', 'finance_admin', 'finance_user']), requestController.processPayments);
```

---

## **📋 TESTING CHECKLIST**

### **✅ Ready to Test**
- [x] Vendor creation
- [x] Vendor search
- [x] Basic request creation
- [x] Creditors/Debtors endpoints

### **❌ Needs Implementation**
- [ ] Enhanced request with vendor quotations
- [ ] Finance approval workflow
- [ ] Payment processing
- [ ] Automated double-entry transactions
- [ ] Vendor balance updates

### **🧪 Test Scripts Needed**
- [ ] Complete workflow test script
- [ ] Vendor integration test
- [ ] Finance approval test
- [ ] Payment processing test
- [ ] Transaction verification test

---

## **🚀 NEXT STEPS**

1. **Implement missing endpoints** in `requestController.js`
2. **Create transaction helper functions**
3. **Add new routes** for finance approval and payments
4. **Test complete workflow** from vendor creation to payment
5. **Update frontend** to use new endpoints
6. **Add error handling** and validation
7. **Implement audit logging** for all transactions

The backend has a solid foundation with vendor management and basic request systems, but needs the enhanced quotation workflow and payment processing to complete the full vendor/supplier system! 🎯 