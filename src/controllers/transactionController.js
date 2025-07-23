const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const AuditLog = require('../models/AuditLog');

exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find the transaction and its entries before update
    const transaction = await Transaction.findById(id).lean();
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const beforeEntries = await TransactionEntry.find({ transaction: id }).lean();

    // Update the main transaction fields
    const updatedTransaction = await Transaction.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

    // Update each entry if provided
    if (Array.isArray(updateData.entries)) {
      for (const entry of updateData.entries) {
        if (entry._id) {
          await TransactionEntry.findByIdAndUpdate(entry._id, entry, { new: true, runValidators: true });
        }
      }
    }

    // Fetch after state for audit
    const afterEntries = await TransactionEntry.find({ transaction: id }).lean();

    // Audit log
    await AuditLog.create({
      user: req.user?._id,
      action: 'update',
      collection: 'Transaction',
      recordId: id,
      before: { transaction, entries: beforeEntries },
      after: { transaction: updatedTransaction, entries: afterEntries }
    });

    res.json({ message: 'Transaction and entries updated', transaction: updatedTransaction });
  } catch (error) {
    console.error('Error in updateTransaction:', error);
    res.status(500).json({ error: 'Failed to update transaction', details: error.message });
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findByIdAndDelete(id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    // Audit log
    await AuditLog.create({
      user: req.user?._id,
      action: 'delete',
      collection: 'Transaction',
      recordId: id,
      before: transaction,
      after: null
    });
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete transaction', details: error.message });
  }
}; 