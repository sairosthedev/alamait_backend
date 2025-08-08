# Advance Payment System

## Overview
The advance payment system allows students to pay for future months while ensuring current obligations are met first. This system supports partial payments and advance payments with proper validation.

## Key Features

### 1. **Strict Chronological Priority**
- **Priority Order**: Previous months → Current month → Future months
- Students must pay for the oldest unpaid month first
- Cannot skip months or pay for future months when previous months are unpaid
- Only advance payments are allowed when ALL previous months are paid

### 2. **Partial Payment Support**
- Students can make partial payments for any month
- System tracks remaining balance for each month
- Prevents overpayment by validating against remaining amounts
- Partial payments must follow chronological order

### 3. **Advance Payment Rules**
- Can only pay for future months when ALL previous months are paid
- No exceptions - strict chronological order is enforced
- System prevents duplicate payments for the same month

## Payment Scenarios

### Scenario 1: Strict Chronological Priority
```
Room Cost: $160
Student pays: $160 for June (previous month)
Result: ✅ Accepted - Previous month payment
Student pays: $160 for July (current month)
Result: ✅ Accepted - Current month payment
Student pays: $160 for August (future month)
Result: ✅ Accepted - Future month payment (all previous paid)
```

### Scenario 2: Cannot Skip Previous Months
```
Unpaid months: June, July
Student tries to pay: $160 for July
Result: ❌ Rejected - Must pay June first
Student pays: $160 for June
Result: ✅ Accepted - Previous month payment
Student pays: $160 for July
Result: ✅ Accepted - Current month payment
```

### Scenario 3: Cannot Pay Future Before Previous
```
Unpaid months: June, July
Student tries to pay: $160 for August
Result: ❌ Rejected - Must pay all previous months first
Error: "You must pay for all unpaid months before paying for future months. Oldest unpaid month: 2024-06"
```

### Scenario 4: Partial Payment Chronological Order
```
Student pays: $60 for June
Result: ✅ Accepted - Partial payment for previous month
Student pays: $100 for June
Result: ✅ Accepted - Remaining balance for previous month
Student pays: $160 for July
Result: ✅ Accepted - Current month payment
```

### Scenario 5: Advance Payment Only After All Previous Paid
```
Student pays: $160 for June
Result: ✅ Accepted - Previous month payment
Student pays: $160 for July
Result: ✅ Accepted - Current month payment
Student pays: $160 for September
Result: ✅ Accepted - Future month payment (all previous paid)
```

## Implementation Details

### Payment Validation Logic

```javascript
// Enhanced validation logic with strict chronological priority
if (unpaidMonths.length > 0) {
    // Priority: Previous months → Current month → Future months
    const oldestUnpaidMonth = unpaidMonths[0];
    
    // Check if requested month is before the oldest unpaid month
    if (requestedMonth < oldestUnpaidMonth) {
        return res.status(400).json({
            error: `You must pay for the oldest unpaid month first: ${oldestUnpaidMonth}`,
            priority: 'Previous months must be paid first'
        });
    }
    
    // Check if requested month is a future month when there are unpaid months
    if (requestedMonth > currentMonth) {
        return res.status(400).json({
            error: `You must pay for all unpaid months before paying for future months. Oldest unpaid month: ${oldestUnpaidMonth}`,
            priority: 'Previous months → Current month → Future months'
        });
    }
}
```

### Partial Payment Tracking

```javascript
// Check if this is a partial payment for the requested month
const requestedMonthPayments = payments.filter(p => 
    p.paymentMonth === requestedMonth && 
    ['Confirmed', 'Verified'].includes(p.status)
);

const alreadyPaidForMonth = requestedMonthPayments.reduce((sum, p) => sum + (p.rentAmount || 0), 0);
const remainingRentForMonth = Math.max(roomPrice - alreadyPaidForMonth, 0);

// Validate against remaining amount
if (rentAmount > remainingRentForMonth) {
    return res.status(400).json({ 
        error: `Rent overpayment for ${requestedMonth}. Only $${remainingRentForMonth.toFixed(2)} remaining for this month.`
    });
}
```

## API Response Examples

### Successful Partial Payment
```json
{
    "message": "Proof of payment uploaded successfully",
    "payment": {
        "id": "PAY-1234567890-abc123",
        "paymentId": "PAY-1234567890-abc123",
        "totalAmount": 60.00,
        "status": "Pending",
        "proofOfPayment": {
            "fileUrl": "https://s3.amazonaws.com/...",
            "fileName": "receipt.pdf",
            "uploadDate": "2024-07-15T10:30:00.000Z"
        }
    }
}
```

### Error: Must Pay Previous Months First
```json
{
    "error": "You must pay for all unpaid months before paying for future months. Oldest unpaid month: 2024-06",
    "oldestUnpaidMonth": "2024-06",
    "requestedMonth": "2024-08",
    "currentMonth": "2024-07",
    "unpaidMonths": ["2024-06", "2024-07"],
    "priority": "Previous months → Current month → Future months"
}
```

### Error: Overpayment
```json
{
    "error": "Rent overpayment for 2024-07. Only $100.00 remaining for this month.",
    "alreadyPaid": 60.00,
    "remaining": 100.00
}
```

## Frontend Integration

### Payment Form Fields
- **paymentMonth**: Required field (YYYY-MM format)
- **rentAmount**: Amount being paid for rent
- **adminFee**: Admin fee amount (if applicable)
- **deposit**: Deposit amount (if applicable)

### Validation Feedback
The system provides detailed error messages to help users understand:
- Which month they need to pay first
- How much they've already paid for a specific month
- How much remains to be paid
- Whether they can make advance payments

## Benefits

1. **Flexibility**: Students can pay what they can afford when they can afford it
2. **Advance Planning**: Students can pay for future months in advance
3. **Clear Tracking**: System maintains clear records of partial and advance payments
4. **Prevents Confusion**: Clear error messages guide students on payment requirements
5. **Maintains Order**: Ensures current obligations are met before allowing advance payments

## Testing

Use the `test-advance-payment.js` script to test various payment scenarios and verify the system works correctly.

## Files Modified

1. `src/controllers/student/paymentHistoryController.js` - Enhanced payment validation logic
2. `test-advance-payment.js` - Test scenarios for advance payments
3. `ADVANCE_PAYMENT_SYSTEM.md` - This documentation 