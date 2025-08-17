# Request File Upload Fix

## Problem Description

The request system was failing with the error:
```
Request validation failed: items.0.quotations.0.fileUrl: Path `fileUrl` is required.
```

This occurred because:
1. The Request model schema required `fileUrl` to be present when creating quotations
2. When creating a request with quotations, the file hadn't been uploaded to S3 yet
3. The validation was failing before the file could be uploaded

## Root Cause

The issue was in the Request model schema where `fileUrl` and `fileName` fields were marked as `required: true` in the quotation schema, but the file upload process happened after the request creation validation.

## Solution Implemented

### 1. **Updated Request Model Schema** (`src/models/Request.js`)

Made `fileUrl` and `fileName` optional in both quotation schemas:

```javascript
// Before
fileUrl: {
    type: String,
    required: true
},
fileName: {
    type: String,
    required: true
},

// After
fileUrl: {
    type: String,
    required: false // Changed to allow creation without files
},
fileName: {
    type: String,
    required: false // Changed to allow creation without files
},
```

### 2. **Added S3 Configuration for Request Quotations** (`src/config/s3.js`)

Added a new S3 configuration for request quotation files:

```javascript
// For request quotations
requestQuotations: {
    bucket: bucketName,
    key: (req, file) => `request_quotations/${req.user._id}_${Date.now()}_${file.originalname}`,
    acl: 'private'
},
```

### 3. **Updated Request Creation Process** (`src/controllers/requestController.js`)

Enhanced the `createRequest` function to:
- Handle file uploads during request creation
- Upload quotation files to S3
- Process both JSON and FormData requests
- Parse items from FormData when needed

Key changes:
```javascript
// Parse items if it's a string (from FormData)
let parsedItems = items;
if (typeof items === 'string') {
    try {
        parsedItems = JSON.parse(items);
    } catch (error) {
        console.error('Error parsing items:', error);
        return res.status(400).json({ message: 'Invalid items format' });
    }
}

// Handle file uploads for quotations
if (uploadedFile) {
    const s3Key = `request_quotations/${user._id}_${Date.now()}_${uploadedFile.originalname}`;
    const s3UploadParams = {
        Bucket: s3Configs.requestQuotations.bucket,
        Key: s3Key,
        Body: uploadedFile.buffer,
        ContentType: uploadedFile.mimetype,
        ACL: s3Configs.requestQuotations.acl,
        Metadata: {
            fieldName: 'quotation',
            uploadedBy: user._id.toString(),
            uploadDate: new Date().toISOString()
        }
    };
    
    const s3Result = await s3.upload(s3UploadParams).promise();
    quotation.fileUrl = s3Result.Location;
    quotation.fileName = uploadedFile.originalname;
}
```

### 4. **Updated Request Routes** (`src/routes/requestRoutes.js`)

Modified the request creation route to handle both JSON and multipart requests:

```javascript
// Create new request
router.post('/', 
    (req, res, next) => {
        // Check if this is a multipart request (file upload)
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
            // Use multer for file uploads
            upload.any()(req, res, next);
        } else {
            // Skip multer for JSON requests
            next();
        }
    },
    requestController.createRequest
);
```

### 5. **Updated Upload Quotation Function** (`src/controllers/requestController.js`)

Enhanced the `uploadQuotation` function to use the new S3 configuration:

```javascript
if (req.file) {
    // File was uploaded via FormData - upload to S3
    const s3Key = `request_quotations/${user._id}_${Date.now()}_${req.file.originalname}`;
    const s3UploadParams = {
        Bucket: s3Configs.requestQuotations.bucket,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: s3Configs.requestQuotations.acl,
        Metadata: {
            fieldName: 'quotation',
            uploadedBy: user._id.toString(),
            uploadDate: new Date().toISOString()
        }
    };
    
    const s3Result = await s3.upload(s3UploadParams).promise();
    fileUrl = s3Result.Location;
    fileName = req.file.originalname;
}
```

## File Structure

Files are now stored in S3 under the `request_quotations/` folder with the following structure:
```
request_quotations/
├── {user_id}_{timestamp}_{filename}
├── {user_id}_{timestamp}_{filename}
└── ...
```

## Testing

Created comprehensive test scripts:

1. **`test-request-file-upload.js`** - Tests request creation with and without file uploads
2. **`create-test-pdf.js`** - Creates a test PDF file for testing

### Running Tests

```bash
# Create test PDF file
node create-test-pdf.js

# Run request file upload tests
node test-request-file-upload.js
```

## Usage Examples

### 1. Creating Request Without File (JSON)

```javascript
const requestData = {
    title: "Test Request",
    description: "Test description",
    type: "operational",
    department: "operations",
    requestedBy: "user",
    deliveryLocation: "location",
    residence: "residence_id",
    items: [{
        description: "Item",
        quantity: 1,
        estimatedCost: 200,
        quotations: [{
            provider: "Provider",
            amount: 150,
            description: "Quotation"
        }]
    }]
};

const response = await axios.post('/api/requests', requestData, {
    headers: { 'Content-Type': 'application/json' }
});
```

### 2. Creating Request With File (FormData)

```javascript
const formData = new FormData();
formData.append('title', 'Test Request');
formData.append('description', 'Test description');
formData.append('type', 'operational');
formData.append('department', 'operations');
formData.append('requestedBy', 'user');
formData.append('deliveryLocation', 'location');
formData.append('residence', 'residence_id');
formData.append('items', JSON.stringify([{
    description: "Item",
    quantity: 1,
    estimatedCost: 200,
    quotations: [{
        provider: "Provider",
        amount: 150,
        description: "Quotation"
    }]
}]));

// Add file for quotation
formData.append('items[0].quotations[0].file', file);

const response = await axios.post('/api/requests', formData, {
    headers: { ...formData.getHeaders() }
});
```

## Benefits

1. **✅ Fixed Validation Error** - Requests can now be created without immediate file uploads
2. **✅ S3 Integration** - All quotation files are properly uploaded to S3
3. **✅ Flexible Upload** - Supports both JSON and FormData requests
4. **✅ Backward Compatibility** - Existing functionality remains unchanged
5. **✅ Proper File Management** - Files are organized in S3 with proper metadata

## Migration Notes

- Existing requests without files will continue to work
- New requests can be created with or without files
- File uploads are handled automatically during request creation
- S3 URLs are generated and stored in the database

## Error Handling

The system now properly handles:
- Missing files (creates request without fileUrl)
- File upload failures (returns appropriate error messages)
- Invalid file types (validated by multer)
- S3 upload errors (returns 500 error with details) 