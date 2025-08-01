# Frontend Integration Guide

## 🎯 **Frontend Implementation Checklist**

### **1. Request Creation Forms**

#### **Student Maintenance Request Form**
```javascript
// React Component Example
const StudentRequestForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'maintenance', // Fixed for students
    residence: '', // Auto-filled from user profile
    room: '',
    category: '',
    priority: 'medium'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        // Handle success
        showSuccessMessage('Request created successfully');
      } else {
        const error = await response.json();
        showErrorMessage(error.message);
      }
    } catch (error) {
      showErrorMessage('Failed to create request');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Request Title"
        value={formData.title}
        onChange={(e) => setFormData({...formData, title: e.target.value})}
        required
      />
      <textarea
        placeholder="Description"
        value={formData.description}
        onChange={(e) => setFormData({...formData, description: e.target.value})}
        required
      />
      <select
        value={formData.category}
        onChange={(e) => setFormData({...formData, category: e.target.value})}
        required
      >
        <option value="">Select Category</option>
        <option value="plumbing">Plumbing</option>
        <option value="electrical">Electrical</option>
        <option value="hvac">HVAC</option>
        <option value="appliance">Appliance</option>
        <option value="structural">Structural</option>
        <option value="other">Other</option>
      </select>
      <input
        type="text"
        placeholder="Room Number"
        value={formData.room}
        onChange={(e) => setFormData({...formData, room: e.target.value})}
        required
      />
      <select
        value={formData.priority}
        onChange={(e) => setFormData({...formData, priority: e.target.value})}
      >
        <option value="low">Low Priority</option>
        <option value="medium">Medium Priority</option>
        <option value="high">High Priority</option>
      </select>
      <button type="submit">Submit Request</button>
    </form>
  );
};
```

#### **Admin Operational Request Form**
```javascript
const AdminRequestForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'operational',
    residence: '',
    department: '',
    requestedBy: '',
    deliveryLocation: '',
    items: [],
    priority: 'medium'
  });

  const [items, setItems] = useState([]);

  const addItem = () => {
    setItems([...items, {
      description: '',
      quantity: 1,
      unitCost: 0,
      purpose: ''
    }]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const requestData = {
      ...formData,
      items: items
    };

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });
      
      if (response.ok) {
        showSuccessMessage('Request created successfully');
      } else {
        const error = await response.json();
        showErrorMessage(error.message);
      }
    } catch (error) {
      showErrorMessage('Failed to create request');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Request Title"
        value={formData.title}
        onChange={(e) => setFormData({...formData, title: e.target.value})}
        required
      />
      <textarea
        placeholder="Description"
        value={formData.description}
        onChange={(e) => setFormData({...formData, description: e.target.value})}
        required
      />
      <input
        type="text"
        placeholder="Department"
        value={formData.department}
        onChange={(e) => setFormData({...formData, department: e.target.value})}
        required
      />
      <input
        type="text"
        placeholder="Requested By"
        value={formData.requestedBy}
        onChange={(e) => setFormData({...formData, requestedBy: e.target.value})}
        required
      />
      <input
        type="text"
        placeholder="Delivery Location"
        value={formData.deliveryLocation}
        onChange={(e) => setFormData({...formData, deliveryLocation: e.target.value})}
        required
      />
      
      {/* Items Section */}
      <div>
        <h3>Items/Services</h3>
        {items.map((item, index) => (
          <div key={index}>
            <input
              type="text"
              placeholder="Item Description"
              value={item.description}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
              required
            />
            <input
              type="number"
              placeholder="Quantity"
              value={item.quantity}
              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
              min="1"
              required
            />
            <input
              type="number"
              placeholder="Unit Cost"
              value={item.unitCost}
              onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value))}
              min="0"
              step="0.01"
            />
            <input
              type="text"
              placeholder="Purpose"
              value={item.purpose}
              onChange={(e) => updateItem(index, 'purpose', e.target.value)}
            />
          </div>
        ))}
        <button type="button" onClick={addItem}>Add Item</button>
      </div>
      
      <button type="submit">Submit Request</button>
    </form>
  );
};
```

### **2. Quotation Upload Component**

```javascript
const QuotationUpload = ({ requestId }) => {
  const [quotationData, setQuotationData] = useState({
    provider: '',
    amount: '',
    description: '',
    validUntil: '',
    terms: ''
  });
  const [file, setFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('provider', quotationData.provider);
    formData.append('amount', quotationData.amount);
    formData.append('description', quotationData.description);
    formData.append('validUntil', quotationData.validUntil);
    formData.append('terms', quotationData.terms);
    
    if (file) {
      formData.append('file', file);
    }

    try {
      const response = await fetch(`/api/requests/${requestId}/quotations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        showSuccessMessage('Quotation uploaded successfully');
        // Refresh request data to show new quotation
      } else {
        const error = await response.json();
        showErrorMessage(error.message);
      }
    } catch (error) {
      showErrorMessage('Failed to upload quotation');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Provider Name"
        value={quotationData.provider}
        onChange={(e) => setQuotationData({...quotationData, provider: e.target.value})}
        required
      />
      <input
        type="number"
        placeholder="Amount"
        value={quotationData.amount}
        onChange={(e) => setQuotationData({...quotationData, amount: e.target.value})}
        min="0"
        step="0.01"
        required
      />
      <textarea
        placeholder="Description"
        value={quotationData.description}
        onChange={(e) => setQuotationData({...quotationData, description: e.target.value})}
      />
      <input
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <input
        type="date"
        placeholder="Valid Until"
        value={quotationData.validUntil}
        onChange={(e) => setQuotationData({...quotationData, validUntil: e.target.value})}
      />
      <textarea
        placeholder="Terms and Conditions"
        value={quotationData.terms}
        onChange={(e) => setQuotationData({...quotationData, terms: e.target.value})}
      />
      <button type="submit">Upload Quotation</button>
    </form>
  );
};
```

### **3. Approval Workflow Components**

#### **Finance Approval Component**
```javascript
const FinanceApproval = ({ requestId, quotations }) => {
  const [approvalData, setApprovalData] = useState({
    approved: false,
    rejected: false,
    waitlisted: false,
    notes: '',
    selectedQuotationId: ''
  });

  const handleApproval = async (action) => {
    const data = {
      ...approvalData,
      [action]: true
    };

    try {
      const response = await fetch(`/api/requests/${requestId}/finance-approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        showSuccessMessage(`Request ${action} successfully`);
      } else {
        const error = await response.json();
        showErrorMessage(error.message);
      }
    } catch (error) {
      showErrorMessage(`Failed to ${action} request`);
    }
  };

  return (
    <div>
      <h3>Finance Approval</h3>
      
      {/* Quotation Selection */}
      <div>
        <h4>Select Quotation</h4>
        {quotations.map((quotation, index) => (
          <div key={quotation._id}>
            <input
              type="radio"
              name="selectedQuotation"
              value={quotation._id}
              onChange={(e) => setApprovalData({
                ...approvalData,
                selectedQuotationId: e.target.value
              })}
            />
            <label>
              {quotation.provider} - ${quotation.amount}
            </label>
          </div>
        ))}
      </div>
      
      <textarea
        placeholder="Approval Notes"
        value={approvalData.notes}
        onChange={(e) => setApprovalData({...approvalData, notes: e.target.value})}
      />
      
      <button onClick={() => handleApproval('approved')}>Approve</button>
      <button onClick={() => handleApproval('rejected')}>Reject</button>
      <button onClick={() => handleApproval('waitlisted')}>Waitlist</button>
    </div>
  );
};
```

### **4. Payment Processing Component**

```javascript
const PaymentProcessing = ({ expenseId, amount }) => {
  const [paymentData, setPaymentData] = useState({
    paymentMethod: 'Cash',
    paidBy: '',
    paidDate: new Date().toISOString().split('T')[0],
    receiptImage: null
  });

  const handlePayment = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('paymentMethod', paymentData.paymentMethod);
    formData.append('paidBy', paymentData.paidBy);
    formData.append('paidDate', paymentData.paidDate);
    
    if (paymentData.receiptImage) {
      formData.append('receiptImage', paymentData.receiptImage);
    }

    try {
      const response = await fetch(`/api/expenses/${expenseId}/mark-paid`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        showSuccessMessage('Payment processed successfully');
      } else {
        const error = await response.json();
        showErrorMessage(error.message);
      }
    } catch (error) {
      showErrorMessage('Failed to process payment');
    }
  };

  return (
    <form onSubmit={handlePayment}>
      <h3>Process Payment - ${amount}</h3>
      
      <select
        value={paymentData.paymentMethod}
        onChange={(e) => setPaymentData({...paymentData, paymentMethod: e.target.value})}
        required
      >
        <option value="Cash">Cash</option>
        <option value="Bank Transfer">Bank Transfer</option>
        <option value="Online Payment">Online Payment</option>
        <option value="Ecocash">Ecocash</option>
        <option value="Innbucks">Innbucks</option>
      </select>
      
      <input
        type="text"
        placeholder="Paid By"
        value={paymentData.paidBy}
        onChange={(e) => setPaymentData({...paymentData, paidBy: e.target.value})}
        required
      />
      
      <input
        type="date"
        value={paymentData.paidDate}
        onChange={(e) => setPaymentData({...paymentData, paidDate: e.target.value})}
        required
      />
      
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => setPaymentData({...paymentData, receiptImage: e.target.files[0]})}
      />
      
      <button type="submit">Mark as Paid</button>
    </form>
  );
};
```

### **5. Status Tracking Component**

```javascript
const RequestStatus = ({ request }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'approved': return 'green';
      case 'rejected': return 'red';
      case 'completed': return 'blue';
      default: return 'gray';
    }
  };

  const getApprovalStage = () => {
    if (request.type === 'maintenance') {
      return request.status;
    } else {
      if (!request.approval.admin.approved) return 'Admin Approval Pending';
      if (!request.approval.finance.approved) return 'Finance Approval Pending';
      if (!request.approval.ceo.approved) return 'CEO Approval Pending';
      return 'Fully Approved';
    }
  };

  return (
    <div>
      <h3>Request Status</h3>
      <div style={{ color: getStatusColor(request.status) }}>
        Status: {request.status}
      </div>
      <div>
        Approval Stage: {getApprovalStage()}
      </div>
      
      {/* Approval Timeline */}
      <div>
        <h4>Approval Timeline</h4>
        {request.requestHistory.map((history, index) => (
          <div key={index}>
            <span>{new Date(history.date).toLocaleDateString()}</span>
            <span>{history.action}</span>
            <span>{history.changes.join(', ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## 🎨 **UI/UX Best Practices**

### **1. Form Validation**
- Real-time validation for required fields
- Clear error messages
- Disable submit button until form is valid
- Show loading states during submission

### **2. Status Indicators**
- Color-coded status badges
- Progress indicators for approval workflow
- Real-time status updates
- Clear action buttons based on current status

### **3. File Upload**
- Drag and drop support
- File type validation
- Upload progress indicators
- Preview for uploaded files

### **4. Responsive Design**
- Mobile-friendly forms
- Touch-friendly buttons
- Responsive tables for data display
- Collapsible sections for complex forms

## 🔧 **Integration Tips**

### **1. Error Handling**
```javascript
const handleApiError = (error) => {
  if (error.status === 400) {
    showValidationErrors(error.errors);
  } else if (error.status === 403) {
    showPermissionError();
  } else if (error.status === 404) {
    showNotFoundError();
  } else {
    showGenericError();
  }
};
```

### **2. Real-time Updates**
```javascript
// Use WebSocket or polling for real-time status updates
const pollRequestStatus = (requestId) => {
  setInterval(async () => {
    const response = await fetch(`/api/requests/${requestId}`);
    const updatedRequest = await response.json();
    setRequest(updatedRequest);
  }, 5000); // Poll every 5 seconds
};
```

### **3. File Upload Progress**
```javascript
const uploadWithProgress = async (file, onProgress) => {
  const xhr = new XMLHttpRequest();
  
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percentComplete = (e.loaded / e.total) * 100;
      onProgress(percentComplete);
    }
  });
  
  xhr.open('POST', '/api/upload');
  xhr.send(file);
};
```

This frontend integration guide provides comprehensive examples and best practices for implementing the request-to-payment flow system in your frontend application. 