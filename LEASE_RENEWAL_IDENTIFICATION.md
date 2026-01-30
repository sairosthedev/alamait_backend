# 🔄 Lease Renewal Identification

## Overview

The system uses **multiple fields** to identify and track lease renewals. Here's how it works:

## 🔑 Key Fields for Identifying Renewals

### 1. **`requestType: 'renewal'`** (Primary Identifier)

**Location**: `Application` model  
**Type**: String enum  
**Values**: `['new', 'upgrade', 'renewal']`

This is the **main field** that indicates a lease is a renewal:

```javascript
// Application Schema
requestType: {
    type: String,
    enum: ['new', 'upgrade', 'renewal'], // 'renewal' marks it as a renewal
    required: true
}
```

**How it's set:**
- When a student re-applies (existing user), the system automatically sets `requestType = 'renewal'`
- See: `src/controllers/public/applicationController.js` line 161

```javascript
// If this is a re-application, link to existing user
if (isReapplication && existingUser) {
    applicationData.student = existingUser._id;
    applicationData.requestType = 'renewal'; // Mark as renewal for admin processing
}
```

### 2. **`isReapplication: true`** (Supporting Flag)

**Location**: `Application` model  
**Type**: Boolean  
**Default**: `false`

This flag indicates the application is a re-application (preserves financial history):

```javascript
isReapplication: {
    type: Boolean,
    default: false
}
```

**How it's set:**
- Automatically set to `true` when an existing user (by email) submits a new application
- See: `src/controllers/public/applicationController.js` lines 35-41

### 3. **`previousDebtorCode`** (Financial Link)

**Location**: `Application` model  
**Type**: String

Links to the previous debtor account to preserve financial history:

```javascript
previousDebtorCode: {
    type: String,
    trim: true
}
```

**How it's set:**
- Automatically populated when `isReapplication = true` and a previous debtor account is found
- Links the new application to the previous financial account

### 4. **`previousFinancialSummary`** (Financial History)

**Location**: `Application` model  
**Type**: Object

Stores previous financial information for reference:

```javascript
previousFinancialSummary: {
    debtorCode: String,
    previousBalance: Number,
    totalPaid: Number,
    totalOwed: Number,
    lastPaymentDate: Date,
    lastPaymentAmount: Number,
    transactionCount: Number,
    recentTransactions: [...]
}
```

## 📋 Complete Application Object for Renewal

When a lease renewal is created, the Application document looks like this:

```javascript
{
    // Basic Info
    applicationCode: "APP1234567890",
    email: "student@example.com",
    firstName: "John",
    lastName: "Doe",
    
    // RENEWAL IDENTIFIERS
    requestType: "renewal",           // ✅ Main identifier
    isReapplication: true,              // ✅ Supporting flag
    previousDebtorCode: "DR0001",      // ✅ Links to previous account
    previousFinancialSummary: {         // ✅ Previous financial data
        debtorCode: "DR0001",
        previousBalance: 300,
        totalPaid: 5000,
        totalOwed: 5300,
        // ...
    },
    
    // Lease Info
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "approved",
    // ...
}
```

## 🔍 How to Query for Renewals

### **Get All Renewal Applications**

```javascript
const renewals = await Application.find({
    requestType: 'renewal'
});
```

### **Get Renewals for a Specific Student**

```javascript
const studentRenewals = await Application.find({
    student: studentId,
    requestType: 'renewal'
});
```

### **Get Renewals with Previous Financial History**

```javascript
const renewalsWithHistory = await Application.find({
    requestType: 'renewal',
    isReapplication: true,
    previousDebtorCode: { $exists: true, $ne: null }
}).populate('student');
```

## 📊 Displaying Renewal Status

### **In API Responses**

The system includes renewal information in application responses:

```javascript
// Example API response
{
    "success": true,
    "application": {
        "applicationCode": "APP1234567890",
        "requestType": "renewal",        // ✅ Shows it's a renewal
        "isReapplication": true,          // ✅ Confirms re-application
        "previousDebtorCode": "DR0001",  // ✅ Previous account link
        "previousFinancialSummary": {    // ✅ Previous balance info
            "previousBalance": 300,
            "totalPaid": 5000,
            // ...
        },
        // ... other fields
    }
}
```

### **In Admin Interface**

Admins can see renewal status through:
- `requestType` field showing "renewal"
- `isReapplication` flag
- `previousDebtorCode` linking to previous account
- `previousFinancialSummary` showing previous balance

## 🔄 Renewal Flow

1. **Student Re-applies**
   - System detects existing user by email
   - Sets `isReapplication = true`
   - Finds previous debtor account
   - Sets `requestType = 'renewal'`
   - Populates `previousDebtorCode` and `previousFinancialSummary`

2. **Application Created**
   - Application document has `requestType: 'renewal'`
   - Links to previous financial account

3. **Lease Start Processing**
   - When `processLeaseStart()` runs, it uses the same debtor account
   - Previous balance ($300) is automatically included
   - New accruals are added to the same account

4. **Financial Continuity**
   - Same `accountCode` (e.g., "AR0001") is reused
   - Balance is cumulative: previous balance + new accruals - payments

## ✅ Summary

**To identify a lease renewal, check:**

1. ✅ **`requestType === 'renewal'`** - Primary identifier
2. ✅ **`isReapplication === true`** - Confirms it's a re-application
3. ✅ **`previousDebtorCode` exists** - Links to previous account
4. ✅ **`previousFinancialSummary` exists** - Contains previous balance info

**The main field that shows it's a renewal is `requestType: 'renewal'`**
