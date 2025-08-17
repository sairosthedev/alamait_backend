# Petty Cash Transfer Implementation

## Overview
This implementation adds the ability for finance users to transfer petty cash to admin users, allowing admins to use petty cash for expenses while maintaining proper financial tracking and accountability.

## Features Implemented

### 1. Petty Cash Transfer Functionality
- **Transfer Between Role-Based Accounts**: Finance users can transfer petty cash between different role-based petty cash accounts
- **Balance Validation**: System checks if source account has sufficient balance before transfer
- **Audit Trail**: All transfers are logged with full audit trail
- **Role-Based Permissions**: Only finance users can perform transfers

### 2. New API Endpoints

#### Transfer Petty Cash
```
POST /api/finance/petty-cash/transfer
```
**Request Body:**
```json
{
  "fromRole": "finance_admin",
  "toRole": "admin", 
  "amount": 100,
  "notes": "Transfer for admin expenses"
}
```

**Response:**
```json
{
  "message": "Petty cash transfer completed successfully",
  "transfer": {
    "id": "transaction_id",
    "fromRole": "finance_admin",
    "toRole": "admin",
    "amount": 100,
    "fromAccount": "Finance Petty Cash",
    "toAccount": "Admin Petty Cash",
    "date": "2024-01-01T00:00:00.000Z",
    "notes": "Transfer for admin expenses"
  }
}
```

#### View All Petty Cash Balances (Finance Users Only)
```
GET /api/finance/petty-cash/all-balances
```

**Response:**
```json
{
  "balances": [
    {
      "accountCode": "1011",
      "accountName": "Admin Petty Cash",
      "balance": 150.00,
      "role": "admin"
    },
    {
      "accountCode": "1012", 
      "accountName": "Finance Petty Cash",
      "balance": 500.00,
      "role": "finance"
    }
  ],
  "totalBalance": 650.00
}
```

### 3. Workflow

#### Finance to Admin Transfer Process:
1. **Finance User** logs into the system
2. **Finance User** navigates to petty cash transfer section
3. **Finance User** selects "Admin" as the destination role
4. **Finance User** enters amount and notes
5. **System** validates:
   - Finance account has sufficient balance
   - User has finance permissions
   - Amount is valid
6. **System** creates transfer transaction with double-entry bookkeeping
7. **Admin User** can now use their petty cash for expenses

#### Admin Expense Process:
1. **Admin User** creates an expense
2. **Admin User** selects "Petty Cash" as payment method
3. **System** automatically uses "Admin Petty Cash" account
4. **System** creates expense transaction debiting admin petty cash
5. **System** maintains proper audit trail

### 4. Database Structure

#### Petty Cash Accounts:
- `1010 - General Petty Cash` (default/fallback)
- `1011 - Admin Petty Cash` (for admin users)
- `1012 - Finance Petty Cash` (for finance users)
- `1013 - Property Manager Petty Cash` (for property managers)
- `1014 - Maintenance Petty Cash` (for maintenance staff)

#### Transaction Types:
- `transfer` - For petty cash transfers between accounts
- `expense` - For expenses paid from petty cash
- `allocation` - For initial petty cash allocations

### 5. Security & Permissions

#### Transfer Permissions:
- Only `finance_admin` and `finance_user` roles can perform transfers
- Users cannot transfer to their own role account
- System validates source account balance before transfer

#### Balance View Permissions:
- All users can view their own role's petty cash balance
- Only finance users can view all petty cash balances

### 6. Error Handling

#### Common Error Scenarios:
- **Insufficient Balance**: Returns error with available balance
- **Invalid Role**: Returns validation error
- **Permission Denied**: Returns 403 Forbidden
- **Invalid Amount**: Returns validation error

### 7. Audit Trail

All transfers create comprehensive audit logs including:
- User who performed the transfer
- Source and destination accounts
- Amount transferred
- Timestamp
- Notes/description
- IP address

### 8. Integration with Existing Systems

#### Expense System:
- Admin users can select "Petty Cash" as payment method
- System automatically uses role-specific petty cash account
- Proper double-entry bookkeeping maintained

#### Balance Reporting:
- Finance users can view all petty cash balances
- Individual users can view their own balance
- Real-time balance updates

## Usage Examples

### Transfer Petty Cash (Finance User)
```javascript
// Finance user transferring $200 to admin
const response = await fetch('/api/finance/petty-cash/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fromRole: 'finance_admin',
    toRole: 'admin',
    amount: 200,
    notes: 'Monthly admin petty cash allocation'
  })
});
```

### Create Expense with Petty Cash (Admin User)
```javascript
// Admin user creating expense paid from petty cash
const response = await fetch('/api/finance/expenses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    description: 'Office supplies',
    amount: 50,
    category: 'supplies',
    paymentMethod: 'Petty Cash', // Automatically uses Admin Petty Cash
    residence: 'residence_id'
  })
});
```

### View Petty Cash Balance (Any User)
```javascript
// View current user's petty cash balance
const response = await fetch('/api/finance/petty-cash/balance');
const balance = await response.json();
console.log(`Current petty cash balance: $${balance.balance}`);
```

## Benefits

1. **Improved Accountability**: Each role has its own petty cash account
2. **Better Tracking**: All transfers and expenses are properly tracked
3. **Role-Based Access**: Users can only access their designated petty cash
4. **Audit Compliance**: Complete audit trail for all transactions
5. **Flexible Workflow**: Finance can allocate funds to different departments
6. **Real-Time Balances**: Up-to-date balance information for all accounts

## Future Enhancements

1. **Transfer Limits**: Set maximum transfer amounts per role
2. **Approval Workflow**: Require approval for large transfers
3. **Scheduled Transfers**: Automate regular petty cash allocations
4. **Reporting**: Enhanced reporting and analytics for petty cash usage
5. **Notifications**: Email/SMS notifications for transfers and low balances 