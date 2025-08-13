# CEO Dashboard Implementation

## Overview
This document outlines the implementation of the CEO dashboard system, including API endpoints, data structures, and functionality for the CEO role.

## CEO Role Permissions
- **Full View Access**: Can view all data across admin, finance, and general routes
- **Request Approval**: Can approve/reject requests and change quotations with reasons
- **Read-Only Financial Data**: Can view all financial statements and reports
- **Audit Access**: Complete audit logging and trail access

## API Endpoints

### Dashboard Routes
```
GET /api/ceo/dashboard/overview
GET /api/ceo/dashboard/income-distribution
GET /api/ceo/dashboard/expense-distribution
GET /api/ceo/dashboard/recent-transactions
GET /api/ceo/dashboard/recent-requests
```

### Financial Routes (Uses Finance Controllers)
**Note**: These routes use the same controllers as finance routes to ensure consistent data and functionality.

```
GET /api/ceo/financial/income-statements
GET /api/ceo/financial/income-statements/:id
GET /api/ceo/financial/balance-sheets
GET /api/ceo/financial/balance-sheets/:id
GET /api/ceo/financial/expenses
GET /api/ceo/financial/expenses/:id
GET /api/ceo/financial/transactions
GET /api/ceo/financial/transactions/:id
```

**Key Benefits of Using Finance Controllers:**
- **Consistent Data**: Same filtering, sorting, and pagination as finance routes
- **Advanced Features**: Support for residence filtering, date ranges, custom sorting
- **Validation**: Same validation rules and error handling
- **Response Format**: Consistent response structure across all financial endpoints

### Request Management Routes
```
GET /api/ceo/requests
GET /api/ceo/requests/:id
GET /api/ceo/requests/pending-ceo-approval
PATCH /api/ceo/requests/:id/approve
PATCH /api/ceo/requests/:id/reject
PATCH /api/ceo/requests/:id/change-quotation
```

### Audit Routes
```
GET /api/ceo/audit/reports
GET /api/ceo/audit/trail
GET /api/ceo/audit/trail/:id
```

## Data Consistency

### Financial Data
The CEO financial routes now use the exact same controllers as finance routes, ensuring:

1. **Same Query Parameters**:
   - `residence` - Filter by residence ID
   - `status` - Filter by status
   - `startDate` / `endDate` - Date range filtering
   - `page` / `limit` - Pagination
   - `sortBy` / `sortOrder` - Custom sorting

2. **Same Response Format**:
   ```json
   {
     "balanceSheets": [...],
     "pagination": {
       "totalBalanceSheets": 100,
       "totalPages": 10,
       "currentPage": 1,
       "limit": 10
     }
   }
   ```

3. **Same Validation**: All finance route validations apply to CEO routes

## Request Approval Workflow

### 1. View Pending Requests
```http
GET /api/ceo/requests/pending-ceo-approval
```

### 2. Approve Request
```http
PATCH /api/ceo/requests/:id/approve
Content-Type: application/json

{
  "approvalNotes": "Approved after review"
}
```

### 3. Reject Request
```http
PATCH /api/ceo/requests/:id/reject
Content-Type: application/json

{
  "rejectionReason": "Budget constraints"
}
```

### 4. Change Quotation
```http
PATCH /api/ceo/requests/:id/change-quotation
Content-Type: application/json

{
  "newQuotation": 1500,
  "changeReason": "Market price adjustment required"
}
```

## Authentication & Authorization

### Required Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Role Verification
All CEO routes require the `ceo` role in the JWT token.

## Error Handling

### Common Error Responses
```json
{
  "error": "Error message",
  "status": 400/401/403/404/500
}
```

### Validation Errors
```json
{
  "errors": [
    {
      "type": "field",
      "msg": "Validation message",
      "path": "fieldName",
      "location": "body"
    }
  ]
}
```

## Performance Considerations

### Database Optimization
- Indexed queries on frequently accessed fields
- Pagination to limit data transfer
- Lean queries for read-only operations

### Caching Strategy
- Consider implementing Redis caching for dashboard metrics
- Cache financial summaries for better performance

## Security Features

### Audit Logging
All CEO actions are logged with:
- User ID and timestamp
- Action performed
- Data before and after changes
- IP address and user agent

### Data Access Control
- Role-based access control (RBAC)
- JWT token validation
- Request sanitization

## Testing Guide

### Test CEO Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ceo@alamait.com",
    "password": "password123"
  }'
```

### Test Dashboard Access
```bash
curl -X GET http://localhost:3000/api/ceo/dashboard/overview \
  -H "Authorization: Bearer <CEO_TOKEN>"
```

### Test Financial Data Access
```bash
curl -X GET "http://localhost:3000/api/ceo/financial/balance-sheets?page=1&limit=10" \
  -H "Authorization: Bearer <CEO_TOKEN>"
```

## Future Enhancements

### Planned Features
1. **Real-time Notifications**: WebSocket integration for live updates
2. **Advanced Analytics**: Custom financial reports and insights
3. **Export Functionality**: PDF/Excel export for reports
4. **Mobile Optimization**: Responsive design for mobile access

### Performance Improvements
1. **Database Indexing**: Optimize query performance
2. **Caching Layer**: Implement Redis for frequently accessed data
3. **API Rate Limiting**: Prevent abuse and ensure fair usage

## Conclusion

The CEO dashboard provides comprehensive oversight capabilities while maintaining data consistency with existing finance routes. The implementation ensures that CEOs have access to the same high-quality data and functionality as finance users, with additional approval capabilities for requests. 