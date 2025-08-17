# Maintenance Transaction Flow Guide

## Overview

This guide explains how double-entry transactions are created for maintenance requests, specifically for issues like "toilets blocked" and other maintenance problems.

## 🔄 **Complete Transaction Flow**

### **Phase 1: Maintenance Request Created**
- Student/Admin creates maintenance request
- Request is assigned to maintenance staff
- **No transactions created yet**

### **Phase 2: Finance Approval (Creates AP Liability)**
When finance approves the maintenance request:

```javascript
// Transaction Type: 'approval'
// Creates Accounts Payable (AP) liability

DEBIT:  Maintenance Expense Account (5099)  $500
CREDIT: Accounts Payable Account (2000)    $500

Description: "Maintenance Approval: Toilets blocked - Urgent plumbing repair needed"
Reference: "MAINT-{maintenanceId}"
```

**Purpose**: Records the approved liability but doesn't pay it yet.

### **Phase 3: Maintenance Completed (Records Actual Expense)**
When property manager marks maintenance as completed:

```javascript
// Transaction Type: 'completion'
// Records actual expense and payment

DEBIT:  Maintenance Expense Account (5099)  $500
CREDIT: Cash/Bank Account (1000)          $500

Description: "Maintenance Completion: Toilets blocked - Plumbing repair completed"
Reference: "MAINT-COMPLETE-{maintenanceId}"
```

**Purpose**: Records the actual expense and payment made.

## 📊 **Account Mapping for Different Maintenance Types**

### **Plumbing Issues (e.g., Toilets Blocked)**
```javascript
// Approval Transaction
DEBIT:  5099 (Maintenance & Repairs)     $amount
CREDIT: 2000 (Accounts Payable)          $amount

// Completion Transaction  
DEBIT:  5099 (Maintenance & Repairs)     $amount
CREDIT: 1000 (Cash/Bank)                 $amount
```

### **Electrical Issues**
```javascript
// Approval Transaction
DEBIT:  5099 (Maintenance & Repairs)     $amount
CREDIT: 2000 (Accounts Payable)          $amount

// Completion Transaction
DEBIT:  5099 (Maintenance & Repairs)     $amount
CREDIT: 1000 (Cash/Bank)                 $amount
```

### **HVAC Issues**
```javascript
// Approval Transaction
DEBIT:  5099 (Maintenance & Repairs)     $amount
CREDIT: 2000 (Accounts Payable)          $amount

// Completion Transaction
DEBIT:  5099 (Maintenance & Repairs)     $amount
CREDIT: 1000 (Cash/Bank)                 $amount
```

## 🔧 **Implementation Details**

### **1. Finance Approval Transaction Creation**

**Location**: `src/controllers/finance/maintenanceController.js`

```javascript
// When finance approves maintenance request
const txn = await Transaction.create({
    transactionId: transactionId,
    date: new Date(),
    description: `Maintenance Approval: ${maintenance.issue} - ${maintenance.description}`,
    reference: `MAINT-${maintenance._id}`,
    type: 'approval',
    createdBy: req.user._id
});

// Double-entry transaction entry
const transactionEntry = await TransactionEntry.create({
    entries: [
        {
            // DEBIT: Maintenance Expense Account
            accountCode: '5099',
            debit: approvalAmount,
            credit: 0,
            description: `Maintenance expense: ${maintenance.issue}`
        },
        {
            // CREDIT: Accounts Payable Account
            accountCode: '2000',
            debit: 0,
            credit: approvalAmount,
            description: `Accounts payable for maintenance: ${maintenance.issue}`
        }
    ]
});
```

### **2. Completion Transaction Creation**

**Location**: `src/controllers/property_manager/maintenanceController.js`

```javascript
// When maintenance is marked as completed
if (isBeingCompleted && maintenance.amount > 0) {
    const completionTxn = await Transaction.create({
        transactionId: transactionId,
        date: new Date(),
        description: `Maintenance Completion: ${maintenance.issue} - ${maintenance.description}`,
        reference: `MAINT-COMPLETE-${maintenance._id}`,
        type: 'completion',
        createdBy: req.user._id
    });

    // Double-entry transaction entry
    const completionEntry = await TransactionEntry.create({
        entries: [
            {
                // DEBIT: Maintenance Expense Account
                accountCode: '5099',
                debit: maintenance.amount,
                credit: 0,
                description: `Maintenance completion: ${maintenance.issue}`
            },
            {
                // CREDIT: Cash/Bank Account (payment made)
                accountCode: '1000',
                debit: 0,
                credit: maintenance.amount,
                description: `Payment for maintenance: ${maintenance.issue}`
            }
        ]
    });
}
```

## 📋 **Transaction Status Flow**

### **1. Pending → Approved**
- **Creates**: AP Liability Transaction
- **Status**: `pending-finance-approval` → `approved`
- **Transaction Type**: `approval`

### **2. Approved → Completed**
- **Creates**: Completion Transaction
- **Status**: `approved` → `completed`
- **Transaction Type**: `completion`

## 🎯 **Example: Toilets Blocked Maintenance**

### **Step 1: Request Created**
```javascript
{
    issue: "Toilets blocked",
    description: "Both toilets in room 101 are completely blocked",
    category: "plumbing",
    priority: "high",
    amount: 150,
    status: "pending"
}
```

### **Step 2: Finance Approval**
```javascript
// Transaction 1: AP Liability Created
{
    transactionId: "TXN000123",
    type: "approval",
    description: "Maintenance Approval: Toilets blocked - Both toilets in room 101 are completely blocked",
    reference: "MAINT-507f1f77bcf86cd799439011",
    entries: [
        { accountCode: "5099", debit: 150, credit: 0 },    // Maintenance Expense
        { accountCode: "2000", debit: 0, credit: 150 }     // Accounts Payable
    ]
}
```

### **Step 3: Maintenance Completed**
```javascript
// Transaction 2: Completion Recorded
{
    transactionId: "TXN000124",
    type: "completion",
    description: "Maintenance Completion: Toilets blocked - Plumbing repair completed",
    reference: "MAINT-COMPLETE-507f1f77bcf86cd799439011",
    entries: [
        { accountCode: "5099", debit: 150, credit: 0 },    // Maintenance Expense
        { accountCode: "1000", debit: 0, credit: 150 }     // Cash/Bank Payment
    ]
}
```

## 🔍 **Audit Trail**

Each transaction creation is logged in the audit trail:

```javascript
// Approval Audit Log
{
    action: "maintenance_approved_ap_created",
    collection: "Transaction",
    details: {
        source: "Maintenance",
        sourceId: maintenance._id,
        maintenanceIssue: "Toilets blocked",
        maintenanceAmount: 150,
        apAccount: "2000",
        maintenanceAccount: "5099"
    }
}

// Completion Audit Log
{
    action: "maintenance_completed_transaction_created",
    collection: "Transaction",
    details: {
        source: "Maintenance",
        sourceId: maintenance._id,
        maintenanceIssue: "Toilets blocked",
        maintenanceAmount: 150,
        expenseAccount: "5099",
        cashAccount: "1000"
    }
}
```

## 📊 **Financial Impact**

### **Before Approval**
- **No financial impact**
- Maintenance request exists but no transactions

### **After Approval**
- **AP Liability**: $150 (Accounts Payable increases)
- **Expense Recognition**: $150 (Maintenance Expense increases)
- **Net Effect**: No change to cash, but liability recorded

### **After Completion**
- **AP Liability**: $0 (Accounts Payable decreases)
- **Cash**: -$150 (Cash decreases)
- **Expense Recognition**: $150 (Maintenance Expense remains)
- **Net Effect**: Cash paid, liability cleared, expense recorded

## 🚀 **Benefits of This Approach**

1. **✅ Proper Double-Entry**: All transactions follow accounting principles
2. **✅ Liability Tracking**: AP liability is properly recorded and cleared
3. **✅ Audit Trail**: Complete audit trail for all financial transactions
4. **✅ Expense Recognition**: Maintenance expenses are properly categorized
5. **✅ Cash Flow Tracking**: Actual payments are recorded when work is completed
6. **✅ Compliance**: Follows standard accounting practices

## 🔧 **Configuration**

### **Default Account Codes**
- **Maintenance Expense**: `5099` (Maintenance & Repairs)
- **Accounts Payable**: `2000` (Accounts Payable)
- **Cash/Bank**: `1000` (Cash)

### **Transaction Types**
- **Approval**: `approval` (creates AP liability)
- **Completion**: `completion` (records actual expense and payment)

This system ensures that all maintenance expenses are properly tracked through the complete lifecycle from approval to completion, maintaining accurate financial records and audit trails. 