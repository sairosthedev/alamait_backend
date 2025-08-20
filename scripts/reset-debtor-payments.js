/*
  Reset a debtor's payment state to reflect no payments.

  Usage examples:
    node scripts/reset-debtor-payments.js --debtorCode DR0003
    node scripts/reset-debtor-payments.js --debtorId 64f...abc
    node scripts/reset-debtor-payments.js --userId 64f...abc
    node scripts/reset-debtor-payments.js --email student@example.com

  What it does:
    - Clears `paymentHistory`
    - Resets `monthlyPayments` paid fields and statuses to unpaid, zeroes paymentMonths
    - Sets `totalPaid = 0`, `lastPaymentDate = null`, `lastPaymentAmount = 0`
    - Recomputes `currentBalance = max(totalOwed - totalPaid, 0)`
    - Preserves expected amounts (totalOwed, expected per month) and billing data
*/

require('dotenv').config();
const mongoose = require('mongoose');
const Debtor = require('../src/models/Debtor');
const User = require('../src/models/User');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, val] = arg.split('=');
      const k = key.replace(/^--/, '');
      if (typeof val !== 'undefined') {
        args[k] = val;
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          args[k] = next;
          i++;
        } else {
          args[k] = true;
        }
      }
    }
  }
  return args;
}

async function findDebtor({ debtorId, debtorCode, userId, email }) {
  // Support picking the latest updated debtor via a special flag
  if (debtorId === '__LATEST__') {
    // Try updatedAt, then createdAt
    let d = await Debtor.findOne({}).sort({ updatedAt: -1 }).exec();
    if (!d) d = await Debtor.findOne({}).sort({ createdAt: -1 }).exec();
    return d;
  }

  if (debtorId) {
    return await Debtor.findById(debtorId);
  }

  if (debtorCode) {
    return await Debtor.findOne({ debtorCode });
  }

  if (userId) {
    return await Debtor.findOne({ user: userId });
  }

  if (email) {
    const user = await User.findOne({ email }).select('_id');
    if (user) {
      return await Debtor.findOne({ user: user._id });
    }
  }

  return null;
}

function resetMonthlyPaymentState(monthlyPayment) {
  // Preserve expected amounts; reset paid and outstanding based on expected
  const expectedRent = monthlyPayment.expectedComponents?.rent || 0;
  const expectedAdmin = monthlyPayment.expectedComponents?.admin || 0;
  const expectedDeposit = monthlyPayment.expectedComponents?.deposit || 0;

  monthlyPayment.paidAmount = 0;
  monthlyPayment.paidComponents = {
    rent: 0,
    admin: 0,
    deposit: 0,
    utilities: 0,
    other: 0
  };

  monthlyPayment.outstandingComponents = {
    rent: expectedRent,
    admin: expectedAdmin,
    deposit: expectedDeposit,
    utilities: 0,
    other: 0
  };

  monthlyPayment.outstandingAmount = expectedRent + expectedAdmin + expectedDeposit;
  monthlyPayment.status = 'unpaid';
  monthlyPayment.paymentCount = 0;
  monthlyPayment.paymentIds = [];
  monthlyPayment.paymentMonths = [];
  monthlyPayment.paymentMonthSummary = {
    totalPaymentMonths: 0,
    firstPaymentMonth: null,
    lastPaymentMonth: null,
    paymentMonthBreakdown: []
  };
  monthlyPayment.lastPaymentDate = null;
  monthlyPayment.updatedAt = new Date();
}

async function run() {
  const args = parseArgs(process.argv);
  const { debtorId, debtorCode, userId, email, dryRun, latest } = args;

  if (!debtorId && !debtorCode && !userId && !email && !latest) {
    console.error('Error: Please provide one of --debtorId, --debtorCode, --userId, --email, or --latest');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB: ${mongoUri}`);

  try {
    let resolvedDebtorId = debtorId;
    if (latest) {
      resolvedDebtorId = '__LATEST__';
    }

    let debtor = await findDebtor({ debtorId: resolvedDebtorId, debtorCode, userId, email });
    if (!debtor) {
      console.error('Error: Debtor not found for the provided identifier');
      process.exit(2);
    }

    await debtor.populate('user', 'firstName lastName email');

    console.log('Target Debtor:');
    console.log(`  _id:        ${debtor._id}`);
    console.log(`  debtorCode: ${debtor.debtorCode}`);
    console.log(`  user:       ${debtor.user} (${debtor.user?.email || 'N/A'})`);
    console.log(`  totalOwed:  ${debtor.totalOwed}`);
    console.log(`  totalPaid:  ${debtor.totalPaid}`);
    console.log(`  currBal:    ${debtor.currentBalance}`);
    console.log(`  payments:   ${debtor.paymentHistory?.length || 0}`);
    console.log(`  monthly:    ${debtor.monthlyPayments?.length || 0} months`);

    if (dryRun) {
      console.log('\nDry run: would reset paymentHistory and monthlyPayments to show no payments.');
      return;
    }

    // Reset payment history
    debtor.paymentHistory = [];

    // Reset monthly payments
    if (Array.isArray(debtor.monthlyPayments)) {
      debtor.monthlyPayments.forEach(resetMonthlyPaymentState);
    }

    // Reset financial summary counters
    debtor.totalPaid = 0;
    debtor.lastPaymentDate = null;
    debtor.lastPaymentAmount = 0;
    debtor.financialSummary = debtor.financialSummary || {};
    debtor.financialSummary.historical = debtor.financialSummary.historical || {};
    debtor.financialSummary.historical.totalPayments = 0;
    debtor.financialSummary.historical.lastPaymentDate = null;
    debtor.financialSummary.historical.averagePaymentAmount = 0;

    // Recompute current balance (keep totalOwed as-is)
    debtor.currentBalance = Math.max((debtor.totalOwed || 0) - (debtor.totalPaid || 0), 0);
    debtor.overdueAmount = debtor.currentBalance > 0 ? debtor.currentBalance : 0;

    await debtor.save();

    console.log('\n✅ Debtor updated to reflect no payments.');
    console.log(`  totalPaid:  ${debtor.totalPaid}`);
    console.log(`  currBal:    ${debtor.currentBalance}`);
    console.log(`  payments:   ${debtor.paymentHistory?.length || 0}`);
  } catch (err) {
    console.error('Error resetting debtor payments:', err);
    process.exit(3);
  } finally {
    await mongoose.disconnect();
  }
}

run();


