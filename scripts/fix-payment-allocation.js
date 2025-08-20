/*
  Usage:
    node scripts/fix-payment-allocation.js --paymentId PAY123 --amount 85.16
*/

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/database');
const Payment = require('../src/models/Payment');
const Transaction = require('../src/models/Transaction');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--paymentId') args.paymentId = argv[++i];
    else if (a === '--amount') args.amount = parseFloat(argv[++i]);
  }
  return args;
}

(async () => {
  try {
    await connectDB();
    const { paymentId, amount } = parseArgs(process.argv);
    if (!paymentId || !amount || isNaN(amount)) {
      console.error('Error: --paymentId and --amount are required');
      process.exit(1);
    }

    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      console.log(JSON.stringify({ ok: false, error: 'payment_not_found', paymentId }, null, 2));
      process.exit(0);
    }

    // Ensure accounts exist
    let deferred = await Account.findOne({ name: 'Deferred Income - Tenant Advances' });
    if (!deferred) deferred = await Account.findOne({ code: '1102' });
    if (!deferred) {
      deferred = new Account({ code: '1102', name: 'Deferred Income - Tenant Advances', type: 'Liability', category: 'Current Liabilities', isActive: true });
      await deferred.save();
    }

    let ar = await Account.findOne({ name: 'Accounts Receivable - Tenants' });
    if (!ar) ar = await Account.findOne({ code: '1100' });
    if (!ar) ar = await Account.findOne({ name: 'Accounts Receivable' });
    if (!ar) ar = await Account.findOne({ code: '1101' });
    if (!ar) {
      ar = new Account({ code: '1101', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets', isActive: true });
      await ar.save();
    }

    const txnId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const txn = new Transaction({
      transactionId: txnId,
      date: new Date(),
      description: `Rent allocation correction for ${paymentId}`,
      type: 'adjustment',
      reference: payment._id.toString(),
      residence: payment.residence,
      createdBy: 'system'
    });
    await txn.save();

    const fixedAmount = Number((amount).toFixed(2));
    const entries = [
      {
        accountCode: deferred.code,
        accountName: deferred.name,
        accountType: deferred.type,
        debit: fixedAmount,
        credit: 0,
        description: `Reclassify rent from Deferred Income for ${paymentId}`
      },
      {
        accountCode: ar.code,
        accountName: ar.name,
        accountType: ar.type,
        debit: 0,
        credit: fixedAmount,
        description: `Recognize AR settlement portion for ${paymentId}`
      }
    ];

    const te = new TransactionEntry({
      transactionId: txnId,
      date: new Date(),
      description: `Rent allocation fix for ${paymentId}`,
      reference: payment._id.toString(),
      entries,
      totalDebit: fixedAmount,
      totalCredit: fixedAmount,
      source: 'payment',
      sourceId: payment._id,
      sourceModel: 'Payment',
      residence: payment.residence,
      createdBy: 'system',
      status: 'posted',
      metadata: { correction: true, correctionType: 'rent_allocation', accruedApplied: fixedAmount, paymentId }
    });
    await te.save();

    console.log(JSON.stringify({ ok: true, payment: payment._id, transaction: txnId, entryId: te._id, amount: fixedAmount }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
