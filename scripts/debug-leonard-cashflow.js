require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../src/models/Payment');
const TransactionEntry = require('../src/models/TransactionEntry');
const User = require('../src/models/User');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const students = await User.find({ firstName: /leonard/i }).select('firstName lastName _id').lean();
    console.log('Students:', students);

    for (const s of students) {
        const payments = await Payment.find({ $or: [{ student: s._id }, { user: s._id }] })
            .sort({ date: -1 })
            .lean();
        console.log(`\n=== Payments for ${s.firstName} ${s.lastName} (${payments.length}) ===`);

        const allTxs = await TransactionEntry.find({
            $or: [
                { 'metadata.studentId': s._id.toString() },
                { description: new RegExp(s.lastName, 'i') }
            ]
        })
            .select('transactionId date description source entries metadata')
            .sort({ date: 1 })
            .lean();
        console.log(`\nAll ledger txs mentioning student (${allTxs.length}):`);
        for (const tx of allTxs) {
            console.log(
                tx.transactionId,
                tx.date?.toISOString?.()?.slice(0, 10),
                tx.description,
                'source:',
                tx.source,
                'paymentType:',
                tx.metadata?.paymentType,
                'paymentId:',
                tx.metadata?.paymentId
            );
            console.log(
                '  entries:',
                tx.entries?.map((e) => `${e.accountCode} dr${e.debit}/cr${e.credit}`)
            );
        }

        for (const p of payments) {
            console.log({
                paymentId: p.paymentId,
                date: p.date,
                totalAmount: p.totalAmount,
                rentAmount: p.rentAmount,
                deposit: p.deposit,
                adminFee: p.adminFee,
                levies: p.levies,
                payments: p.payments,
                status: p.status
            });
            const txs = await TransactionEntry.find({
                $or: [{ 'metadata.paymentId': p.paymentId }, { sourceId: p._id }]
            })
                .select('transactionId date description source entries metadata')
                .lean();
            for (const tx of txs) {
                console.log(
                    '  TX:',
                    tx.transactionId,
                    tx.date?.toISOString?.()?.slice(0, 10),
                    tx.description,
                    'source:',
                    tx.source,
                    'paymentType:',
                    tx.metadata?.paymentType
                );
                console.log(
                    '    entries:',
                    tx.entries?.map((e) => ({
                        code: e.accountCode,
                        dr: e.debit,
                        cr: e.credit,
                        type: e.accountType
                    }))
                );
            }
        }
    }
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
