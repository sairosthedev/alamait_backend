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
  const paymentId = process.argv[2];
  if (!paymentId) {
    console.error('Usage: node scripts/fix-payment-allocation.js <paymentId>');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Payment = require('../src/models/Payment');
    const TransactionEntry = require('../src/models/TransactionEntry');

    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error(`Payment not found: ${paymentId}`);

    const studentId = payment.student?.toString();
    if (!studentId) throw new Error('Payment missing student');

    // 1) Delete wrong advance entries for this payment
    const del = await TransactionEntry.deleteMany({ source: 'advance_payment', sourceId: paymentId });
    console.log(`Deleted ${del.deletedCount} advance_payment entries for ${paymentId}`);

    // 2) Find lease_start accrual (May) OR fallback to earliest rental_accrual for this student
    let accrual = await TransactionEntry.findOne({
      source: 'rental_accrual',
      'metadata.type': 'lease_start',
      'entries.accountCode': { $regex: `^1100-${studentId}` }
    }).sort({ date: 1 });

    if (!accrual) {
      accrual = await TransactionEntry.findOne({
        source: 'rental_accrual',
        'entries.accountCode': { $regex: `^1100-${studentId}` }
      }).sort({ date: 1 });
      if (!accrual) throw new Error('No rental_accrual entries found for student');
      console.log('Fallback: using earliest rental_accrual to derive May amounts');
    }

    const accDate = new Date(accrual.date);
    const mayMonthKey = `${accDate.getFullYear()}-${String(accDate.getMonth() + 1).padStart(2, '0')}`;

    // Derive owed amounts from accrual AR debit lines
    let proratedRent = 0, adminFee = 0, securityDeposit = 0;
    (accrual.entries || []).forEach(line => {
      if (line.accountCode && line.accountCode.startsWith(`1100-${studentId}`) && Number(line.debit || 0) > 0) {
        const desc = (line.description || '').toLowerCase();
        if (desc.includes('deposit')) securityDeposit += Number(line.debit || 0);
        else if (desc.includes('admin')) adminFee += Number(line.debit || 0);
        else proratedRent += Number(line.debit || 0);
      }
    });

    // 3) Determine payment breakdown
    let rentPortion = 0, adminPortion = 0, depositPortion = 0;
    if (Array.isArray(payment.payments)) {
      rentPortion = Number(payment.payments.find(p => p.type === 'rent')?.amount || 0);
      adminPortion = Number(payment.payments.find(p => p.type === 'admin')?.amount || 0);
      depositPortion = Number(payment.payments.find(p => p.type === 'deposit')?.amount || 0);
    } else {
      const total = Number(payment.totalAmount || 0);
      adminPortion = adminFee;
      depositPortion = securityDeposit;
      rentPortion = Math.max(0, total - adminPortion - depositPortion);
    }

    // Clamp to owed caps for May
    const mayRentAlloc = Math.min(rentPortion, proratedRent);
    const mayAdminAlloc = Math.min(adminPortion, adminFee);
    const mayDepositAlloc = Math.min(depositPortion, securityDeposit);

    const remainingRent = Math.max(0, rentPortion - mayRentAlloc);

    const cashAccount = '1000';
    const arAccount = `1100-${studentId}`;

    const makeEntry = async (amount, monthKey, type) => {
      if (amount <= 0) return null;
      const tx = new TransactionEntry({
        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2,5).toUpperCase()}`,
        date: new Date(),
        description: `Payment allocation: $${amount} ${type} for ${monthKey}`,
        reference: paymentId,
        entries: [
          { accountCode: arAccount, accountName: 'Accounts Receivable - Student', accountType: 'Asset', debit: 0, credit: amount, description: `Payment received - ${paymentId}` },
          { accountCode: cashAccount, accountName: 'Cash', accountType: 'Asset', debit: amount, credit: 0, description: `Payment received - ${paymentId}` }
        ],
        totalDebit: amount,
        totalCredit: amount,
        source: 'payment',
        sourceId: paymentId,
        sourceModel: 'Payment',
        residence: payment.residence,
        createdBy: 'system',
        status: 'posted',
        metadata: {
          paymentId,
          studentId,
          amount,
          allocationType: 'payment_allocation',
          originalARTransaction: accrual._id,
          monthSettled: monthKey,
          paymentType: type
        }
      });
      await tx.save();
      console.log(`Created allocation: ${type} $${amount} for ${monthKey}`);
      return tx;
    };

    // 4) Create May allocations
    await makeEntry(mayRentAlloc, mayMonthKey, 'rent');
    await makeEntry(mayAdminAlloc, mayMonthKey, 'admin');
    await makeEntry(mayDepositAlloc, mayMonthKey, 'deposit');

    // 5) Create June rent allocation (remaining rent)
    if (remainingRent > 0) {
      const juneDate = new Date(accDate.getFullYear(), accDate.getMonth() + 1, 1);
      const juneMonthKey = `${juneDate.getFullYear()}-${String(juneDate.getMonth() + 1).padStart(2, '0')}`;
      await makeEntry(remainingRent, juneMonthKey, 'rent');
    }

    console.log('✅ Fix complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();
