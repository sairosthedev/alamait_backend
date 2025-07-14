const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');
const User = require('../models/User');
const { generateInvoicePdf } = require('../utils/invoicePdf');
const emailService = require('../services/emailService');

// GET /api/invoices - List/filter invoices
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.tenant) filter.tenant = req.query.tenant;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.billingPeriod) filter.billingPeriod = req.query.billingPeriod;
    if (req.query.unit) filter.unit = req.query.unit;
    const invoices = await Invoice.find(filter).sort({ dueDate: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/:id - Get single invoice
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST /api/invoices - Create invoice
router.post('/', async (req, res) => {
  try {
    const { createdBy, ...data } = req.body;
    const invoice = new Invoice({ ...data, createdBy });
    invoice.auditLog.push({ action: 'created', user: createdBy });
    await invoice.save();
    // Send email if status is 'sent'
    if (invoice.status === 'sent') {
      const tenant = await User.findById(invoice.tenant);
      if (tenant && tenant.email) {
        const pdfBuffer = await generateInvoicePdf(invoice, tenant);
        await emailService.sendInvoiceEmail(tenant.email, invoice, tenant, pdfBuffer);
      }
    }
    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/:id', async (req, res) => {
  try {
    const { updatedBy, ...data } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const prevStatus = invoice.status;
    Object.assign(invoice, data);
    invoice.updatedBy = updatedBy;
    invoice.auditLog.push({ action: 'updated', user: updatedBy });
    await invoice.save();
    // Send email if status changed to 'sent'
    if (prevStatus !== 'sent' && invoice.status === 'sent') {
      const tenant = await User.findById(invoice.tenant);
      if (tenant && tenant.email) {
        const pdfBuffer = await generateInvoicePdf(invoice, tenant);
        await emailService.sendInvoiceEmail(tenant.email, invoice, tenant, pdfBuffer);
      }
    }
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router; 