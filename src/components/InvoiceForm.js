import React, { useState, useEffect } from 'react';
import { createInvoice, updateInvoice, getUnpaidTenants } from '@/services/invoiceService';

const defaultInvoice = {
  student: '', // student ID
  residence: '', // residence ID
  room: '',
  roomType: 'Standard',
  billingPeriod: '',
  billingStartDate: '',
  billingEndDate: '',
  dueDate: '',
  charges: [{ 
    description: 'Monthly Rent', 
    amount: 0, 
    quantity: 1, 
    unitPrice: 0, 
    category: 'rent', 
    taxRate: 0 
  }],
  notes: '',
  terms: 'Payment due within 7 days of invoice date',
  isRecurring: false,
  lateFeeRate: 5,
  gracePeriod: 3,
  status: 'draft',
};

function InvoiceForm({ initialData, onSuccess, mode = 'create' }) {
  const [form, setForm] = useState(initialData || defaultInvoice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unpaidTenants, setUnpaidTenants] = useState([]);
  const [residences, setResidences] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingTenants(true);
      try {
        const [tenants, residencesData] = await Promise.all([
          getUnpaidTenants(),
          fetch('/api/residences').then(res => res.json())
        ]);
        setUnpaidTenants(tenants);
        setResidences(residencesData.residences || residencesData || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setUnpaidTenants([]);
        setResidences([]);
      } finally {
        setLoadingTenants(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => {
      // Handle student selection
      if (name === 'student') {
        const selectedStudent = unpaidTenants.find(t => t._id === value || t.id === value);
        let room = f.room;
        let billingPeriod = f.billingPeriod;
        
        if (selectedStudent) {
          room = selectedStudent.room || selectedStudent.allocatedRoom || selectedStudent.currentRoom || '';
          billingPeriod = selectedStudent.billingPeriod || '';
        }
        
        return { 
          ...f, 
          student: value, 
          room, 
          billingPeriod 
        };
      }
      
      // Handle residence selection
      if (name === 'residence') {
        return { ...f, residence: value };
      }
      
      // Handle checkbox
      if (type === 'checkbox') {
        return { ...f, [name]: checked };
      }
      
      // Handle date fields
      if (name === 'billingStartDate') {
        const startDate = new Date(value);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
        
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + 7);
        
        return { 
          ...f, 
          billingStartDate: value,
          billingEndDate: endDate.toISOString().split('T')[0],
          dueDate: dueDate.toISOString().split('T')[0]
        };
      }
      
      return { ...f, [name]: value };
    });
  };

  const handleChargeChange = (idx, field, value) => {
    setForm(f => {
      const charges = [...f.charges];
      charges[idx][field] = value;
      
      // Auto-calculate amount if quantity or unitPrice changes
      if (field === 'quantity' || field === 'unitPrice') {
        const quantity = parseFloat(charges[idx].quantity) || 1;
        const unitPrice = parseFloat(charges[idx].unitPrice) || 0;
        charges[idx].amount = quantity * unitPrice;
      }
      
      return { ...f, charges };
    });
  };

  const addCharge = () => {
    setForm(f => ({ 
      ...f, 
      charges: [...f.charges, { 
        description: '', 
        amount: 0, 
        quantity: 1, 
        unitPrice: 0, 
        category: 'other', 
        taxRate: 0 
      }] 
    }));
  };

  const removeCharge = (idx) => {
    setForm(f => ({ 
      ...f, 
      charges: f.charges.filter((_, i) => i !== idx) 
    }));
  };

  const calculateTotal = () => {
    return form.charges.reduce((total, charge) => {
      const amount = parseFloat(charge.amount) || 0;
      const tax = amount * (parseFloat(charge.taxRate) || 0) / 100;
      return total + amount + tax;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!form.student) {
      setError('Please select a student');
      setLoading(false);
      return;
    }
    if (!form.residence) {
      setError('Please select a residence');
      setLoading(false);
      return;
    }
    if (!form.room) {
      setError('Room number is required');
      setLoading(false);
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const userId = user?._id || user?.id;
      
      const payload = {
        ...form,
        student: form.student,
        residence: form.residence,
        billingStartDate: new Date(form.billingStartDate),
        billingEndDate: new Date(form.billingEndDate),
        dueDate: new Date(form.dueDate),
        createdBy: userId
      };

      if (mode === 'edit') {
        await updateInvoice(form._id || form.id, payload);
      } else {
        await createInvoice(payload);
      }
      
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Invoice save error:', err);
      setError(err.response?.data?.message || 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  const chargeCategories = [
    { value: 'rent', label: 'Rent' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'late_fee', label: 'Late Fee' },
    { value: 'deposit', label: 'Deposit' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <div className="text-red-600 bg-red-50 p-3 rounded">{error}</div>}
      
      {/* Student Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
        {loadingTenants ? (
          <div className="text-gray-500 text-sm">Loading students...</div>
        ) : unpaidTenants.length > 0 ? (
          <select
            name="student"
            value={form.student}
            onChange={handleChange}
            className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select student...</option>
            {unpaidTenants.map(student => (
              <option key={student._id || student.id} value={student._id || student.id}>
                {student.firstName} {student.lastName} ({student.email})
              </option>
            ))}
          </select>
        ) : (
          <div className="text-gray-500 text-sm">No students available</div>
        )}
      </div>

      {/* Residence Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Residence *</label>
        <select
          name="residence"
          value={form.residence}
          onChange={handleChange}
          className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Select residence...</option>
          {residences.map(residence => (
            <option key={residence._id || residence.id} value={residence._id || residence.id}>
              {residence.name}
            </option>
          ))}
        </select>
      </div>

      {/* Room Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Room Number *</label>
          <input
            name="room"
            value={form.room}
            onChange={handleChange}
            className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Room 101"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
          <select
            name="roomType"
            value={form.roomType}
            onChange={handleChange}
            className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Standard">Standard</option>
            <option value="Premium">Premium</option>
            <option value="Deluxe">Deluxe</option>
          </select>
        </div>
      </div>

      {/* Billing Period */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Billing Period *</label>
          <input
            name="billingPeriod"
            value={form.billingPeriod}
            onChange={handleChange}
            className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="YYYY-MM"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
          <input
            type="date"
            name="billingStartDate"
            value={form.billingStartDate}
            onChange={handleChange}
            className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            name="billingEndDate"
            value={form.billingEndDate}
            onChange={handleChange}
            className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            readOnly
          />
        </div>
      </div>

      {/* Due Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
        <input
          type="date"
          name="dueDate"
          value={form.dueDate}
          onChange={handleChange}
          className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      {/* Charges */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Charges *</label>
        {form.charges.map((charge, idx) => (
          <div key={idx} className="border border-gray-200 p-3 rounded-md mb-3">
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-2">
                <input
                  placeholder="Description"
                  value={charge.description}
                  onChange={e => handleChargeChange(idx, 'description', e.target.value)}
                  className="border border-gray-300 px-2 py-1 rounded text-sm w-full"
                  required
                />
              </div>
              <div>
                <select
                  value={charge.category}
                  onChange={e => handleChargeChange(idx, 'category', e.target.value)}
                  className="border border-gray-300 px-2 py-1 rounded text-sm w-full"
                >
                  {chargeCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Qty"
                  value={charge.quantity}
                  onChange={e => handleChargeChange(idx, 'quantity', e.target.value)}
                  className="border border-gray-300 px-2 py-1 rounded text-sm w-full"
                  min="1"
                  step="1"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Unit Price"
                  value={charge.unitPrice}
                  onChange={e => handleChargeChange(idx, 'unitPrice', e.target.value)}
                  className="border border-gray-300 px-2 py-1 rounded text-sm w-full"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="Tax %"
                  value={charge.taxRate}
                  onChange={e => handleChargeChange(idx, 'taxRate', e.target.value)}
                  className="border border-gray-300 px-2 py-1 rounded text-sm w-16"
                  min="0"
                  max="100"
                />
                <span className="text-sm text-gray-600">%</span>
                {form.charges.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCharge(idx)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Amount: ${(parseFloat(charge.amount) || 0).toFixed(2)}
              {charge.taxRate > 0 && (
                <span className="ml-2">
                  (Tax: ${((parseFloat(charge.amount) || 0) * (parseFloat(charge.taxRate) || 0) / 100).toFixed(2)})
                </span>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addCharge}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          + Add Charge
        </button>
      </div>

      {/* Total */}
      <div className="bg-gray-50 p-3 rounded-md">
        <div className="text-right">
          <span className="font-semibold">Total Amount: ${calculateTotal().toFixed(2)}</span>
        </div>
      </div>

      {/* Recurring Billing */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isRecurring"
          checked={form.isRecurring}
          onChange={handleChange}
          className="rounded"
        />
        <label className="text-sm font-medium text-gray-700">Make this a recurring invoice</label>
      </div>

      {/* Late Fee Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Late Fee Rate (%)</label>
          <input
            type="number"
            name="lateFeeRate"
            value={form.lateFeeRate}
            onChange={handleChange}
            className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
            max="100"
            step="0.1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period (days)</label>
          <input
            type="number"
            name="gracePeriod"
            value={form.gracePeriod}
            onChange={handleChange}
            className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
            step="1"
          />
        </div>
      </div>

      {/* Notes and Terms */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="2"
          placeholder="Additional notes..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
        <textarea
          name="terms"
          value={form.terms}
          onChange={handleChange}
          className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="2"
          placeholder="Payment terms..."
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Saving...' : mode === 'edit' ? 'Update Invoice' : 'Create Invoice'}
      </button>
    </form>
  );
}

export default InvoiceForm; 