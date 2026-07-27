/**
 * Repair missing deposit ledger entries when rent+deposit were paid same day/amount.
 * Root cause: createAdvancePaymentTransaction deduped by amount+date without paymentType.
 *
 * Usage:
 *   node scripts/repair-missing-deposit-advances.js          # dry run
 *   node scripts/repair-missing-deposit-advances.js --live   # create missing txs
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../src/models/Payment');
const TransactionEntry = require('../src/models/TransactionEntry');
const User = require('../src/models/User');
const { Residence } = require('../src/models/Residence');
const EnhancedPaymentAllocationService = require('../src/services/enhancedPaymentAllocationService');

const LIVE = process.argv.includes('--live');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);

    const payments = await Payment.find({
        deposit: { $gt: 0 },
        status: { $in: ['Confirmed', 'completed', 'Completed', 'Verified'] }
    })
        .populate({ path: 'student', model: User, select: 'firstName lastName' })
        .populate({ path: 'residence', model: Residence, select: 'name' })
        .lean();

    const missing = [];

    for (const payment of payments) {
        const depositAmount = Number(payment.deposit) || 0;
        if (depositAmount <= 0) continue;

        const paymentIdStr = payment.paymentId || payment._id.toString();
        const existingDepositTx = await TransactionEntry.findOne({
            source: 'advance_payment',
            'metadata.paymentType': 'deposit',
            status: { $ne: 'reversed' },
            $or: [
                { sourceId: payment._id },
                { 'metadata.paymentId': paymentIdStr },
                { reference: paymentIdStr }
            ]
        }).lean();

        if (!existingDepositTx) {
            missing.push(payment);
        }
    }

    console.log(`Found ${missing.length} payment(s) with deposit but no deposit ledger entry`);
    for (const p of missing) {
        const name = p.student ? `${p.student.firstName} ${p.student.lastName}` : 'Unknown';
        console.log(`  - ${p.paymentId} | ${name} | deposit $${p.deposit} | date ${new Date(p.date).toISOString().slice(0, 10)}`);
    }

    if (!LIVE) {
        console.log('\nDry run only. Re-run with --live to create missing deposit transactions.');
        await mongoose.disconnect();
        return;
    }

    for (const payment of missing) {
        const studentId = payment.student?._id || payment.user || payment.student;
        const paymentData = {
            ...payment,
            date: payment.date,
            residence: payment.residence?._id || payment.residence,
            debtorAccountCode: payment.debtorAccountCode
        };

        const tx = await EnhancedPaymentAllocationService.createAdvancePaymentTransaction(
            payment._id,
            studentId,
            Number(payment.deposit),
            paymentData,
            'deposit'
        );
        console.log(`✅ Created deposit TX ${tx.transactionId} for ${payment.paymentId}`);
    }

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
