# Vendor Creation for Quotations System Guide

## 🎯 Overview

When adding quotations to maintenance requests, the system can automatically detect new vendors and prompt for vendor creation. This guide explains the complete workflow, required fields, auto-generated fields, and frontend integration.

## 🔄 Workflow Overview

### **1. Quotation Addition Process:**
```
User adds quotation → System checks if vendor exists → 
If new vendor → Show vendor creation modal → 
Create vendor → Link to quotation → Complete request
```

### **2. Auto-Detection Logic:**
- When adding a quotation, the system checks if the `provider` name exists in the vendors collection
- If not found, the system flags it as a "new vendor" and triggers the vendor creation modal
- The modal pre-fills the `businessName` field with the provider name from the quotation

## 📋 Required Fields for Vendor Creation

### **🔴 Mandatory Fields (Validation Required):**

#### **Basic Information:**
- `businessName` (String) - Company/business name
- `category` (String) - Business category (see categories below)

#### **Contact Person:**
- `contactPerson.firstName` (String) - First name
- `contactPerson.lastName` (String) - Last name  
- `contactPerson.email` (String) - Email address (must be unique)
- `contactPerson.phone` (String) - Phone number

#### **Business Address:**
- `businessAddress.street` (String) - Street address
- `businessAddress.city` (String) - City

### **🟡 Optional Fields (Auto-generated if not provided):**

#### **Auto-Generated Fields:**
- `vendorCode` (String) - Auto-generated format: `V{YY}{XXXX}` (e.g., V250001)
- `chartOfAccountsCode` (String) - Auto-generated: `200{XXX}` (e.g., 200001)
- `expenseAccountCode` (String) - Auto-generated based on category

#### **Optional Business Details:**
- `tradingName` (String) - Alternative business name
- `contactPerson.mobile` (String) - Mobile number
- `businessAddress.state` (String) - State/Province
- `businessAddress.postalCode` (String) - Postal code
- `businessAddress.country` (String) - Defaults to "South Africa"

#### **Tax & Registration:**
- `taxNumber` (String) - Tax registration number
- `vatNumber` (String) - VAT registration number
- `registrationNumber` (String) - Business registration number

#### **Banking Information:**
- `bankDetails.bankName` (String) - Bank name
- `bankDetails.accountNumber` (String) - Account number
- `bankDetails.accountType` (String) - Account type
- `bankDetails.branchCode` (String) - Branch code
- `bankDetails.swiftCode` (String) - SWIFT code

#### **Business Classification:**
- `vendorType` (String) - Enum: `['shop', 'contractor', 'service_provider', 'other']`
- `businessScope` (String) - Description of business scope
- `specializations` (Array) - Array of specializations
- `serviceAreas` (Array) - Array of service areas

## 🏷️ Available Categories

### **Maintenance & Services:**
- `maintenance` - General maintenance
- `cleaning` - Cleaning services
- `security` - Security services
- `landscaping` - Landscaping services
- `electrical` - Electrical work
- `plumbing` - Plumbing services
- `carpentry` - Carpentry work
- `painting` - Painting services

### **Supplies & Equipment:**
- `supplies` - General supplies
- `equipment` - Equipment and tools
- `utilities` - Utility services

### **Other:**
- `services` - General services
- `other` - Other categories

## 🚀 API Endpoints

### **Create Vendor:**
```http
POST /api/finance/vendors
Content-Type: application/json
Authorization: Bearer <token>

{
    "businessName": "ABC Electrical Services",
    "category": "electrical",
    "contactPerson": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@abcelectrical.com",
        "phone": "+27 11 123 4567"
    },
    "businessAddress": {
        "street": "123 Main Street",
        "city": "Johannesburg"
    },
    "bankDetails": {
        "bankName": "Standard Bank",
        "accountNumber": "1234567890",
        "accountType": "Business Account"
    }
}
```

### **Search Vendors (for quotation system):**
```http
GET /api/finance/vendors/for-quotations
Authorization: Bearer <token>
```

### **Get Vendors by Category:**
```http
GET /api/finance/vendors/category/electrical
Authorization: Bearer <token>
```

## 💻 Frontend Integration

### **React Component Example:**

```jsx
import React, { useState, useEffect } from 'react';
import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid
} from '@mui/material';

const VendorCreationModal = ({ 
    open, 
    onClose, 
    onVendorCreated, 
    prefillProvider = '' 
}) => {
    const [formData, setFormData] = useState({
        businessName: prefillProvider,
        category: 'other',
        contactPerson: {
            firstName: '',
            lastName: '',
            email: '',
            phone: ''
        },
        businessAddress: {
            street: '',
            city: ''
        },
        bankDetails: {
            bankName: '',
            accountNumber: '',
            accountType: ''
        }
    });

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const categories = [
        'maintenance', 'cleaning', 'security', 'landscaping',
        'electrical', 'plumbing', 'carpentry', 'painting',
        'supplies', 'equipment', 'utilities', 'services', 'other'
    ];

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/finance/vendors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const result = await response.json();
                onVendorCreated(result.vendor);
                onClose();
            } else {
                const error = await response.json();
                setErrors(error.fields || {});
            }
        } catch (error) {
            console.error('Error creating vendor:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Create New Vendor</DialogTitle>
            <DialogContent>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    {/* Basic Information */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Business Name *"
                            value={formData.businessName}
                            onChange={(e) => setFormData({
                                ...formData,
                                businessName: e.target.value
                            })}
                            error={!!errors.businessName}
                            helperText={errors.businessName}
                        />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                            <InputLabel>Category *</InputLabel>
                            <Select
                                value={formData.category}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    category: e.target.value
                                })}
                            >
                                {categories.map(cat => (
                                    <MenuItem key={cat} value={cat}>
                                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Contact Person */}
                    <Grid item xs={12}>
                        <h4>Contact Person</h4>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="First Name *"
                            value={formData.contactPerson.firstName}
                            onChange={(e) => setFormData({
                                ...formData,
                                contactPerson: {
                                    ...formData.contactPerson,
                                    firstName: e.target.value
                                }
                            })}
                            error={!!errors['contactPerson.firstName']}
                            helperText={errors['contactPerson.firstName']}
                        />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Last Name *"
                            value={formData.contactPerson.lastName}
                            onChange={(e) => setFormData({
                                ...formData,
                                contactPerson: {
                                    ...formData.contactPerson,
                                    lastName: e.target.value
                                }
                            })}
                            error={!!errors['contactPerson.lastName']}
                            helperText={errors['contactPerson.lastName']}
                        />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Email *"
                            type="email"
                            value={formData.contactPerson.email}
                            onChange={(e) => setFormData({
                                ...formData,
                                contactPerson: {
                                    ...formData.contactPerson,
                                    email: e.target.value
                                }
                            })}
                            error={!!errors['contactPerson.email']}
                            helperText={errors['contactPerson.email']}
                        />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Phone *"
                            value={formData.contactPerson.phone}
                            onChange={(e) => setFormData({
                                ...formData,
                                contactPerson: {
                                    ...formData.contactPerson,
                                    phone: e.target.value
                                }
                            })}
                            error={!!errors['contactPerson.phone']}
                            helperText={errors['contactPerson.phone']}
                        />
                    </Grid>

                    {/* Business Address */}
                    <Grid item xs={12}>
                        <h4>Business Address</h4>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Street Address *"
                            value={formData.businessAddress.street}
                            onChange={(e) => setFormData({
                                ...formData,
                                businessAddress: {
                                    ...formData.businessAddress,
                                    street: e.target.value
                                }
                            })}
                            error={!!errors['businessAddress.street']}
                            helperText={errors['businessAddress.street']}
                        />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="City *"
                            value={formData.businessAddress.city}
                            onChange={(e) => setFormData({
                                ...formData,
                                businessAddress: {
                                    ...formData.businessAddress,
                                    city: e.target.value
                                }
                            })}
                            error={!!errors['businessAddress.city']}
                            helperText={errors['businessAddress.city']}
                        />
                    </Grid>

                    {/* Banking Information */}
                    <Grid item xs={12}>
                        <h4>Banking Information (Optional)</h4>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Bank Name"
                            value={formData.bankDetails.bankName}
                            onChange={(e) => setFormData({
                                ...formData,
                                bankDetails: {
                                    ...formData.bankDetails,
                                    bankName: e.target.value
                                }
                            })}
                        />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Account Number"
                            value={formData.bankDetails.accountNumber}
                            onChange={(e) => setFormData({
                                ...formData,
                                bankDetails: {
                                    ...formData.bankDetails,
                                    accountNumber: e.target.value
                                }
                            })}
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button 
                    onClick={handleSubmit} 
                    variant="contained" 
                    disabled={loading}
                >
                    {loading ? 'Creating...' : 'Create Vendor'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default VendorCreationModal;
```

### **Integration with Quotation System:**

```jsx
// In your quotation component
const [showVendorModal, setShowVendorModal] = useState(false);
const [newVendorProvider, setNewVendorProvider] = useState('');

const handleAddQuotation = async (quotationData) => {
    try {
        // Check if vendor exists
        const vendorResponse = await fetch(`/api/finance/vendors/search?q=${quotationData.provider}`);
        const vendors = await vendorResponse.json();
        
        if (vendors.length === 0) {
            // New vendor detected
            setNewVendorProvider(quotationData.provider);
            setShowVendorModal(true);
            return;
        }
        
        // Vendor exists, proceed with quotation
        await addQuotation(quotationData);
        
    } catch (error) {
        console.error('Error checking vendor:', error);
    }
};

const handleVendorCreated = (newVendor) => {
    // Update quotation with vendor details
    const updatedQuotation = {
        ...currentQuotation,
        vendorId: newVendor._id,
        vendorName: newVendor.businessName,
        vendorCode: newVendor.vendorCode
    };
    
    addQuotation(updatedQuotation);
    setShowVendorModal(false);
};

return (
    <>
        {/* Your quotation form */}
        
        <VendorCreationModal
            open={showVendorModal}
            onClose={() => setShowVendorModal(false)}
            onVendorCreated={handleVendorCreated}
            prefillProvider={newVendorProvider}
        />
    </>
);
```

## 🔧 Auto-Generated Fields Logic

### **Vendor Code Generation:**
```javascript
// Format: V{YY}{XXXX}
// Example: V250001 (Year 2025, Vendor #1)
async function generateVendorCode() {
    const count = await Vendor.countDocuments();
    const year = new Date().getFullYear().toString().substr(-2);
    const sequence = (count + 1).toString().padStart(4, '0');
    return `V${year}${sequence}`;
}
```

### **Chart of Accounts Code:**
```javascript
// Format: 200{XXX} (Accounts Payable series)
const vendorCount = await Vendor.countDocuments();
chartOfAccountsCode = `200${(vendorCount + 1).toString().padStart(3, '0')}`;
```

### **Expense Account Code (by Category):**
```javascript
const categoryExpenseMap = {
    'maintenance': '5000',
    'utilities': '5001', 
    'supplies': '5000',
    'equipment': '5000',
    'services': '5000',
    'cleaning': '5010',
    'security': '5011',
    'landscaping': '5000',
    'electrical': '5000',
    'plumbing': '5000',
    'carpentry': '5000',
    'painting': '5000',
    'other': '5013'
};
```

## 🎯 Key Features

### ✅ **What Works:**
1. **Auto-Detection**: System detects new vendors from quotation provider names
2. **Pre-filled Forms**: Business name auto-filled from quotation provider
3. **Validation**: Comprehensive field validation with clear error messages
4. **Auto-Generation**: Vendor codes and chart of accounts codes generated automatically
5. **Bank Details**: Optional banking information for payment method determination
6. **Category Mapping**: Automatic expense account code assignment based on category
7. **Integration**: Seamless integration with quotation and expense systems

### 🔧 **How to Use:**

#### **For Admins/Finance Users:**
1. Add quotation to maintenance request
2. If provider is new, vendor creation modal appears
3. Fill required fields (business name pre-filled)
4. Submit to create vendor
5. Quotation automatically linked to new vendor
6. Vendor available for future quotations

#### **For Frontend Developers:**
1. Implement vendor search before adding quotations
2. Show vendor creation modal for new providers
3. Handle vendor creation response
4. Update quotation with vendor details
5. Provide clear validation feedback

## 🧪 Testing

### **Test Vendor Creation:**
```bash
# Test vendor creation API
curl -X POST http://localhost:5000/api/finance/vendors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "businessName": "Test Electrical",
    "category": "electrical",
    "contactPerson": {
      "firstName": "John",
      "lastName": "Doe", 
      "email": "john@testelectrical.com",
      "phone": "+27 11 123 4567"
    },
    "businessAddress": {
      "street": "123 Test Street",
      "city": "Johannesburg"
    }
  }'
```

### **Test Vendor Search:**
```bash
# Search for existing vendors
curl -X GET "http://localhost:5000/api/finance/vendors/search?q=electrical" \
  -H "Authorization: Bearer <token>"
```

## 📈 Benefits

1. **Streamlined Process**: No need to create vendors separately
2. **Data Consistency**: Vendors automatically linked to quotations
3. **Payment Integration**: Bank details determine payment methods
4. **Financial Tracking**: Automatic chart of accounts integration
5. **Audit Trail**: Complete history of vendor creation and updates
6. **Flexible**: Handles both simple and complex vendor information

The vendor creation system seamlessly integrates with the quotation workflow, ensuring all vendors are properly registered and linked for financial tracking! 🚀 