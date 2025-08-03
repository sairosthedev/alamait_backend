import api from './api';

// Get all invoices with filtering
export const getInvoices = async (queryParams = '') => {
  const url = queryParams ? `/invoices?${queryParams}` : '/invoices';
  return api.get(url);
};

// Get single invoice
export const getInvoice = async (id) => {
  return api.get(`/invoices/${id}`);
};

// Create invoice
export const createInvoice = async (invoiceData) => {
  return api.post('/invoices', invoiceData);
};

// Update invoice
export const updateInvoice = async (id, invoiceData) => {
  return api.put(`/invoices/${id}`, invoiceData);
};

// Delete invoice
export const deleteInvoice = async (id) => {
  return api.delete(`/invoices/${id}`);
};

// Record payment
export const recordPayment = async (invoiceId, paymentData) => {
  return api.post(`/invoices/${invoiceId}/payments`, paymentData);
};

// Send reminder
export const sendReminder = async (invoiceId, reminderData) => {
  return api.post(`/invoices/${invoiceId}/reminders`, reminderData);
};

// Get overdue invoices
export const getOverdueInvoices = async () => {
  return api.get('/invoices/overdue/all');
};

// Get student invoices
export const getStudentInvoices = async (studentId, startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  return api.get(`/invoices/student/${studentId}?${params}`);
};

// Bulk send reminders
export const bulkSendReminders = async (invoiceIds, reminderData) => {
  return api.post('/invoices/bulk/reminders', {
    invoiceIds,
    ...reminderData
  });
};

// Get unpaid tenants (students)
export const getUnpaidTenants = async () => {
  return api.get('/users?role=student&hasUnpaidInvoices=true');
};

// Generate invoice PDF
export const generateInvoicePdf = async (invoiceId) => {
  return api.get(`/invoices/${invoiceId}/pdf`, {
    responseType: 'blob'
  });
};

// Dashboard reports
export const getDashboardReport = async () => {
  return api.get('/invoices/dashboard');
};

// Monthly report
export const getMonthlyReport = async (month, year) => {
  return api.get(`/invoices/reports/monthly?month=${month}&year=${year}`);
};

// Overdue report
export const getOverdueReport = async () => {
  return api.get('/invoices/reports/overdue');
};

// Student financial report
export const getStudentReport = async (studentId, startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  return api.get(`/invoices/reports/student/${studentId}?${params}`);
}; 