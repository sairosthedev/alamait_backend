const MonthlyRequestDeductionService = require('../services/monthlyRequestDeductionService');
const { validationResult } = require('express-validator');

/**
 * Create a maintenance request from an approved monthly request
 */
exports.createMaintenanceRequestFromMonthly = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { monthlyRequestId, itemIndex, amount, description, week } = req.body;
        const user = req.user;

        console.log(`🔧 Admin creating maintenance request from monthly request ${monthlyRequestId}`);
        console.log(`   - Item index: ${itemIndex}`);
        console.log(`   - Amount: $${amount}`);
        console.log(`   - Week: ${week}`);
        console.log(`   - User: ${user.firstName} ${user.lastName}`);

        const result = await MonthlyRequestDeductionService.createMaintenanceRequestFromMonthly({
            monthlyRequestId,
            itemIndex,
            amount,
            description,
            user,
            week
        });

        res.status(201).json({
            success: true,
            message: 'Maintenance request created successfully from monthly request',
            data: {
                maintenanceRequest: result.maintenanceRequest,
                monthlyRequest: result.monthlyRequest,
                item: result.item,
                remainingAmount: result.remainingAmount,
                isFullyDeducted: result.isFullyDeducted
            }
        });

    } catch (error) {
        console.error('❌ Error creating maintenance request from monthly:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating maintenance request from monthly request',
            error: error.message
        });
    }
};

/**
 * Get deduction summary for a specific monthly request item
 */
exports.getDeductionSummary = async (req, res) => {
    try {
        const { monthlyRequestId, itemIndex } = req.params;

        const summary = await MonthlyRequestDeductionService.getDeductionSummary(
            monthlyRequestId, 
            parseInt(itemIndex)
        );

        res.status(200).json({
            success: true,
            message: 'Deduction summary retrieved successfully',
            data: summary
        });

    } catch (error) {
        console.error('❌ Error getting deduction summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting deduction summary',
            error: error.message
        });
    }
};

/**
 * Get all deductions for a monthly request
 */
exports.getAllDeductionsForRequest = async (req, res) => {
    try {
        const { monthlyRequestId } = req.params;

        const deductions = await MonthlyRequestDeductionService.getAllDeductionsForRequest(monthlyRequestId);

        res.status(200).json({
            success: true,
            message: 'All deductions retrieved successfully',
            data: deductions
        });

    } catch (error) {
        console.error('❌ Error getting all deductions for request:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting all deductions for request',
            error: error.message
        });
    }
};

/**
 * Get maintenance requests that need finance approval
 */
exports.getMaintenanceRequestsForFinance = async (req, res) => {
    try {
        const { residence, monthlyRequestId } = req.query;
        
        const filters = {};
        if (residence) filters.residence = residence;
        if (monthlyRequestId) filters.monthlyRequestId = monthlyRequestId;

        const maintenanceRequests = await MonthlyRequestDeductionService.getMaintenanceRequestsForFinance(filters);

        res.status(200).json({
            success: true,
            message: 'Maintenance requests for finance retrieved successfully',
            data: maintenanceRequests
        });

    } catch (error) {
        console.error('❌ Error getting maintenance requests for finance:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting maintenance requests for finance',
            error: error.message
        });
    }
};

/**
 * Get monthly request with deduction progress
 */
exports.getMonthlyRequestWithProgress = async (req, res) => {
    try {
        const { monthlyRequestId } = req.params;

        const deductions = await MonthlyRequestDeductionService.getAllDeductionsForRequest(monthlyRequestId);

        res.status(200).json({
            success: true,
            message: 'Monthly request with progress retrieved successfully',
            data: {
                monthlyRequest: deductions.monthlyRequest,
                deductionsByItem: deductions.deductionsByItem,
                totalRequestAmount: deductions.totalRequestAmount,
                totalDeductedAmount: deductions.totalDeductedAmount,
                overallProgress: deductions.overallProgress,
                progressSummary: {
                    totalItems: Object.keys(deductions.deductionsByItem).length,
                    fullyDeductedItems: Object.values(deductions.deductionsByItem).filter(d => d.isFullyDeducted).length,
                    partiallyDeductedItems: Object.values(deductions.deductionsByItem).filter(d => d.deductedAmount > 0 && !d.isFullyDeducted).length,
                    pendingItems: Object.values(deductions.deductionsByItem).filter(d => d.deductedAmount === 0).length
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting monthly request with progress:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting monthly request with progress',
            error: error.message
        });
    }
};

