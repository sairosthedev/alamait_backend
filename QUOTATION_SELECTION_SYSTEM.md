# 🎯 **Quotation Selection System**

## 📋 **Overview**

The Quotation Selection System allows **admins** to select quotations for items and **finance users** to override those selections. This system provides complete audit trails and automatically updates item amounts based on selected quotations.

## 🔄 **Workflow**

```
1. Admin uploads multiple quotations for an item
2. Admin selects one quotation (others are automatically deselected)
3. Item amount is updated to match selected quotation
4. Finance can override admin's selection if needed
5. Complete audit trail is maintained
```

## 🏗️ **Database Schema Updates**

### **Quotation Schema Fields Added:**

```javascript
// Selection tracking
isSelected: Boolean,                    // Is this quotation selected?
selectedBy: ObjectId,                   // User who selected it
selectedAt: Date,                       // When it was selected
selectedByEmail: String,                // Email of user who selected it

// Deselection tracking
deselectedBy: ObjectId,                 // User who deselected it
deselectedAt: Date,                     // When it was deselected
deselectedByEmail: String,              // Email of user who deselected it

// Complete audit trail
selectionHistory: [{
    action: String,                     // 'selected' | 'deselected'
    user: ObjectId,                     // User who performed action
    userEmail: String,                  // User's email
    timestamp: Date,                    // When action occurred
    reason: String                      // Reason for action
}]
```

## 🔌 **API Endpoints**

### **1. Select Item Quotation (Admin Only)**
```javascript
POST /api/requests/:requestId/items/:itemIndex/quotations/:quotationIndex/select

// Request Body
{
    "reason": "Best value for money"    // Optional reason
}

// Response
{
    "message": "Quotation selected successfully",
    "request": { /* Updated request object */ },
    "selectedQuotation": {
        "provider": "Vendor A",
        "amount": 200,
        "selectedBy": "admin@alamait.com",
        "selectedAt": "2025-08-02T10:30:00.000Z"
    }
}
```

### **2. Select Request Quotation (Admin Only)**
```javascript
POST /api/requests/:requestId/quotations/:quotationIndex/select

// Request Body
{
    "reason": "Best quality option"     // Optional reason
}

// Response
{
    "message": "Quotation selected successfully",
    "request": { /* Updated request object */ },
    "selectedQuotation": {
        "provider": "Vendor A",
        "amount": 200,
        "selectedBy": "admin@alamait.com",
        "selectedAt": "2025-08-02T10:30:00.000Z"
    }
}
```

### **3. Override Quotation Selection (Finance Only)**
```javascript
POST /api/requests/:requestId/items/:itemIndex/quotations/:quotationIndex/override

// Request Body
{
    "reason": "Lower cost option preferred"  // Optional reason
}

// Response
{
    "message": "Quotation selection overridden successfully",
    "request": { /* Updated request object */ },
    "selectedQuotation": {
        "provider": "Vendor B",
        "amount": 180,
        "selectedBy": "finance@alamait.com",
        "selectedAt": "2025-08-02T11:00:00.000Z",
        "override": true
    }
}
```

## 🎯 **Features**

### **1. Automatic Amount Updates**
- ✅ **Item total cost** is updated to match selected quotation amount
- ✅ **Item unit cost** is recalculated (totalCost / quantity)
- ✅ **Request total estimated cost** is recalculated based on all selected quotations

### **2. Selection Management**
- ✅ **Only one quotation** can be selected per item
- ✅ **Automatic deselection** of other quotations when one is selected
- ✅ **Complete audit trail** of all selection changes

### **3. Role-Based Access**
- ✅ **Admin**: Can select quotations initially
- ✅ **Finance**: Can override admin selections
- ✅ **Audit trail**: Shows who made what changes and when

### **4. Audit Trail**
- ✅ **Selection history** for each quotation
- ✅ **User email tracking** for accountability
- ✅ **Timestamp tracking** for all actions
- ✅ **Reason tracking** for decision transparency

## 📊 **Example Data Flow**

### **Initial State:**
```javascript
{
    "items": [{
        "description": "Plumbing Repair",
        "quantity": 1,
        "unitCost": 200,
        "totalCost": 200,
        "quotations": [
            {
                "provider": "Vendor A",
                "amount": 200,
                "isSelected": false
            },
            {
                "provider": "Vendor B", 
                "amount": 180,
                "isSelected": false
            },
            {
                "provider": "Vendor C",
                "amount": 220,
                "isSelected": false
            }
        ]
    }],
    "totalEstimatedCost": 200
}
```

### **After Admin Selection:**
```javascript
{
    "items": [{
        "description": "Plumbing Repair",
        "quantity": 1,
        "unitCost": 200,
        "totalCost": 200,  // Updated to match selected quotation
        "quotations": [
            {
                "provider": "Vendor A",
                "amount": 200,
                "isSelected": true,
                "selectedBy": "admin@alamait.com",
                "selectedAt": "2025-08-02T10:30:00.000Z",
                "selectionHistory": [{
                    "action": "selected",
                    "userEmail": "admin@alamait.com",
                    "timestamp": "2025-08-02T10:30:00.000Z",
                    "reason": "Best value for money"
                }]
            },
            {
                "provider": "Vendor B",
                "amount": 180,
                "isSelected": false,
                "deselectedBy": "admin@alamait.com",
                "deselectedAt": "2025-08-02T10:30:00.000Z",
                "selectionHistory": [{
                    "action": "deselected",
                    "userEmail": "admin@alamait.com",
                    "timestamp": "2025-08-02T10:30:00.000Z",
                    "reason": "Deselected by admin when selecting quotation 1"
                }]
            },
            {
                "provider": "Vendor C",
                "amount": 220,
                "isSelected": false,
                "deselectedBy": "admin@alamait.com",
                "deselectedAt": "2025-08-02T10:30:00.000Z",
                "selectionHistory": [{
                    "action": "deselected",
                    "userEmail": "admin@alamait.com",
                    "timestamp": "2025-08-02T10:30:00.000Z",
                    "reason": "Deselected by admin when selecting quotation 1"
                }]
            }
        ]
    }],
    "totalEstimatedCost": 200  // Updated to match selected quotation
}
```

### **After Finance Override:**
```javascript
{
    "items": [{
        "description": "Plumbing Repair",
        "quantity": 1,
        "unitCost": 180,  // Updated to match new selected quotation
        "totalCost": 180, // Updated to match new selected quotation
        "quotations": [
            {
                "provider": "Vendor A",
                "amount": 200,
                "isSelected": false,
                "deselectedBy": "finance@alamait.com",
                "deselectedAt": "2025-08-02T11:00:00.000Z",
                "selectionHistory": [
                    {
                        "action": "selected",
                        "userEmail": "admin@alamait.com",
                        "timestamp": "2025-08-02T10:30:00.000Z",
                        "reason": "Best value for money"
                    },
                    {
                        "action": "deselected",
                        "userEmail": "finance@alamait.com",
                        "timestamp": "2025-08-02T11:00:00.000Z",
                        "reason": "Deselected by finance - Lower cost option preferred"
                    }
                ]
            },
            {
                "provider": "Vendor B",
                "amount": 180,
                "isSelected": true,
                "selectedBy": "finance@alamait.com",
                "selectedAt": "2025-08-02T11:00:00.000Z",
                "selectionHistory": [
                    {
                        "action": "deselected",
                        "userEmail": "admin@alamait.com",
                        "timestamp": "2025-08-02T10:30:00.000Z",
                        "reason": "Deselected by admin when selecting quotation 1"
                    },
                    {
                        "action": "selected",
                        "userEmail": "finance@alamait.com",
                        "timestamp": "2025-08-02T11:00:00.000Z",
                        "reason": "Lower cost option preferred"
                    }
                ]
            },
            {
                "provider": "Vendor C",
                "amount": 220,
                "isSelected": false,
                "selectionHistory": [
                    {
                        "action": "deselected",
                        "userEmail": "admin@alamait.com",
                        "timestamp": "2025-08-02T10:30:00.000Z",
                        "reason": "Deselected by admin when selecting quotation 1"
                    }
                ]
            }
        ]
    }],
    "totalEstimatedCost": 180  // Updated to match new selected quotation
}
```

## 🧪 **Testing**

### **Test Script:**
```bash
node test-quotation-selection.js
```

### **Test Flow:**
1. ✅ Create request with multiple quotations
2. ✅ Admin selects first quotation
3. ✅ Verify amount updates
4. ✅ Finance overrides to second quotation
5. ✅ Verify amount updates and audit trail

## 🎯 **Frontend Integration**

### **Quotation Selection UI:**
```javascript
// Example React component
const QuotationSelector = ({ quotations, onSelect, userRole }) => {
    return (
        <div className="quotation-selector">
            {quotations.map((quotation, index) => (
                <div key={index} className={`quotation-card ${quotation.isSelected ? 'selected' : ''}`}>
                    <h4>{quotation.provider}</h4>
                    <p>Amount: ${quotation.amount}</p>
                    <p>Description: {quotation.description}</p>
                    
                    {quotation.isSelected && (
                        <div className="selection-info">
                            <p>✅ Selected by: {quotation.selectedByEmail}</p>
                            <p>📅 Selected at: {quotation.selectedAt}</p>
                        </div>
                    )}
                    
                    {quotation.deselectedByEmail && (
                        <div className="deselection-info">
                            <p>❌ Deselected by: {quotation.deselectedByEmail}</p>
                            <p>📅 Deselected at: {quotation.deselectedAt}</p>
                        </div>
                    )}
                    
                    <button 
                        onClick={() => onSelect(index)}
                        disabled={quotation.isSelected}
                    >
                        {userRole === 'admin' ? 'Select Quotation' : 'Override Selection'}
                    </button>
                </div>
            ))}
        </div>
    );
};
```

### **API Calls:**
```javascript
// Admin selecting quotation
const selectQuotation = async (requestId, itemIndex, quotationIndex, reason) => {
    const response = await api.post(
        `/requests/${requestId}/items/${itemIndex}/quotations/${quotationIndex}/select`,
        { reason }
    );
    return response.data;
};

// Finance overriding selection
const overrideQuotation = async (requestId, itemIndex, quotationIndex, reason) => {
    const response = await api.post(
        `/requests/${requestId}/items/${itemIndex}/quotations/${quotationIndex}/override`,
        { reason }
    );
    return response.data;
};
```

## ✅ **Benefits**

1. **🎯 Clear Decision Making**: Only one quotation selected per item
2. **💰 Automatic Cost Updates**: Item amounts reflect selected quotations
3. **📊 Complete Audit Trail**: Full history of all selection changes
4. **👥 Role-Based Access**: Admins select, finance can override
5. **📈 Transparency**: All decisions tracked with reasons and timestamps
6. **🔄 Workflow Integration**: Seamlessly integrates with existing approval process

## 🚀 **Implementation Status**

- ✅ **Database Schema**: Updated with selection tracking fields
- ✅ **API Endpoints**: All selection endpoints implemented
- ✅ **Role-Based Access**: Admin and finance permissions enforced
- ✅ **Audit Trail**: Complete selection history tracking
- ✅ **Amount Updates**: Automatic cost recalculation
- ✅ **Test Script**: Comprehensive testing available

The Quotation Selection System is now fully implemented and ready for frontend integration! 🎉 