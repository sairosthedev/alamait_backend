const express = require('express');
const router = express.Router();
const TransactionEntry = require('../models/TransactionEntry');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const mongoose = require('mongoose');

// GET /api/audit - List all transaction entries, filterable by account, date
router.get('/audit', async (req, res) => {
  try {
    const { account, start, end } = req.query;
    const filter = {};
    if (account && mongoose.Types.ObjectId.isValid(account)) {
      filter.account = account;
    }
    if (start || end) {
      filter['transaction.date'] = {};
      if (start) filter['transaction.date'].$gte = new Date(start);
      if (end) filter['transaction.date'].$lte = new Date(end);
    }
    // Join with transaction and account
    const entries = await TransactionEntry.find(filter)
      .populate('transaction')
      .populate('account')
      .sort({ 'transaction.date': -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit entries' });
  }
});

// GET /api/income-statement - Summarize income and expense accounts for a date range
router.get('/income-statement', async (req, res) => {
  try {
    const { start, end } = req.query;
    const txnFilter = {};
    if (start) txnFilter.date = { ...txnFilter.date, $gte: new Date(start) };
    if (end) txnFilter.date = { ...txnFilter.date, $lte: new Date(end) };
    // Find all entries for transactions in range
    const txns = await Transaction.find(txnFilter).select('_id');
    const txnIds = txns.map(t => t._id);
    const entries = await TransactionEntry.find({ transaction: { $in: txnIds } }).populate('account');
    // Summarize by account
    const summary = {};
    entries.forEach(e => {
      if (['Income', 'Expense'].includes(e.account.type)) {
        if (!summary[e.account.code]) {
          summary[e.account.code] = { name: e.account.name, type: e.account.type, code: e.account.code, total: 0 };
        }
        // For income, credit increases; for expense, debit increases
        if (e.account.type === 'Income') {
          summary[e.account.code].total += (e.credit - e.debit);
        } else {
          summary[e.account.code].total += (e.debit - e.credit);
        }
      }
    });
    res.json(Object.values(summary));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch income statement' });
  }
});

module.exports = router; 