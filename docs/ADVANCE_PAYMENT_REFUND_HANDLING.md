# Advance Payment Refund Handling

## Overview

This document explains how the system handles refunds for advance payments made for future leases that get cancelled.

## Scenario

**Example:**
- **January**: Kudzai pays $100 for a lease starting in February
- **January 30**: Kudzai cancels and receives a refund of $100
- **January**: Tamia pays $100 for a lease starting in February  
- **February**: Tamia cancels and receives a refund of $100

Both transactions are recorded and kept for audit purposes, even though refunds occur in different months than the original payments.

## Accounting Treatment

### Original Advance Payment (January)

When a student pays in advance for a future lease:

```
Dr. Cash                    $100
    Cr. Deferred Income      $100
```

**Transaction Entry:**
- Account Code: `1000` (Cash) - Debit $100
- Account Code: `2200` (Advance Payments Liability) - Credit $100
- Source: `advance_payment`
- Metadata: `{ type: 'advance_payment', intendedLeaseStartMonth: '2026-02' }`

### Refund Transaction (January 30 or February)

When the advance payment is refunded:

```
Dr. Deferred Income         $100
    Cr. Cash                 $100
```

**Transaction Entry:**
- Account Code: `2200` (Advance Payments Liability) - Debit $100
- Account Code: `1000` (Cash) or `1001` (Bank) - Credit $100
- Source: `refund`
- Metadata: `{ type: 'refund', originalPaymentId: '...', isAdvancePaymentRefund: true }`

## Implementation

### 1. Creating a Refund

**Endpoint:** `POST /api/finance/refunds`

**Request Body:**
```json
{
  "paymentId": "PAY123456",
  "studentId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "amount": 100,
  "reason": "Cancelled lease - student not coming",
  "method": "Bank Transfer",
  "reference": "REF-2026-001",
  "date": "2026-01-30",
  "createTransaction": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Refund created and transaction recorded",
  "refund": {
    "_id": "...",
    "amount": 100,
    "status": "Processed",
    "reason": "Cancelled lease - student not coming"
  },
  "transaction": {
    "transactionId": "TXN1770633261360XAI2B",
    "transactionEntryId": "...",
    "isAdvancePaymentRefund": true
  }
}
```

### 2. Automatic Transaction Creation

By default, when a refund is created (`createTransaction: true`), the system:

1. **Identifies the refund type:**
   - Checks if the original payment was an advance payment
   - Looks for deferred income entries in the original transaction
   - Checks if payment was for a future month

2. **Creates appropriate accounting entries:**
   - **Advance Payment Refund:** Reverses deferred income (liability)
   - **Regular Refund:** Reverses accounts receivable or income

3. **Links everything together:**
   - Links refund to original payment
   - Links refund to transaction
   - Stores metadata for audit trail

### 3. Manual Transaction Creation

If `createTransaction: false`, you can create the transaction later:

**Endpoint:** `POST /api/finance/refunds/:refundId/process`

This will create the accounting transaction for an existing refund record.

## Key Features

### ✅ Audit Trail

- Original payment transaction is preserved
- Refund transaction references original payment
- Both transactions are linked via metadata
- Full history is maintained for compliance

### ✅ Cross-Month Handling

- Refunds can occur in different months than payments
- Each transaction is dated correctly
- Cash flow statements reflect transactions in their respective months

### ✅ Automatic Detection

- System automatically detects advance payments
- Identifies deferred income accounts
- Creates appropriate reversal entries

### ✅ Multiple Refund Methods

- Supports Cash, Bank Transfer, Ecocash, Innbucks
- Uses appropriate cash/bank account for refund
- Tracks refund method in transaction metadata

## Cash Flow Impact

### January Cash Flow
- **Cash Inflow:** +$100 (Kudzai's payment)
- **Cash Outflow:** -$100 (Kudzai's refund)
- **Net:** $0

### February Cash Flow
- **Cash Inflow:** $0 (Tamia paid in January)
- **Cash Outflow:** -$100 (Tamia's refund)
- **Net:** -$100

Both transactions appear in their respective months' cash flow statements, providing accurate monthly reporting.

## Database Schema

### Refund Model
```javascript
{
  payment: ObjectId,        // Reference to original payment
  student: ObjectId,        // Student/User ID
  amount: Number,           // Refund amount
  reason: String,           // Reason for refund
  method: String,           // Refund method (Bank Transfer, Cash, etc.)
  status: String,           // Pending, Processed, Failed
  transactionId: String,    // Link to transaction entry
  reference: String,       // External reference number
  processedAt: Date,      // When refund was processed
  createdBy: ObjectId,     // User who created refund
  updatedBy: ObjectId      // User who last updated
}
```

### Transaction Entry Metadata
```javascript
{
  type: 'refund',
  originalPaymentId: ObjectId,
  originalPaymentDate: Date,
  refundDate: Date,
  refundMethod: String,
  reason: String,
  isAdvancePaymentRefund: Boolean,
  originalPaymentMonth: String  // e.g., "2026-02"
}
```

## Usage Examples

### Example 1: Kudzai's Refund (Same Month)

```javascript
// January: Payment received
POST /api/admin/payments
{
  "studentId": "kudzai_id",
  "amount": 100,
  "paymentMonth": "2026-02",
  "date": "2026-01-15"
}
// Creates: DR Cash $100, CR Deferred Income $100

// January 30: Refund issued
POST /api/finance/refunds
{
  "paymentId": "PAY123",
  "studentId": "kudzai_id",
  "amount": 100,
  "reason": "Cancelled - not coming",
  "date": "2026-01-30",
  "method": "Bank Transfer"
}
// Creates: DR Deferred Income $100, CR Bank $100
```

### Example 2: Tamia's Refund (Different Month)

```javascript
// January: Payment received
POST /api/admin/payments
{
  "studentId": "tamia_id",
  "amount": 100,
  "paymentMonth": "2026-02",
  "date": "2026-01-20"
}
// Creates: DR Cash $100, CR Deferred Income $100

// February: Refund issued
POST /api/finance/refunds
{
  "paymentId": "PAY124",
  "studentId": "tamia_id",
  "amount": 100,
  "reason": "Cancelled - not coming",
  "date": "2026-02-05",
  "method": "Cash"
}
// Creates: DR Deferred Income $100, CR Cash $100
```

## Reporting

### Cash Flow Statement
- January: Shows both payment (+$100) and refund (-$100) for Kudzai
- February: Shows refund (-$100) for Tamia

### Balance Sheet
- Deferred Income account reflects net advance payments (after refunds)
- Cash accounts reflect actual cash position

### Transaction History
- Both original payment and refund transactions are visible
- Linked via `originalPaymentId` in refund metadata
- Full audit trail maintained

## Best Practices

1. **Always provide a reason** for refunds for audit purposes
2. **Use accurate dates** - refund date determines which month it appears in cash flow
3. **Link to original payment** - system does this automatically
4. **Review before processing** - check refund amount matches original payment
5. **Keep external references** - store bank transfer references, receipt numbers, etc.

## Error Handling

- If transaction creation fails, refund status remains "Pending"
- Can retry transaction creation using `/process` endpoint
- Original refund record is preserved even if transaction fails
- Error details stored in refund record for troubleshooting
