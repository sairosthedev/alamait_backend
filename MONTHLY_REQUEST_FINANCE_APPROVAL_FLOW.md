# Monthly Request Finance Approval Flow

This document explains what happens when finance approves a monthly request.

## Overview

When finance approves a monthly request, several processes are triggered to:
1. Update the request status
2. Create accounting entries (double-entry transactions)
3. Create expense records
4. Send email notifications
5. Handle template updates (if applicable)

## Approval Process

### 1. **Immediate Status Update** (Synchronous)

When `financeApproveMonthlyRequest` is called:

```javascript
// Status is updated immediately
monthlyRequest.status = approved ? 'approved' : 'rejected';
monthlyRequest.approvedBy = user._id;
monthlyRequest.approvedAt = dateApproved ? new Date(dateApproved) : new Date();
monthlyRequest.dateApproved = dateApproved ? new Date(dateApproved) : null;
monthlyRequest.approvedByEmail = user.email;
monthlyRequest.notes = notes || monthlyRequest.notes;

// Set datePaid when approved
if (approved) {
    monthlyRequest.datePaid = datePaid ? new Date(datePaid) : (dateApproved ? new Date(dateApproved) : new Date());
}

// Add to request history
monthlyRequest.requestHistory.push({
    date: dateApproved ? new Date(dateApproved) : new Date(),
    action: `Monthly request ${approved ? 'approved' : 'rejected'} by finance`,
    user: user._id,
    changes: [`Status changed to ${approved ? 'approved' : 'rejected'}`]
});

// Save immediately
await monthlyRequest.save();
```

### 2. **Background Processes** (Asynchronous - Runs after response)

After the response is sent, background processes are scheduled to run 2 seconds later:

#### A. **Email Notification**
- Sends approval/rejection email to the submitter
- Includes notes and approval details
- Uses `EmailNotificationService.sendMonthlyRequestApprovalNotification()`

#### B. **Template Update** (if applicable)
- If the monthly request is created from a template, updates the template's monthly approval record
- Links the approval to the specific month/year in the template

#### C. **Expense Creation** (if `createExpenses = true`)

This is the most complex part:

##### **Decision Logic:**
1. **Installment Payments** (for large amounts > $100):
   - Status set to `'approved'` (not `'completed'`)
   - Expenses are created later as payments are made
   - Request remains in approved state

2. **Immediate Expense Creation** (for smaller amounts):
   - Status set to `'completed'`
   - Expenses created immediately
   - Double-entry transactions created

##### **Expense Creation Process:**

For each item in the monthly request:

1. **Get Expense Account:**
   ```javascript
   const expenseAccountCode = await AccountMappingService.getExpenseAccountForItem(item);
   const expenseAccount = await Account.findOne({ code: expenseAccountCode });
   ```

2. **Create Double-Entry Transaction:**
   ```javascript
   // Creates accrual entry (Accounts Payable + Expense)
   const transactionResult = await DoubleEntryAccountingService.recordMaintenanceApproval(
       tempRequest, 
       user, 
       request.approvedAt
   );
   ```
   - **Debit**: Expense Account (e.g., Utilities, Maintenance)
   - **Credit**: Accounts Payable
   - This follows accrual accounting principles

3. **Create Expense Record:**
   ```javascript
   const expense = new Expense({
       expenseId: `${expenseId}_item_${i}`,
       title: `${request.title} - ${item.title}`,
       description: item.description,
       amount: item.estimatedCost,
       category: expenseCategory,
       expenseDate: request.approvedAt || request.dateRequested,
       period: 'monthly',
       paymentStatus: 'Pending',
       paymentMethod: 'Bank Transfer',
       monthlyRequestId: request._id,
       itemIndex: i,
       residence: request.residence,
       createdBy: user._id,
       transactionId: linkedTransactionId // Links to double-entry transaction
   });
   ```

4. **Update Request Status:**
   - Status changed to `'completed'`
   - `datePaid` set to approval date
   - History updated with expense creation details

## Key Features

### ✅ **Double-Entry Accounting**
- Every expense creates a corresponding accounting entry
- Follows GAAP (Generally Accepted Accounting Principles)
- Accrual basis accounting (expense recorded when approved, not when paid)

### ✅ **Item-Level Processing**
- Each item in the monthly request becomes a separate expense
- Each expense has its own double-entry transaction
- Allows for proper categorization and tracking

### ✅ **Error Handling**
- If expense creation fails, error is logged in request history
- Request status is updated to reflect the error
- Background processes don't block the approval response

### ✅ **Template Support**
- Templates can be approved for specific months
- Monthly approvals are tracked separately
- Original template remains unchanged

## API Endpoint

```
PATCH /api/monthly-requests/:id/finance-approve
```

**Request Body:**
```json
{
  "approved": true,
  "notes": "Approved for payment",
  "createExpenses": true,
  "datePaid": "2025-01-15",
  "dateApproved": "2025-01-10"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Monthly request approved successfully. Background processes (email notification, expense conversion) are running and will complete within 2-5 minutes.",
  "monthlyRequest": { ... },
  "backgroundProcessing": {
    "status": "scheduled",
    "message": "Email notification and expense conversion will be processed in the background",
    "estimatedCompletion": "2025-01-10T12:05:00.000Z"
  }
}
```

## Permissions

Only users with these roles can approve monthly requests:
- `admin`
- `finance`
- `finance_admin`
- `finance_user`

## Status Flow

```
pending → approved → completed
         ↓
      rejected
```

- **pending**: Initial state, waiting for approval
- **approved**: Approved by finance, may be waiting for installment payments
- **completed**: All expenses created, fully processed
- **rejected**: Not approved by finance

## Important Notes

1. **Background Processing**: Expense creation happens asynchronously to avoid timeout issues
2. **Templates**: Templates never create expenses - only monthly requests created from templates do
3. **Double-Entry**: Every expense must have a corresponding accounting entry
4. **Date Handling**: Uses `dateApproved` if provided, otherwise uses current date
5. **Error Recovery**: If expense creation fails, the request remains approved but with error status

## Related Files

- `src/controllers/monthlyRequestController.js` - Main approval controller
- `src/services/monthlyRequestDeductionService.js` - Handles deductions from monthly requests
- `src/services/doubleEntryAccountingService.js` - Creates accounting entries
- `src/models/MonthlyRequest.js` - Monthly request model
- `src/models/Expense.js` - Expense model

