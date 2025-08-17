# Request File Upload Guide

This guide explains how to upload files for quotations in the request system. The system now supports two approaches:

## 1. FormData Approach (File Upload)

Use this approach when you want to upload an actual file from the frontend.

### Upload Quotation
```javascript
const formData = new FormData();
formData.append('quotation', file); // The actual file object
formData.append('provider', 'Tembo');
formData.append('amount', '150');
formData.append('description', 'geyser install');
formData.append('quotationDate', '2025-07-30');
formData.append('validUntil', '2025-08-29');
formData.append('notes', '');

const response = await fetch('/api/requests/request-id/quotations', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let the browser set it for FormData
    },
    body: formData
});
```

### Add Item Quotation
```javascript
const formData = new FormData();
formData.append('quotation', file); // The actual file object
formData.append('provider', 'Tembo');
formData.append('amount', '150');
formData.append('description', 'geyser install');

const response = await fetch('/api/requests/request-id/items/0/quotations', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let the browser set it for FormData
    },
    body: formData
});
```

## 2. JSON Approach (File URL)

Use this approach when you have already uploaded the file elsewhere and just need to provide the URL.

### Upload Quotation
```javascript
const data = {
    provider: 'Tembo',
    amount: '150',
    description: 'geyser install',
    quotationDate: '2025-07-30',
    validUntil: '2025-08-29',
    notes: '',
    fileUrl: 'https://your-s3-bucket.s3.amazonaws.com/quotations/file.pdf',
    fileName: 'quotation.pdf'
};

const response = await fetch('/api/requests/request-id/quotations', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
});
```

### Add Item Quotation
```javascript
const data = {
    provider: 'Tembo',
    amount: '150',
    description: 'geyser install',
    fileUrl: 'https://your-s3-bucket.s3.amazonaws.com/quotations/file.pdf',
    fileName: 'quotation.pdf'
};

const response = await fetch('/api/requests/request-id/items/0/quotations', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
});
```

## Frontend Implementation Examples

### React Example with FormData
```jsx
import React, { useState } from 'react';

function QuotationUpload({ requestId }) {
    const [file, setFile] = useState(null);
    const [formData, setFormData] = useState({
        provider: '',
        amount: '',
        description: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const data = new FormData();
        data.append('quotation', file);
        data.append('provider', formData.provider);
        data.append('amount', formData.amount);
        data.append('description', formData.description);

        try {
            const response = await fetch(`/api/requests/${requestId}/quotations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: data
            });
            
            if (response.ok) {
                console.log('Quotation uploaded successfully');
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
            />
            <input
                type="text"
                placeholder="Provider"
                value={formData.provider}
                onChange={(e) => setFormData({...formData, provider: e.target.value})}
            />
            <input
                type="number"
                placeholder="Amount"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
            />
            <textarea
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
            <button type="submit">Upload Quotation</button>
        </form>
    );
}
```

### React Example with JSON (File URL)
```jsx
import React, { useState } from 'react';

function QuotationUpload({ requestId }) {
    const [formData, setFormData] = useState({
        provider: '',
        amount: '',
        description: '',
        fileUrl: '',
        fileName: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const response = await fetch(`/api/requests/${requestId}/quotations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                console.log('Quotation uploaded successfully');
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="text"
                placeholder="File URL"
                value={formData.fileUrl}
                onChange={(e) => setFormData({...formData, fileUrl: e.target.value})}
            />
            <input
                type="text"
                placeholder="File Name"
                value={formData.fileName}
                onChange={(e) => setFormData({...formData, fileName: e.target.value})}
            />
            <input
                type="text"
                placeholder="Provider"
                value={formData.provider}
                onChange={(e) => setFormData({...formData, provider: e.target.value})}
            />
            <input
                type="number"
                placeholder="Amount"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
            />
            <textarea
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
            <button type="submit">Upload Quotation</button>
        </form>
    );
}
```

## Important Notes

1. **Content-Type Header**: 
   - For FormData: Don't set Content-Type manually, let the browser set it
   - For JSON: Always set `Content-Type: application/json`

2. **File Types**: The system accepts:
   - PDF files (`application/pdf`)
   - Word documents (`application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
   - Images (`image/jpeg`, `image/png`, `image/gif`)

3. **File Size**: Maximum file size is 10MB

4. **Authentication**: All requests require a valid JWT token in the Authorization header

5. **Error Handling**: The system provides detailed error messages and debugging information when uploads fail

## Testing

Use the provided test script to verify both approaches work:

```bash
node test-request-file-upload.js
```

Make sure to update the `ADMIN_TOKEN` variable in the test script with a valid admin token. 