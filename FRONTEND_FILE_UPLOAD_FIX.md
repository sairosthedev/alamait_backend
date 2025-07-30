# Frontend File Upload Fix Guide

## The Problem
Your frontend is sending:
```javascript
{
    provider: "Tembo",
    description: "Building",
    file: {}, // ❌ Empty object - this is the problem!
    // ... other fields
}
```

Instead of actually uploading a file or providing a file URL.

## Root Cause
The frontend file input is not properly connected to the form submission. This typically happens when:

1. **File input is not included in FormData**
2. **FormData is not used for file uploads**
3. **File input value is not captured**

## Solution: Fix Your Frontend Code

### Method 1: Use FormData (Recommended)

```javascript
// ✅ CORRECT - Using FormData for file uploads
const uploadQuotation = async (requestId, formData) => {
    try {
        const response = await fetch(`/api/requests/${requestId}/quotations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                // Don't set Content-Type - browser will set it automatically
            },
            body: formData // Send FormData directly
        });
        
        return await response.json();
    } catch (error) {
        console.error('Upload failed:', error);
        throw error;
    }
};

// Usage in your form submission
const handleSubmit = async (event) => {
    event.preventDefault();
    
    const formData = new FormData();
    
    // Add the file
    const fileInput = document.getElementById('quotationFile');
    if (fileInput.files[0]) {
        formData.append('quotation', fileInput.files[0]);
    } else {
        alert('Please select a file');
        return;
    }
    
    // Add other form data
    formData.append('provider', document.getElementById('provider').value);
    formData.append('amount', document.getElementById('amount').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('validUntil', document.getElementById('validUntil').value);
    formData.append('terms', document.getElementById('terms').value);
    
    // Upload
    const result = await uploadQuotation(requestId, formData);
    console.log('Success:', result);
};
```

### Method 2: React Example

```jsx
import React, { useState, useRef } from 'react';

const QuotationUpload = ({ requestId }) => {
    const [formData, setFormData] = useState({
        provider: '',
        amount: '',
        description: '',
        validUntil: '',
        terms: ''
    });
    const fileInputRef = useRef(null);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Check if file is selected
        if (!fileInputRef.current.files[0]) {
            alert('Please select a file');
            return;
        }
        
        // Create FormData
        const uploadData = new FormData();
        uploadData.append('quotation', fileInputRef.current.files[0]);
        uploadData.append('provider', formData.provider);
        uploadData.append('amount', formData.amount);
        uploadData.append('description', formData.description);
        uploadData.append('validUntil', formData.validUntil);
        uploadData.append('terms', formData.terms);
        
        try {
            const response = await fetch(`/api/requests/${requestId}/quotations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: uploadData
            });
            
            const result = await response.json();
            console.log('Upload successful:', result);
        } catch (error) {
            console.error('Upload failed:', error);
        }
    };
    
    return (
        <form onSubmit={handleSubmit}>
            <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                required
            />
            <input
                type="text"
                placeholder="Provider"
                value={formData.provider}
                onChange={(e) => setFormData({...formData, provider: e.target.value})}
                required
            />
            <input
                type="number"
                placeholder="Amount"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                required
            />
            <textarea
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
            <button type="submit">Upload Quotation</button>
        </form>
    );
};
```

### Method 3: Vue.js Example

```vue
<template>
    <form @submit.prevent="handleSubmit">
        <input
            type="file"
            ref="fileInput"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            required
        />
        <input
            type="text"
            v-model="formData.provider"
            placeholder="Provider"
            required
        />
        <input
            type="number"
            v-model="formData.amount"
            placeholder="Amount"
            required
        />
        <textarea
            v-model="formData.description"
            placeholder="Description"
        />
        <button type="submit">Upload Quotation</button>
    </form>
</template>

<script>
export default {
    data() {
        return {
            formData: {
                provider: '',
                amount: '',
                description: '',
                validUntil: '',
                terms: ''
            }
        };
    },
    methods: {
        async handleSubmit() {
            // Check if file is selected
            if (!this.$refs.fileInput.files[0]) {
                alert('Please select a file');
                return;
            }
            
            // Create FormData
            const uploadData = new FormData();
            uploadData.append('quotation', this.$refs.fileInput.files[0]);
            uploadData.append('provider', this.formData.provider);
            uploadData.append('amount', this.formData.amount);
            uploadData.append('description', this.formData.description);
            uploadData.append('validUntil', this.formData.validUntil);
            uploadData.append('terms', this.formData.terms);
            
            try {
                const response = await fetch(`/api/requests/${this.requestId}/quotations`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                    },
                    body: uploadData
                });
                
                const result = await response.json();
                console.log('Upload successful:', result);
            } catch (error) {
                console.error('Upload failed:', error);
            }
        }
    }
};
</script>
```

## What You're Currently Doing Wrong

❌ **Your current code probably looks like this:**
```javascript
// WRONG - Sending JSON with empty file object
const payload = {
    provider: "Tembo",
    description: "Building",
    file: {}, // ❌ This is wrong!
    amount: "150",
    // ... other fields
};

fetch('/api/requests/123/quotations', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload) // ❌ Sending JSON instead of FormData
});
```

## Debug Your Current Code

Add this debugging to see what's happening:

```javascript
// Add this to your form submission
const handleSubmit = (event) => {
    event.preventDefault();
    
    // Debug: Check what's in your form
    const form = event.target;
    const formData = new FormData(form);
    
    console.log('FormData contents:');
    for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
    }
    
    // Check if file is actually selected
    const fileInput = form.querySelector('input[type="file"]');
    console.log('File input files:', fileInput.files);
    console.log('Selected file:', fileInput.files[0]);
    
    // Continue with your upload logic...
};
```

## Quick Fix Checklist

1. ✅ **Use FormData instead of JSON for file uploads**
2. ✅ **Don't set Content-Type header for FormData**
3. ✅ **Check if file is actually selected before submitting**
4. ✅ **Use `formData.append('quotation', file)` to add the file**
5. ✅ **Send FormData as the body, not JSON.stringify()**

## Test Your Fix

After implementing the fix, you should see in the Network tab:
- **Content-Type**: `multipart/form-data; boundary=...`
- **Request Payload**: Form data with the actual file content
- **Response**: Success with file URL

Instead of:
- **Content-Type**: `application/json`
- **Request Payload**: `{"file": {}, "provider": "Tembo", ...}`
- **Response**: Error about missing file 