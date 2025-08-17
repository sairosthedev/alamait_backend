# 🔧 IMPLEMENTATION GUIDE: MISSING FEATURES

## **📋 CURRENT STATUS**

### **✅ COMPLETED**
- Vendor management system (full CRUD)
- Chart of Accounts integration
- Basic request system
- Creditors/Debtors endpoints
- File upload support

### **❌ MISSING (NEEDS IMPLEMENTATION)**
- Enhanced request with vendor quotations
- Finance approval workflow
- Payment processing
- Automated double-entry transactions

---

## **🚀 STEP-BY-STEP IMPLEMENTATION**

### **STEP 1: ENHANCE REQUEST MODEL**

**File:** `src/models/Request.js`

**Add vendor integration to quotations:**

```javascript
// Update the quotationSchema in Request.js
const quotationSchema = new mongoose.Schema({
    provider: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        trim: true
    },
    // ADD THESE NEW FIELDS:
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor'
    },
    vendorCode: {
        type: String,
        trim: true
    },
    vendorName: {
        type: String,
        trim: true
    },
    vendorContact: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String
    },
    expenseAccountCode: {
        type: String,
        trim: true
    },
    isSelected: {
        type: Boolean,
        default: false
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    // Existing fields...
    fileUrl: String,
    fileName: String,
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});
```

### **STEP 2: CREATE TRANSACTION HELPER FUNCTIONS**

**File:** `src/utils/transactionHelpers.js` (NEW FILE)

```javascript
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Vendor = require('../models/Vendor');
const Account = require('../models/Account');

// Create transaction when request is approved
exports.createApprovalTransaction = async (request, user) => {
    try {
        const entries = [];
        let totalAmount = 0;
        
        // Calculate total from selected quotes
        request.items.forEach(item => {
            const selectedQuote = item.quotations.find(q => q.isSelected);
            if (selectedQuote) {
                totalAmount += selectedQuote.amount;
            } else {
                totalAmount += (item.quantity * item.unitCost);
            }
        });

        // Get vendor from first selected quote
        const firstItem = request.items.find(item => 
            item.quotations.some(q => q.isSelected)
        );
        
        if (!firstItem) {
            throw new Error('No selected quotes found');
        }

        const selectedQuote = firstItem.quotations.find(q => q.isSelected);
        const vendor = await Vendor.findById(selectedQuote.vendorId);
        
        if (!vendor) {
            throw new Error('Vendor not found');
        }

        // Create expense entry
        const expenseEntry = new TransactionEntry({
            account: vendor.expenseAccountCode,
            debit: totalAmount,
            credit: 0,
            type: 'expense'
        });
        await expenseEntry.save();
        entries.push(expenseEntry._id);

        // Create liability entry (Accounts Payable)
        const liabilityEntry = new TransactionEntry({
            account: vendor.chartOfAccountsCode,
            debit: 0,
            credit: totalAmount,
            type: 'liability'
        });
        await liabilityEntry.save();
        entries.push(liabilityEntry._id);

        // Update vendor balance
        vendor.currentBalance += totalAmount;
        await vendor.save();

        // Create transaction
        const transaction = new Transaction({
            date: new Date(),
            description: `${request.title} - ${vendor.businessName}`,
            reference: `REQ-${request._id}`,
            residence: request.residence,
            entries
        });

        return await transaction.save();
    } catch (error) {
        console.error('Error creating approval transaction:', error);
        throw error;
    }
};

// Create transaction when payment is processed
exports.createPaymentTransaction = async (payment, user) => {
    try {
        const vendor = await Vendor.findById(payment.vendorId);
        if (!vendor) {
            throw new Error('Vendor not found');
        }

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
            account: '1000', // Bank account code - adjust as needed
            debit: 0,
            credit: payment.amount,
            type: 'asset'
        });
        await bankEntry.save();
        entries.push(bankEntry._id);

        // Update vendor balance
        vendor.currentBalance -= payment.amount;
        await vendor.save();

        // Create transaction
        const transaction = new Transaction({
            date: new Date(),
            description: `Payment to ${vendor.businessName}`,
            reference: `PAY-${payment._id}`,
            residence: payment.residence,
            entries
        });

        return await transaction.save();
    } catch (error) {
        console.error('Error creating payment transaction:', error);
        throw error;
    }
};
```

### **STEP 3: ADD FINANCE APPROVAL ENDPOINT**

**File:** `src/controllers/requestController.js`

**Add these functions:**

```javascript
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

        // Check if user has finance role
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can approve requests' });
        }

        // Update request status
        request.status = approved ? 'approved' : 'rejected';
        request.financeStatus = approved ? 'approved' : 'rejected';
        request.approvedTotal = approvedTotal;
        request.approvedAt = new Date();
        request.approvedBy = user._id;

        // Update selected quotes
        if (selectedQuotes && approved) {
            Object.keys(selectedQuotes).forEach(itemIndex => {
                const quoteIndex = selectedQuotes[itemIndex];
                if (request.items[itemIndex] && request.items[itemIndex].quotations[quoteIndex]) {
                    // Reset all quotes to not selected
                    request.items[itemIndex].quotations.forEach(q => {
                        q.isSelected = false;
                        q.isApproved = false;
                    });
                    
                    // Set the selected quote
                    request.items[itemIndex].quotations[quoteIndex].isSelected = true;
                    request.items[itemIndex].quotations[quoteIndex].isApproved = true;
                    request.items[itemIndex].quotations[quoteIndex].approvedBy = user._id;
                    request.items[itemIndex].quotations[quoteIndex].approvedAt = new Date();
                }
            });
        }

        await request.save();

        let transaction = null;
        
        // Create double-entry transaction if approved
        if (approved) {
            const { createApprovalTransaction } = require('../utils/transactionHelpers');
            transaction = await createApprovalTransaction(request, user);
        }

        res.status(200).json({
            message: `Request ${approved ? 'approved' : 'rejected'} successfully`,
            request,
            transaction
        });

    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ 
            message: 'Error approving request',
            error: error.message 
        });
    }
};

// Payment processing endpoint
exports.processPayments = async (req, res) => {
    try {
        const { payments, paymentMethod, paymentDate } = req.body;
        const user = req.user;

        // Check if user has finance role
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can process payments' });
        }

        const processedPayments = [];
        const transactions = [];

        for (const payment of payments) {
            try {
                // Validate payment data
                if (!payment.requestId || !payment.vendorId || !payment.amount) {
                    throw new Error('Missing required payment fields');
                }

                // Get the request to validate
                const request = await Request.findById(payment.requestId);
                if (!request) {
                    throw new Error(`Request ${payment.requestId} not found`);
                }

                if (request.status !== 'approved') {
                    throw new Error(`Request ${payment.requestId} is not approved`);
                }

                // Process payment
                const { createPaymentTransaction } = require('../utils/transactionHelpers');
                const transaction = await createPaymentTransaction(payment, user);
                
                processedPayments.push({
                    _id: payment._id || new mongoose.Types.ObjectId(),
                    requestId: payment.requestId,
                    vendorId: payment.vendorId,
                    amount: payment.amount,
                    paymentMethod,
                    paymentDate: paymentDate || new Date(),
                    status: 'completed',
                    processedBy: user._id,
                    processedAt: new Date()
                });
                
                transactions.push(transaction);
                
            } catch (paymentError) {
                console.error(`Error processing payment:`, paymentError);
                processedPayments.push({
                    _id: payment._id || new mongoose.Types.ObjectId(),
                    requestId: payment.requestId,
                    vendorId: payment.vendorId,
                    amount: payment.amount,
                    status: 'failed',
                    error: paymentError.message
                });
            }
        }

        res.status(200).json({
            message: 'Payments processed',
            payments: processedPayments,
            transactions,
            summary: {
                total: payments.length,
                successful: processedPayments.filter(p => p.status === 'completed').length,
                failed: processedPayments.filter(p => p.status === 'failed').length
            }
        });

    } catch (error) {
        console.error('Error processing payments:', error);
        res.status(500).json({ 
            message: 'Error processing payments',
            error: error.message 
        });
    }
};
```

### **STEP 4: ADD NEW ROUTES**

**File:** `src/routes/requestRoutes.js`

**Add these routes:**

```javascript
// Finance approval route
router.put('/:id/approve', 
    auth, 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    requestController.approveRequest
);

// Payment processing route
router.post('/payments/process', 
    auth, 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    requestController.processPayments
);
```

### **STEP 5: UPDATE REQUEST CREATION TO SUPPORT VENDOR INTEGRATION**

**File:** `src/controllers/requestController.js`

**Update the createRequest function to handle vendor data:**

```javascript
// In the createRequest function, add this logic for quotations:

// Handle quotations with vendor integration
if (item.quotations && Array.isArray(item.quotations)) {
    for (let j = 0; j < item.quotations.length; j++) {
        const quotation = item.quotations[j];
        
        // If vendorId is provided, fetch vendor details
        if (quotation.vendorId) {
            const vendor = await Vendor.findById(quotation.vendorId);
            if (vendor) {
                quotation.vendorCode = vendor.vendorCode;
                quotation.vendorName = vendor.businessName;
                quotation.vendorContact = vendor.contactPerson;
                quotation.expenseAccountCode = vendor.expenseAccountCode;
            }
        }
        
        // Handle file uploads (existing code)
        const uploadedFile = req.files ? req.files.find(file => 
            file.fieldname === `items[${i}].quotations[${j}].file` ||
            file.fieldname === `quotation_${i}_${j}`
        ) : null;
        
        if (uploadedFile) {
            // ... existing file upload logic
        }
    }
}
```

---

## **🧪 TESTING THE IMPLEMENTATION**

### **1. Test Finance Approval**

```bash
# After implementing the approval endpoint
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

### **2. Test Payment Processing**

```bash
# After implementing the payment endpoint
curl -X POST https://alamait-backend.onrender.com/api/requests/payments/process \
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

---

## **📋 IMPLEMENTATION CHECKLIST**

### **Phase 1: Model Updates**
- [ ] Update Request model with vendor fields in quotations
- [ ] Add vendor integration fields to quotationSchema
- [ ] Test model validation

### **Phase 2: Helper Functions**
- [ ] Create transactionHelpers.js
- [ ] Implement createApprovalTransaction
- [ ] Implement createPaymentTransaction
- [ ] Test transaction creation

### **Phase 3: Controller Updates**
- [ ] Add approveRequest function
- [ ] Add processPayments function
- [ ] Update createRequest for vendor integration
- [ ] Test all endpoints

### **Phase 4: Routes**
- [ ] Add finance approval route
- [ ] Add payment processing route
- [ ] Test route access and permissions

### **Phase 5: Integration Testing**
- [ ] Test complete workflow
- [ ] Verify vendor balance updates
- [ ] Check transaction entries
- [ ] Validate double-entry accounting

---

## **🎯 EXPECTED RESULTS**

After implementation, you should be able to:

1. **Create requests with vendor quotations** ✅
2. **Finance users can approve requests** ✅
3. **Automated double-entry transactions** ✅
4. **Process payments to vendors** ✅
5. **Vendor balances update automatically** ✅
6. **Complete audit trail** ✅

The system will provide a complete vendor/supplier management workflow with integrated accounting! 🚀 