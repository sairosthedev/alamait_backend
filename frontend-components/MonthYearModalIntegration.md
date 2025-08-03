# Month/Year Selection Modal Integration Guide

## Overview
This modal component allows users to select a specific month and year when sending template-based monthly requests to finance.

## Component Usage

### 1. Import the Component
```jsx
import MonthYearSelectionModal from './MonthYearSelectionModal';
```

### 2. Add State Management
```jsx
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedRequestId, setSelectedRequestId] = useState(null);
```

### 3. Handle Send to Finance Action
```jsx
const handleSendToFinance = (requestId) => {
    setSelectedRequestId(requestId);
    setIsModalOpen(true);
};

const handleModalConfirm = async (month, year) => {
    try {
        const response = await fetch(`/api/monthly-requests/${selectedRequestId}/send-to-finance`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ month, year })
        });

        if (response.ok) {
            const result = await response.json();
            // Handle success
            console.log('Success:', result.message);
            // Refresh your data or update UI
        } else {
            const error = await response.json();
            // Handle error
            console.error('Error:', error.message);
        }
    } catch (error) {
        console.error('Network error:', error);
    }
};
```

### 4. Add the Modal to Your JSX
```jsx
return (
    <div>
        {/* Your existing content */}
        
        {/* Add buttons that trigger the modal */}
        <button 
            onClick={() => handleSendToFinance(request._id)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
            Send to Finance
        </button>

        {/* Modal Component */}
        <MonthYearSelectionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onConfirm={handleModalConfirm}
            title="Select Month and Year for Finance Submission"
            currentMonth={8} // Default to current month
            currentYear={2025} // Default to current year
        />
    </div>
);
```

## Complete Example Component

```jsx
import React, { useState } from 'react';
import MonthYearSelectionModal from './MonthYearSelectionModal';

const MonthlyRequestList = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSendToFinance = (requestId) => {
        setSelectedRequestId(requestId);
        setIsModalOpen(true);
    };

    const handleModalConfirm = async (month, year) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/monthly-requests/${selectedRequestId}/send-to-finance`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ month, year })
            });

            if (response.ok) {
                const result = await response.json();
                alert(`Success: ${result.message}`);
                // Refresh your data here
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            alert('Network error occurred');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Monthly Requests</h2>
            
            {/* Example request list */}
            <div className="space-y-4">
                <div className="border p-4 rounded">
                    <h3 className="font-semibold">Template Request</h3>
                    <p className="text-gray-600">Template-based monthly request</p>
                    <button 
                        onClick={() => handleSendToFinance('request-id-here')}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        disabled={loading}
                    >
                        {loading ? 'Sending...' : 'Send to Finance'}
                    </button>
                </div>
            </div>

            <MonthYearSelectionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleModalConfirm}
                title="Select Month and Year for Finance Submission"
            />
        </div>
    );
};

export default MonthlyRequestList;
```

## Error Handling

The backend will return specific error messages:

1. **Missing Month/Year**: `"Month and year are required for template submissions"`
2. **Already Submitted**: `"Monthly request for 8/2025 is already pending"`
3. **Permission Error**: `"Only admins can send requests to finance"`

## Styling

The modal uses Tailwind CSS classes. If you're not using Tailwind, you can replace the classes with your own CSS:

```css
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
}

.modal-content {
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    width: 24rem;
    max-width: 28rem;
    margin: 0 1rem;
}
```

## Backend Integration

The modal sends a PUT request to `/api/monthly-requests/:id/send-to-finance` with the following body:

```json
{
    "month": 8,
    "year": 2025
}
```

The backend will:
1. Validate the month/year parameters
2. Check if the request is a template
3. Create or update monthly approvals
4. Send the request to finance
5. Auto-approve past/current months if applicable 