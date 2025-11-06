/**
 * Deletion Logging Examples
 * 
 * This file shows how to use the DeletionLogService in other controllers
 * to track deletions across the system.
 */

const DeletionLogService = require('../services/deletionLogService');

/**
 * EXAMPLE 1: Logging student deletion
 * 
 * In your student deletion controller:
 */
async function deleteStudentExample(studentId, userId) {
    // Get the student data before deletion
    const student = await Student.findById(studentId);
    
    // Create snapshot of deleted data
    const deletedDataSnapshot = student.toObject();
    
    // Delete the student (soft delete or hard delete)
    student.status = 'deleted';
    await student.save();
    // OR: await student.remove(); // for hard delete
    
    // Log the deletion
    await DeletionLogService.logDeletion({
        modelName: 'Student',
        documentId: studentId,
        deletedData: deletedDataSnapshot,
        deletedBy: userId,
        reason: 'Student record no longer needed',
        context: 'soft_delete', // or 'hard_delete'
        metadata: {
            studentEmail: student.email,
            studentName: `${student.firstName} ${student.lastName}`
        }
    });
}

/**
 * EXAMPLE 2: Logging transaction deletion
 * 
 * In your transaction deletion controller:
 */
async function deleteTransactionExample(transactionId, userId) {
    const transaction = await TransactionEntry.findById(transactionId);
    const deletedDataSnapshot = transaction.toObject();
    
    // Delete transaction
    transaction.status = 'deleted';
    await transaction.save();
    
    // Log the deletion
    await DeletionLogService.logDeletion({
        modelName: 'TransactionEntry',
        documentId: transactionId,
        deletedData: deletedDataSnapshot,
        deletedBy: userId,
        reason: 'Transaction error correction',
        context: 'soft_delete',
        metadata: {
            transactionId: transaction.transactionId,
            amount: transaction.totalDebit || transaction.totalCredit,
            date: transaction.date
        }
    });
}

/**
 * EXAMPLE 3: Logging payment deletion
 */
async function deletePaymentExample(paymentId, userId) {
    const payment = await Payment.findById(paymentId);
    const deletedDataSnapshot = payment.toObject();
    
    // Delete payment
    payment.status = 'deleted';
    await payment.save();
    
    // Log the deletion
    await DeletionLogService.logDeletion({
        modelName: 'Payment',
        documentId: paymentId,
        deletedData: deletedDataSnapshot,
        deletedBy: userId,
        reason: req.body.reason || null,
        context: 'soft_delete',
        metadata: {
            paymentId: payment.paymentId,
            amount: payment.amount,
            method: payment.method
        }
    });
}

/**
 * EXAMPLE 4: Using in a controller with error handling
 */
exports.deleteSomething = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        
        // Get the document
        const document = await SomeModel.findById(id);
        if (!document) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }
        
        // Create snapshot BEFORE deletion
        const deletedDataSnapshot = document.toObject();
        
        // Perform deletion
        document.status = 'deleted';
        await document.save();
        
        // Log deletion (non-blocking - don't fail if logging fails)
        try {
            await DeletionLogService.logDeletion({
                modelName: 'SomeModel',
                documentId: id,
                deletedData: deletedDataSnapshot,
                deletedBy: user._id,
                reason: req.body.reason || null,
                context: 'soft_delete',
                metadata: {
                    // Add any relevant metadata here
                }
            });
        } catch (logError) {
            console.error('Error logging deletion (non-critical):', logError);
            // Don't fail the deletion if logging fails
        }
        
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ success: false, message: 'Error deleting', error: error.message });
    }
};

module.exports = {
    deleteStudentExample,
    deleteTransactionExample,
    deletePaymentExample
};



