# Comprehensive Audit Logging System

This document describes the comprehensive audit logging system implemented to ensure every action in the system is logged for complete audit trail compliance.

## Overview

The audit logging system captures:
- All API requests and responses
- User authentication events
- CRUD operations on all models
- Financial transactions
- Approval workflows
- File operations
- System operations
- Error events

## Components

### 1. AuditLog Model (`src/models/AuditLog.js`)

Enhanced model with comprehensive fields:
- `user`: User who performed the action
- `action`: Type of action (create, read, update, delete, approve, etc.)
- `collection`: Database collection affected
- `recordId`: ID of the specific record
- `before`: State before the action
- `after`: State after the action
- `details`: Additional details about the action
- `ipAddress`: Client IP address
- `userAgent`: Client user agent
- `sessionId`: Session identifier
- `requestId`: Unique request identifier
- `duration`: Request duration in milliseconds
- `statusCode`: HTTP status code
- `errorMessage`: Error message if applicable

### 2. Audit Middleware (`src/middleware/auditMiddleware.js`)

Automatically logs all API requests:
- Captures request/response data
- Determines action type from HTTP method and path
- Extracts record IDs from path parameters
- Sanitizes sensitive data
- Logs asynchronously to avoid blocking responses

### 3. Enhanced Audit Logger (`src/utils/auditLogger.js`)

Core logging functions:
- `createAuditLog()`: Main logging function
- `logSystemOperation()`: For automated processes
- `logAuthOperation()`: For authentication events
- `logFileOperation()`: For file operations
- `logBulkOperation()`: For bulk operations
- `logAPIOperation()`: For API operations
- `logApprovalOperation()`: For approval workflows
- `logFinancialOperation()`: For financial operations
- `logDataOperation()`: For data export/import
- `logErrorOperation()`: For error events

### 4. Audit Helpers (`src/utils/auditHelpers.js`)

Specialized helper functions for common operations:
- `logCRUDOperation()`: Generic CRUD operations
- `logSalaryRequestOperation()`: Salary request operations
- `logMonthlyRequestOperation()`: Monthly request operations
- `logExpenseOperation()`: Expense operations
- `logPaymentOperation()`: Payment operations
- `logTransactionOperation()`: Transaction operations
- `logAccountOperation()`: Account operations
- `logStudentOperation()`: Student operations
- `logApplicationOperation()`: Application operations
- `logLeaseOperation()`: Lease operations
- `logVendorOperation()`: Vendor operations
- `logDebtorOperation()`: Debtor operations
- `logResidenceOperation()`: Residence operations
- `logRoomOperation()`: Room operations
- `logQuotationOperation()`: Quotation operations
- `logInvoiceOperation()`: Invoice operations
- `logUserOperation()`: User operations

### 5. Error Handler (`src/middleware/errorHandler.js`)

Comprehensive error handling:
- Logs all errors to audit trail
- Provides consistent error responses
- Sanitizes sensitive data in error logs
- Handles different error types appropriately

## Usage Examples

### 1. Automatic API Logging

All API requests are automatically logged by the audit middleware:

```javascript
// No additional code needed - automatically logged
app.get('/api/users', (req, res) => {
    // This request is automatically logged
});
```

### 2. Manual Operation Logging

For specific operations, use the helper functions:

```javascript
const { logAccountOperation } = require('../utils/auditHelpers');

// In your controller
exports.createAccount = async (req, res) => {
    try {
        const account = new Account(req.body);
        await account.save();
        
        // Log the operation
        await logAccountOperation(
            'create',
            account,
            req.user._id,
            `Created account ${account.code} - ${account.name}`,
            req
        );
        
        res.status(201).json({ account });
    } catch (error) {
        next(error);
    }
};
```

### 3. Approval Workflow Logging

```javascript
const { logApprovalWorkflow } = require('../utils/auditHelpers');

exports.approveRequest = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        const beforeState = request.toObject();
        
        request.status = 'approved';
        request.approvedBy = req.user._id;
        await request.save();
        
        // Log the approval
        await logApprovalWorkflow(
            'approve',
            request,
            req.user._id,
            `Request approved by ${req.user.email}`,
            req
        );
        
        res.json({ request });
    } catch (error) {
        next(error);
    }
};
```

### 4. Financial Operation Logging

```javascript
const { logFinancialWorkflow } = require('../utils/auditHelpers');

exports.createExpense = async (req, res) => {
    try {
        const expense = new Expense(req.body);
        await expense.save();
        
        // Log the financial operation
        await logFinancialWorkflow(
            'create',
            expense,
            req.user._id,
            `Created expense for ${expense.category}`,
            req
        );
        
        res.status(201).json({ expense });
    } catch (error) {
        next(error);
    }
};
```

### 5. System Operation Logging

```javascript
const { logSystemEvent } = require('../utils/auditHelpers');

// For automated processes
exports.processMonthlyAccruals = async () => {
    try {
        // Process accruals...
        
        // Log system operation
        await logSystemEvent(
            'system_operation',
            'Transaction',
            null,
            'Processed monthly accruals for all active leases'
        );
    } catch (error) {
        console.error('Error processing accruals:', error);
    }
};
```

## Configuration

### Environment Variables

```env
# Audit logging configuration
AUDIT_LOG_LEVEL=info
AUDIT_LOG_RETENTION_DAYS=2555  # 7 years
AUDIT_LOG_SENSITIVE_FIELDS=password,token,secret,key
```

### Middleware Setup

The audit middleware is automatically applied to all routes in `app.js`:

```javascript
const { auditMiddleware } = require('./middleware/auditMiddleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Apply audit middleware
app.use(auditMiddleware);

// Apply error handlers
app.use(notFoundHandler);
app.use(errorHandler);
```

## Security Considerations

### Data Sanitization

The system automatically sanitizes sensitive data:
- Passwords, tokens, and secrets are redacted
- Authorization headers are masked
- API keys are hidden

### Access Control

Audit logs should only be accessible to:
- System administrators
- Compliance officers
- Auditors (read-only access)

### Data Retention

- Audit logs are retained for 7 years (configurable)
- Old logs can be archived or purged based on policy
- Sensitive data is automatically redacted

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Failed Operations**: High rate of failed operations
2. **Unusual Access Patterns**: Access from unusual IP addresses
3. **Bulk Operations**: Large-scale data modifications
4. **Authentication Failures**: Multiple failed login attempts
5. **Privilege Escalation**: Users accessing resources beyond their role

### Alert Conditions

- More than 10 failed operations in 5 minutes
- Access from new IP addresses
- Bulk operations affecting more than 100 records
- Multiple authentication failures from same IP
- Unauthorized access attempts

## Compliance Features

### SOX Compliance

- Complete audit trail for financial operations
- Segregation of duties logging
- Change management tracking
- Data integrity verification

### GDPR Compliance

- Data access logging
- Data modification tracking
- Data deletion audit trail
- Consent management logging

### HIPAA Compliance

- Access control logging
- Data encryption status
- Breach detection capabilities
- User activity monitoring

## Performance Considerations

### Asynchronous Logging

- Audit logs are written asynchronously
- Non-blocking operation logging
- Background processing for bulk operations

### Database Optimization

- Indexed fields for fast queries
- Partitioned tables for large datasets
- Compression for archived logs
- Efficient query patterns

### Storage Management

- Automatic log rotation
- Compression of old logs
- Archival to cold storage
- Cleanup of expired logs

## Troubleshooting

### Common Issues

1. **Missing Audit Logs**
   - Check middleware configuration
   - Verify database connection
   - Check for error handling

2. **Performance Impact**
   - Monitor database performance
   - Check for blocking operations
   - Optimize query patterns

3. **Storage Issues**
   - Monitor disk space
   - Check log rotation
   - Verify cleanup processes

### Debug Mode

Enable debug mode for detailed logging:

```env
AUDIT_DEBUG=true
NODE_ENV=development
```

This will provide detailed console output for audit operations.

## Best Practices

1. **Always Log Operations**: Use helper functions for consistent logging
2. **Include Context**: Provide meaningful details in audit logs
3. **Handle Errors Gracefully**: Don't let audit logging break main operations
4. **Monitor Performance**: Keep an eye on audit log performance
5. **Regular Cleanup**: Implement log rotation and cleanup
6. **Security First**: Always sanitize sensitive data
7. **Test Thoroughly**: Ensure audit logging works in all scenarios

## API Endpoints

### View Audit Logs

```http
GET /api/audit-logs
GET /api/audit-logs?collection=User&action=create
GET /api/audit-logs?user=123&startDate=2024-01-01&endDate=2024-12-31
```

### Audit Reports

```http
GET /api/audit-reports/summary
GET /api/audit-reports/user-activity
GET /api/audit-reports/financial-operations
```

## Conclusion

This comprehensive audit logging system ensures that every action in the system is properly logged and tracked, providing complete audit trail compliance for regulatory requirements and security monitoring.
