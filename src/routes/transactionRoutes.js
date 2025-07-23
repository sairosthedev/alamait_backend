const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const multer = require('multer');
const { s3, s3Configs, fileFilter, fileTypes } = require('../config/s3');
const { Types: { ObjectId } } = require('mongoose');
const { generateSignedUrl, getKeyFromUrl } = require('../config/s3');
const { updateTransaction, deleteTransaction } = require('../controllers/transactionController');
const { auth } = require('../middleware/auth');

// Multer instance for receipt uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter([...fileTypes.images, ...fileTypes.documents]),
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(auth);

// GET /api/transactions - List all transactions with entries, filterable by residence
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.residence) {
      filter.residence = req.query.residence;
    }
    const transactions = await Transaction.find(filter).sort({ date: -1 });
    const results = await Promise.all(transactions.map(async (txn) => {
      const entries = await TransactionEntry.find({ transaction: txn._id }).populate('account', 'name code');
      // Collect unique account names from entries
      const accountNames = entries.map(e => e.account?.name).filter(Boolean);
      return { ...txn.toObject(), entries, accountNames };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/transactions/all - List all transactions with entries and full account info for reporting
router.get('/all', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 });
    const results = await Promise.all(transactions.map(async (txn) => {
      const entries = await TransactionEntry.find({ transaction: txn._id }).populate('account', 'name code type');
      return { ...txn.toObject(), entries };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch all transactions' });
  }
});

// Debug endpoint: List entries with orphaned accounts
router.get('/debug/orphaned-entries', async (req, res) => {
  try {
    const entries = await TransactionEntry.find().populate('account', 'name');
    const orphaned = entries.filter(e => !e.account);
    res.json(orphaned.map(e => ({ _id: e._id, description: e.description })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orphaned entries' });
  }
});

// POST /api/transactions - Add a new transaction with entries (double-entry validation, require residence)
router.post('/', async (req, res) => {
  try {
    const { date, description, reference, entries, residence } = req.body;
    if (!residence) {
      return res.status(400).json({ error: 'Residence is required' });
    }
    if (!entries || !Array.isArray(entries) || entries.length < 2) {
      return res.status(400).json({ error: 'At least two entries required (double-entry)' });
    }
    const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    if (totalDebit !== totalCredit) {
      return res.status(400).json({ error: 'Debits and credits must be equal (double-entry)' });
    }
    // Fetch residence name
    const Residence = require('../models/Residence');
    const residenceDoc = await Residence.findById(residence);
    if (!residenceDoc) {
      return res.status(400).json({ error: 'Residence not found' });
    }
    const residenceName = residenceDoc.name;
    const transaction = await Transaction.create({ date, description, reference, residence, residenceName });
    // Set type for each entry based on account if not provided
    const accounts = await Account.find();
    const idToType = Object.fromEntries(accounts.map(a => [a._id.toString(), a.type?.toLowerCase()]));
    const txnEntries = await TransactionEntry.insertMany(
      entries.map(e => {
        let type = e.type;
        if (!type && e.account) {
          type = idToType[e.account.toString()];
        }
        return { ...e, transaction: transaction._id, type };
      })
    );
    res.status(201).json({ transaction, entries: txnEntries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload endpoint: Save receipt to parent transaction only
router.post('/:id/upload-receipt', upload.single('receipt'), async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn) {
      console.error('Transaction not found:', req.params.id);
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    txn.receipt = {
      fileUrl: req.file.location || req.file.path, // S3 or local
      fileName: req.file.originalname,
      uploadDate: new Date(),
      uploadedBy: req.user ? req.user._id : null
    };
    try {
      await txn.save();
      console.log('Receipt saved to transaction:', txn._id, txn.receipt);
    } catch (err) {
      console.error('Error saving transaction:', err);
      return res.status(500).json({ error: 'Failed to save receipt to transaction', details: err.message });
    }
    res.json({ message: 'Receipt uploaded successfully', receipt: txn.receipt });
  } catch (err) {
    console.error('Error uploading or saving receipt:', err);
    res.status(500).json({ error: 'Failed to upload or save receipt', details: err.message });
  }
});

// GET /api/transactions/:id - Get a single transaction with entries
router.get('/:id', async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    const entries = await TransactionEntry.find({ transaction: txn._id }).populate('account', 'name code');
    const accountNames = entries.map(e => e.account?.name).filter(Boolean);
    res.json({ ...txn.toObject(), entries, accountNames });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Robust fetch endpoint for receipts
router.get('/:id/receipt', async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn) {
      console.error('Transaction not found:', req.params.id);
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (!txn.receipt || !txn.receipt.fileUrl) {
      console.error('No receipt found for transaction:', req.params.id);
      return res.status(404).json({ error: 'No receipt found for this transaction' });
    }
    res.json({
      fileName: txn.receipt.fileName,
      uploadedAt: txn.receipt.uploadDate,
      uploadedBy: txn.receipt.uploadedBy,
      fileUrl: txn.receipt.fileUrl
    });
  } catch (err) {
    console.error('Error fetching receipt:', err);
    res.status(500).json({ error: 'Failed to fetch receipt', details: err.message });
  }
});

router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router; 