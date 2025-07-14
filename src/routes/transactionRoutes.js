const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');

// GET /api/transactions - List all transactions with entries
router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 });
    const results = await Promise.all(transactions.map(async (txn) => {
      const entries = await TransactionEntry.find({ transaction: txn._id }).populate('account');
      return { ...txn.toObject(), entries };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/transactions - Add a new transaction with entries (double-entry validation)
router.post('/', async (req, res) => {
  try {
    const { date, description, reference, entries } = req.body;
    if (!entries || !Array.isArray(entries) || entries.length < 2) {
      return res.status(400).json({ error: 'At least two entries required (double-entry)' });
    }
    const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    if (totalDebit !== totalCredit) {
      return res.status(400).json({ error: 'Debits and credits must be equal (double-entry)' });
    }
    const transaction = await Transaction.create({ date, description, reference });
    const txnEntries = await TransactionEntry.insertMany(
      entries.map(e => ({ ...e, transaction: transaction._id }))
    );
    res.status(201).json({ transaction, entries: txnEntries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/transactions/:id - Get a single transaction with entries
router.get('/:id', async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    const entries = await TransactionEntry.find({ transaction: txn._id }).populate('account');
    res.json({ ...txn.toObject(), entries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

module.exports = router; 