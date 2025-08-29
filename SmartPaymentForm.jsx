import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

/**
 * Smart Payment Form Component
 * Integrates with Smart FIFO allocation backend system
 * Automatically allocates payments to oldest outstanding balances first
 */
const SmartPaymentForm = ({ onPaymentSuccess, onClose }) => {
  // Form state
  const [formData, setFormData] = useState({
    student: '',
    residence: '',
    totalAmount: 0,
    payments: [
      { type: 'rent', amount: 0 },
      { type: 'admin', amount: 0 },
      { type: 'deposit', amount: 0 }
    ],
    method: 'Cash',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [residences, setResidences] = useState([]);
  const [outstandingBalances, setOutstandingBalances] = useState(null);
  const [allocationPreview, setAllocationPreview] = useState(null);

  // Payment methods
  const paymentMethods = [
    'Cash',
    'Bank Transfer',
    'Ecocash',
    'Innbucks',
    'Online Payment'
  ];

  // Load initial data
  useEffect(() => {
    loadStudents();
    loadResidences();
  }, []);

  // Load outstanding balances when student changes
  useEffect(() => {
    if (formData.student) {
      loadOutstandingBalances(formData.student);
    }
  }, [formData.student]);

  // Calculate total amount when payment components change
  useEffect(() => {
    const total = formData.payments.reduce((sum, payment) => sum + payment.amount, 0);
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.payments]);

  /**
   * Load students from API
   */
  const loadStudents = async () => {
    try {
      const response = await fetch('/api/admin/students', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setStudents(data.data);
      }
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load students');
    }
  };

  /**
   * Load residences from API
   */
  const loadResidences = async () => {
    try {
      const response = await fetch('/api/admin/residences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setResidences(data.data);
      }
    } catch (error) {
      console.error('Error loading residences:', error);
      toast.error('Failed to load residences');
    }
  };

  /**
   * Load outstanding balances for selected student
   */
  const loadOutstandingBalances = async (studentId) => {
    try {
      const response = await fetch(`/api/admin/payment-allocation/student/${studentId}/ar-balances`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setOutstandingBalances(data.data);
      }
    } catch (error) {
      console.error('Error loading outstanding balances:', error);
      toast.error('Failed to load outstanding balances');
    }
  };

  /**
   * Preview Smart FIFO allocation
   */
  const previewAllocation = async () => {
    if (!formData.student || formData.totalAmount <= 0) {
      toast.warning('Please select a student and enter payment amount');
      return;
    }

    try {
      setLoading(true);
      
      // Create temporary payment data for preview
      const previewData = {
        totalAmount: formData.totalAmount,
        payments: formData.payments.filter(p => p.amount > 0),
        student: formData.student,
        residence: formData.residence,
        method: formData.method,
        date: formData.date
      };

      // Call the Smart FIFO allocation preview endpoint
      const response = await fetch('/api/admin/payment-allocation/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(previewData)
      });

      const data = await response.json();
      if (data.success) {
        setAllocationPreview(data.data);
        toast.success('Allocation preview generated');
      } else {
        toast.error(data.message || 'Failed to generate allocation preview');
      }
    } catch (error) {
      console.error('Error previewing allocation:', error);
      toast.error('Failed to preview allocation');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle form submission with Smart FIFO allocation
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.student) {
      toast.error('Please select a student');
      return;
    }

    if (formData.totalAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    try {
      setLoading(true);

      // Prepare payment data for Smart FIFO allocation
      const paymentData = {
        totalAmount: formData.totalAmount,
        payments: formData.payments.filter(p => p.amount > 0),
        student: formData.student,
        residence: formData.residence,
        method: formData.method,
        date: formData.date,
        description: formData.description
      };

      // Create payment with Smart FIFO allocation
      const response = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(paymentData)
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Payment recorded successfully with Smart FIFO allocation!');
        
        // Show allocation details
        if (data.allocation) {
          showAllocationDetails(data.allocation);
        }
        
        // Reset form
        setFormData({
          student: '',
          residence: '',
          totalAmount: 0,
          payments: [
            { type: 'rent', amount: 0 },
            { type: 'admin', amount: 0 },
            { type: 'deposit', amount: 0 }
          ],
          method: 'Cash',
          date: new Date().toISOString().split('T')[0],
          description: ''
        });
        
        setOutstandingBalances(null);
        setAllocationPreview(null);
        
        // Call success callback
        if (onPaymentSuccess) {
          onPaymentSuccess(data);
        }
      } else {
        toast.error(data.message || 'Payment failed');
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Failed to create payment');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Show allocation details modal
   */
  const showAllocationDetails = (allocation) => {
    const details = `
Smart FIFO Allocation Results:

Total Allocated: $${allocation.summary.totalAllocated}
Months Covered: ${allocation.summary.monthsCovered}
Allocation Method: ${allocation.summary.allocationMethod}

Monthly Breakdown:
${allocation.monthlyBreakdown.map(item => 
  `• ${item.paymentType}: $${item.amountAllocated} to ${item.month}`
).join('\n')}
    `;
    
    alert(details);
  };

  /**
   * Update payment component amount
   */
  const updatePaymentAmount = (index, amount) => {
    const updatedPayments = [...formData.payments];
    updatedPayments[index].amount = parseFloat(amount) || 0;
    setFormData(prev => ({ ...prev, payments: updatedPayments }));
  };

  /**
   * Auto-calculate payment components based on outstanding balances
   */
  const autoCalculatePayments = () => {
    if (!outstandingBalances || outstandingBalances.totalBalance <= 0) {
      toast.warning('No outstanding balances found for this student');
      return;
    }

    const totalOutstanding = outstandingBalances.totalBalance;
    const updatedPayments = [...formData.payments];

    // Distribute payment across components based on outstanding amounts
    updatedPayments[0].amount = Math.min(totalOutstanding * 0.8, totalOutstanding); // Rent
    updatedPayments[1].amount = Math.min(totalOutstanding * 0.1, totalOutstanding - updatedPayments[0].amount); // Admin
    updatedPayments[2].amount = Math.max(0, totalOutstanding - updatedPayments[0].amount - updatedPayments[1].amount); // Deposit

    setFormData(prev => ({ ...prev, payments: updatedPayments }));
    toast.info('Payment components auto-calculated based on outstanding balances');
  };

  return (
    <div className="smart-payment-form bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Smart Payment Form</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Student Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Student *
          </label>
          <select
            value={formData.student}
            onChange={(e) => setFormData(prev => ({ ...prev, student: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select a student...</option>
            {students.map(student => (
              <option key={student._id} value={student._id}>
                {student.firstName} {student.lastName} - {student.email}
              </option>
            ))}
          </select>
        </div>

        {/* Residence Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Residence *
          </label>
          <select
            value={formData.residence}
            onChange={(e) => setFormData(prev => ({ ...prev, residence: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select a residence...</option>
            {residences.map(residence => (
              <option key={residence._id} value={residence._id}>
                {residence.name}
              </option>
            ))}
          </select>
        </div>

        {/* Outstanding Balances Display */}
        {outstandingBalances && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Outstanding Balances</h3>
            <div className="text-sm text-blue-800">
              <p>Total Outstanding: <span className="font-semibold">${outstandingBalances.totalBalance.toFixed(2)}</span></p>
              <p>Months with Balance: <span className="font-semibold">{outstandingBalances.summary.monthsWithBalance}</span></p>
              {outstandingBalances.summary.oldestBalance && (
                <p>Oldest Balance: <span className="font-semibold">{outstandingBalances.summary.oldestBalance}</span></p>
              )}
            </div>
            <button
              type="button"
              onClick={autoCalculatePayments}
              className="mt-2 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            >
              Auto-Calculate Payments
            </button>
          </div>
        )}

        {/* Payment Components */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Components
          </label>
          <div className="space-y-3">
            {formData.payments.map((payment, index) => (
              <div key={payment.type} className="flex items-center space-x-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 capitalize">
                    {payment.type} Amount
                  </label>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) => updatePaymentAmount(index, e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-right">
            <span className="text-sm font-medium text-gray-700">
              Total: ${formData.totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method *
          </label>
          <select
            value={formData.method}
            onChange={(e) => setFormData(prev => ({ ...prev, method: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {paymentMethods.map(method => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
        </div>

        {/* Payment Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Date *
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
            placeholder="Payment description (optional)"
          />
        </div>

        {/* Allocation Preview */}
        {allocationPreview && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-green-900 mb-2">Allocation Preview</h3>
            <div className="text-sm text-green-800">
              <p>Method: <span className="font-semibold">{allocationPreview.summary.allocationMethod}</span></p>
              <p>Months Covered: <span className="font-semibold">{allocationPreview.summary.monthsCovered}</span></p>
              <p>Advance Amount: <span className="font-semibold">${allocationPreview.summary.advancePaymentAmount.toFixed(2)}</span></p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={previewAllocation}
            disabled={loading || !formData.student || formData.totalAmount <= 0}
            className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Preview Allocation'}
          </button>
          
          <button
            type="submit"
            disabled={loading || !formData.student || formData.totalAmount <= 0}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Record Payment'}
          </button>
        </div>
      </form>

      {/* Smart FIFO Info */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-yellow-900 mb-2">Smart FIFO Allocation</h3>
        <p className="text-xs text-yellow-800">
          This payment will be automatically allocated to the oldest outstanding balances first (FIFO principle). 
          The system ensures proper double-entry accounting and maintains accurate financial records.
        </p>
      </div>
    </div>
  );
};

export default SmartPaymentForm;
