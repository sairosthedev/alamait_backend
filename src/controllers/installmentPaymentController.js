const InstallmentPaymentService = require('../services/installmentPaymentService');
const { validationResult } = require('express-validator');

/**
 * Create an installment payment for a monthly request item
 * POST /api/installment-payments
 */
const createInstallmentPayment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { monthlyRequestId, itemIndex, amount, paymentMethod, notes } = req.body;
        const user = req.user;

        console.log(`💰 Creating installment payment for monthly request ${monthlyRequestId}, item ${itemIndex}`);

        const result = await InstallmentPaymentService.createInstallmentPayment({
            monthlyRequestId,
            itemIndex,
            amount,
            paymentMethod,
            user,
            notes
        });

        res.status(201).json({
            success: true,
            message: 'Installment payment created successfully',
            data: {
                installmentPayment: result.installmentPayment,
                expense: result.expense,
                transaction: result.transaction
            }
        });

    } catch (error) {
        console.error('❌ Error creating installment payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create installment payment',
            error: error.message
        });
    }
};

/**
 * Get installment payment summary for a monthly request item
 * GET /api/installment-payments/summary/:monthlyRequestId/:itemIndex
 */
const getInstallmentSummary = async (req, res) => {
    try {
        const { monthlyRequestId, itemIndex } = req.params;

        const summary = await InstallmentPaymentService.getInstallmentSummary(
            monthlyRequestId,
            parseInt(itemIndex)
        );

        res.status(200).json({
            success: true,
            message: 'Installment summary retrieved successfully',
            data: summary
        });

    } catch (error) {
        console.error('❌ Error getting installment summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get installment summary',
            error: error.message
        });
    }
};

/**
 * Get all installment payments for a monthly request
 * GET /api/installment-payments/request/:monthlyRequestId
 */
const getAllInstallmentsForRequest = async (req, res) => {
    try {
        const { monthlyRequestId } = req.params;

        const result = await InstallmentPaymentService.getAllInstallmentsForRequest(monthlyRequestId);

        res.status(200).json({
            success: true,
            message: 'Installment payments retrieved successfully',
            data: result
        });

    } catch (error) {
        console.error('❌ Error getting installment payments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get installment payments',
            error: error.message
        });
    }
};

/**
 * Get installment payment by ID
 * GET /api/installment-payments/:id
 */
const getInstallmentPaymentById = async (req, res) => {
    try {
        const { id } = req.params;
        const InstallmentPayment = require('../models/InstallmentPayment');

        const installmentPayment = await InstallmentPayment.findById(id)
            .populate('monthlyRequestId', 'title month year status')
            .populate('createdBy', 'firstName lastName email')
            .populate('paidBy', 'firstName lastName email')
            .populate('expenseId', 'expenseId amount description')
            .populate('transactionId', 'transactionId amount');

        if (!installmentPayment) {
            return res.status(404).json({
                success: false,
                message: 'Installment payment not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Installment payment retrieved successfully',
            data: installmentPayment
        });

    } catch (error) {
        console.error('❌ Error getting installment payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get installment payment',
            error: error.message
        });
    }
};

/**
 * Update installment payment status
 * PATCH /api/installment-payments/:id/status
 */
const updateInstallmentPaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const InstallmentPayment = require('../models/InstallmentPayment');

        const installmentPayment = await InstallmentPayment.findById(id);
        if (!installmentPayment) {
            return res.status(404).json({
                success: false,
                message: 'Installment payment not found'
            });
        }

        // Update status
        installmentPayment.status = status;
        if (notes) {
            installmentPayment.notes = notes;
        }

        await installmentPayment.save();

        res.status(200).json({
            success: true,
            message: 'Installment payment status updated successfully',
            data: installmentPayment
        });

    } catch (error) {
        console.error('❌ Error updating installment payment status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update installment payment status',
            error: error.message
        });
    }
};

/**
 * Delete installment payment (only if not paid)
 * DELETE /api/installment-payments/:id
 */
const deleteInstallmentPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const InstallmentPayment = require('../models/InstallmentPayment');

        const installmentPayment = await InstallmentPayment.findById(id);
        if (!installmentPayment) {
            return res.status(404).json({
                success: false,
                message: 'Installment payment not found'
            });
        }

        // Only allow deletion if not paid
        if (installmentPayment.status === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete paid installment payments'
            });
        }

        await InstallmentPayment.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Installment payment deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting installment payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete installment payment',
            error: error.message
        });
    }
};

module.exports = {
    createInstallmentPayment,
    getInstallmentSummary,
    getAllInstallmentsForRequest,
    getInstallmentPaymentById,
    updateInstallmentPaymentStatus,
    deleteInstallmentPayment
};

