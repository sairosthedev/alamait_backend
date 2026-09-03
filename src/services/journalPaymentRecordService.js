/**
 * Create Payment records for journal uploads that already posted DR Cash / CR Student AR.
 * Links TransactionEntry ↔ Payment without re-running Smart FIFO (no double posting).
 */
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const TransactionEntry = require('../models/TransactionEntry');
const Debtor = require('../models/Debtor');
const { lookupRoomForDebtor } = require('./journalExcelUploadService');

function detectStudentPaymentFromEntries(entries = []) {
    const lines = entries.map((e) => ({
        code: String(e.accountCode || e.account || '').trim(),
        debit: Number(e.debit) || 0,
        credit: Number(e.credit) || 0
    }));
    const cashLine = lines.find(
        (e) => /^(1000|1001|1010|1015|10003)/.test(e.code) && e.debit > 0
    );
    const arLine = lines.find((e) => /^1100[-_]/.test(e.code) && e.credit > 0);
    if (!cashLine || !arLine) return null;
    return {
        amount: cashLine.debit,
        accountCode: arLine.code,
        debtorKey: arLine.code.replace(/^1100[-_]/, '')
    };
}

function paymentMonthFromDate(date) {
    const d = date ? new Date(date) : new Date();
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function resolveStudentId({ studentId, debtorId, accountCode, customer }) {
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        return String(studentId);
    }

    let debtor = null;
    if (debtorId && mongoose.Types.ObjectId.isValid(debtorId)) {
        debtor = await Debtor.findById(debtorId).lean();
    }
    if (!debtor && accountCode) {
        debtor = await Debtor.findOne({ accountCode: String(accountCode) }).lean();
    }
    if (!debtor && accountCode && /^1100[-_]/.test(accountCode)) {
        const key = accountCode.replace(/^1100[-_]/, '');
        if (mongoose.Types.ObjectId.isValid(key)) {
            debtor = await Debtor.findById(key).lean();
        }
        if (!debtor) {
            debtor = await Debtor.findOne({ user: key }).lean();
        }
    }
    if (!debtor && customer) {
        const name = String(customer).trim();
        if (name) {
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            debtor = await Debtor.findOne({
                'contactInfo.name': new RegExp(`^${escaped}$`, 'i')
            }).lean();
        }
    }
    if (debtor?.user) return String(debtor.user);
    return null;
}

async function applyPaymentToSystemInvoice({ invoiceId, payment, processedByUserId }) {
    if (!invoiceId || !payment?._id) return;

    const Invoice = require('../models/Invoice');
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return;

    const alreadyApplied = (invoice.payments || []).some(
        (p) => p.paymentId === payment.paymentId || p.reference === payment.paymentId
    );
    if (alreadyApplied) return;

    invoice.addPayment({
        paymentId: payment.paymentId,
        amount: payment.totalAmount,
        paymentDate: payment.date || new Date(),
        paymentMethod: payment.method || 'Cash',
        reference: payment.paymentId,
        status: 'confirmed',
        processedBy: processedByUserId
    });
    await invoice.save();
}

/**
 * @returns {{ payment: object, created: boolean }}
 */
async function createPaymentRecordForJournal({
    transactionEntry,
    residenceId,
    createdByUserId,
    studentId,
    debtorId,
    customer,
    accountCode,
    paymentType = 'rent',
    method = 'Cash',
    paymentMonth,
    roomNumber,
    adminFee = 0,
    rental = 0,
    systemInvoiceId = null
}) {
    if (!transactionEntry?._id) {
        throw new Error('Transaction entry is required');
    }
    if (!createdByUserId) {
        throw new Error('createdBy user id is required');
    }

    const detected = detectStudentPaymentFromEntries(transactionEntry.entries || []);
    if (!detected) {
        throw new Error('Not a student payment journal (expected DR 1000 / CR 1100-*)');
    }

    const existingByTxn = await Payment.findOne({
        $or: [
            { paymentId: `PAY-JRN-${transactionEntry.transactionId}` },
            { 'metadata.transactionId': transactionEntry.transactionId }
        ]
    }).lean();
    if (existingByTxn) {
        await linkTransactionToPayment(transactionEntry, existingByTxn);
        return { payment: existingByTxn, created: false };
    }

    const resolvedStudentId = await resolveStudentId({
        studentId,
        debtorId,
        accountCode: accountCode || detected.accountCode,
        customer
    });
    if (!resolvedStudentId) {
        throw new Error(
            customer
                ? `No student/debtor found for "${customer}"`
                : 'studentId or debtor-linked AR account required for payment record'
        );
    }

    let resolvedRoomNumber =
        roomNumber && String(roomNumber).trim() ? String(roomNumber).trim() : null;
    if (!resolvedRoomNumber) {
        let debtorDoc = null;
        if (debtorId && mongoose.Types.ObjectId.isValid(debtorId)) {
            debtorDoc = await Debtor.findById(debtorId).lean();
        }
        if (!debtorDoc) {
            debtorDoc = await Debtor.findOne({ user: resolvedStudentId }).lean();
        }
        if (debtorDoc) {
            resolvedRoomNumber = await lookupRoomForDebtor(debtorDoc, residenceId);
        }
    }

    const totalAmount = detected.amount;
    const txDate = transactionEntry.date || new Date();
    const month = paymentMonth || paymentMonthFromDate(txDate);
    const rentAmount = paymentType === 'admin' ? 0 : rental > 0 ? rental : totalAmount - (adminFee || 0);
    const adminAmount = paymentType === 'admin' ? totalAmount : adminFee || 0;
    const componentType = paymentType === 'admin' ? 'admin' : 'rent';
    const paymentsBreakdown =
        adminAmount > 0 && rentAmount > 0
            ? [
                  { type: 'rent', amount: rentAmount },
                  { type: 'admin', amount: adminAmount }
              ]
            : [{ type: componentType, amount: totalAmount }];

    const payment = new Payment({
        paymentId: `PAY-JRN-${transactionEntry.transactionId}`,
        user: resolvedStudentId,
        student: resolvedStudentId,
        residence: residenceId,
        room: resolvedRoomNumber || 'Not Assigned',
        payments: paymentsBreakdown,
        totalAmount,
        paymentMonth: month,
        date: txDate,
        method: method || 'Cash',
        status: 'Confirmed',
        description: transactionEntry.description,
        rentAmount: rentAmount > 0 ? rentAmount : paymentType === 'admin' ? 0 : totalAmount,
        adminFee: adminAmount,
        accountCode: accountCode || detected.accountCode,
        debtorAccountCode: accountCode || detected.accountCode,
        createdBy: createdByUserId,
        allocation: {
            summary: { source: 'journal_upload', allocated: totalAmount },
            journalLinked: true
        },
        metadata: {
            journalUpload: true,
            transactionId: transactionEntry.transactionId,
            transactionEntryId: transactionEntry._id.toString(),
            systemInvoiceId: systemInvoiceId || transactionEntry.metadata?.systemInvoiceId || null,
            smartFIFOAllocationCalled: true,
            smartFIFOAllocationCalledAt: new Date(),
            skipSmartFIFOAllocation: true
        }
    });

    await linkTransactionToPayment(transactionEntry, payment);
    await payment.save();

    const invoiceId =
        systemInvoiceId ||
        transactionEntry.metadata?.systemInvoiceId ||
        null;
    if (invoiceId) {
        try {
            await applyPaymentToSystemInvoice({
                invoiceId,
                payment,
                processedByUserId: createdByUserId
            });
        } catch (invoiceErr) {
            console.warn(
                `Payment ${payment.paymentId} saved but invoice update failed:`,
                invoiceErr.message
            );
        }
    }

    return { payment, created: true };
}

async function linkTransactionToPayment(transactionEntry, payment) {
    const paymentDoc = payment._id ? payment : await Payment.findById(payment).lean();
    if (!paymentDoc?._id) return;

    transactionEntry.sourceId = paymentDoc._id;
    transactionEntry.sourceModel = 'Payment';
    transactionEntry.metadata = {
        ...(transactionEntry.metadata || {}),
        paymentId: paymentDoc._id.toString(),
        journalPaymentLinked: true
    };
    await TransactionEntry.updateOne(
        { _id: transactionEntry._id },
        {
            $set: {
                sourceId: paymentDoc._id,
                sourceModel: 'Payment',
                metadata: transactionEntry.metadata
            }
        }
    );
}

/**
 * When a journal already exists from a prior upload, try to create the missing Payment record.
 * @returns {{ status: 'linked'|'already_complete'|'not_applicable'|'failed', payment?: object, created?: boolean, error?: string }}
 */
async function tryBackfillPaymentForExistingJournal({
    existingTransactionId,
    existingId,
    extraMeta = {},
    residenceId,
    createdByUserId
}) {
    if (!existingTransactionId && !existingId) {
        return { status: 'not_applicable' };
    }

    const existingPayment = await Payment.findOne({
        $or: [
            { paymentId: `PAY-JRN-${existingTransactionId}` },
            { 'metadata.transactionId': existingTransactionId }
        ]
    }).lean();
    if (existingPayment) {
        return { status: 'already_complete', payment: existingPayment, created: false };
    }

    const isPaymentJournal =
        extraMeta.invoiceRowType === 'payment' &&
        (extraMeta.studentId || extraMeta.debtorId || extraMeta.customer);
    if (!isPaymentJournal || !createdByUserId) {
        return { status: 'not_applicable' };
    }

    try {
        const transactionEntry = existingId
            ? await TransactionEntry.findById(existingId)
            : await TransactionEntry.findOne({ transactionId: existingTransactionId });
        if (!transactionEntry) {
            return { status: 'failed', error: 'Existing journal not found' };
        }

        const meta = { ...(transactionEntry.metadata || {}), ...extraMeta };
        const { payment, created } = await createPaymentRecordForJournal({
            transactionEntry,
            residenceId: transactionEntry.residence || residenceId,
            createdByUserId,
            studentId: meta.studentId,
            debtorId: meta.debtorId,
            customer: meta.customer,
            accountCode: meta.accountCode,
            paymentType: meta.paymentType || 'rent',
            method: meta.method || 'Cash',
            paymentMonth: meta.paymentMonth,
            roomNumber: meta.roomNumber,
            adminFee: Number(meta.adminFee) || 0,
            rental: Number(meta.rental) || 0,
            systemInvoiceId: meta.systemInvoiceId || null
        });
        return { status: 'linked', payment, created };
    } catch (error) {
        return { status: 'failed', error: error.message };
    }
}

module.exports = {
    detectStudentPaymentFromEntries,
    createPaymentRecordForJournal,
    linkTransactionToPayment,
    tryBackfillPaymentForExistingJournal
};
