# Debtor Creation from Approved Applications

## Overview

The debtor creation system has been updated to ensure that debtors are only created from approved applications, rather than automatically when students are created. This ensures that debtors have complete and accurate financial information.

## Key Changes

### 1. Disabled Automatic Debtor Creation

- **Before**: Debtors were automatically created whenever a student was created or their role was updated to 'student'
- **After**: Debtors are only created when applications are approved, ensuring they have proper financial data

### 2. Enhanced Application Approval Process

When an application is approved, the system now:

1. **Creates/Updates Debtor Account**: Automatically creates a new debtor or updates an existing one
2. **Links Financial Data**: Associates the debtor with the residence, room, and lease terms
3. **Calculates Financial Obligations**: Computes total owed based on room price, lease duration, admin fees, and deposits
4. **Sets Billing Periods**: Establishes proper billing cycles and payment schedules
5. **Links Back to Application**: Creates a bidirectional relationship between debtor and application

### 3. Improved Debtor Service

The `debtorService.js` has been enhanced to:

- Prioritize approved application data over other sources
- Better handle room pricing and lease duration calculations
- Provide comprehensive financial breakdowns
- Support both new debtor creation and existing debtor updates

## How It Works

### Application Approval Flow

```
1. Admin approves application
   ↓
2. System checks if student has existing debtor
   ↓
3a. If no debtor exists: Creates new debtor with application data
   ↓
3b. If debtor exists: Updates existing debtor with new application data
   ↓
4. Links debtor back to application
   ↓
5. Sends approval email with lease agreement
```

### Debtor Creation Process

```
1. Extract financial data from approved application:
   - Residence and room information
   - Lease start/end dates
   - Room pricing
   - Admin fees (if applicable)
   
2. Calculate total financial obligations:
   - Total rent (room price × lease duration)
   - Admin fees
   - Security deposit
   
3. Create debtor record with:
   - Contact information
   - Financial breakdown
   - Billing period details
   - Payment terms
   
4. Link to application and residence
```

## Benefits

### ✅ **Data Accuracy**
- Debtors are created with complete financial information
- No more debtors with missing or incorrect data
- Financial calculations are based on actual lease terms

### ✅ **Proper Relationships**
- Clear link between applications and debtors
- Bidirectional relationships for better data integrity
- Easier to track financial obligations

### ✅ **Financial Compliance**
- Proper calculation of total amounts owed
- Accurate billing periods and payment schedules
- Support for different fee structures (admin fees, deposits)

### ✅ **Audit Trail**
- Complete history of when and why debtors were created
- Clear linkage to approval process
- Better tracking of financial changes

## Migration

### For Existing Approved Applications

If you have existing approved applications without debtors, you can run:

```bash
npm run create-debtors-from-applications
```

This script will:
1. Find all approved applications without debtors
2. Create debtors for students who don't have them
3. Link existing debtors to applications
4. Provide a summary of the migration

### Manual Process

You can also manually trigger debtor creation by:
1. Finding approved applications without debtors
2. Running the approval process again (it will update existing debtors)
3. Or using the new service function directly

## API Endpoints

### Application Approval
- **PUT** `/admin/applications/:applicationId`
- **Body**: `{ "action": "approve", "roomNumber": "...", "residenceId": "..." }`
- **Result**: Application approved + debtor created/updated

### Debtor Creation Service
- **Function**: `createDebtorForStudent(user, options)`
- **Function**: `createDebtorsFromApprovedApplications()`

## Configuration

### Admin Fees
- **St Kilda**: $20 admin fee
- **Other Residences**: No admin fee (configurable)

### Default Values
- **Room Price**: $150 (fallback if not specified)
- **Lease Duration**: 6 months (fallback if not specified)
- **Security Deposit**: 1 month's rent

## Error Handling

The system is designed to be resilient:

- **Debtor Creation Failures**: Don't block application approval
- **Missing Data**: Uses fallback values with clear logging
- **Partial Failures**: Continues processing other applications
- **Detailed Logging**: Comprehensive error tracking for debugging

## Monitoring

### Logs to Watch
- ✅ `Created debtor account for approved student: [email]`
- ✅ `Updated existing debtor account for approved student: [email]`
- ⚠️ `No approved application found for [email] - will use fallback data`
- ❌ `Error creating/updating debtor account: [error]`

### Key Metrics
- Number of debtors created from applications
- Number of existing debtors updated
- Failed debtor creation attempts
- Applications without linked debtors

## Troubleshooting

### Common Issues

1. **Debtor Not Created**
   - Check if application is actually approved
   - Verify student user exists
   - Check application has required data (dates, room, residence)

2. **Financial Data Missing**
   - Ensure room has price information
   - Check application has start/end dates
   - Verify residence data is complete

3. **Linking Failures**
   - Check if debtor already exists
   - Verify application has student reference
   - Ensure proper database permissions

### Debug Commands

```bash
# Check applications without debtors
db.applications.find({ status: "approved", debtor: { $exists: false } })

# Check debtors without applications
db.debtors.find({ application: { $exists: false } })

# Verify application approval status
db.applications.find({ _id: ObjectId("...") }, { status: 1, student: 1, residence: 1 })
```

## Future Enhancements

- **Bulk Operations**: Support for approving multiple applications at once
- **Advanced Billing**: Support for different payment schedules
- **Fee Templates**: Configurable fee structures per residence
- **Integration**: Better integration with payment and accounting systems
