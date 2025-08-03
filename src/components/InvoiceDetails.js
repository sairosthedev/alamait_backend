import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoice, recordPayment, sendReminder } from '@/services/invoiceService';
import FinanceSidebar from './FinanceSidebar';

function InvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Bank Transfer',
    reference: '',
    notes: ''
  });
  const [reminderForm, setReminderForm] = useState({
    type: 'due_date',
    sentVia: 'email',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await getInvoice(id);
      setInvoice(res.data.invoice || res.data);
    } catch (err) {
      setError('Failed to fetch invoice');
      console.error('Error fetching invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recordPayment(id, paymentForm);
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', paymentMethod: 'Bank Transfer', reference: '', notes: '' });
      fetchInvoice(); // Refresh invoice data
    } catch (err) {
      console.error('Error recording payment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReminderSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sendReminder(id, reminderForm);
      setShowReminderModal(false);
      setReminderForm({ type: 'due_date', sentVia: 'email', message: '' });
      fetchInvoice(); // Refresh invoice data
    } catch (err) {
      console.error('Error sending reminder:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-yellow-100 text-yellow-800';
      case 'partially_paid': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return (
    <div className="flex bg-zinc-50 min-h-screen">
      <FinanceSidebar activeTab="invoices" />
      <div className="flex-1 ml-14 md:ml-52 w-full p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-center text-gray-600">Loading invoice...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex bg-zinc-50 min-h-screen">
      <FinanceSidebar activeTab="invoices" />
      <div className="flex-1 ml-14 md:ml-52 w-full p-6">
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    </div>
  );

  if (!invoice) return (
    <div className="flex bg-zinc-50 min-h-screen">
      <FinanceSidebar activeTab="invoices" />
      <div className="flex-1 ml-14 md:ml-52 w-full p-6">
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <p className="text-yellow-800">Invoice not found.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex bg-zinc-50 min-h-screen">
      <FinanceSidebar activeTab="invoices" />
      <div className="flex-1 ml-14 md:ml-52 w-full">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <button 
                className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
                onClick={() => navigate(-1)}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Invoices
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Invoice #{invoice.invoiceNumber}</h1>
            </div>
            <div className="flex space-x-2">
              {invoice.status === 'sent' && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Record Payment
                </button>
              )}
              {invoice.balanceDue > 0 && (
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Send Reminder
                </button>
              )}
              <button
                onClick={() => window.open(`/api/invoices/${id}/pdf`, '_blank')}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Download PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Invoice Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Invoice Information */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Issue Date</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : '--'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Due Date</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '--'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Billing Period</label>
                    <div className="mt-1 text-sm text-gray-900">{invoice.billingPeriod}</div>
                  </div>
                </div>
              </div>

              {/* Student Information */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {invoice.student?.firstName} {invoice.student?.lastName}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <div className="mt-1 text-sm text-gray-900">{invoice.student?.email}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <div className="mt-1 text-sm text-gray-900">{invoice.student?.phone}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Room</label>
                    <div className="mt-1 text-sm text-gray-900">{invoice.room}</div>
                  </div>
                </div>
              </div>

              {/* Charges */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Charges</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tax %</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoice.charges?.map((charge, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm text-gray-900">{charge.description}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 capitalize">{charge.category?.replace('_', ' ')}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{charge.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(charge.unitPrice)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{charge.taxRate}%</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">{formatCurrency(charge.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments */}
              {invoice.payments && invoice.payments.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h2>
                  <div className="space-y-3">
                    {invoice.payments.map((payment, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900">{formatCurrency(payment.amount)}</div>
                            <div className="text-sm text-gray-500">{payment.paymentMethod}</div>
                            {payment.reference && (
                              <div className="text-sm text-gray-500">Ref: {payment.reference}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">
                              {new Date(payment.paymentDate).toLocaleDateString()}
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              payment.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {payment.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Financial Summary */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Subtotal:</span>
                    <span className="text-sm font-medium">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tax:</span>
                    <span className="text-sm font-medium">{formatCurrency(invoice.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Discount:</span>
                    <span className="text-sm font-medium">{formatCurrency(invoice.discountAmount)}</span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900">Total Amount:</span>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900">Amount Paid:</span>
                    <span className="text-sm font-bold text-green-600">{formatCurrency(invoice.amountPaid)}</span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900">Balance Due:</span>
                    <span className={`text-sm font-bold ${invoice.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(invoice.balanceDue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reminders */}
              {invoice.reminders && invoice.reminders.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Reminders Sent</h2>
                  <div className="space-y-2">
                    {invoice.reminders.map((reminder, index) => (
                      <div key={index} className="text-sm">
                        <div className="font-medium text-gray-900">{reminder.type.replace('_', ' ')}</div>
                        <div className="text-gray-500">{new Date(reminder.sentDate).toLocaleDateString()}</div>
                        <div className="text-gray-500">via {reminder.sentVia}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {invoice.notes && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
                  <p className="text-sm text-gray-700">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                  max={invoice.balanceDue}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Balance due: {formatCurrency(invoice.balanceDue)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({...paymentForm, paymentMethod: e.target.value})}
                  className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Online Payment">Online Payment</option>
                  <option value="Ecocash">Ecocash</option>
                  <option value="Innbucks">Innbucks</option>
                  <option value="Credit Card">Credit Card</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({...paymentForm, reference: e.target.value})}
                  className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Transaction reference"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Send Reminder</h2>
            </div>
            <form onSubmit={handleReminderSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Type</label>
                <select
                  value={reminderForm.type}
                  onChange={(e) => setReminderForm({...reminderForm, type: e.target.value})}
                  className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="due_date">Due Date Reminder</option>
                  <option value="overdue">Overdue Reminder</option>
                  <option value="payment_received">Payment Received</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Send Via</label>
                <select
                  value={reminderForm.sentVia}
                  onChange={(e) => setReminderForm({...reminderForm, sentVia: e.target.value})}
                  className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={reminderForm.message}
                  onChange={(e) => setReminderForm({...reminderForm, message: e.target.value})}
                  className="border border-gray-300 px-3 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Custom message (optional)"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceDetails; 