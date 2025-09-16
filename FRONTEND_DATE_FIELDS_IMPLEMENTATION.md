# Frontend Date Fields Implementation Guide

## Overview
The backend has been updated to support date tracking for monthly requests. All requests now have a `dateRequested` field when created, and a `datePaid` field when marked as paid/approved.

## Backend Changes Made

### 1. Model Schema Updates
- Added `dateRequested` field to MonthlyRequest model (defaults to current date)
- Added `datePaid` field to MonthlyRequest model (set when approved/paid)
- Added `datePaid` field to monthlyApprovals sub-schema for template approvals

### 2. API Endpoint Updates

#### Create Monthly Request
- **Endpoint**: `POST /api/monthly-requests`
- **New Field**: `dateRequested` (optional, defaults to current date if not provided)
- **Format**: ISO date string (e.g., "2024-01-15")

#### Approve Monthly Request
- **Endpoint**: `PUT /api/monthly-requests/:id/approve`
- **New Field**: `datePaid` (optional, defaults to current date if not provided)
- **Format**: ISO date string (e.g., "2024-01-20")

#### Finance Approve Monthly Request
- **Endpoint**: `PUT /api/monthly-requests/:id/finance-approve`
- **New Field**: `datePaid` (optional, defaults to current date if not provided)
- **Format**: ISO date string (e.g., "2024-01-20")

## Frontend Implementation Requirements

### 1. Create Monthly Request Form
Add a date picker field for `dateRequested`:

```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Date Requested *
  </label>
  <input
    type="date"
    value={formData.dateRequested}
    onChange={(e) => setFormData(prev => ({ ...prev, dateRequested: e.target.value }))}
    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    required
  />
</div>
```

### 2. Approval Forms
Add a date picker field for `datePaid` in approval forms:

```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Date Paid *
  </label>
  <input
    type="date"
    value={formData.datePaid}
    onChange={(e) => setFormData(prev => ({ ...prev, datePaid: e.target.value }))}
    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    required
  />
</div>
```

### 3. Form State Management
Update form state to include the new date fields:

```jsx
const [formData, setFormData] = useState({
  // ... existing fields
  dateRequested: new Date().toISOString().split('T')[0], // Default to today
  // ... other fields
});

// For approval forms
const [approvalData, setApprovalData] = useState({
  // ... existing fields
  datePaid: new Date().toISOString().split('T')[0], // Default to today
  // ... other fields
});
```

### 4. API Calls
Include the date fields in API requests:

```jsx
// Create request
const createRequest = async (requestData) => {
  const response = await fetch('/api/monthly-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ...requestData,
      dateRequested: requestData.dateRequested
    })
  });
  return response.json();
};

// Approve request
const approveRequest = async (requestId, approvalData) => {
  const response = await fetch(`/api/monthly-requests/${requestId}/approve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ...approvalData,
      datePaid: approvalData.datePaid
    })
  });
  return response.json();
};
```

### 5. Display Date Fields
Show the date fields in request details and lists:

```jsx
// In request details component
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="text-sm font-medium text-gray-500">Date Requested</label>
    <p className="text-sm text-gray-900">{new Date(request.dateRequested).toLocaleDateString()}</p>
  </div>
  {request.datePaid && (
    <div>
      <label className="text-sm font-medium text-gray-500">Date Paid</label>
      <p className="text-sm text-gray-900">{new Date(request.datePaid).toLocaleDateString()}</p>
    </div>
  )}
</div>
```

## Validation Rules

### Date Requested
- Required field
- Cannot be in the future (should be today or earlier)
- Defaults to current date if not provided

### Date Paid
- Required when approving/paid
- Cannot be earlier than dateRequested
- Cannot be in the future
- Defaults to current date if not provided

## Example Validation Function

```jsx
const validateDates = (dateRequested, datePaid = null) => {
  const today = new Date().toISOString().split('T')[0];
  const errors = [];

  // Validate dateRequested
  if (!dateRequested) {
    errors.push('Date requested is required');
  } else if (dateRequested > today) {
    errors.push('Date requested cannot be in the future');
  }

  // Validate datePaid if provided
  if (datePaid) {
    if (datePaid > today) {
      errors.push('Date paid cannot be in the future');
    }
    if (dateRequested && datePaid < dateRequested) {
      errors.push('Date paid cannot be earlier than date requested');
    }
  }

  return errors;
};
```

## Testing Checklist

- [ ] Create request form includes dateRequested field
- [ ] Approval forms include datePaid field
- [ ] Date validation works correctly
- [ ] API calls include the new date fields
- [ ] Date fields display correctly in request details
- [ ] Default dates are set correctly
- [ ] Error handling for invalid dates

## Notes

1. The backend automatically sets `dateRequested` to the current date if not provided
2. The backend automatically sets `datePaid` to the current date if not provided during approval
3. Both fields are stored as Date objects in the database
4. The API accepts ISO date strings (YYYY-MM-DD format)
5. Template approvals also support the `datePaid` field for monthly-specific approvals


