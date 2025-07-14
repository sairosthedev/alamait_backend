const express = require('express');
const router = express.Router();
const Account = require('../models/Account');

// GET /api/accounts - List all accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await Account.find().sort({ code: 1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// POST /api/accounts - Add a new account
router.post('/', async (req, res) => {
  try {
    const { code, name, type } = req.body;
    const account = new Account({ code, name, type });
    await account.save();
    res.status(201).json(account);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router; 