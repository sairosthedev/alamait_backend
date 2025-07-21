const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const multer = require('multer');
const { s3, s3Configs, fileFilter, fileTypes } = require('../config/s3');
const { Types: { ObjectId } } = require('mongoose');
const { generateSignedUrl, getKeyFromUrl } = require('../config/s3');

// Multer config for receipt uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter([...fileTypes.images, ...fileTypes.documents]),
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('receipt');

// GET /api/transactions - List all transactions with entries, filterable by residence
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.residence) {
      filter.residence = req.query.residence;
    }
    const transactions = await Transaction.find(filter).sort({ date: -1 });
    const results = await Promise.all(transactions.map(async (txn) => {
      const entries = await TransactionEntry.find({ transaction: txn._id }).populate('account');
      return { ...txn.toObject(), entries };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
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
    const txnEntries = await TransactionEntry.insertMany(
      entries.map(e => ({ ...e, transaction: transaction._id }))
    );
    res.status(201).json({ transaction, entries: txnEntries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/transactions/:id/upload-receipt - Upload a receipt for a transaction
router.post('/:id/upload-receipt', (req, res) => {
  upload(req, res, async function(err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const txnId = req.params.id;
    if (!ObjectId.isValid(txnId)) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }
    try {
      const txn = await Transaction.findById(txnId);
      if (!txn) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      // Upload to S3
      const s3Key = `receipts/${(req.user?._id || 'finance')}_${Date.now()}_${req.file.originalname}`;
      const s3UploadParams = {
        Bucket: s3Configs.general.bucket,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: s3Configs.general.acl,
        Metadata: {
          fieldName: req.file.fieldname,
          uploadedBy: req.user?._id ? req.user._id.toString() : 'finance',
          uploadDate: new Date().toISOString()
        }
      };
      const s3Result = await s3.upload(s3UploadParams).promise();
      // Save receipt info in transaction
      txn.receipt = {
        fileUrl: s3Result.Location,
        fileName: req.file.originalname,
        uploadDate: new Date(),
        uploadedBy: req.user?._id || null
      };
      await txn.save();
      res.json({ message: 'Receipt uploaded successfully', receipt: txn.receipt });
    } catch (error) {
      console.error('Error uploading receipt:', error);
      res.status(500).json({ error: 'Failed to upload receipt' });
    }
  });
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

// GET /api/transactions/:id/receipt - Get receipt file info and signed URL
router.get('/:id/receipt', async (req, res) => {
  const txnId = req.params.id;
  if (!ObjectId.isValid(txnId)) {
    return res.status(400).json({ error: 'Invalid transaction ID' });
  }
  try {
    const txn = await Transaction.findById(txnId);
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (!txn.receipt || !txn.receipt.fileUrl) {
      return res.status(404).json({ error: 'No receipt found for this transaction' });
    }
    // Generate a signed S3 URL for the file
    const key = getKeyFromUrl(txn.receipt.fileUrl);
    let signedUrl = null;
    if (key) {
      signedUrl = await generateSignedUrl(key, 60 * 60); // 1 hour expiry
    }
    res.json({
      fileName: txn.receipt.fileName,
      uploadDate: txn.receipt.uploadDate,
      uploadedBy: txn.receipt.uploadedBy,
      fileUrl: txn.receipt.fileUrl,
      signedUrl
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

module.exports = router; 