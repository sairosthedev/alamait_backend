const axios = require('axios');

const invoiceData = {
  invoiceNumber: 'INV-2024-TEST',
  tenant: '686d806b76fac16e629e9bdd',
  unit: 'Room 101',
  billingPeriod: 'July 2024',
  charges: [
    { description: 'Rent', amount: 500 },
    { description: 'Wifi', amount: 20 }
  ],
  penalties: [
    { description: 'Late Fee', amount: 10 }
  ],
  dueDate: '2024-07-31T00:00:00.000Z',
  status: 'sent',
  createdBy: '686d806b76fac16e629e9bdd'
};

const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';

axios.post(`${API_BASE}/invoices`, invoiceData)
  .then(res => {
    console.log('Invoice created and sent:', res.data);
  })
  .catch(err => {
    console.error('Error:', err.response?.data || err.message);
  }); 