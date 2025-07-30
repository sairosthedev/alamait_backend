# 📄 Quotation Update Implementation

## 🎯 Overview

This implementation adds the ability to update existing quotations in both regular requests and monthly requests. Previously, the system only allowed adding new quotations, but now you can modify existing ones including their files.

## 🚀 New Features

### ✅ **What's New**
- **Update quotation metadata** (provider, amount, description)
- **Replace quotation files** (uploads new file, deletes old one from S3)
- **Automatic unapproval** of modified quotations
- **Request history tracking** for all changes
- **S3 file management** (cleanup of old files)

### 🔒 **Security & Permissions**
- **Admin-only access** - Only admin users can update quotations
- **Status restrictions** - Only pending/admin-approved requests can be updated
- **Audit trail** - All changes are logged in request history

## 📡 New API Endpoints

### 1. **Update Request-Level Quotation**
```http
PUT /api/requests/:id/quotations/:quotationId
```

**Parameters:**
- `id` - Request ID
- `quotationId` - Quotation ID to update

**Request Body (JSON):**
```json
{
  "provider": "Updated Vendor Name",
  "amount": 1500,
  "description": "Updated quotation description"
}
```

**Request Body (FormData with file):**
```form-data
provider: Updated Vendor Name
amount: 1500
description: Updated quotation description
quotation: [file upload]
```

### 2. **Update Item-Level Quotation**
```http
PUT /api/requests/:id/items/:itemIndex/quotations/:quotationIndex
```

**Parameters:**
- `id` - Request ID
- `itemIndex` - Item index (0-based)
- `quotationIndex` - Quotation index (0-based)

**Request Body:** Same as request-level quotation

### 3. **Update Monthly Request Item Quotation**
```http
PUT /api/monthly-requests/:id/items/:itemIndex/quotations/:quotationIndex
```

**Parameters:**
- `id` - Monthly Request ID
- `itemIndex` - Item index (0-based)
- `quotationIndex` - Quotation index (0-based)

**Request Body:** Same as request-level quotation

## 🔧 Implementation Details

### **File Management**
- **Old file deletion**: When updating with a new file, the old file is automatically deleted from S3
- **New file upload**: New files are uploaded to the same S3 bucket with updated metadata
- **File naming**: Files are named with timestamp to avoid conflicts

### **Status Management**
- **Automatic unapproval**: When a quotation is updated, it's automatically unapproved
- **Approval reset**: All approval fields are cleared (approvedBy, approvedAt, isApproved)
- **Status tracking**: Changes are logged in request history

### **Error Handling**
- **Permission checks**: Validates admin role
- **Status validation**: Ensures request is in updatable status
- **File validation**: Handles S3 upload errors gracefully
- **Data validation**: Validates quotation existence and data integrity

## 📝 Usage Examples

### **Update Quotation Metadata Only**
```javascript
const response = await axios.put(
  '/api/requests/123/quotations/456',
  {
    provider: 'New Vendor Name',
    amount: 2000,
    description: 'Updated description'
  },
  {
    headers: {
      'Authorization': 'Bearer admin_token',
      'Content-Type': 'application/json'
    }
  }
);
```

### **Update Quotation with File**
```javascript
const formData = new FormData();
formData.append('provider', 'New Vendor');
formData.append('amount', '2500');
formData.append('description', 'Updated with new file');
formData.append('quotation', fileInput.files[0]);

const response = await axios.put(
  '/api/requests/123/quotations/456',
  formData,
  {
    headers: {
      'Authorization': 'Bearer admin_token',
      ...formData.getHeaders()
    }
  }
);
```

### **Update Item Quotation**
```javascript
const response = await axios.put(
  '/api/requests/123/items/0/quotations/1',
  {
    provider: 'Item Vendor',
    amount: 750,
    description: 'Updated item quotation'
  },
  {
    headers: {
      'Authorization': 'Bearer admin_token',
      'Content-Type': 'application/json'
    }
  }
);
```

## 🔍 Response Format

### **Success Response**
```json
{
  "message": "Quotation updated successfully",
  "request": {
    "_id": "request_id",
    "title": "Request Title",
    "quotations": [
      {
        "_id": "quotation_id",
        "provider": "Updated Vendor",
        "amount": 1500,
        "description": "Updated description",
        "fileUrl": "https://s3.amazonaws.com/bucket/file.pdf",
        "fileName": "updated_quotation.pdf",
        "uploadedBy": "user_id",
        "uploadedAt": "2024-01-01T00:00:00.000Z",
        "isApproved": false,
        "approvedBy": null,
        "approvedAt": null
      }
    ],
    "requestHistory": [
      {
        "date": "2024-01-01T00:00:00.000Z",
        "action": "Quotation Updated",
        "user": "user_id",
        "changes": [
          "Provider updated to: Updated Vendor",
          "Amount updated to: 1500",
          "Quotation unapproved due to modification"
        ]
      }
    ]
  }
}
```

### **Error Responses**
```json
{
  "message": "Only admins can update quotations"
}
```

```json
{
  "message": "Cannot update quotation for request in current status"
}
```

```json
{
  "message": "Quotation not found"
}
```

## 🧪 Testing

Use the provided test file `test-quotation-update.js` to test all functionality:

```bash
# Install dependencies
npm install axios form-data

# Update test file with your data
# Replace placeholder values with actual IDs and tokens

# Run tests
node test-quotation-update.js
```

## 🔄 Migration Notes

### **Backward Compatibility**
- ✅ All existing functionality remains unchanged
- ✅ Existing quotations are not affected
- ✅ No database schema changes required
- ✅ Existing API endpoints continue to work

### **New Behavior**
- 🔄 Quotations can now be updated (previously only added)
- 🔄 Modified quotations are automatically unapproved
- 🔄 Old files are automatically deleted when replaced
- 🔄 All changes are tracked in request history

## 🚨 Important Notes

### **File Management**
- Old files are **permanently deleted** from S3 when replaced
- Ensure you have backups if needed
- File deletion is automatic and cannot be undone

### **Approval Workflow**
- Updated quotations must be re-approved
- This ensures data integrity and proper approval workflow
- Approval history is preserved in request history

### **Performance**
- File operations may take time depending on file size
- S3 operations are asynchronous
- Consider implementing progress indicators for large files

## 🔮 Future Enhancements

### **Potential Improvements**
- **Bulk quotation updates** - Update multiple quotations at once
- **Quotation versioning** - Keep history of quotation changes
- **Soft file deletion** - Archive old files instead of deleting
- **Approval workflow** - Custom approval rules for updated quotations
- **Notification system** - Notify relevant users of quotation updates

### **Monitoring**
- **Audit logs** - Track all quotation modifications
- **Performance metrics** - Monitor file upload/download times
- **Error tracking** - Log and alert on update failures

## 📞 Support

For questions or issues with quotation updates:
1. Check the request history for detailed change logs
2. Verify file permissions and S3 configuration
3. Ensure proper admin authentication
4. Review error messages for specific issues

---

**Implementation Date:** January 2024  
**Version:** 1.0.0  
**Compatibility:** All existing request and monthly request systems 